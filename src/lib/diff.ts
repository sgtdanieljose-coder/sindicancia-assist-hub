/**
 * Diff simples por linha (parágrafo), usado para comparar duas versões de uma peça —
 * Prioridade 3.3 da evolução do sistema ("versão atual × versão anterior, com destaque das
 * alterações. Não alterar a versão original.").
 *
 * Deliberadamente por linha, e não por palavra: textos de peças processuais são
 * estruturados em parágrafos, então um diff por linha já mostra claramente o que mudou, com
 * um custo computacional muito menor que um diff por palavra em textos longos (dezenas de
 * linhas, em vez de milhares de palavras).
 *
 * Implementação: LCS (subsequência comum mais longa) clássica via programação dinâmica —
 * suficiente para o tamanho normal de uma peça; não precisa de dependência externa.
 */

export type LinhaDiff = {
  tipo: "igual" | "removida" | "adicionada";
  texto: string;
};

export function diffLinhas(anterior: string, atual: string): LinhaDiff[] {
  const a = anterior.split("\n");
  const b = atual.split("\n");
  const n = a.length;
  const m = b.length;

  // Guarda de segurança: para textos anormalmente grandes (ex.: colagem de um documento
  // inteiro em uma peça), a tabela de programação dinâmica O(n*m) fica cara demais — nesse
  // caso, cai para um diff grosseiro (tudo removido/tudo adicionado) em vez de travar a UI.
  if (n * m > 4_000_000) {
    const resultado: LinhaDiff[] = [];
    for (const linha of a) resultado.push({ tipo: "removida", texto: linha });
    for (const linha of b) resultado.push({ tipo: "adicionada", texto: linha });
    return resultado;
  }

  // dp[i][j] = tamanho da LCS entre a[i..] e b[j..]
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const resultado: LinhaDiff[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      resultado.push({ tipo: "igual", texto: a[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      resultado.push({ tipo: "removida", texto: a[i] });
      i++;
    } else {
      resultado.push({ tipo: "adicionada", texto: b[j] });
      j++;
    }
  }
  while (i < n) {
    resultado.push({ tipo: "removida", texto: a[i] });
    i++;
  }
  while (j < m) {
    resultado.push({ tipo: "adicionada", texto: b[j] });
    j++;
  }
  return resultado;
}

/** Resumo curto ("+3/-1 linhas", "sem alterações") — usado nas linhas do histórico sem
 *  precisar renderizar o diff inteiro. */
export function resumoDiff(anterior: string, atual: string): string {
  if (anterior === atual) return "sem alterações de texto";
  const linhas = diffLinhas(anterior, atual);
  const add = linhas.filter((l) => l.tipo === "adicionada").length;
  const rem = linhas.filter((l) => l.tipo === "removida").length;
  const partes: string[] = [];
  if (add) partes.push(`+${add}`);
  if (rem) partes.push(`-${rem}`);
  return partes.length ? `${partes.join("/")} linha${add + rem > 1 ? "s" : ""}` : "alteração menor";
}
