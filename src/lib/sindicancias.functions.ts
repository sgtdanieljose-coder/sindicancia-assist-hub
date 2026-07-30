import { createServerFn } from "@tanstack/react-start";
import type { Sindicancia } from "./pecas";

function rowToSindicancia(row: string[]): Sindicancia {
  const safeParse = <T>(v: string | undefined, fallback: T): T => {
    if (!v) return fallback;
    try {
      return JSON.parse(v) as T;
    } catch {
      return fallback;
    }
  };
  return {
    id: row[0] ?? "",
    nup: row[1] ?? "",
    portariaNumero: row[2] ?? "",
    portariaData: row[3] ?? "",
    om: row[4] ?? "",
    autoridade: row[5] ?? "",
    sindicante: row[6] ?? "",
    sindicado: row[7] ?? "",
    objeto: row[8] ?? "",
    status: row[9] ?? "Em instrução",
    etapas: safeParse<string[]>(row[10], []),
    documentos: safeParse<Sindicancia["documentos"]>(row[11], []),
    atualizadoEm: row[12] ?? "",
    pastaId: row[13] || undefined,
    pastaUrl: row[14] || undefined,
    anexosId: row[15] || undefined,
    anexosUrl: row[16] || undefined,
  };
}

function sindicanciaToRow(s: Sindicancia): string[] {
  return [
    s.id,
    s.nup,
    s.portariaNumero,
    s.portariaData,
    s.om,
    s.autoridade,
    s.sindicante,
    s.sindicado,
    s.objeto,
    s.status,
    JSON.stringify(s.etapas ?? []),
    JSON.stringify(s.documentos ?? []),
    new Date().toISOString(),
    s.pastaId ?? "",
    s.pastaUrl ?? "",
    s.anexosId ?? "",
    s.anexosUrl ?? "",
  ];
}

export const listarSindicancias = createServerFn({ method: "GET" }).handler(async () => {
  const { readRows } = await import("./google.server");
  try {
    const rows = await readRows();
    return { itens: rows.map(rowToSindicancia), erro: null as string | null };
  } catch (e) {
    return { itens: [] as Sindicancia[], erro: (e as Error).message };
  }
});

export const salvarSindicancia = createServerFn({ method: "POST" })
  .inputValidator((data: Sindicancia) => data)
  .handler(async ({ data }) => {
    const { readRows, appendRow, updateRow, ensureSindicanciaFolders } =
      await import("./google.server");
    const registro: Sindicancia = { ...data, id: data.id || `SIND-${Date.now()}` };
    const rows = await readRows();
    const idx = rows.findIndex((r) => r[0] === registro.id);

    // Cria a pasta da sindicância (nome = NUP) com a subpasta "Anexos" no Drive.
    // Roda tanto em cadastros novos quanto em registros antigos que ainda não têm pasta.
    if (registro.nup?.trim() && !registro.pastaId) {
      try {
        const pastas = await ensureSindicanciaFolders(registro.nup);
        registro.pastaId = pastas.pastaId;
        registro.pastaUrl = pastas.pastaUrl;
        registro.anexosId = pastas.anexosId;
        registro.anexosUrl = pastas.anexosUrl;
      } catch (e) {
        console.warn("Não foi possível criar a pasta da sindicância no Drive:", e);
      }
    }

    const row = sindicanciaToRow(registro);
    if (idx >= 0) {
      await updateRow(idx + 2, row);
    } else {
      await appendRow(row);
    }
    return rowToSindicancia(row);
  });

export const exportarParaDocs = createServerFn({ method: "POST" })
  .inputValidator((data: { sindicanciaId: string; titulo: string; conteudo: string }) => data)
  .handler(async ({ data }) => {
    const { createDoc, readRows, updateRow } = await import("./google.server");

    // Localiza a sindicância primeiro para poder exportar a peça direto na pasta dela no Drive.
    let atual: Sindicancia | null = null;
    let idx = -1;
    if (data.sindicanciaId) {
      try {
        const rows = await readRows();
        idx = rows.findIndex((r) => r[0] === data.sindicanciaId);
        if (idx >= 0) atual = rowToSindicancia(rows[idx]);
      } catch (e) {
        console.warn("Falha ao localizar a sindicância antes de exportar o documento:", e);
      }
    }

    const doc = await createDoc(data.titulo, data.conteudo, atual?.pastaId);

    if (atual) {
      try {
        atual.documentos = [
          ...atual.documentos,
          { titulo: data.titulo, documentId: doc.documentId, url: doc.url },
        ];
        await updateRow(idx + 2, sindicanciaToRow(atual));
      } catch (e) {
        console.warn("Falha ao registrar documento na planilha:", e);
      }
    }

    return doc;
  });
