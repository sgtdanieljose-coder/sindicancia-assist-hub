export type AnexoJuntada = {
  nome: string;
  fileId: string;
  url: string;
};

export type Juntada = {
  id: string;
  numero: number;
  titulo: string;
  data: string;
  anexos: AnexoJuntada[];
};

export type Sindicancia = {
  id: string;
  nup: string;
  portariaNumero: string;
  portariaData: string;
  om: string;
  autoridade: string;
  sindicante: string;
  sindicado: string;
  objeto: string;
  status: string;
  etapas: string[];
  documentos: { titulo: string; documentId: string; url: string; pecaId?: string }[];
  atualizadoEm: string;
  /** Pasta da sindicância no Drive (nome = NUP), criada automaticamente ao salvar. */
  pastaId?: string;
  pastaUrl?: string;
  /** Subpasta "Anexos" dentro da pasta da sindicância. */
  anexosId?: string;
  anexosUrl?: string;
  /** Cidade/localidade em que os atos são lavrados. */
  local: string;
  /** Subordinação da OM (ex.: "12ª Brigada de Infantaria Leve"). */
  subordinacao: string;
  /** OM instauradora (comando que expediu a portaria). */
  omInstauradora: string;
  /** Documento único (autos paginados) no Google Docs. */
  autosDocId?: string;
  autosUrl?: string;
  /** Juntadas do processo, cada uma com seus anexos vinculados ao NUP. */
  juntadas: Juntada[];
  /** Dias adicionais concedidos por prorrogação (somados aos 30 dias corridos regulamentares). */
  prazoProrrogadoDias?: number;
};

export const PRAZO_BASE_DIAS = 30;
export const PRAZO_ALERTA_ANTECEDENCIA_DIAS = 10;

/** Prazo total (dias corridos), somando eventual prorrogação já registrada. */
export function prazoTotalDias(s: Pick<Sindicancia, "prazoProrrogadoDias">): number {
  return PRAZO_BASE_DIAS + (s.prazoProrrogadoDias || 0);
}

export const ETAPAS = [
  "Recebimento da Portaria de instauração",
  "Autuação (Capa dos Autos de Sindicância)",
  "Termo de Abertura dos Trabalhos",
  "Notificação prévia do sindicado",
  "Juntada de documentos",
  "Inquirição de testemunhas",
  "Depoimento do sindicado",
  "Diligências complementares",
  "Encerramento da instrução",
  "Alegações finais",
  "Relatório do Sindicante",
  "Remessa à autoridade instauradora",
];

export const STATUS = [
  "Em instrução",
  "Aguardando alegações finais",
  "Em relatório",
  "Prorrogada",
  "Concluída",
] as const;

export const PECAS = [
  {
    id: "autos",
    nome: "Autos de Sindicância (Capa)",
    unica: true,
    etapa: "Autuação (Capa dos Autos de Sindicância)",
  },
  {
    id: "abertura",
    nome: "Termo de Abertura dos Trabalhos",
    unica: true,
    etapa: "Termo de Abertura dos Trabalhos",
  },
  {
    id: "notificacao",
    nome: "Notificação Prévia do Sindicado",
    unica: true,
    etapa: "Notificação prévia do sindicado",
  },
  {
    id: "inquiricao",
    nome: "Termo de Inquirição de Testemunha",
    unica: false,
    etapa: "Inquirição de testemunhas",
  },
  {
    id: "depoimento",
    nome: "Termo de Depoimento do Sindicado",
    unica: true,
    etapa: "Depoimento do sindicado",
  },
  { id: "oficio", nome: "Ofício / Mandado de Intimação", unica: false, etapa: undefined },
  {
    id: "juntada",
    nome: "Juntada de Documentos",
    unica: false,
    etapa: "Juntada de documentos",
  },
  {
    id: "encerramento",
    nome: "Termo de Encerramento da Instrução",
    unica: true,
    etapa: "Encerramento da instrução",
  },
  {
    id: "alegacoes",
    nome: "Notificação para Alegações Finais",
    unica: true,
    etapa: "Alegações finais",
  },
  { id: "prorrogacao", nome: "Pedido de Prorrogação de Prazo", unica: false, etapa: undefined },
] as const;

export type PecaId = (typeof PECAS)[number]["id"];

export type PecaCampos = {
  local: string;
  data: string;
  hora: string;
  destinatario: string;
  qualificacao: string;
  documentos: string;
  perguntas: string;
  respostas: string;
  justificativa: string;
  prazoDias: string;
  numeroOficio: string;
};

