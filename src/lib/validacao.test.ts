import { describe, expect, it } from "vitest";
import { validarAutos } from "./validacao";
import type { Sindicancia } from "./pecas";

function base(): Sindicancia {
  return {
    id: "SND-1",
    nup: "64070.000001/2026-11",
    portariaNumero: "01/2026",
    portariaData: "2026-01-10",
    om: "1º BIS",
    autoridade: "Comandante",
    sindicante: "Cap Fulano",
    sindicado: "Sd Beltrano",
    objeto: "Apuração de fato X",
    status: "Em instrução",
    etapas: [],
    documentos: [],
    atualizadoEm: "2026-01-10T10:00:00.000Z",
    local: "Quartel",
    localTrabalhos: "Sala 1",
    subordinacao: "Comando X",
    omInstauradora: "1º BIS",
    juntadas: [],
    tags: [],
  };
}

const PECAS_OBRIGATORIAS_IDS = [
  "autos",
  "abertura",
  "despacho-inicial",
  "notificacao",
  "depoimento",
  "encerramento",
  "alegacoes",
];

function comTodasPecasObrigatorias(s: Sindicancia): Sindicancia {
  return {
    ...s,
    documentos: PECAS_OBRIGATORIAS_IDS.map((id, i) => ({
      titulo: id,
      documentId: `DOC-${i}`,
      url: `https://example.com/${i}`,
      pecaId: id,
      status: "concluida" as const,
    })),
  };
}

describe("validarAutos", () => {
  it("aprova uma sindicância completa sem apontar nenhuma pendência", () => {
    const s = comTodasPecasObrigatorias(base());
    const itens = validarAutos(s);
    expect(itens.every((i) => i.ok)).toBe(true);
  });

  it("aponta NUP em branco", () => {
    const s = base();
    s.nup = "";
    const itens = validarAutos(s);
    expect(itens.find((i) => i.titulo === "NUP preenchido")?.ok).toBe(false);
  });

  it("aponta peças obrigatórias ainda não lançadas", () => {
    const itens = validarAutos(base());
    const faltantes = itens.filter((i) => !i.ok && i.detalhe?.includes("obrigatória"));
    expect(faltantes.length).toBe(PECAS_OBRIGATORIAS_IDS.length);
  });

  it("aponta peça lançada mas ainda em elaboração", () => {
    const s = comTodasPecasObrigatorias(base());
    s.documentos[0] = { ...s.documentos[0], status: "em-elaboracao" };
    const itens = validarAutos(s);
    expect(itens.some((i) => !i.ok && i.detalhe?.includes("elaboração"))).toBe(true);
  });

  it("aponta juntada sem nenhum anexo", () => {
    const s = comTodasPecasObrigatorias(base());
    s.juntadas = [{ id: "J1", numero: 1, titulo: "Juntada nº 1", data: "2026-01-10", anexos: [] }];
    const itens = validarAutos(s);
    expect(itens.some((i) => !i.ok && i.titulo.includes("Juntada nº 1"))).toBe(true);
  });

  it("não reclama de juntada com pelo menos um anexo", () => {
    const s = comTodasPecasObrigatorias(base());
    s.juntadas = [
      {
        id: "J1",
        numero: 1,
        titulo: "Juntada nº 1",
        data: "2026-01-10",
        anexos: [{ id: "A1", descricao: "doc.pdf", fileId: "F1", url: "https://x" }],
      },
    ];
    const itens = validarAutos(s);
    expect(itens.some((i) => !i.ok && i.titulo.includes("Juntada nº 1"))).toBe(false);
  });

  it("aponta numeração de juntadas fora de sequência", () => {
    const s = comTodasPecasObrigatorias(base());
    s.juntadas = [
      { id: "J1", numero: 1, titulo: "J1", data: "2026-01-10", anexos: [] },
      { id: "J2", numero: 3, titulo: "J2", data: "2026-01-11", anexos: [] },
    ];
    const itens = validarAutos(s);
    expect(itens.find((i) => i.titulo.includes("Numeração"))?.ok).toBe(false);
  });
});
