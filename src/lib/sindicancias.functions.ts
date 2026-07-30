import { createServerFn } from "@tanstack/react-start";
import type { Sindicancia } from "./pecas";

function rowToSindicancia(row: string[]): Sindicancia {
  const safeParse = <T,>(v: string | undefined, fallback: T): T => {
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
    const { readRows, appendRow, updateRow } = await import("./google.server");
    const registro: Sindicancia = { ...data, id: data.id || `SIND-${Date.now()}` };
    const rows = await readRows();
    const idx = rows.findIndex((r) => r[0] === registro.id);
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
    const doc = await createDoc(data.titulo, data.conteudo);

    if (data.sindicanciaId) {
      try {
        const rows = await readRows();
        const idx = rows.findIndex((r) => r[0] === data.sindicanciaId);
        if (idx >= 0) {
          const atual = rowToSindicancia(rows[idx]);
          atual.documentos = [
            ...atual.documentos,
            { titulo: data.titulo, documentId: doc.documentId, url: doc.url },
          ];
          await updateRow(idx + 2, sindicanciaToRow(atual));
        }
      } catch (e) {
        console.warn("Falha ao registrar documento na planilha:", e);
      }
    }

    return doc;
  });
