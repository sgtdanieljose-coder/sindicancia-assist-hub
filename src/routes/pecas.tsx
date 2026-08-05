export type AnexoJuntada = {
  id: string;
  /** Texto digitado livremente — pode ter vírgula, dois-pontos etc., ao contrário do nome do arquivo. */
  descricao: string;
  /** Presentes só quando um arquivo foi anexado a este item. */
  fileId?: string;
  url?: string;
  mimeType?: string;
  nomeArquivo?: string;
  /** Documento (folha própria) deste anexo específico, se houver arquivo. */
  documentId?: string;
  docUrl?: string;
};

export type Juntada = {
  id: string;
  numero: number;
  titulo: string;
  data: string;
  anexos: AnexoJuntada[];
  /** Documento (Google Docs) desta juntada — termo + lista de anexos incorporada. */
  documentId?: string;
  url?: string;
};

/** Snapshot do texto de uma peça, guardado a cada exportação/atualização. */
export type VersaoPeca = {
  id: string;
  texto: string;
  criadoEm: string;
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
  documentos: {
    titulo: string;
    documentId: string;
    url: string;
    pecaId?: string;
    /** Título literal esperado DENTRO do corpo do texto (quando difere do TITULOS_PECA
     *  estático — ex.: cada juntada tem seu próprio "JUNTADA Nº N"). */
    tituloInterno?: string;
    /** Histórico de textos anteriores desta peça (mais antigo primeiro), para restauração. */
    versoes?: VersaoPeca[];
  }[];

  atualizadoEm: string;
  /** Pasta da sindicância no Drive (nome = NUP), criada automaticamente ao salvar. */
  pastaId?: string;
  pastaUrl?: string;
  /** Subpasta "Anexos" dentro da pasta da sindicância. */
  anexosId?: string;
  anexosUrl?: string;
  /** Cidade/localidade em que os atos são lavrados. */
  local: string;
  /** Local específico dos trabalhos (onde serão feitas as oitivas) — ex.: sala/prédio, distinto da cidade. */
  localTrabalhos: string;
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
  "Despacho inicial",
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
  "Arquivada",
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
    id: "despacho-inicial",
    nome: "Despacho Inicial",
    unica: true,
    etapa: "Despacho inicial",
  },
  {
    id: "despacho-diversos",
    nome: "Despachos Diversos",
    unica: false,
    etapa: undefined,
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

// ====================================================================================
// Convenção de formatação-base de TODA peça (documento individual e a cópia dela dentro
// do documento único dos autos — aplicada em src/lib/google.server.ts, que usa a MESMA
// lógica nos dois lugares para nunca ficarem dessincronizados):
//   1) Brasão da República no topo.
//   2) Cabeçalho institucional (timbre / Subordinação) em negrito e centralizado.
//   3) 4 linhas em branco entre o cabeçalho e o título da peça — ver ESPACO_ANTES_TITULO.
//   4) Título da peça em negrito, sublinhado e centralizado.
//   5) Corpo do texto (peças com parágrafo narrativo) justificado, com recuo de 1ª linha.
//   6) Assinatura ao final: nome centralizado (peso normal) e a função/cargo (ex.:
//      "Sindicante") centralizada e em negrito — sempre as duas últimas linhas não vazias.
//
// Ao escrever uma peça nova: comece o corpo com ...ESPACO_ANTES_TITULO, "TÍTULO DA PEÇA",
// "", <corpo>, e cadastre esse título literal em TITULOS_PECA (google.server.ts) — o resto
// (negrito/centralização/sublinhado/justificado/assinatura, nos dois documentos) é automático.
// ====================================================================================

/** Linhas em branco padrão entre o cabeçalho institucional e o título de qualquer peça. */
const ESPACO_ANTES_TITULO = ["", "", "", ""];

/** Cabeçalho institucional obrigatório — o brasão é inserido como imagem acima destas linhas. */
export function cabecalho(s: Sindicancia) {
  const linhasSubordinacao = (s.subordinacao || "Subordinação")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  return ["MINISTÉRIO DA DEFESA", "EXÉRCITO BRASILEIRO", ...linhasSubordinacao, ""].join("\n");
}

function subcabecalhoProcesso(s: Sindicancia) {
  return [
    `SINDICÂNCIA — NUP/NUD ${s.nup || "____________"}`,
    `Portaria nr ${s.portariaNumero || "____"}, de ${dataExtenso(s.portariaData)}`,
    linha,
    "",
  ].join("\n");
}

/** A função/cargo (última linha) vira negrito automaticamente — ver requestsAssinatura. */
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
  // Oitivas (inquirição/depoimento) usam o local específico dos trabalhos quando preenchido.
  const localOitiva = c.local || s.localTrabalhos || s.local || "____________";
  const head = cabecalho(s);

  if (peca === "autos") {
    return [
      head.replace(/\n+$/, ""),
      ...ESPACO_ANTES_TITULO,
      "AUTOS DE SINDICÂNCIA",
      "",
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
      case "abertura": {
        const dataTxt = c.data ? dataPorExtenso(c.data) : "“data por extenso”";
        const localTxt = c.local || s.local || "“local adicionado na base de dados”";
        const omTxt = s.om || "“OM adicionada na base de dados”";
        const portariaTxt = s.portariaNumero || "“Portaria adicionada na base”";
        const autoridadeTxt = s.autoridade || "“Autoridade Instauradora da base de dados”";
        const omInstTxt =
          s.omInstauradora || s.om || "“OM Instauradora adicionada na base de dados”";
        return [
          ...ESPACO_ANTES_TITULO,
          "TERMO DE ABERTURA",
          "",
          `Aos ${dataTxt} nesta cidade de ${localTxt}, no quartel do ${omTxt}, em cumprimento ao determinado na Portaria nº ${portariaTxt}, do Sr ${autoridadeTxt}, Comandante do ${omInstTxt}, faço a abertura dos trabalhos atinentes a presente sindicância, do que, para constar, lavrei o presente termo.`,
        ].join("\n");
      }

      case "despacho-inicial": {
        const sindicadoTxt = s.sindicado || "“sindicado adicionado na base de dados”";
        const portariaTxt = s.portariaNumero || "“Portaria adicionada na base”";
        const dataPortariaTxt = s.portariaData ? dataExtenso(s.portariaData) : "“data da portaria”";
        const autoridadeTxt = s.autoridade || "“Autoridade Instauradora da base de dados”";
        const omTxt = s.om || "“OM adicionada na base de dados”";
        const dataOitivaTxt = c.data ? dataExtenso(c.data) : "“data designada”";
        const horaTxt = c.hora || "__:__";
        const localOitivaTxt = s.localTrabalhos || "“local dos trabalhos”";
        const fechamentoData = c.data ? dataExtenso(c.data) : "__ de __________ de ____";
        return [
          ...ESPACO_ANTES_TITULO,
          "DESPACHO",
          "",
          `Oficiar ao(à) ${sindicadoTxt}, sindicado, notificando previamente sobre a instauração da sindicância referente à Portaria nº ${portariaTxt}, de ${dataPortariaTxt}, do Sr ${autoridadeTxt}, Comandante do ${omTxt}.`,
          "",
          `Oficiar ao Sr. Comandante da “subunidade do sindicado”, com a finalidade de autorizar o comparecimento do ${sindicadoTxt}, com a finalidade de ser inquirido como sindicado.`,
          "",
          `Oficiar ao Chefe da “seção competente”, com a finalidade de solicitar “documento necessário”.`,
          "",
          `Designo o dia ${dataOitivaTxt}, às ${horaTxt} horas, a fim de ser ouvido o sindicado ${sindicadoTxt}, em ${localOitivaTxt}.`,
          "",
          "",
          `Quartel em ${s.local || "____________"}, ${fechamentoData}.`,
        ].join("\n");
      }

      case "despacho-diversos": {
        const fechamentoData = c.data ? dataExtenso(c.data) : "__ de __________ de ____";
        return [
          ...ESPACO_ANTES_TITULO,
          "DESPACHO",
          "",
          c.justificativa || "“conteúdo do despacho”",
          "",
          "",
          `Quartel em ${s.local || "____________"}, ${fechamentoData}.`,
        ].join("\n");
      }

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
          `Aos ${dataPorExtenso(c.data)}, às ${c.hora || "__:__"} horas, em ${localOitiva}, presente o Sindicante, compareceu ${c.destinatario || "Posto/Grad e Nome de Guerra"}, ${c.qualificacao || "qualificação"}, na condição de testemunha, advertido(a) das penas cominadas ao falso testemunho, prometeu dizer a verdade do que soubesse e lhe fosse perguntado.`,
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
          `Aos ${dataPorExtenso(c.data)}, às ${c.hora || "__:__"} horas, em ${localOitiva}, presente o Sindicante, compareceu ${s.sindicado || "Posto/Grad e Nome de Guerra"}, ${c.qualificacao || "qualificação"}, na condição de sindicado, cientificado do direito ao silêncio, ao contraditório e à ampla defesa, respondeu:`,
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

/**
 * Gera o texto de uma juntada específica (com numeração própria, ex.: "JUNTADA Nº 2"),
 * listando os anexos já enviados. Segue a mesma convenção de formatação-base das demais
 * peças; as fotos/PDFs em si são incorporados depois, sobre o Google Doc já criado — ver
 * inserirAnexosNaJuntada em google.server.ts.
 */
export function gerarTextoJuntada(s: Sindicancia, j: Juntada): string {
  const titulo = `JUNTADA Nº ${j.numero}`;
  const listaAnexos = j.anexos.length
    ? j.anexos.map((a, i) => `${i + 1}. ${a.des
