import { describe, expect, it } from "vitest";
import {
  PECAS,
  gerarPeca,
  gerarRelatorio,
  gerarTextoJuntada,
  cabecalho,
  type Juntada,
  type PecaCampos,
  type PecaId,
  type Sindicancia,
} from "./pecas";

/**
 * Contrato doutrinário (EB10-IG-01.001 / Portaria C Ex nº 2.394/2024) verificado aqui:
 *  1) Cabeçalho institucional obrigatório ("MINISTÉRIO DA DEFESA" / "EXÉRCITO BRASILEIRO"
 *     + subordinação) no topo de TODA peça — o brasão é inserido como imagem acima dele.
 *  2) 4 linhas em branco entre o cabeçalho e o título da peça.
 *  3) Título da peça em CAIXA ALTA, em linha própria, idêntico ao registrado em
 *     TITULOS_PECA (src/lib/google.server.ts) — sem o casamento exato, a formatação
 *     automática (negrito/sublinhado/centralização) não é aplicada no Google Docs.
 *  4) Assinatura ao final: nome do sindicante em caixa alta e "Sindicante" como as duas
 *     últimas linhas não vazias (exceto na capa dos Autos, que não é assinada).
 *  5) Nenhum vazamento de "undefined"/"null"/"NaN" no texto; campos ausentes viram
 *     lacunas/placeholders legíveis.
 */

/** Espelho do TITULOS_PECA de google.server.ts (o título deve bater literalmente). */
const TITULOS_PECA: Record<PecaId, string> = {
  autos: "AUTOS DE SINDICÂNCIA",
  abertura: "TERMO DE ABERTURA",
  "despacho-inicial": "DESPACHO",
  "despacho-diversos": "DESPACHO",
  notificacao: "NOTIFICAÇÃO PRÉVIA DO SINDICADO",
  inquiricao: "TERMO DE INQUIRIÇÃO DE TESTEMUNHA",
  depoimento: "TERMO DE DECLARAÇÕES DO SINDICADO",
  oficio: "OFÍCIO",
  encerramento: "TERMO DE ENCERRAMENTO DA INSTRUÇÃO",
  alegacoes: "NOTIFICAÇÃO PARA APRESENTAÇÃO DE ALEGAÇÕES FINAIS",
  prorrogacao: "PEDIDO DE PRORROGAÇÃO DE PRAZO",
};

const SINDICANCIA: Sindicancia = {
  id: "s1",
  nup: "64444.000123/2026-11",
  portariaNumero: "015",
  portariaData: "2026-03-10",
  om: "63º Batalhão de Infantaria",
  autoridade: "Cel Inf SILVA",
  sindicante: "1º Ten Inf PEREIRA",
  sindicado: "Sd MARQUES",
  objeto: "apurar o extravio de material de carga",
  status: "Em instrução",
  etapas: [],
  documentos: [],
  atualizadoEm: "2026-03-11T10:00:00.000Z",
  local: "Florianópolis-SC",
  localTrabalhos: "Sala da Sindicância do 63º BI",
  subordinacao: "14ª Brigada de Infantaria Motorizada",
  omInstauradora: "63º Batalhão de Infantaria",
  juntadas: [],
  tags: [],
};

const SINDICANCIA_VAZIA: Sindicancia = {
  ...SINDICANCIA,
  nup: "",
  portariaNumero: "",
  portariaData: "",
  om: "",
  autoridade: "",
  sindicante: "",
  sindicado: "",
  objeto: "",
  local: "",
  localTrabalhos: "",
  subordinacao: "",
  omInstauradora: "",
};

const CAMPOS: PecaCampos = {
  local: "Florianópolis-SC",
  data: "2026-03-12",
  hora: "14:30",
  destinatario: "Sgt ALMEIDA",
  qualificacao: "Sargento do 63º BI",
  documentos: "Cópia da guia de material",
  perguntas: "1) Onde estava no dia dos fatos?",
  respostas: "1) No quartel.",
  justificativa: "necessidade de oitiva de testemunha residente em outra guarnição",
  prazoDias: "5",
  numeroOficio: "3",
};

const CAMPOS_VAZIOS: PecaCampos = {
  local: "",
  data: "",
  hora: "",
  destinatario: "",
  qualificacao: "",
  documentos: "",
  perguntas: "",
  respostas: "",
  justificativa: "",
  prazoDias: "",
  numeroOficio: "",
};

const linhas = (t: string) => t.split("\n");
const naoVazias = (t: string) => linhas(t).filter((l) => l.trim() !== "");

