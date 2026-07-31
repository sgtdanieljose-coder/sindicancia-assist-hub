import { rowToSindicancia } from "./sindicancias.mapper";

/** Localiza a sindicância na planilha e devolve o registro e o número da linha. */
export async function carregar(sindicanciaId: string) {
  const { readRows } = await import("./google.server");
  const rows = await readRows();
  const idx = rows.findIndex((r) => r[0] === sindicanciaId);
  if (idx < 0) throw new Error("Sindicância não localizada na planilha.");
  return { atual: rowToSindicancia(rows[idx]), linha: idx + 2 };
}
