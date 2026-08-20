import type { Sindicancia, VersaoPeca } from "./pecas";

/** Quantidade máxima de versões guardadas por peça (herdado do limite de caracteres por
 *  célula da antiga planilha — mantido para não deixar o histórico crescer sem limite). */
const MAX_VERSOES = 15;

/** Carrega a sindicância pelo id (Supabase). Etapa 2 da migração do banco: antes lia a
 *  planilha inteira e achava a linha pelo id; agora é 1 select direto pela chave primária,
 *  sem precisar devolver posição nenhuma (o antigo `linha`, usado só pra saber em qual linha
 *  regravar depois — ver `salvar` abaixo, que resolve isso com upsert por id). */
export async function carregar(sindicanciaId: string) {
  const { carregarSindicanciaDb } = await import("./supabase.server");
  const atual = await carregarSindicanciaDb(sindicanciaId);
  return { atual };
}

/** Grava a sindicância (Supabase, upsert por id) — substitui o antigo updateRow(linha, ...). */
export async function salvar(atual: Sindicancia): Promise<Sindicancia> {
  const { salvarSindicanciaDb } = await import("./supabase.server");
  return salvarSindicanciaDb(atual);
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
