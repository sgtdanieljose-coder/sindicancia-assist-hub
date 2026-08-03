import type { VersaoPeca } from "./pecas";
import { rowToSindicancia } from "./sindicancias.mapper";

/** Quantidade máxima de versões guardadas por peça (a planilha tem limite de caracteres por célula). */
const MAX_VERSOES = 15;

/** Localiza a sindicância na planilha e devolve o registro e o número da linha. */
export async function carregar(sindicanciaId: string) {
  const { readRows } = await import("./google.server");
  const rows = await readRows();
  const idx = rows.findIndex((r) => r[0] === sindicanciaId);
  if (idx < 0) throw new Error("Sindicância não localizada na planilha.");
  return { atual: rowToSindicancia(rows[idx]), linha: idx + 2 };
}

/**
 * Acrescenta o texto anterior ao histórico da peça, ignorando conteúdos vazios ou idênticos
 * ao novo texto. Mantém apenas as últimas MAX_VERSOES entradas (mais antiga primeiro).
 */
export function novaVersao(
  versoes: VersaoPeca[] | undefined,
  anterior: string,
  novo: string,
): VersaoPeca[] {
  const lista = versoes ?? [];
  if (!anterior.trim() || anterior.trim() === novo.trim()) return lista;
  if (lista[lista.length - 1]?.texto.trim() === anterior.trim()) return lista;
  return [
    ...lista,
    { id: `V-${Date.now()}`, texto: anterior, criadoEm: new Date().toISOString() },
  ].slice(-MAX_VERSOES);
}
