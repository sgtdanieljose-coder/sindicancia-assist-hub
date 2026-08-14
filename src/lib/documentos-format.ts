import { PECAS, type Sindicancia } from "./pecas";

export type DocumentoItem = Sindicancia["documentos"][number];

/** Nome de exibição do tipo de um item dos autos — a peça do catálogo, ou "Juntada". */
export function tipoDoItem(d: DocumentoItem): string {
  if (d.pecaId?.startsWith("juntada-")) return "Juntada";
  const base = d.pecaId ? PECAS.find((p) => p.id === d.pecaId) : undefined;
  return base?.nome ?? "Peça avulsa";
}

export function formatarDataHora(iso?: string): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("pt-BR");
  } catch {
    return "—";
  }
}
