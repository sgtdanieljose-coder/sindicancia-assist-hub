import { PECAS, STATUS_PECA_LABEL, type PecaId, type Sindicancia } from "./pecas";

export type ItemValidacao = {
  /** Rótulo curto do item — nome do campo, da peça ou da juntada em questão. */
  titulo: string;
  ok: boolean;
  /** Só presente quando ok === false — explica o que falta corrigir. */
  detalhe?: string;
  /** Quando presente, o painel de validação oferece um link direto pra corrigir este item —
   *  ver PainelValidacao.tsx. */
  corrigirEm?: { to: "/pecas"; search: { peca: PecaId | "juntada" } };
};

/**
 * Confere o estado da sindicância e devolve uma lista de itens ✓/⚠ — Prioridade 6 da
 * evolução do sistema. Deliberadamente uma função pura, sem nenhuma chamada ao Google: os
 * dados já estão carregados em memória (o objeto Sindicancia vindo do contexto), então
 * "Validar Autos" é instantâneo e não custa nenhuma requisição.
 *
 * Não inclui o estado de sincronização (isso é sessão do navegador, não faz parte do dado
 * da sindicância em si) — quem chama esta função pode complementar a lista com itens de
 * sincronização a partir da fila (ver useSyncQueue), como faz PainelValidacao.tsx.
 */
export function validarAutos(s: Sindicancia): ItemValidacao[] {
  const itens: ItemValidacao[] = [];

  itens.push({ titulo: "NUP preenchido", ok: Boolean(s.nup?.trim()) });
  itens.push({
    titulo: "Portaria preenchida",
    ok: Boolean(s.portariaNumero?.trim() && s.portariaData?.trim()),
  });
  itens.push({ titulo: "Sindicante definido", ok: Boolean(s.sindicante?.trim()) });
  itens.push({ titulo: "Sindicado definido", ok: Boolean(s.sindicado?.trim()) });

  // Peças obrigatórias (catálogo "única") ainda não lançadas nos autos.
  const faltando = PECAS.filter((p) => p.unica && !s.documentos.some((d) => d.pecaId === p.id));
  if (faltando.length === 0) {
    itens.push({ titulo: "Peças obrigatórias lançadas nos autos", ok: true });
  } else {
    for (const p of faltando) {
      itens.push({
        titulo: p.nome,
        ok: false,
        detalhe: "peça obrigatória ainda não lançada nos autos",
        corrigirEm: { to: "/pecas", search: { peca: p.id } },
      });
    }
  }

  // Peças já lançadas, mas ainda não concluídas (rascunho, revisão, ou marcadas como não
  // iniciadas apesar de já existirem — ver Prioridade 2.3).
  for (const d of s.documentos) {
    const status = d.status ?? "concluida";
    if (status === "em-elaboracao" || status === "em-revisao" || status === "nao-iniciada") {
      const pecaValida = d.pecaId ? PECAS.find((p) => p.id === d.pecaId) : undefined;
      itens.push({
        titulo: d.titulo,
        ok: false,
        detalhe: `ainda ${STATUS_PECA_LABEL[status].toLowerCase()}`,
        corrigirEm: d.pecaId?.startsWith("juntada-")
          ? { to: "/pecas", search: { peca: "juntada" } }
          : pecaValida
            ? { to: "/pecas", search: { peca: pecaValida.id } }
            : undefined,
      });
    }
    if (status === "cancelada") {
      itens.push({
        titulo: d.titulo,
        ok: false,
        detalhe:
          "está marcada como cancelada — remova da numeração ou substitua antes de finalizar",
      });
    }
  }

  // Juntadas sem nenhum anexo.
  const juntadas = s.juntadas ?? [];
  const semAnexo = juntadas.filter((j) => j.anexos.length === 0);
  if (juntadas.length > 0 && semAnexo.length === 0) {
    itens.push({ titulo: "Juntadas com documentos anexados", ok: true });
  }
  for (const j of semAnexo) {
    itens.push({
      titulo: `Juntada nº ${j.numero} — ${j.titulo}`,
      ok: false,
      detalhe: "sem nenhum documento anexado",
      corrigirEm: { to: "/pecas", search: { peca: "juntada" } },
    });
  }

  // Anexos que ficaram sem fileId/url (upload que não completou direito).
  const anexosQuebrados = juntadas.flatMap((j) =>
    j.anexos.filter((a) => !a.fileId || !a.url).map((a) => ({ juntada: j, anexo: a })),
  );
  for (const { juntada, anexo } of anexosQuebrados) {
    itens.push({
      titulo: `Anexo "${anexo.descricao}" (Juntada nº ${juntada.numero})`,
      ok: false,
      detalhe: "não tem arquivo vinculado no Drive — reenvie",
    });
  }

  // Numeração das juntadas — sequencial, sem lacunas nem repetição.
  if (juntadas.length > 0) {
    const numeros = [...juntadas.map((j) => j.numero)].sort((a, b) => a - b);
    const esperados = numeros.map((_, i) => i + 1);
    const sequencial = numeros.every((n, i) => n === esperados[i]);
    itens.push({
      titulo: "Numeração das juntadas sequencial",
      ok: sequencial,
      detalhe: sequencial ? undefined : `numeração atual: ${numeros.join(", ")}`,
    });
  }

  return itens;
}