export function diasCorridos(dataInicio: string) {
  if (!dataInicio) return 0;
  const inicio = new Date(`${dataInicio}T00:00:00`);
  if (Number.isNaN(inicio.getTime())) return 0;
  const hoje = new Date();
  return Math.floor((hoje.getTime() - inicio.getTime()) / 86_400_000);
}

const EXTENSO_NUM = [
  "zero",
  "um",
  "dois",
  "três",
  "quatro",
  "cinco",
  "seis",
  "sete",
  "oito",
  "nove",
  "dez",
  "onze",
  "doze",
  "treze",
  "quatorze",
  "quinze",
  "dezesseis",
  "dezessete",
  "dezoito",
  "dezenove",
  "vinte",
  "vinte e um",
  "vinte e dois",
  "vinte e três",
  "vinte e quatro",
  "vinte e cinco",
  "vinte e seis",
  "vinte e sete",
  "vinte e oito",
  "vinte e nove",
  "trinta",
  "trinta e um",
];

const MESES = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

function anoExtenso(ano: number) {
  // Ex.: 2026 -> "dois mil e vinte e seis"
  const milhar = Math.floor(ano / 1000);
  const resto = ano % 1000;
  const base = milhar === 2 ? "dois mil" : `${EXTENSO_NUM[milhar] ?? milhar} mil`;
  if (resto === 0) return base;
  const centena = Math.floor(resto / 100);
  const dezena = resto % 100;
  const centenas = [
    "",
    "cento",
    "duzentos",
    "trezentos",
    "quatrocentos",
    "quinhentos",
    "seiscentos",
    "setecentos",
    "oitocentos",
    "novecentos",
  ][centena];
  const partes = [centenas, dezena ? (EXTENSO_NUM[dezena] ?? `${dezena}`) : ""].filter(Boolean);
  return `${base} e ${partes.join(" e ")}`;
}

/** "Aos vinte e três dias do mês de julho de dois mil e vinte e seis" */
export function dataPorExtenso(iso: string) {
  if (!iso) return "____ dias do mês de __________ de ______";
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  const dia = d.getDate();
  return `${EXTENSO_NUM[dia] ?? dia} dias do mês de ${MESES[d.getMonth()]} de ${anoExtenso(d.getFullYear())}`;
}

function dataExtenso(iso: string) {
  if (!iso) return "____ de __________ de ______";
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
}

const linha = "_".repeat(66);

/** Cabeçalho institucional obrigatório — o brasão é inserido como imagem acima destas linhas. */
export function cabecalho(s: Sindicancia) {
  return [
    "MINISTÉRIO DA DEFESA",
    "EXÉRCITO BRASILEIRO",
    (s.subordinacao || "SUBORDINAÇÃO").toUpperCase(),
    (s.om || "ORGANIZAÇÃO MILITAR").toUpperCase(),
    "",
  ].join("\n");
}

function subcabecalhoProcesso(s: Sindicancia) {
  return [
    `SINDICÂNCIA — NUP/NUD ${s.nup || "____________"}`,
    `Portaria nr ${s.portariaNumero || "____"}, de ${dataExtenso(s.portariaData)}`,
    linha,
    "",
  ].join("\n");
}

function assinatura(s: Sindicancia) {
  return [
    "",
    "",
    (s.sindicante || "Posto/Grad e Nome de Guerra").toUpperCase(),
    "Sindicante",
    "",
  ].join("\n");
}