/** Índice da linha do título; garante que ele exista sozinho na própria linha. */
function indiceTitulo(texto: string, titulo: string) {
  return linhas(texto).findIndex((l) => l.trim() === titulo);
}

const ids = PECAS.map((p) => p.id);

describe("gerarPeca — padrão EB10-IG-01.001", () => {
  it("cobre todas as peças cadastradas em PECAS", () => {
    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids) expect(TITULOS_PECA[id]).toBeTruthy();
  });

  it.each(ids)("%s: cabeçalho institucional no topo", (id) => {
    const texto = gerarPeca(id, SINDICANCIA, CAMPOS);
    const primeiras = naoVazias(texto).slice(0, 3);
    expect(primeiras[0]).toBe("MINISTÉRIO DA DEFESA");
    expect(primeiras[1]).toBe("EXÉRCITO BRASILEIRO");
    expect(primeiras[2]).toBe(SINDICANCIA.subordinacao);
  });

  it.each(ids)("%s: título literal em caixa alta, em linha própria", (id) => {
    const texto = gerarPeca(id, SINDICANCIA, CAMPOS);
    const titulo = TITULOS_PECA[id];
    const i = indiceTitulo(texto, titulo);
    expect(i, `título "${titulo}" não encontrado em linha própria`).toBeGreaterThan(0);
    expect(titulo).toBe(titulo.toUpperCase());
  });

  // Peças que trazem o subcabeçalho do processo (NUP + portaria + filete) entre o
  // cabeçalho institucional e o título; as demais usam o espaçamento padrão de 4 linhas.
  const COM_SUBCABECALHO: PecaId[] = [
    "notificacao",
    "inquiricao",
    "depoimento",
    "oficio",
    "encerramento",
    "alegacoes",
    "prorrogacao",
  ];

  it.each(ids.filter((id) => !COM_SUBCABECALHO.includes(id)))(
    "%s: 4 linhas em branco entre cabeçalho e título",
    (id) => {
      const texto = gerarPeca(id, SINDICANCIA, CAMPOS);
      const ls = linhas(texto);
      const i = indiceTitulo(texto, TITULOS_PECA[id]);
      const brancos = ls.slice(0, i).reverse();
      let n = 0;
      while (brancos[n] !== undefined && brancos[n].trim() === "") n++;
      expect(n).toBe(4);
    },
  );

  it.each(COM_SUBCABECALHO)("%s: subcabeçalho com NUP e portaria antes do título", (id) => {
    const texto = gerarPeca(id, SINDICANCIA, CAMPOS);
    const ls = linhas(texto);
    const i = indiceTitulo(texto, TITULOS_PECA[id]);
    const antes = ls.slice(0, i).join("\n");
    expect(antes).toContain(`SINDICÂNCIA — NUP/NUD ${SINDICANCIA.nup}`);
    expect(antes).toContain(`Portaria nr ${SINDICANCIA.portariaNumero}`);
    expect(antes).toMatch(/_{10,}/); // filete separador
    expect(ls[i - 1]?.trim()).toBe(""); // linha em branco imediatamente antes do título
  });


  it.each(ids.filter((id) => id !== "autos"))("%s: assinatura do sindicante ao final", (id) => {
    const texto = gerarPeca(id, SINDICANCIA, CAMPOS);
    const ls = naoVazias(texto);
    expect(ls.at(-1)).toBe("Sindicante");
    expect(ls.at(-2)).toBe(SINDICANCIA.sindicante.toUpperCase());
  });

  it("capa dos Autos não é assinada e traz os dados essenciais do processo", () => {
    const texto = gerarPeca("autos", SINDICANCIA, CAMPOS);
    expect(texto).not.toContain("Sindicante\n");
    expect(texto).toContain(`NUP: ${SINDICANCIA.nup}`);
    expect(texto).toContain(`SINDICANTE: ${SINDICANCIA.sindicante}`);
    expect(texto).toContain(`SINDICADO: ${SINDICANCIA.sindicado}`);
    expect(texto).toContain(`OBJETO: ${SINDICANCIA.objeto}`);
  });

  it.each(ids)("%s: não vaza undefined/null/NaN nem com dados completos", (id) => {
    const texto = gerarPeca(id, SINDICANCIA, CAMPOS);
    expect(texto).not.toMatch(/undefined|null|NaN|\[object Object\]/);
  });

  it.each(ids)("%s: com base vazia gera lacunas em vez de valores inválidos", (id) => {
    const texto = gerarPeca(id, SINDICANCIA_VAZIA, CAMPOS_VAZIOS);
    expect(texto).not.toMatch(/undefined|null|NaN|\[object Object\]/);
    expect(texto.trim().length).toBeGreaterThan(0);
    expect(indiceTitulo(texto, TITULOS_PECA[id])).toBeGreaterThan(0);
  });

  it("termo de abertura cita portaria, autoridade, OM instauradora e data por extenso", () => {
    const texto = gerarPeca("abertura", SINDICANCIA, CAMPOS);
    expect(texto).toContain(`Portaria nº ${SINDICANCIA.portariaNumero}`);
    expect(texto).toContain(SINDICANCIA.autoridade);
    expect(texto).toContain(SINDICANCIA.omInstauradora);
    expect(texto).toMatch(/Aos .+ dias do mês de março de/);
  });

  it("oitivas usam o local dos trabalhos quando o campo local não é informado", () => {
    for (const id of ["inquiricao", "depoimento"] as const) {
      const texto = gerarPeca(id, SINDICANCIA, { ...CAMPOS, local: "" });
      expect(texto).toContain(SINDICANCIA.localTrabalhos);
    }
  });

  it("cabecalho respeita subordinação com múltiplas linhas", () => {
    const head = cabecalho({ ...SINDICANCIA, subordinacao: "COMANDO MILITAR DO SUL\n5ª DE" });
    expect(naoVazias(head)).toEqual([
      "MINISTÉRIO DA DEFESA",
      "EXÉRCITO BRASILEIRO",
      "COMANDO MILITAR DO SUL",
      "5ª DE",
    ]);
  });
});

