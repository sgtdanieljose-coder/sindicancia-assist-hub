import { createServerFn } from "@tanstack/react-start";
import type { DadoSindicado } from "./pecas";

// ---------------------------------------------------------------------------
// Etapa 3 da migração do banco (Sheets -> Supabase): migração ÚNICA dos dados que hoje
// existem na planilha. Só lê o Sheets (nunca grava nele) e grava no Supabase. Idempotente
// — pode rodar mais de uma vez sem duplicar nada, porque zera as duas tabelas do Supabase
// antes de reinserir tudo de novo a partir da planilha.
//
// Arquivo temporário: depois de confirmar que os dados migraram certinho (Etapa 4), este
// arquivo e a rota /migrar-supabase que o chama podem ser apagados — não fazem parte da
// operação normal do app.
// ---------------------------------------------------------------------------

export const migrarSheetsParaSupabase = createServerFn({ method: "POST" }).handler(async () => {
  const { readRows, readSindicadosRows } = await import("./google.server");
  const { rowToSindicancia } = await import("./sindicancias.mapper");
  const { limparTudoDb, salvarSindicanciaDb, salvarSindicadoDb } =
    await import("./supabase.server");

  const linhasSindicancias = (await readRows()).filter((row) => row[0]?.trim());
  const linhasSindicados = (await readSindicadosRows()).filter((row) => row[0]?.trim());

  // Zera as duas tabelas antes de reinserir — é isso que torna seguro rodar de novo.
  await limparTudoDb();

  const erros: string[] = [];

  let sindicanciasMigradas = 0;
  for (const row of linhasSindicancias) {
    try {
      await salvarSindicanciaDb(rowToSindicancia(row));
      sindicanciasMigradas++;
    } catch (e) {
      erros.push(`Sindicância ${row[0]} (NUP ${row[1] || "?"}): ${(e as Error).message}`);
    }
  }

  let sindicadosMigrados = 0;
  for (const row of linhasSindicados) {
    const sindicanciaId = row[0];
    try {
      const dado: DadoSindicado = {
        sindicanciaId,
        civil: (row[1] as DadoSindicado["civil"]) || "",
        idt: row[2] ?? "",
        cpf: row[3] ?? "",
        nascimento: row[4] ?? "",
        naturalidade: row[5] ?? "",
        estadoCivil: row[6] ?? "",
        filiacao: row[7] ?? "",
        mae: row[8] ?? "",
        enderecoCompleto: row[9] ?? "",
        // row[10] era "cep" na planilha — não existe mais como campo próprio.
        companhia: row[11] ?? "",
        vocativo: row[12] ?? "",
      };
      await salvarSindicadoDb(dado);
      sindicadosMigrados++;
    } catch (e) {
      erros.push(`Sindicado da sindicância ${sindicanciaId}: ${(e as Error).message}`);
    }
  }

  return {
    sindicanciasEncontradas: linhasSindicancias.length,
    sindicanciasMigradas,
    sindicadosEncontrados: linhasSindicados.length,
    sindicadosMigrados,
    erros,
  };
});
