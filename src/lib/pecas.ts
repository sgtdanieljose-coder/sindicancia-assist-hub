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
  /** Tamanho do arquivo em bytes, no momento do envio (Prioridade 4.3). Ausente em anexos
   *  enviados antes desta mudança. */
  tamanho?: number;
  /** Quando o upload deste anexo foi concluído. Ausente em anexos enviados antes desta
   *  mudança. */
  criadoEm?: string;
};

/** Situação de uma juntada — Prioridade 4.0: "aberta" enquanto ainda recebe anexos,
 *  "concluida" quando o usuário sinaliza que terminou de montá-la. */
export const STATUS_JUNTADA = ["aberta", "concluida"] as const;
export type StatusJuntada = (typeof STATUS_JUNTADA)[number];
export const STATUS_JUNTADA_LABEL: Record<StatusJuntada, string> = {
  aberta: "Aberta",
  concluida: "Concluída",
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
  /**
   * Texto editado manualmente pelo usuário no Gerador Dinâmico de Peças. Quando
   * presente (não vazio), tem prioridade sobre o texto gerado automaticamente a
   * partir da lista de anexos — ver textoEfetivoJuntada() abaixo e
   * sincronizarDocumentoJuntada em sindicancias.functions.ts, que é quem realmente
   * decide o que vai para o Google Docs. Ficar em branco faz a juntada voltar a
   * usar a lista automática (gerarTextoJuntada).
   */
  textoEditado?: string;
  /** Quem é responsável por esta juntada (texto livre — não há autenticação no sistema
   *  para vincular um usuário de verdade). Prioridade 4.0. */
  responsavel?: string;
  /** Prioridade 4.0/2.3. Ausente em juntadas criadas antes desta mudança — tratar como
   *  "aberta". */
  status?: StatusJuntada;
};

/** Snapshot do texto de uma peça, guardado a cada exportação/atualização. */
export type VersaoPeca = {
  id: string;
  texto: string;
  criadoEm: string;
};

/** Situação de controle processual de uma peça já lançada nos autos — Prioridade 2.3 da
 *  evolução do sistema. Editável pelo usuário direto no índice dos autos, sem precisar
 *  abrir o Google Docs. */
export const STATUS_PECA = [
  "nao-iniciada",
  "em-elaboracao",
  "em-revisao",
  "concluida",
  "juntada-aos-autos",
  "cancelada",
] as const;

export type StatusPeca = (typeof STATUS_PECA)[number];

export const STATUS_PECA_LABEL: Record<StatusPeca, string> = {
  "nao-iniciada": "Não iniciada",
  "em-elaboracao": "Em elaboração",
  "em-revisao": "Em revisão",
  concluida: "Concluída",
  "juntada-aos-autos": "Juntada aos autos",
  cancelada: "Cancelada",
};