describe("gerarTextoJuntada", () => {
  const juntada: Juntada = {
    numero: 2,
    data: "2026-03-15",
    anexos: [
      { descricao: "Cópia da guia de material" },
      { descricao: "Fotografia do depósito" },
    ] as Juntada["anexos"],
  } as Juntada;

  it("segue a mesma convenção de cabeçalho, título e assinatura", () => {
    const texto = gerarTextoJuntada(SINDICANCIA, juntada);
    const ls = naoVazias(texto);
    expect(ls[0]).toBe("MINISTÉRIO DA DEFESA");
    expect(indiceTitulo(texto, "JUNTADA Nº 2")).toBeGreaterThan(0);
    expect(ls.at(-1)).toBe("Sindicante");
    expect(ls.at(-2)).toBe(SINDICANCIA.sindicante.toUpperCase());
    expect(texto).toContain("1. Cópia da guia de material");
    expect(texto).toContain("2. Fotografia do depósito");
    expect(texto).not.toMatch(/undefined|null|NaN/);
  });

  it("sem anexos informa a ausência em vez de deixar o rol vazio", () => {
    const texto = gerarTextoJuntada(SINDICANCIA, { ...juntada, anexos: [] });
    expect(texto).toContain("(nenhum item juntado até o momento)");
  });
});

describe("gerarRelatorio", () => {
  const vazio = { introducao: "", diligencias: "", analise: "", conclusao: "" };

  it("mantém as 4 partes obrigatórias, na ordem, e a assinatura", () => {
    const texto = gerarRelatorio(SINDICANCIA, vazio, "Florianópolis-SC", "2026-04-05");
    const ls = linhas(texto);
    const pos = [
      "RELATÓRIO DO SINDICANTE",
      "1. INTRODUÇÃO",
      "2. DILIGÊNCIAS REALIZADAS",
      "3. ANÁLISE DOS FATOS",
      "4. CONCLUSÃO",
    ].map((t) => ls.findIndex((l) => l.trim() === t));
    expect(pos.every((p) => p >= 0)).toBe(true);
    expect([...pos].sort((a, b) => a - b)).toEqual(pos);
    const nv = naoVazias(texto);
    expect(nv.at(-1)).toBe("Sindicante");
    expect(nv.at(-2)).toBe(SINDICANCIA.sindicante.toUpperCase());
  });

  it("preserva o texto redigido pelo encarregado em cada parte", () => {
    const texto = gerarRelatorio(
      SINDICANCIA,
      {
        introducao: "INTRO-X",
        diligencias: "DILIG-X",
        analise: "ANALISE-X",
        conclusao: "CONCLUSAO-X",
      },
      "Florianópolis-SC",
      "2026-04-05",
    );
    for (const t of ["INTRO-X", "DILIG-X", "ANALISE-X", "CONCLUSAO-X"]) {
      expect(texto).toContain(t);
    }
    expect(texto).not.toMatch(/undefined|null|NaN/);
  });
});
