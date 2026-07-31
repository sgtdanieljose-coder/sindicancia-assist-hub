import type { Juntada, Sindicancia } from "./pecas";

function safeParse<T>(v: string | undefined, fallback: T): T {
  if (!v) return fallback;
  try {
    return JSON.parse(v) as T;
  } catch {
    return fallback;
  }
}

function rowToSindicancia(row: string[]): Sindicancia {
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
    local: row[17] ?? "",
    subordinacao: row[18] ?? "",
    omInstauradora: row[19] ?? "",
    autosDocId: row[20] || undefined,
    autosUrl: row[21] || undefined,
    juntadas: safeParse<Juntada[]>(row[22], []),
  };
}

export function sindicanciaToRow(s: Sindicancia): string[] {
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
    s.local ?? "",
    s.subordinacao ?? "",
    s.omInstauradora ?? "",
    s.autosDocId ?? "",
    s.autosUrl ?? "",
    JSON.stringify(s.juntadas ?? []),
  ];
}

