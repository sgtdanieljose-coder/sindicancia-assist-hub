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
  documentos: { titulo: string; documentId: string; url: string }[];
  atualizadoEm: string;
};

export const ETAPAS = [
  "Recebimento da Portaria de instauração",
  "Termo de Abertura dos Trabalhos",
  "Notificação prévia do sindicado",
  "Autuação e juntada de documentos",
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
  { id: "abertura", nome: "Termo de Abertura dos Trabalhos" },
  { id: "notificacao", nome: "Notificação Prévia do Sindicado" },
  { id: "inquiricao", nome: "Termo de Inquirição de Testemunha" },
  { id: "depoimento", nome: "Termo de Depoimento do Sindicado" },
  { id: "oficio", nome: "Ofício / Mandado de Intimação" },
  { id: "juntada", nome: "Termo de Juntada de Documentos" },
  { id: "encerramento", nome: "Termo de Encerramento da Instrução" },
  { id: "alegacoes", nome: "Notificação para Alegações Finais" },
  { id: "prorrogacao", nome: "Pedido de Prorrogação de Prazo" },
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
};

export function diasCorridos(dataInicio: string) {
  if (!dataInicio) return 0;
  const inicio = new Date(`${dataInicio}T00:00:00`);
  if (Number.isNaN(inicio.getTime())) return 0;
  const hoje = new Date();
  return Math.floor((hoje.getTime() - inicio.getTime()) / 86_400_000);
}

function dataExtenso(iso: string) {
  if (!iso) return "____ de __________ de ______";
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
}

const linha = "_".repeat(66);

function cabecalho(s: Sindicancia) {
  return [
    "MINISTÉRIO DA DEFESA",
    "EXÉRCITO BRASILEIRO",
    (s.om || "ORGANIZAÇÃO MILITAR").toUpperCase(),
    "",
    `SINDICÂNCIA — NUP/NUD ${s.nup || "____________"}`,
    `Portaria nr ${s.portariaNumero || "____"}, de ${dataExtenso(s.portariaData)}`,
    linha,
    "",
  ].join("\n");
}

function fecho(s: Sindicancia, c: PecaCampos) {
  return [
    "",
    `${c.local || "________________"}, ${dataExtenso(c.data)}.`,
    "",
    "",
    "____________________________________",
    `${s.sindicante || "Posto/Grad e Nome de Guerra"}`,
    "Encarregado da Sindicância",
    "",
    "Referências: Portaria C Ex nr 2.394/2024 (EB10-IG-09.001) e EB10-IG-01.001.",
  ].join("\n");
}