export type Sindicancia = {
  id: string;
  nup: string;
  portariaNumero: string;
  portariaData: string;
  /** Antiga "Organização Militar (OM)". Hoje representa a "Seção dos Atos": o
   *  local/seção onde são feitas as inquirições e demais atos da sindicância —
   *  ver o rótulo em routes/index.tsx. Continua se chamando `om` internamente
   *  (mesma coluna na planilha) para não quebrar dados já salvos; o valor
   *  alimenta automaticamente o "local dos trabalhos" do Despacho Inicial e da
   *  Notificação Prévia (ver gerarPeca) além do seu uso já existente ("no
   *  quartel do ...", no Termo de Abertura e nas Juntadas). */
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
    /**
     * Texto puro já conhecido desta peça, gravado a cada criação/atualização. Existe só para
     * evitar recarregar (getDocText) cada peça já existente do Google Docs sempre que
     * QUALQUER outra peça é salva e o documento único precisa ser reconstruído — sem isto, o
     * salvamento de uma única peça nova exigia 1 chamada de leitura por peça já existente,
     * deixando o salvamento cada vez mais lento à medida que a sindicância cresce. Se ausente
     * (registros salvos antes desta mudança, ou peça editada fora do app), o código volta a
     * buscar do Google Docs normalmente.
     */
    texto?: string;
    /** Situação de controle (Prioridade 2.3). Peças exportadas antes desta mudança não têm
     *  este campo — tratar ausência como "concluida" (o documento já existe no Drive). */
    status?: StatusPeca;
    /** Quando este item passou a existir nos autos pela 1ª vez (1ª exportação bem-sucedida).
     *  Ausente em registros salvos antes desta mudança. */
    criadoEm?: string;
    /** Última exportação/atualização/restauração desta peça específica — distinto do
     *  `atualizadoEm` da sindicância como um todo (esse é global e muda a cada salvamento
     *  de qualquer coisa). Ausente em registros salvos antes desta mudança. */
    atualizadoEm?: string;
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
  /** Campo legado ("local específico dos trabalhos") — mantido só como fallback para
   *  sindicâncias antigas; hoje quem preenche esse papel é `om` (Seção dos Atos). Sem
   *  campo próprio no formulário. */
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
  /** Marcadores livres para categorizar a sindicância e facilitar buscas futuras. */
  tags: string[];
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

/** Lista fixa de tags para categorizar sindicâncias e facilitar buscas futuras. */
export const TAGS_DISPONIVEIS = [
  "Acidente de SV",
  "Dano ao Erário",
  "Reinclusão de Dependente",
  "Desídia de Adido",
  "Anulação de Incorporação",
  "Irregularidade na Incorporação",
  "Recuperação de Adido",
  "Aux Transporte",
  "Acumulo de Benefício",
  "Dano Material",
  "Dano Pessoal",
  "Nexo Causal",
  "Incapacidade Física Temporária",
  "Desaparecimento de material",
  "Perda de armamento",
  "Extravio de munição",
  "Acidentes durante instrução",
  "Acidentes em serviço",
  "Documentos sigilosos",
  "Reconhecimento de direitos",
  "Auxílio-fardamento",
  "Outros",
] as const;

/**
 * Peças suportadas pelo gerador, com a etapa do checklist que cada uma marca ao ser
 * exportada. Correspondência aproximada com os modelos do Anexo da EB10-IG-01.001
 * (nem toda peça daqui tem um modelo 1:1 na IG — o app usa a MESMA convenção-base
 * (cabeçalho, margens, fonte, recuo, assinatura — ver o bloco de comentários logo
 * acima de ESPACO_ANTES_TITULO) para qualquer peça, prevista na IG ou não):
 *   - abertura, despacho-inicial, despacho-diversos, encerramento: art. 66, IX
 *     (Termo) / despacho de mero expediente — não têm modelo gráfico próprio na IG,
 *     por isso reaproveitam a convenção-base.
 *   - notificacao, alegacoes, oficio, prorrogacao, diex: adaptações do Ofício/DIEx
 *     (Anexo I.1 e II.2).
 *   - inquiricao, depoimento, acareacao: rito de sindicância (EB10-IG-09.001), não
 *     da correspondência — também seguem a convenção-base deste app.
 *   - certidao: art. 66, IX (Termo/Certidão) — modelo simples de "Certifico que...".
 */
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
    id: "diex",
    nome: "DIEx (Documento Interno do Exército)",
    unica: false,
    etapa: undefined,
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
  {
    id: "acareacao",
    nome: "Termo de Acareação",
    unica: false,
    etapa: undefined,
  },
  { id: "oficio", nome: "Ofício / Mandado de Intimação", unica: false, etapa: undefined },
  {
    id: "certidao",
    nome: "Certidão",
    unica: false,
    etapa: undefined,
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

/**
 * Opções de rodapé para o DIEx (Anexo II.2 da EB10-IG-01.001): tanto o modelo de
 * "Recebimento" (quando o destinatário só precisa confirmar que recebeu, ex.:
 * DIEx de encaminhamento/solicitação) quanto o de "Declaro que tenho ciência"
 * (mais comum em notificações que exigem ciência formal do destinatário) aparecem
 * nos DIEx e Ofícios já produzidos por esta OM.
 */
export const RODAPE_DIEX_OPCOES = [
  {
    value: "recebimento",
    label: "Recebimento (data/hora + assinatura do destinatário)",
    texto: [
      "Recebimento:",
      "",
      "Dia ..../....../....... às....... horas",
      "",
      "____________________________________",
    ].join("\n"),
  },
  {
    value: "ciencia",
    label: "Declaro que tenho ciência (data/hora + assinatura)",
    texto: [
      "Declaro que tenho ciência:",
      "",
      "Dia ..../....../....... às....... horas",
      "",
      "____________________________________",
    ].join("\n"),
  },
  { value: "nenhum", label: "Nenhum (sem campo de recebimento)", texto: "" },
] as const;

export type RodapeDiex = (typeof RODAPE_DIEX_OPCOES)[number]["value"];

export type PecaCampos = {
  local: string;
  /** Data que a própria peça carrega (fecho do despacho, epígrafe do ofício/DIEx etc.). */
  data: string;
  /** Data marcada para a inquirição/oitiva — usada por Despacho Inicial e Notificação
   *  Prévia na frase "Designo o dia ..."/"Deverá comparecer no dia ...". Distinta de
   *  `data` (a data da PEÇA em si) — antes do EB10-IG-09.001 este app reaproveitava o
   *  mesmo campo para as duas coisas, o que não faz sentido (a peça pode ser lavrada
   *  num dia e marcar a oitiva para outro). */
  dataInquiricao: string;
  hora: string;
  destinatario: string;
  qualificacao: string;
  /** 2º acareado — só usado pelo Termo de Acareação. */
  destinatario2: string;
  qualificacao2: string;
  documentos: string;
  perguntas: string;
  respostas: string;
  justificativa: string;
  prazoDias: string;
  numeroOficio: string;
  /** Campos exclusivos do DIEx (Anexo II.2). */
  numeroDiex: string;
  assunto: string;
  referencia: string;
  rodapeDiex: RodapeDiex;
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

/**
 * "4 de março de 2026" (dia sem zero à esquerda) ou "1º de maio de 2026" (dia 1
 * sempre com o indicativo ordinal "º") — art. 51, I e II, da EB10-IG-01.001, que dá
 * exatamente esses dois exemplos ("4 de março... e não 04 de março..."; "1º de
 * maio... e não 1 de maio..."). Usa o array MESES (o mesmo de dataPorExtenso) em
 * vez de depender de dados de locale do runtime para o nome do mês.
 */
function dataExtenso(iso: string) {
  if (!iso) return "____ de __________ de ______";
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  const dia = d.getDate();
  const diaTxt = dia === 1 ? "1º" : String(dia);
  return `${diaTxt} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`;
}

const linha = "_".repeat(66);

// ====================================================================================
// Convenção de formatação-base de TODA peça (documento individual e a cópia dela dentro
// do documento único dos autos — aplicada em src/lib/google.server.ts, que usa a MESMA
// lógica nos dois lugares para nunca ficarem dessincronizados), alinhada à
// EB10-IG-01.001 (Instruções Gerais para a Correspondência do Exército, folhas 7 a 76):
//   1) Brasão da República no topo, a 1 cm da borda superior da folha (art. 24 c/c a
//      margem superior de 1 cm — ver MARGEM_SUPERIOR_PT em google.server.ts: como o
//      brasão é sempre o 1º conteúdo do corpo, ele já nasce a 1 cm do topo).
//   2) Margens da folha: 1 cm (superior), mínimo 2 cm (inferior), 3 cm (esquerda) e
//      1,5 cm (direita) — art. 25. Aplicadas em requestsMargens (google.server.ts).
//   3) Fonte Times New Roman, 12 no corpo do texto e 10 no rodapé/identificação de
//      página, com espaçamento simples entre linhas — arts. 26 e 28. Aplicadas em
//      requestsFontePadrao (google.server.ts).
//   4) Cabeçalho institucional (timbre / Subordinação) em negrito, centralizado e
//      sempre em letras maiúsculas — art. 24 (ver cabecalho() logo abaixo).
//   5) 4 linhas em branco entre o cabeçalho e o título da peça — ver
//      ESPACO_ANTES_TITULO. (Convenção própria deste sistema: a IG não fixa um
//      número de linhas aqui, e ofícios/DIEx reais nem têm um "título" destacado —
//      este app usa um título em negrito em toda peça, por clareza e uniformidade.)
//   6) Título da peça em negrito, sublinhado e centralizado.
//   7) Corpo do texto (peças com parágrafo narrativo) justificado, com recuo de
//      primeira linha de 1,5 cm além da margem esquerda — art. 27 ("o início do
//      texto será entre 4,5 a 5 cm de distância da margem esquerda"; como a margem
//      já é de 3 cm, o recuo extra é de 1,5 a 2 cm — ver RECUO_PRIMEIRA_LINHA_PT).
//   8) Assinatura ao final (art. 57, I e II): sem traço horizontal, tudo
//      centralizado; NOME em negrito e maiúsculo (1ª linha) e função/cargo (ex.:
//      "Sindicante") SEM negrito (2ª linha) — sempre as duas últimas linhas não
//      vazias. O negrito certo (nome, não função) é aplicado em requestsAssinatura
//      (google.server.ts); a função assinatura() abaixo só cuida do espaçamento
//      mínimo de 3 linhas em branco antes da assinatura, pedido pelo art. 57, e a
//      formatação também marca esse trecho para não ficar isolado numa página
//      própria (art. 45 — ver requestsEvitarAssinaturaIsolada). Peças com um
//      segundo signatário (ex.: acareacao) inserem as próprias linhas de assinatura
//      ANTES da assinatura do Sindicante, do mesmo jeito que inquiricao/depoimento
//      já fazem com "Depoente"/"Testemunha".
//      OBS.: as variantes de assinatura delegada ("Por ordem", "Por delegação", "No
//      impedimento de" — art. 57, IV a VII) ainda não têm campo próprio no
//      formulário; se forem necessárias, é preciso adicionar um campo à
//      Sindicancia (ex.: `assinaturaDelegada`) e um novo bloco de texto aqui.
//   9) Abreviatura de "número": sempre "nº" (não "nr") para Portaria e Ofício —
//      art. 60 (que reserva "Nr" para "os demais documentos militares" e "nº"/"Nº"
//      para correspondências e atos normativos/ordinatórios como esses). Ver
//      subcabecalhoProcesso() e os casos de gerarPeca() abaixo.
//
// Ao escrever uma peça nova: comece o corpo com ...ESPACO_ANTES_TITULO, "TÍTULO DA PEÇA",
// "", <corpo>, e cadastre esse título literal em TITULOS_PECA (google.server.ts) — o resto
// (negrito/centralização/sublinhado/justificado/assinatura/margens/fonte, nos dois
// documentos) é automático.
// ====================================================================================

/** Linhas em branco padrão entre o cabeçalho institucional e o título de qualquer peça. */
const ESPACO_ANTES_TITULO = ["", "", "", ""];

/** Cabeçalho institucional obrigatório — o brasão é inserido como imagem acima destas linhas.
 *  Art. 24: 1ª linha "MINISTÉRIO DA DEFESA", 2ª "EXÉRCITO BRASILEIRO", 3ª a OM expedidora e,
 *  se houver, a numeração/denominação histórica — tudo em letras maiúsculas (por isso o
 *  .toUpperCase() abaixo, que blinda o resultado mesmo que o usuário digite em minúsculas na
 *  Subordinação). */
export function cabecalho(s: Sindicancia) {
  const linhasSubordinacao = (s.subordinacao || "Subordinação")
    .split("\n")
    .map((l) => l.trim().toUpperCase())
    .filter(Boolean);
  return ["MINISTÉRIO DA DEFESA", "EXÉRCITO BRASILEIRO", ...linhasSubordinacao, ""].join("\n");
}

/** Sub-cabeçalho (NUP + Portaria) repetido em cada peça extraída para documento próprio.
 *  Usa-se sempre "nº" (não "nr") para "número" de Portaria/Ofício — art. 60 da
 *  EB10-IG-01.001 (item 9 do bloco de comentários acima), padrão também observado nos
 *  autos de sindicância já produzidos por esta OM. */
function subcabecalhoProcesso(s: Sindicancia) {
  return [
    `SINDICÂNCIA — NUP/NUD ${s.nup || "____________"}`,
    `Portaria nº ${s.portariaNumero || "____"}, de ${dataExtenso(s.portariaData)}`,
    linha,
    "",
  ].join("\n");
}

/** A função/cargo (última linha) fica SEM negrito; o nome (penúltima) vem em negrito —
 *  ver requestsAssinatura em google.server.ts, que aplica o negrito na linha certa
 *  (art. 57, II). As 3 linhas em branco abaixo dão o espaçamento mínimo pedido pelo
 *  art. 57 antes da assinatura ("mínimo de 3 espaços simples ou 24 Pt"). */
function assinatura(s: Sindicancia) {
  return [
    "",
    "",
    "",
    (s.sindicante || "Posto/Grad e Nome de Guerra").toUpperCase(),
    "Sindicante",
    "",
  ].join("\n");
}

export function gerarPeca(peca: PecaId, s: Sindicancia, c: PecaCampos): string {
  const local = c.local || s.local || "____________";
  // Oitivas (inquirição/depoimento/acareação) usam o local específico dos trabalhos
  // quando preenchido. Comportamento inalterado — quem passou a puxar "Seção dos
  // Atos" (s.om) automaticamente foi só o Despacho Inicial e a Notificação Prévia,
  // que perderam o campo manual de local (ver mais abaixo).
  const localOitiva = c.local || s.localTrabalhos || s.local || "____________";
  const head = cabecalho(s);

  if (peca === "autos") {
    const dataTxt = c.data ? dataExtenso(c.data) : "__ de __________ de ____";
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
      "",
      `${s.local || "____________"}, ${dataTxt}.`,
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
        // Data/hora da OITIVA (não a data da peça em si) — campo próprio dataInquiricao.
        const dataOitivaTxt = c.dataInquiricao ? dataExtenso(c.dataInquiricao) : "“data designada”";
        const horaTxt = c.hora || "__:__";
        // "Seção dos Atos" (campo s.om, renomeado no formulário — ver Gestor do
        // Processo) entra automaticamente como local dos trabalhos; não há mais
        // campo manual de local para esta peça. OBS.: como `s.om` também é usado
        // acima em "Comandante do ${omTxt}", quem preencher esse campo com algo
        // muito específico (ex.: "Fiscalização Administrativa do 63º BI") deve
        // conferir se a frase "Comandante do..." continua fazendo sentido — ver
        // comentário no início do arquivo sobre essa dupla função do campo.
        const localOitivaTxt = s.om || s.localTrabalhos || s.local || "“local dos trabalhos”";
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

      case "notificacao": {
        const dataPecaTxt = c.data ? dataExtenso(c.data) : "__ de __________ de ____";
        const dataInquiricaoTxt = c.dataInquiricao
          ? dataExtenso(c.dataInquiricao)
          : "“data designada”";
        const horaTxt = c.hora || "__:__";
        // Mesma lógica do Despacho Inicial: "Seção dos Atos" (s.om) auto-preenche o
        // local dos trabalhos, sem campo manual nesta peça.
        const localOitivaTxt = s.om || s.localTrabalhos || s.local || "____________";
        return [
          subcabecalhoProcesso(s),
          "NOTIFICAÇÃO PRÉVIA DO SINDICADO",
          "",
          `${s.local || "____________"}, ${dataPecaTxt}.`,
          "",
          `Notifico V. S.ª, ${s.sindicado || "Posto/Grad e Nome de Guerra do sindicado"}, ${c.qualificacao || "qualificação"}, de que responde à presente Sindicância, instaurada pela Portaria nº ${s.portariaNumero || "____"}, de ${dataExtenso(s.portariaData)}, tendo por objeto ${s.objeto || "os fatos nela descritos"}.`,
          "",
          "Fica assegurado o direito ao contraditório e à ampla defesa, podendo acompanhar todos os atos do procedimento, pessoalmente ou por procurador, arrolar testemunhas, requerer diligências e produzir provas em direito admitidas.",
          "",
          `Deverá comparecer no dia ${dataInquiricaoTxt}, às ${horaTxt} horas, em ${localOitivaTxt}, a fim de ser ouvido em declarações.`,
        ].join("\n");
      }

      case "diex": {
        // Modelo do Anexo II.2 da EB10-IG-01.001 (DIEx): epígrafe com número e data,
        // "Do.../Ao...", Assunto (sempre em negrito — ver ROTULOS_NEGRITO em
        // google.server.ts), Referência(s)/Anexo(s) quando houver, corpo numerado
        // pelo próprio usuário (campo justificativa) e um rodapé configurável.
        const numeroTxt = c.numeroDiex || "____";
        const destinatarioTxt =
          c.destinatario || "Posto/Grad e Nome de Guerra / Cargo do destinatário";
        const assuntoTxt = c.assunto || "assunto do expediente";
        const dataTxt = c.data ? dataExtenso(c.data) : "__ de __________ de ____";
        const rodapeTxt = RODAPE_DIEX_OPCOES.find((o) => o.value === c.rodapeDiex)?.texto ?? "";
        return [
          subcabecalhoProcesso(s),
          "DIEX",
          "",
          `DIEx nº ${numeroTxt} - Sind`,
          "",
          `${s.local || "____________"}, ${dataTxt}.`,
          "",
          `Do(a) ${s.sindicante || "Posto/Grad e Nome de Guerra"} (Sindicante)`,
          `Ao(À) ${destinatarioTxt}`,
          "",
          `Assunto: ${assuntoTxt}`,
          ...(c.referencia.trim() ? ["", `Referência: ${c.referencia}`] : []),
          ...(c.documentos.trim() ? ["", `Anexo: ${c.documentos}`] : []),
          "",
          c.justificativa || "1. ...",
          ...(rodapeTxt ? ["", rodapeTxt] : []),
        ].join("\n");
      }

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

      case "acareacao": {
        const dataTxt = c.data ? dataPorExtenso(c.data) : "“data por extenso”";
        const horaTxt = c.hora || "__:__";
        const pessoa1 = c.destinatario || "Posto/Grad e Nome de Guerra (1º acareado)";
        const pessoa2 = c.destinatario2 || "Posto/Grad e Nome de Guerra (2º acareado)";
        return [
          subcabecalhoProcesso(s),
          "TERMO DE ACAREAÇÃO",
          "",
          `Aos ${dataTxt}, às ${horaTxt} horas, em ${localOitiva}, presente o Sindicante, procedeu-se à acareação entre ${pessoa1}, ${c.qualificacao || "qualificação"}, e ${pessoa2}, ${c.qualificacao2 || "qualificação"}, tendo em vista a divergência verificada em suas declarações anteriores, notadamente quanto a: ${c.perguntas || "“ponto de divergência”"}.`,
          "",
          "Após lidas aos acareados as passagens divergentes de suas declarações anteriores, foram os mesmos reperguntados sobre os pontos controvertidos, tendo respondido:",
          "",
          c.respostas || "...",
          "",
          "Nada mais havendo, encerrou-se o presente termo, lido e achado conforme, que vai devidamente assinado pelo Sindicante e pelos acareados.",
          "",
          "",
          "____________________________________",
          "Acareado(a)",
          "",
          "",
          "____________________________________",
          "Acareado(a)",
        ].join("\n");
      }

      case "oficio":
        return [
          subcabecalhoProcesso(s),
          "OFÍCIO",
          "",
          `Ofício nº ${c.numeroOficio || "____"} - Sind ${s.nup || ""}`,
          "",
          `Ao Senhor ${c.destinatario || "Posto/Grad e Nome de Guerra / Autoridade"}`,
          `${c.qualificacao || "Função / Endereço"}`,
          "",
          "Assunto: Intimação para comparecimento",
          "",
          `1. Na condição de Sindicante da Sindicância instaurada pela Portaria nº ${s.portariaNumero || "____"}, de ${dataExtenso(s.portariaData)}, solicito a V. S.ª as providências necessárias ao comparecimento no dia ${dataExtenso(c.data)}, às ${c.hora || "__:__"} horas, em ${local}.`,
          "",
          `2. ${c.justificativa || "A medida destina-se à instrução do procedimento, nos termos da EB10-IG-09.001."}`,
          "",
          "3. Coloco-me à disposição para os esclarecimentos que se fizerem necessários.",
        ].join("\n");

      case "certidao": {
        const dataTxt = c.data ? dataPorExtenso(c.data) : "“data por extenso”";
        return [
          subcabecalhoProcesso(s),
          "CERTIDÃO",
          "",
          `Certifico que, aos ${dataTxt}, ${c.justificativa || "“fato certificado”"}.`,
          "",
          "Do que para constar, lavrei o presente termo.",
        ].join("\n");
      }

      case "encerramento":
        return [
          subcabecalhoProcesso(s),
          "TERMO DE ENCERRAMENTO DA INSTRUÇÃO",
          "",
          `Aos ${dataPorExtenso(c.data)}, nesta cidade de ${local}, o Sindicante declara encerrada a fase instrutória do procedimento instaurado pela Portaria nº ${s.portariaNumero || "____"}, de ${dataExtenso(s.portariaData)}, havendo sido produzidas todas as provas reputadas necessárias ao esclarecimento dos fatos.`,
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
          `Notifico V. S.ª, ${s.sindicado || "Posto/Grad e Nome de Guerra"}, do encerramento da instrução da Sindicância instaurada pela Portaria nº ${s.portariaNumero || "____"}, de ${dataExtenso(s.portariaData)}.`,
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
          `1. Solicito a prorrogação do prazo para conclusão da Sindicância instaurada pela Portaria nº ${s.portariaNumero || "____"}, de ${dataExtenso(s.portariaData)}, por mais ${c.prazoDias || "20"} (____) dias corridos.`,
          "",
          `2. Justificativa: ${c.justificativa || "necessidade de realização de diligências imprescindíveis à elucidação dos fatos, ainda pendentes de conclusão."}`,
          "",
          "3. O pedido encontra amparo na Portaria C Ex nº 2.394/2024 (EB10-IG-09.001).",
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
    ? j.anexos.map((a, i) => `${i + 1}. ${a.descricao}`).join("\n\n")
    : "(nenhum item juntado até o momento)";

  const corpo = [
    ...ESPACO_ANTES_TITULO,
    titulo,
    "",
    `Aos ${dataPorExtenso(j.data)}, nesta cidade de ${s.local || "____________"}, no quartel do ${s.om || "OM"}, faço a juntada aos autos da presente sindicância dos documentos a seguir especificados, do que, para constar, lavrei o presente termo.`,
    "",
    listaAnexos,
  ].join("\n");

  return `${cabecalho(s)}${corpo}\n${assinatura(s)}`;
}

/**
 * Texto "efetivo" de uma juntada: o editado manualmente pelo usuário no Gerador
 * Dinâmico de Peças (`textoEditado`), se houver algum conteúdo digitado, senão o
 * texto gerado automaticamente a partir da lista de anexos (gerarTextoJuntada).
 * Usada tanto para pré-preencher a área de edição livre quanto — do lado do
 * servidor, em sincronizarDocumentoJuntada (sindicancias.functions.ts) — para
 * decidir o que efetivamente vai para o Google Docs.
 */
export function textoEfetivoJuntada(s: Sindicancia, j: Juntada): string {
  return j.textoEditado && j.textoEditado.trim() ? j.textoEditado : gerarTextoJuntada(s, j);
}

/**
 * Um registro da tabela "Dados_Sindicado" — uma sindicância pode ter vários (um por
 * sindicado). Vínculo com a sindicância é pelo id (não pelo NUP). `linha` é a posição na
 * planilha, preenchida pelo servidor; ausente/undefined significa "ainda não salvo".
 */
export type DadoSindicado = {
  linha?: number;
  sindicanciaId: string;
  /** Select inicial — dele depende quais campos abaixo fazem sentido mostrar. */
  civil: "Militar" | "Civil" | "";
  /** Identidade (RG civil ou identidade militar). */
  idt: string;
  cpf: string;
  nascimento: string;
  naturalidade: string;
  estadoCivil: string;
  filiacao: string;
  mae: string;
  /** Inclui o CEP digitado junto ao restante do endereço. */
  enderecoCompleto: string;
  /** Só faz sentido se militar. */
  companhia: string;
  /** Só faz sentido se civil. */
  vocativo: string;
};

/** Opções fixas de estado civil. */
export const ESTADO_CIVIL_OPCOES = ["Solteiro", "Casado", "Divorciado", "Viúvo"] as const;

/** Formata dígitos de CPF no padrão oficial 000.000.000-00 conforme o usuário digita. */
export function formatarCPF(valor: string): string {
  const digitos = valor.replace(/\D/g, "").slice(0, 11);
  if (digitos.length > 9) {
    return `${digitos.slice(0, 3)}.${digitos.slice(3, 6)}.${digitos.slice(6, 9)}-${digitos.slice(9)}`;
  }
  if (digitos.length > 6) {
    return `${digitos.slice(0, 3)}.${digitos.slice(3, 6)}.${digitos.slice(6)}`;
  }
  if (digitos.length > 3) {
    return `${digitos.slice(0, 3)}.${digitos.slice(3)}`;
  }
  return digitos;
}

/**
 * Monta o parágrafo de qualificação do sindicado a partir de um DadoSindicado — civil e
 * militar têm textos ligeiramente diferentes (vocativo só entra no civil; unidade/companhia
 * só entra no militar). Pronta para ser usada no Termo de Depoimento, Ofícios, Diex e no
 * Relatório Final.
 */
export function gerarQualificacaoSindicado(d: DadoSindicado): string {
  const nascimentoTxt = d.nascimento ? dataExtenso(d.nascimento) : "“data de nascimento”";
  const idtTxt = d.idt || "“identidade”";
  const cpfTxt = d.cpf || "“CPF”";
  const naturalidadeTxt = d.naturalidade || "“naturalidade”";
  const estadoCivilTxt = d.estadoCivil || "“estado civil”";
  const filiacaoTxt = d.filiacao || "“filiação”";
  const maeTxt = d.mae || "“mãe”";
  const enderecoTxt = d.enderecoCompleto || "“endereço”";

  if (d.civil === "Militar") {
    const companhiaTxt = d.companhia || "“companhia/unidade”";
    return `portador(a) da identidade militar nº ${idtTxt}, CPF nº ${cpfTxt}, nascido(a) em ${nascimentoTxt}, natural de ${naturalidadeTxt}, ${estadoCivilTxt}, filho(a) de ${filiacaoTxt} e de ${maeTxt}, servindo na ${companhiaTxt}, residente em ${enderecoTxt}`;
  }

  const vocativoTxt = d.vocativo || "Senhor(a)";
  return `${vocativoTxt}, portador(a) da carteira de identidade nº ${idtTxt}, CPF nº ${cpfTxt}, nascido(a) em ${nascimentoTxt}, natural de ${naturalidadeTxt}, ${estadoCivilTxt}, filho(a) de ${filiacaoTxt} e de ${maeTxt}, residente em ${enderecoTxt}`;
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
      `A presente Sindicância foi instaurada pela Portaria nº ${s.portariaNumero || "____"}, de ${dataExtenso(s.portariaData)}, da lavra do(a) ${s.autoridade || "Autoridade Instauradora"}, a fim de apurar ${s.objeto || "os fatos nela descritos"}.`,
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

/** Tipo mínimo de peça exportada de que gerarDiligenciasRealizadas precisa — evita
 *  importar o tipo completo de Sindicancia["documentos"][number] repetidamente. */
type PecaExportadaResumo = { pecaId?: string; texto?: string };

/** Extrai, de um DIEx/Ofício já exportado (a partir do texto que o próprio app
 *  gerou — por isso as expressões regulares abaixo batem com certeza), um resumo
 *  curto no padrão do Anexo W: número do expediente, data (quando identificável) e
 *  destinatário. Best-effort: o resultado é só um ponto de partida editável. */
function resumoDiexOuOficio(pecaId: string, texto: string): string {
  if (pecaId === "diex") {
    const numero = texto.match(/DIEx nº (\S+)/)?.[1];
    const destinatario = texto.match(/Ao\(À\) (.+)/)?.[1]?.trim();
    const partes = [
      `DIEx nº ${numero ?? "____"}-Sind`,
      destinatario ? `dirigido a ${destinatario}` : undefined,
    ].filter(Boolean);
    return partes.join(", ");
  }
  // oficio
  const numero = texto.match(/Ofício nº (\S+)/)?.[1];
  const destinatario = texto.match(/Ao Senhor (.+)/)?.[1]?.trim();
  const dataAto = texto.match(/no dia (.+?), às/)?.[1];
  const partes = [
    `Ofício nº ${numero ?? "____"}-Sind`,
    dataAto ? `de ${dataAto}` : undefined,
    destinatario ? `dirigido a ${destinatario}` : undefined,
  ].filter(Boolean);
  return partes.join(", ");
}

/**
 * Gera o texto do item "2. DILIGÊNCIAS REALIZADAS" do Relatório, no padrão do
 * ANEXO W da EB10-IG-09.001 (relação numerada de despachos, DIEx/ofícios expedidos
 * e juntadas, cada item com a folha em que consta nos autos) — modelo real
 * observado em sindicâncias já produzidas por esta OM:
 *   "1. Of nº01-Sind, 26 de maio de 2026, dirigido a ..., notificando... (folha nº
 *   04); 2. DIEx nº 001-Sind, ... (folha nº 37); ... e N. ... (folha nº X)."
 * Percorre `s.documentos` NA ORDEM em que aparecem nos autos (a posição+1 é a
 * mesma numeração "Fls. N" usada no documento único — ver rebuildAutos em
 * google.server.ts) e inclui despachos, DIEx/ofícios e juntadas; ignora as demais
 * peças (abertura, encerramento, notificações, relatório etc., que não são
 * "diligências" no sentido do Anexo W). Devolve um texto pronto para colar no
 * campo — o usuário pode (e deve) revisar/ajustar depois, já que a extração dos
 * dados de cada peça é best-effort (ver resumoDiexOuOficio).
 */
export function gerarDiligenciasRealizadas(s: Sindicancia): string {
  const documentos = s.documentos as PecaExportadaResumo[];
  const itens: string[] = [];

  documentos.forEach((d, idx) => {
    const folha = idx + 1;

    if (d.pecaId?.startsWith("juntada-")) {
      const juntada = s.juntadas.find((j) => `juntada-${j.id}` === d.pecaId);
      if (!juntada) return;
      itens.push(
        `Juntada nº ${juntada.numero}, de ${dataExtenso(juntada.data)} (folha nº ${folha})`,
      );
      return;
    }

    if (d.pecaId === "diex" || d.pecaId === "oficio") {
      itens.push(`${resumoDiexOuOficio(d.pecaId, d.texto ?? "")} (folha nº ${folha})`);
      return;
    }

    if (d.pecaId === "despacho-inicial" || d.pecaId === "despacho-diversos") {
      const dataAto = (d.texto ?? "").match(/Quartel em .+?,\s*(.+?)\./)?.[1];
      itens.push(`Despacho${dataAto ? `, de ${dataAto},` : ""} (folha nº ${folha})`);
    }
  });

  const introducao =
    "Com o escopo de reunir elementos probatórios que pudessem esclarecer o fato objeto da presente sindicância, este encarregado houve por bem diligenciar, tendo sido procedidas as seguintes diligências:";

  if (!itens.length) return introducao;

  const lista = itens
    .map((texto, i) => {
      const numero = i + 1;
      const fechamento = i === itens.length - 1 ? "." : i === itens.length - 2 ? "; e" : ";";
      return `${numero}. ${texto}${fechamento}`;
    })
    .join("\n\n");

  return `${introducao}\n\n${lista}`;
}