export function gerarPeca(peca: PecaId, s: Sindicancia, c: PecaCampos): string {
  const local = c.local || s.local || "____________";
  const head = cabecalho(s);

  if (peca === "autos") {
    return [
      head,
      "AUTOS DE SINDICÂNCIA",
      "",
      "",
      `NUP: ${s.nup || "____________"}`,
      "",
      `SINDICANTE: ${s.sindicante || "____________"}`,
      "",
      `SINDICADO: ${s.sindicado || "____________"}`,
      "",
      `OBJETO: ${s.objeto || "____________"}`,
      "",
    ].join("\n");
  }

  const corpo = (() => {
    switch (peca) {
      case "abertura":
        return [
          "TERMO DE ABERTURA",
          "",
          `Aos ${dataPorExtenso(c.data)}, nesta cidade de ${local}, no quartel do ${s.om || "OM"}, em cumprimento ao determinado na Portaria nº ${s.portariaNumero || "____"}, do Sr ${s.autoridade || "Autoridade Instauradora"}, Comandante do ${s.omInstauradora || s.om || "OM Instauradora"}, faço a abertura dos trabalhos atinentes a presente sindicância, do que, para constar, lavrei o presente termo.`,
        ].join("\n");

      case "juntada":
        return [
          "JUNTADA",
          "",
          `Aos ${dataPorExtenso(c.data)}, nesta cidade de ${local}, no quartel do ${s.om || "OM"}, faço a juntada aos autos da presente sindicância dos documentos a seguir especificados, do que, para constar, lavrei o presente termo.`,
          "",
          (c.documentos || "xxxxxxx")
            .split("\n")
            .map((d) => d.trim())
            .filter(Boolean)
            .map(
              (d, i, arr) =>
                `${i + 1}. ${d.replace(/[.;]$/, "")}${i === arr.length - 1 ? "." : ";"}`,
            )
            .join("\n\n"),
        ].join("\n");

      case "notificacao":
        return [
          subcabecalhoProcesso(s),
          "NOTIFICAÇÃO PRÉVIA DO SINDICADO",
          "",
          `Notifico V. S.ª, ${s.sindicado || "Posto/Grad e Nome de Guerra do sindicado"}, ${c.qualificacao || "qualificação"}, de que responde à presente Sindicância, instaurada pela Portaria nr ${s.portariaNumero || "____"}, de ${dataExtenso(s.portariaData)}, tendo por objeto ${s.objeto || "os fatos nela descritos"}.`,
          "",
          "Fica assegurado o direito ao contraditório e à ampla defesa, podendo acompanhar todos os atos do procedimento, pessoalmente ou por procurador, arrolar testemunhas, requerer diligências e produzir provas em direito admitidas.",
          "",
          `Deverá comparecer no dia ${dataExtenso(c.data)}, às ${c.hora || "__:__"} horas, em ${local}, a fim de ser ouvido em declarações.`,
        ].join("\n");

      case "inquiricao":
        return [
          subcabecalhoProcesso(s),
          "TERMO DE INQUIRIÇÃO DE TESTEMUNHA",
          "",
          `Aos ${dataPorExtenso(c.data)}, às ${c.hora || "__:__"} horas, em ${local}, presente o Sindicante, compareceu ${c.destinatario || "Posto/Grad e Nome de Guerra"}, ${c.qualificacao || "qualificação"}, na condição de testemunha, advertido(a) das penas cominadas ao falso testemunho, prometeu dizer a verdade do que soubesse e lhe fosse perguntado.`,
          "",
          "PERGUNTAS FORMULADAS:",
          c.perguntas || "1) ...",
          "",
          "RESPOSTAS:",
          c.respostas || "1) ...",
          "",
          "Nada mais havendo, encerrou-se o presente termo, lido e achado conforme, que vai assinado pelo Sindicante e pelo(a) depoente.",
          "",
          "",
          "____________________________________",
          "Depoente",
        ].join("\n");

      case "depoimento":
        return [
          subcabecalhoProcesso(s),
          "TERMO DE DECLARAÇÕES DO SINDICADO",
          "",
          `Aos ${dataPorExtenso(c.data)}, às ${c.hora || "__:__"} horas, em ${local}, presente o Sindicante, compareceu ${s.sindicado || "Posto/Grad e Nome de Guerra"}, ${c.qualificacao || "qualificação"}, na condição de sindicado, cientificado do direito ao silêncio, ao contraditório e à ampla defesa, respondeu:`,
          "",
          "PERGUNTAS FORMULADAS:",
          c.perguntas || "1) ...",
          "",
          "RESPOSTAS:",
          c.respostas || "1) ...",
          "",
          "Nada mais havendo, encerrou-se o presente termo, lido e achado conforme.",
          "",
          "",
          "____________________________________",
          "Sindicado",
        ].join("\n");

      case "oficio":
        return [
          subcabecalhoProcesso(s),
          `Ofício nr ${c.numeroOficio || "____"} - Sind ${s.nup || ""}`,
          "",
          `Ao Senhor ${c.destinatario || "Posto/Grad e Nome de Guerra / Autoridade"}`,
          `${c.qualificacao || "Função / Endereço"}`,
          "",
          "Assunto: Intimação para comparecimento",
          "",
          `1. Na condição de Sindicante da Sindicância instaurada pela Portaria nr ${s.portariaNumero || "____"}, de ${dataExtenso(s.portariaData)}, solicito a V. S.ª as providências necessárias ao comparecimento no dia ${dataExtenso(c.data)}, às ${c.hora || "__:__"} horas, em ${local}.`,
          "",
          `2. ${c.justificativa || "A medida destina-se à instrução do procedimento, nos termos da EB10-IG-09.001."}`,
          "",
          "3. Coloco-me à disposição para os esclarecimentos que se fizerem necessários.",
        ].join("\n");

      case "encerramento":
        return [
          subcabecalhoProcesso(s),
          "TERMO DE ENCERRAMENTO DA INSTRUÇÃO",
          "",
          `Aos ${dataPorExtenso(c.data)}, nesta cidade de ${local}, o Sindicante declara encerrada a fase instrutória do procedimento instaurado pela Portaria nr ${s.portariaNumero || "____"}, de ${dataExtenso(s.portariaData)}, havendo sido produzidas todas as provas reputadas necessárias ao esclarecimento dos fatos.`,
          "",
          `${c.justificativa || "Não subsistem diligências pendentes."}`,
          "",
          "Determino a notificação do sindicado para apresentação de alegações finais, nos termos da EB10-IG-09.001.",
        ].join("\n");

      case "alegacoes":
        return [
          subcabecalhoProcesso(s),
          "NOTIFICAÇÃO PARA APRESENTAÇÃO DE ALEGAÇÕES FINAIS",
          "",
          `Notifico V. S.ª, ${s.sindicado || "Posto/Grad e Nome de Guerra"}, do encerramento da instrução da Sindicância instaurada pela Portaria nr ${s.portariaNumero || "____"}, de ${dataExtenso(s.portariaData)}.`,
          "",
          `Fica facultada a apresentação de ALEGAÇÕES FINAIS, por escrito, no prazo de ${c.prazoDias || "5"} (____) dias, contados do recebimento desta, franqueada vista dos autos.`,
          "",
          "O silêncio não implicará confissão, prosseguindo o feito em seus ulteriores termos.",
        ].join("\n");

      case "prorrogacao":
        return [
          subcabecalhoProcesso(s),
          "PEDIDO DE PRORROGAÇÃO DE PRAZO",
          "",
          `Ao(À) ${s.autoridade || "Autoridade Instauradora"}, Comandante do ${s.omInstauradora || s.om || "OM Instauradora"}`,
          "",
          `1. Solicito a prorrogação do prazo para conclusão da Sindicância instaurada pela Portaria nr ${s.portariaNumero || "____"}, de ${dataExtenso(s.portariaData)}, por mais ${c.prazoDias || "20"} (____) dias corridos.`,
          "",
          `2. Justificativa: ${c.justificativa || "necessidade de realização de diligências imprescindíveis à elucidação dos fatos, ainda pendentes de conclusão."}`,
          "",
          "3. O pedido encontra amparo na Portaria C Ex nr 2.394/2024 (EB10-IG-09.001).",
          "",
          "4. Nestes termos, peço deferimento.",
        ].join("\n");

      default:
        return "";
    }
  })();

  return `${head}${corpo}\n${assinatura(s)}`;
}

export type Relatorio = {
  introducao: string;
  diligencias: string;
  analise: string;
  conclusao: string;
};

export function gerarRelatorio(s: Sindicancia, r: Relatorio, local: string, data: string) {
  return [
    cabecalho(s),
    subcabecalhoProcesso(s),
    "RELATÓRIO DO SINDICANTE",
    "",
    "1. INTRODUÇÃO",
    r.introducao ||
      `A presente Sindicância foi instaurada pela Portaria nr ${s.portariaNumero || "____"}, de ${dataExtenso(s.portariaData)}, da lavra do(a) ${s.autoridade || "Autoridade Instauradora"}, a fim de apurar ${s.objeto || "os fatos nela descritos"}.`,
    "",
    "2. DILIGÊNCIAS REALIZADAS",
    r.diligencias || "a) ...",
    "",
    "3. ANÁLISE DOS FATOS",
    r.analise || "...",
    "",
    "4. CONCLUSÃO",
    r.conclusao || "...",
    "",
    `${local || s.local || "________________"}, ${dataExtenso(data)}.`,
    assinatura(s),
  ].join("\n");
}