export function gerarPeca(peca: PecaId, s: Sindicancia, c: PecaCampos): string {
  const head = cabecalho(s);
  const corpo = (() => {
    switch (peca) {
      case "abertura":
        return [
          "TERMO DE ABERTURA DOS TRABALHOS",
          "",
          `Aos ${dataExtenso(c.data)}, às ${c.hora || "__:__"} horas, nas dependências da ${s.om || "OM"}, o Encarregado da Sindicância abaixo assinado, designado pela Portaria nr ${s.portariaNumero || "____"}, de ${dataExtenso(s.portariaData)}, da lavra do(a) ${s.autoridade || "Autoridade Instauradora"}, dá por iniciados os trabalhos apuratórios destinados a ${s.objeto || "apurar os fatos constantes da portaria instauradora"}.`,
          "",
          "Os trabalhos observarão o rito da Portaria C Ex nr 2.394/2024 (EB10-IG-09.001), assegurados o contraditório e a ampla defesa, com prazo de 30 (trinta) dias corridos para conclusão, prorrogável na forma regulamentar.",
          "",
          "Para constar, lavrei o presente termo, que vai por mim assinado.",
        ].join("\n");

      case "notificacao":
        return [
          "NOTIFICAÇÃO PRÉVIA DO SINDICADO",
          "",
          `Notifico V. S.ª, ${s.sindicado || "Posto/Grad e Nome de Guerra do sindicado"}, ${c.qualificacao || "qualificação"}, de que responde à presente Sindicância, instaurada pela Portaria nr ${s.portariaNumero || "____"}, de ${dataExtenso(s.portariaData)}, tendo por objeto ${s.objeto || "os fatos nela descritos"}.`,
          "",
          "Fica assegurado o direito ao contraditório e à ampla defesa, podendo acompanhar todos os atos do procedimento, pessoalmente ou por procurador, arrolar testemunhas, requerer diligências e produzir provas em direito admitidas.",
          "",
          `Deverá comparecer no dia ${dataExtenso(c.data)}, às ${c.hora || "__:__"} horas, em ${c.local || "____________"}, a fim de ser ouvido em declarações.`,
        ].join("\n");

      case "inquiricao":
        return [
          "TERMO DE INQUIRIÇÃO DE TESTEMUNHA",
          "",
          `Aos ${dataExtenso(c.data)}, às ${c.hora || "__:__"} horas, em ${c.local || "____________"}, presente o Encarregado da Sindicância, compareceu ${c.destinatario || "Posto/Grad e Nome de Guerra"}, ${c.qualificacao || "qualificação"}, na condição de testemunha, advertido(a) das penas cominadas ao falso testemunho, prometeu dizer a verdade do que soubesse e lhe fosse perguntado.`,
          "",
          "PERGUNTAS FORMULADAS:",
          c.perguntas || "1) ...",
          "",
          "RESPOSTAS:",
          c.respostas || "1) ...",
          "",
          "Nada mais havendo, encerrou-se o presente termo, lido e achado conforme, que vai assinado pelo Encarregado e pelo(a) depoente.",
          "",
          "",
          "____________________________________",
          "Depoente",
        ].join("\n");

      case "depoimento":
        return [
          "TERMO DE DECLARAÇÕES DO SINDICADO",
          "",
          `Aos ${dataExtenso(c.data)}, às ${c.hora || "__:__"} horas, em ${c.local || "____________"}, presente o Encarregado da Sindicância, compareceu ${s.sindicado || "Posto/Grad e Nome de Guerra"}, ${c.qualificacao || "qualificação"}, na condição de sindicado, cientificado do direito ao silêncio, ao contraditório e à ampla defesa, respondeu:`,
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
          `Ofício nr ____ - Sind ${s.nup || ""}`,
          "",
          `Ao Senhor ${c.destinatario || "Posto/Grad e Nome de Guerra / Autoridade"}`,
          `${c.qualificacao || "Função / Endereço"}`,
          "",
          "Assunto: Intimação para comparecimento",
          "",
          `1. Na condição de Encarregado da Sindicância instaurada pela Portaria nr ${s.portariaNumero || "____"}, de ${dataExtenso(s.portariaData)}, solicito a V. S.ª as providências necessárias ao comparecimento no dia ${dataExtenso(c.data)}, às ${c.hora || "__:__"} horas, em ${c.local || "____________"}.`,
          "",
          `2. ${c.justificativa || "A medida destina-se à instrução do procedimento, nos termos da EB10-IG-09.001."}`,
          "",
          "3. Coloco-me à disposição para os esclarecimentos que se fizerem necessários.",
        ].join("\n");

      case "juntada":
        return [
          "TERMO DE JUNTADA DE DOCUMENTOS",
          "",
          `Aos ${dataExtenso(c.data)}, nesta ${s.om || "OM"}, o Encarregado da Sindicância determinou a juntada aos autos dos seguintes documentos:`,
          "",
          c.documentos || "a) ...",
          "",
          `${c.justificativa || "Os documentos são pertinentes à apuração e passam a integrar os autos, devidamente numerados e rubricados."}`,
          "",
          "Para constar, lavrei o presente termo.",
        ].join("\n");

      case "encerramento":
        return [
          "TERMO DE ENCERRAMENTO DA INSTRUÇÃO",
          "",
          `Aos ${dataExtenso(c.data)}, o Encarregado da Sindicância declara encerrada a fase instrutória do procedimento instaurado pela Portaria nr ${s.portariaNumero || "____"}, de ${dataExtenso(s.portariaData)}, havendo sido produzidas todas as provas reputadas necessárias ao esclarecimento dos fatos.`,
          "",
          `${c.justificativa || "Não subsistem diligências pendentes."}`,
          "",
          "Determino a notificação do sindicado para apresentação de alegações finais, nos termos da EB10-IG-09.001.",
        ].join("\n");

      case "alegacoes":
        return [
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
          "PEDIDO DE PRORROGAÇÃO DE PRAZO",
          "",
          `Ao(À) ${s.autoridade || "Autoridade Instauradora"}`,
          "",
          `1. Solicito a prorrogação do prazo para conclusão da Sindicância instaurada pela Portaria nr ${s.portariaNumero || "____"}, de ${dataExtenso(s.portariaData)}, por mais ${c.prazoDias || "20"} (____) dias corridos.`,
          "",
          `2. Justificativa: ${c.justificativa || "necessidade de realização de diligências imprescindíveis à elucidação dos fatos, ainda pendentes de conclusão."}`,
          "",
          "3. O pedido encontra amparo na Portaria C Ex nr 2.394/2024 (EB10-IG-09.001).",
          "",
          "4. Nestes termos, peço deferimento.",
        ].join("\n");
    }
  })();

  return `${head}${corpo}\n${fecho(s, c)}\n`;
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
    fecho(s, {
      local,
      data,
      hora: "",
      destinatario: "",
      qualificacao: "",
      documentos: "",
      perguntas: "",
      respostas: "",
      justificativa: "",
      prazoDias: "",
    }),
  ].join("\n");
}
