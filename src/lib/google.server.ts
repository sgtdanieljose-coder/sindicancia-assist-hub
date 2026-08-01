const GATEWAY = "https://connector-gateway.lovable.dev";

type Connector = "google_sheets" | "google_docs" | "google_drive";

const KEY_ENV: Record<Connector, string> = {
  google_sheets: "GOOGLE_SHEETS_API_KEY",
  google_docs: "GOOGLE_DOCS_API_KEY",
  google_drive: "GOOGLE_DRIVE_API_KEY",
};

export async function gw<T = unknown>(
  connector: Connector,
  path: string,
  init: { method?: string; body?: unknown; query?: Record<string, string> } = {},
): Promise<T> {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const connKey = process.env[KEY_ENV[connector]];
  if (!lovableKey || !connKey) {
    throw new Error(`Conexão Google indisponível (${connector}). Reconecte o Google Workspace.`);
  }

  const qs = init.query ? `?${new URLSearchParams(init.query).toString()}` : "";
  const res = await fetch(`${GATEWAY}/${connector}${path}${qs}`, {
    method: init.method ?? "GET",
    headers: {
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": connKey,
      "Content-Type": "application/json",
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`Gateway ${connector} ${path} falhou [${res.status}]: ${text}`);
    if (res.status === 429) {
      throw new Error(
        "Limite de requisições do Google atingido momentaneamente. Aguarde alguns instantes e clique em Atualizar.",
      );
    }
    throw new Error(`Google API [${res.status}]: ${text.slice(0, 400)}`);
  }

  return (await res.json()) as T;
}

/** Chamada crua ao gateway (usada em uploads multipart do Drive). */
export async function gwRaw(
  connector: Connector,
  path: string,
  init: { method: string; body: BodyInit; contentType: string; query?: Record<string, string> },
): Promise<Record<string, unknown>> {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const connKey = process.env[KEY_ENV[connector]];
  if (!lovableKey || !connKey) {
    throw new Error(`Conexão Google indisponível (${connector}). Reconecte o Google Workspace.`);
  }
  const qs = init.query ? `?${new URLSearchParams(init.query).toString()}` : "";
  const res = await fetch(`${GATEWAY}/${connector}${path}${qs}`, {
    method: init.method,
    headers: {
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": connKey,
      "Content-Type": init.contentType,
    },
    body: init.body,
  });
  if (!res.ok) {
    const text = await res.text();
    console.error(`Gateway ${connector} ${path} falhou [${res.status}]: ${text}`);
    throw new Error(`Google API [${res.status}]: ${text.slice(0, 400)}`);
  }
  return (await res.json()) as Record<string, unknown>;
}

export const SPREADSHEET_ID = "1Fy-JSNpRJXKE89Wm--zo0cFPJwU1Daf_ygUg78-s1jI";
export const DRIVE_FOLDER_ID = "1zcQGM4T6-PAiEttCAdK6aqNBrUnQ-u6G";
export const SHEET_TAB = "Sindicancias";

/** URL pública do brasão da República inserido no topo de toda peça. */
export const BRASAO_URL =
  "https://sindicancia-assist-hub.lovable.app/__l5e/assets-v1/f23d5d02-916f-4e73-809c-9fe4c6876f2e/brasao-republica.png";

export const HEADERS = [
  "id",
  "nup",
  "portaria_numero",
  "portaria_data",
  "om",
  "autoridade",
  "sindicante",
  "sindicado",
  "objeto",
  "status",
  "etapas",
  "documentos",
  "atualizado_em",
  "pasta_id",
  "pasta_url",
  "anexos_id",
  "anexos_url",
  "local",
  "subordinacao",
  "om_instauradora",
  "autos_doc_id",
  "autos_url",
  "juntadas",
  "prazo_prorrogado_dias",
];

/** Converte um índice de coluna 1-based em letra de coluna do Sheets (1 -> A, 17 -> Q, 27 -> AA...). */
function columnLetter(index: number): string {
  let n = index;
  let letra = "";
  while (n > 0) {
    const resto = (n - 1) % 26;
    letra = String.fromCharCode(65 + resto) + letra;
    n = Math.floor((n - 1) / 26);
  }
  return letra;
}

const ULTIMA_COLUNA = columnLetter(HEADERS.length);

export async function ensureTab() {
  const meta = await gw<{ sheets: { properties: { title: string } }[] }>(
    "google_sheets",
    `/v4/spreadsheets/${SPREADSHEET_ID}`,
    { query: { fields: "sheets.properties.title" } },
  );
  const exists = meta.sheets?.some((s) => s.properties.title === SHEET_TAB);

  if (!exists) {
    await gw("google_sheets", `/v4/spreadsheets/${SPREADSHEET_ID}:batchUpdate`, {
      method: "POST",
      body: { requests: [{ addSheet: { properties: { title: SHEET_TAB } } }] },
    });
    await gw(
      "google_sheets",
      `/v4/spreadsheets/${SPREADSHEET_ID}/values/${SHEET_TAB}!A1:${ULTIMA_COLUNA}1`,
      {
        method: "PUT",
        query: { valueInputOption: "RAW" },
        body: { values: [HEADERS] },
      },
    );
    return;
  }

  // Migração: se a aba já existia antes das colunas de pasta do Drive serem adicionadas,
  // garante que o cabeçalho seja atualizado sem tocar nas linhas de dados existentes.
  const cabecalhoAtual = await gw<{ values?: string[][] }>(
    "google_sheets",
    `/v4/spreadsheets/${SPREADSHEET_ID}/values/${SHEET_TAB}!A1:${ULTIMA_COLUNA}1`,
  );
  if ((cabecalhoAtual.values?.[0]?.length ?? 0) < HEADERS.length) {
    await gw(
      "google_sheets",
      `/v4/spreadsheets/${SPREADSHEET_ID}/values/${SHEET_TAB}!A1:${ULTIMA_COLUNA}1`,
      {
        method: "PUT",
        query: { valueInputOption: "RAW" },
        body: { values: [HEADERS] },
      },
    );
  }
}

export async function readRows(): Promise<string[][]> {
  await ensureTab();
  const data = await gw<{ values?: string[][] }>(
    "google_sheets",
    `/v4/spreadsheets/${SPREADSHEET_ID}/values/${SHEET_TAB}!A2:${ULTIMA_COLUNA}1000`,
  );
  return (data.values ?? []).filter((r) => r[0]);
}

export async function appendRow(row: string[]) {
  await ensureTab();
  await gw(
    "google_sheets",
    `/v4/spreadsheets/${SPREADSHEET_ID}/values/${SHEET_TAB}!A:${ULTIMA_COLUNA}:append`,
    {
      method: "POST",
      query: { valueInputOption: "USER_ENTERED", insertDataOption: "INSERT_ROWS" },
      body: { values: [row] },
    },
  );
}

export async function updateRow(rowIndex: number, row: string[]) {
  const a1 = `${SHEET_TAB}!A${rowIndex}:${ULTIMA_COLUNA}${rowIndex}`;
  await gw("google_sheets", `/v4/spreadsheets/${SPREADSHEET_ID}/values/${a1}`, {
    method: "PUT",
    query: { valueInputOption: "USER_ENTERED" },
    body: { values: [row] },
  });
}

/**
 * Verifica se um arquivo/pasta do Drive ainda existe e não está na lixeira. O Drive costuma
 * mover para a lixeira em vez de apagar de vez, e a API do Docs continua aceitando leitura e
 * escrita em arquivos na lixeira — por isso não basta tentar escrever e ver se deu erro.
 */
export async function arquivoAtivo(id?: string): Promise<boolean> {
  if (!id) return false;
  try {
    const meta = await gw<{ trashed?: boolean }>("google_drive", `/drive/v3/files/${id}`, {
      query: { fields: "trashed" },
    });
    return !meta.trashed;
  } catch {
    return false;
  }
}

/** Busca uma subpasta pelo nome dentro de um pai; cria se não existir. Idempotente. */
async function obterOuCriarPasta(
  nome: string,
  paiId: string,
): Promise<{ id: string; url: string }> {
  const nomeEscapado = nome.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
  const busca = await gw<{ files?: { id: string; name: string }[] }>(
    "google_drive",
    "/drive/v3/files",
    {
      query: {
        q: `name = '${nomeEscapado}' and mimeType = 'application/vnd.google-apps.folder' and '${paiId}' in parents and trashed = false`,
        fields: "files(id,name)",
        spaces: "drive",
      },
    },
  );

  const existente = busca.files?.[0];
  if (existente) {
    return { id: existente.id, url: `https://drive.google.com/drive/folders/${existente.id}` };
  }

  const criada = await gw<{ id: string }>("google_drive", "/drive/v3/files", {
    method: "POST",
    query: { fields: "id" },
    body: {
      name: nome,
      mimeType: "application/vnd.google-apps.folder",
      parents: [paiId],
    },
  });

  return { id: criada.id, url: `https://drive.google.com/drive/folders/${criada.id}` };
}

/**
 * Garante a estrutura de pastas de uma sindicância no Drive: <PASTA BASE>/<NUP>/Anexos.
 * Idempotente — se as pastas já existirem (mesmo nome, mesmo pai), reaproveita em vez de duplicar.
 */
export async function ensureSindicanciaFolders(nup: string) {
  const nome = nup.trim();
  if (!nome) {
    throw new Error("NUP vazio: não é possível criar a pasta da sindicância no Drive.");
  }

  const pasta = await obterOuCriarPasta(nome, DRIVE_FOLDER_ID);
  const anexos = await obterOuCriarPasta("Anexos", pasta.id);

  return {
    pastaId: pasta.id,
    pastaUrl: pasta.url,
    anexosId: anexos.id,
    anexosUrl: anexos.url,
  };
}

/** Insere o brasão da República centralizado no início do documento (best-effort). */
async function inserirBrasao(documentId: string, index = 1) {
  try {
    await gw("google_docs", `/v1/documents/${documentId}:batchUpdate`, {
      method: "POST",
      body: {
        requests: [
          {
            insertInlineImage: {
              location: { index },
              uri: BRASAO_URL,
              objectSize: {
                height: { magnitude: 70, unit: "PT" },
                width: { magnitude: 62, unit: "PT" },
              },
            },
          },
          {
            updateParagraphStyle: {
              range: { startIndex: index, endIndex: index + 1 },
              paragraphStyle: { alignment: "CENTER" },
              fields: "alignment",
            },
          },
        ],
      },
    });
  } catch (e) {
    console.warn("Não foi possível inserir o brasão no documento:", e);
  }
}

/** Cria um Google Doc com brasão + texto e devolve id/url. */
export async function createDoc(title: string, content: string, pastaId?: string) {
  const doc = await gw<{ documentId: string }>("google_docs", "/v1/documents", {
    method: "POST",
    body: { title },
  });

  await gw("google_docs", `/v1/documents/${doc.documentId}:batchUpdate`, {
    method: "POST",
    body: {
      requests: [{ insertText: { location: { index: 1 }, text: `\n${content}` } }],
    },
  });
  await inserirBrasao(doc.documentId, 1);

  // Tenta arquivar na pasta da sindicância (ou na pasta geral, se ela ainda não tiver uma). Best-effort.
  try {
    await gw("google_drive", `/drive/v3/files/${doc.documentId}`, {
      method: "PATCH",
      query: { addParents: pastaId || DRIVE_FOLDER_ID, fields: "id,parents" },
      body: {},
    });
  } catch (e) {
    console.warn("Não foi possível mover o documento para a pasta do Drive:", e);
  }

  return {
    documentId: doc.documentId,
    url: `https://docs.google.com/document/d/${doc.documentId}/edit`,
    embedUrl: `https://docs.google.com/document/d/${doc.documentId}/preview`,
  };
}

type DocElement = {
  startIndex?: number;
  endIndex?: number;
  paragraph?: { elements?: { textRun?: { content?: string } }[] };
};

/** Extrai o texto puro de um Google Doc. */
export async function getDocText(documentId: string): Promise<string> {
  const doc = await gw<{ body?: { content?: DocElement[] } }>(
    "google_docs",
    `/v1/documents/${documentId}`,
  );
  const partes: string[] = [];
  for (const el of doc.body?.content ?? []) {
    for (const e of el.paragraph?.elements ?? []) {
      if (e.textRun?.content) partes.push(e.textRun.content);
    }
  }
  return partes
    .join("")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

type Paragrafo = { startIndex: number; endIndex: number; texto: string };

async function listarParagrafos(documentId: string): Promise<Paragrafo[]> {
  const doc = await gw<{ body?: { content?: DocElement[] } }>(
    "google_docs",
    `/v1/documents/${documentId}`,
  );
  const paragrafos: Paragrafo[] = [];
  for (const el of doc.body?.content ?? []) {
    if (!el.paragraph || el.startIndex === undefined || el.endIndex === undefined) continue;
    const texto = (el.paragraph.elements ?? []).map((e) => e.textRun?.content ?? "").join("");
    paragrafos.push({ startIndex: el.startIndex, endIndex: el.endIndex, texto });
  }
  return paragrafos;
}

// ====================================================================================
// Formatação-base de toda peça (documento individual E a cópia dela dentro do
// documento único dos autos — ver gruposFormatacaoPeca/rebuildAutos abaixo, que usam
// exatamente a mesma lógica nos dois lugares, para nunca ficarem dessincronizados):
//
//   1) Brasão da República no topo (inserido separadamente por inserirBrasao).
//   2) Cabeçalho institucional (timbre / Subordinação) em negrito e centralizado.
//   3) 4 linhas em branco entre o cabeçalho e o título da peça (ver ESPACO_ANTES_TITULO
//      em pecas.ts, usado ao gerar o texto).
//   4) Título da peça em negrito, sublinhado e centralizado.
//   5) Corpo do texto (peças com um parágrafo narrativo) justificado, com recuo na
//      primeira linha.
//   6) Assinatura ao final: nome centralizado em peso normal, e a função/cargo
//      (ex.: "Sindicante") centralizada e em negrito — sempre os dois últimos
//      parágrafos não vazios, já que toda peça (exceto a Capa) termina com assinatura(s).
//
// Reconhecida pelo TEXTO já inserido (não por posição fixa), então sobrevive a ajustes
// que o usuário faça na minuta antes de exportar.
//
// Para estender a uma peça nova: basta cadastrar o título literal dela em TITULOS_PECA
// — o resto (negrito/centralização/sublinhado/justificado/assinatura) é automático a
// partir daí, tanto no documento individual quanto no consolidado.
// ====================================================================================

/** Título literal (linha exata no corpo do texto) de cada peça que já segue a convenção acima. */
const TITULOS_PECA: Partial<Record<string, string>> = {
  autos: "AUTOS DE SINDICÂNCIA",
  abertura: "TERMO DE ABERTURA",
  juntada: "JUNTADA",
};

const ROTULOS_CAPA = ["NUP:", "SINDICANTE:", "SINDICADO:", "OBJETO:"];

/** Cabeçalho (tudo antes do título) em negrito+centralizado; título em negrito+sublinhado+
 *  centralizado. Não faz nada se o título não for encontrado (evita negritar o documento
 *  inteiro por engano quando a peça ainda não tem uma convenção de título cadastrada). */
function requestsCabecalhoTitulo(paragrafos: Paragrafo[], titulo: string): unknown[] {
  if (!paragrafos.some((p) => p.texto.replace(/\n$/, "").trim() === titulo)) return [];

  const requests: unknown[] = [];
  let noCabecalho = true;
  for (const p of paragrafos) {
    const texto = p.texto.replace(/\n$/, "");
    const conteudo = texto.trim();
    if (!conteudo) continue;
    const inicio = p.startIndex;
    const fim = p.startIndex + texto.length;

    if (conteudo === titulo) {
      noCabecalho = false;
      requests.push(
        {
          updateTextStyle: {
            range: { startIndex: inicio, endIndex: fim },
            textStyle: { bold: true, underline: true },
            fields: "bold,underline",
          },
        },
        {
          updateParagraphStyle: {
            range: { startIndex: inicio, endIndex: fim },
            paragraphStyle: { alignment: "CENTER" },
            fields: "alignment",
          },
        },
      );
      continue;
    }

    if (noCabecalho) {
      requests.push(
        {
          updateTextStyle: {
            range: { startIndex: inicio, endIndex: fim },
            textStyle: { bold: true },
            fields: "bold",
          },
        },
        {
          updateParagraphStyle: {
            range: { startIndex: inicio, endIndex: fim },
            paragraphStyle: { alignment: "CENTER" },
            fields: "alignment",
          },
        },
      );
    }
  }
  return requests;
}

/** Parágrafos entre o título e os dois últimos (a assinatura) justificados, com recuo de
 *  primeira linha — o corpo narrativo da peça. */
function requestsCorpoJustificado(paragrafos: Paragrafo[], titulo: string): unknown[] {
  const naoVazios = paragrafos.filter((p) => p.texto.trim());
  const idxTitulo = naoVazios.findIndex((p) => p.texto.replace(/\n$/, "").trim() === titulo);
  if (idxTitulo < 0) return [];

  const requests: unknown[] = [];
  for (let i = idxTitulo + 1; i < naoVazios.length - 2; i++) {
    const texto = naoVazios[i].texto.replace(/\n$/, "");
    requests.push({
      updateParagraphStyle: {
        range: {
          startIndex: naoVazios[i].startIndex,
          endIndex: naoVazios[i].startIndex + texto.length,
        },
        paragraphStyle: { alignment: "JUSTIFIED", indentFirstLine: { magnitude: 36, unit: "PT" } },
        fields: "alignment,indentFirstLine",
      },
    });
  }
  return requests;
}

/** Assinatura final: sempre os dois últimos parágrafos não vazios — nome centralizado (peso
 *  normal) e função/cargo (última linha) centralizada e em negrito. Não usar na Capa, que
 *  não tem assinatura. */
function requestsAssinatura(paragrafos: Paragrafo[]): unknown[] {
  const naoVazios = paragrafos.filter((p) => p.texto.trim());
  if (naoVazios.length < 2) return [];

  const requests: unknown[] = [];
  naoVazios.slice(-2).forEach((p, i) => {
    const texto = p.texto.replace(/\n$/, "");
    const inicio = p.startIndex;
    const fim = p.startIndex + texto.length;
    const ehFuncao = i === 1;
    requests.push(
      {
        updateParagraphStyle: {
          range: { startIndex: inicio, endIndex: fim },
          paragraphStyle: { alignment: "CENTER" },
          fields: "alignment",
        },
      },
      ...(ehFuncao
        ? [
            {
              updateTextStyle: {
                range: { startIndex: inicio, endIndex: fim },
                textStyle: { bold: true },
                fields: "bold",
              },
            },
          ]
        : []),
    );
  });
  return requests;
}

/** Rótulos NUP:/SINDICANTE:/SINDICADO:/OBJETO: em negrito (mantendo o valor em texto normal) —
 *  específico da Capa dos Autos, que não segue o padrão corpo+assinatura das demais peças. */
function requestsRotulosCapa(paragrafos: Paragrafo[]): unknown[] {
  const requests: unknown[] = [];
  for (const p of paragrafos) {
    const texto = p.texto.replace(/\n$/, "");
    const conteudo = texto.trim();
    const rotulo = ROTULOS_CAPA.find((r) => conteudo.startsWith(r));
    if (!rotulo) continue;
    const recuo = texto.length - texto.trimStart().length;
    const inicioRotulo = p.startIndex + recuo;
    requests.push({
      updateTextStyle: {
        range: { startIndex: inicioRotulo, endIndex: inicioRotulo + rotulo.length },
        textStyle: { bold: true },
        fields: "bold",
      },
    });
  }
  return requests;
}

/** Compõe todos os passos acima para uma peça específica — a MESMA função usada tanto para
 *  o documento individual quanto para o trecho correspondente dentro do consolidado. */
type GrupoFormatacao = { nome: string; requests: unknown[] };

/** Mesmos passos de sempre, mas em grupos nomeados — cada grupo vira uma chamada separada à
 *  API (ver formatarPecaBasica/rebuildAutos), então um pedaço malformado não derruba os outros. */
function gruposFormatacaoPeca(paragrafos: Paragrafo[], pecaId?: string): GrupoFormatacao[] {
  if (!pecaId) return [];
  const titulo = TITULOS_PECA[pecaId];
  const grupos: GrupoFormatacao[] = [];

  if (titulo) {
    grupos.push({
      nome: "cabeçalho/título",
      requests: requestsCabecalhoTitulo(paragrafos, titulo),
    });
    if (pecaId !== "autos") {
      grupos.push({
        nome: "corpo justificado",
        requests: requestsCorpoJustificado(paragrafos, titulo),
      });
    }
  }
  if (pecaId === "autos") {
    grupos.push({ nome: "rótulos da capa", requests: requestsRotulosCapa(paragrafos) });
  } else {
    grupos.push({ nome: "assinatura", requests: requestsAssinatura(paragrafos) });
  }
  return grupos.filter((g) => g.requests.length);
}

/** Aplica a formatação-base (ver comentário acima) ao documento individual de uma peça, um
 *  grupo por vez. Se algum grupo falhar, os demais ainda são aplicados; ao final, lança um
 *  erro descrevendo exatamente quais grupos falharam (para diagnóstico, em vez de silêncio). */
export async function formatarPecaBasica(documentId: string, pecaId?: string) {
  const paragrafos = await listarParagrafos(documentId);
  const grupos = gruposFormatacaoPeca(paragrafos, pecaId);
  const erros: string[] = [];

  for (const g of grupos) {
    try {
      await gw("google_docs", `/v1/documents/${documentId}:batchUpdate`, {
        method: "POST",
        body: { requests: g.requests },
      });
    } catch (e) {
      erros.push(`${g.nome}: ${e instanceof Error ? e.message : "falha desconhecida"}`);
    }
  }

  if (erros.length) throw new Error(erros.join(" | "));
}

export async function updateDocContent(documentId: string, content: string) {
  const doc = await gw<{ body?: { content?: { endIndex?: number }[] } }>(
    "google_docs",
    `/v1/documents/${documentId}`,
    { query: { fields: "body.content.endIndex" } },
  );
  const endIndex = doc.body?.content?.at(-1)?.endIndex ?? 1;

  const requests: unknown[] = [];
  if (endIndex > 2) {
    requests.push({ deleteContentRange: { range: { startIndex: 1, endIndex: endIndex - 1 } } });
  }
  requests.push({ insertText: { location: { index: 1 }, text: `\n${content}` } });

  await gw("google_docs", `/v1/documents/${documentId}:batchUpdate`, {
    method: "POST",
    body: { requests },
  });
  await inserirBrasao(documentId, 1);

  return {
    documentId,
    url: `https://docs.google.com/document/d/${documentId}/edit`,
    embedUrl: `https://docs.google.com/document/d/${documentId}/preview`,
  };
}

/** Cria (se necessário) o documento único dos autos e devolve seus dados. */
export async function ensureAutosDoc(nup: string, autosDocId?: string, pastaId?: string) {
  if (autosDocId && (await arquivoAtivo(autosDocId))) {
    return {
      documentId: autosDocId,
      url: `https://docs.google.com/document/d/${autosDocId}/edit`,
    };
  }
  const doc = await gw<{ documentId: string }>("google_docs", "/v1/documents", {
    method: "POST",
    body: { title: `AUTOS DE SINDICÂNCIA — ${nup || "sem NUP"}` },
  });
  try {
    await gw("google_drive", `/drive/v3/files/${doc.documentId}`, {
      method: "PATCH",
      query: { addParents: pastaId || DRIVE_FOLDER_ID, fields: "id,parents" },
      body: {},
    });
  } catch (e) {
    console.warn("Não foi possível mover os autos para a pasta do Drive:", e);
  }
  return {
    documentId: doc.documentId,
    url: `https://docs.google.com/document/d/${doc.documentId}/edit`,
  };
}

/**
 * Reescreve o documento único dos autos com as peças na ordem informada, numerando as
 * folhas ("Fls. N"), sempre em página própria (quebra de página de verdade, não um simples
 * caractere de texto), com o brasão no início de cada uma, e reaplicando a MESMA formatação
 * usada no documento individual de cada peça — ver gruposFormatacaoPeca.
 */
export async function rebuildAutos(
  documentId: string,
  pecas: { pecaId?: string; titulo: string; texto: string }[],
) {
  // 1) Limpa o conteúdo atual.
  const atual = await gw<{ body?: { content?: { endIndex?: number }[] } }>(
    "google_docs",
    `/v1/documents/${documentId}`,
  );
  const conteudo = atual.body?.content ?? [];
  const fim = conteudo[conteudo.length - 1]?.endIndex ?? 2;
  if (fim > 2) {
    await gw("google_docs", `/v1/documents/${documentId}:batchUpdate`, {
      method: "POST",
      body: {
        requests: [{ deleteContentRange: { range: { startIndex: 1, endIndex: fim - 1 } } }],
      },
    });
  }
  if (!pecas.length) return;

  // 2) Monta o texto completo, guardando o índice de início de cada peça.
  let texto = "";
  const inicios: number[] = [];
  pecas.forEach((p, i) => {
    inicios.push(1 + texto.length);
    texto += `\nFls. ${i + 1}\n\n${p.texto.trim()}\n`;
  });

  await gw("google_docs", `/v1/documents/${documentId}:batchUpdate`, {
    method: "POST",
    body: { requests: [{ insertText: { location: { index: 1 }, text: texto } }] },
  });

  // 3) Quebra de página de verdade (não caractere de texto) + brasão no início de cada peça —
  //    sempre em página própria. De trás para frente: como cada peça só mexe em índices a
  //    partir do próprio início, os índices das peças anteriores continuam válidos.
  for (let i = pecas.length - 1; i >= 0; i--) {
    if (i > 0) {
      await gw("google_docs", `/v1/documents/${documentId}:batchUpdate`, {
        method: "POST",
        body: { requests: [{ insertPageBreak: { location: { index: inicios[i] } } }] },
      });
      await inserirBrasao(documentId, inicios[i] + 1);
    } else {
      await inserirBrasao(documentId, inicios[i]);
    }
  }

  // 4) Reaplica, sobre o documento já paginado, a MESMA formatação usada em cada documento
  //    individual (gruposFormatacaoPeca) — localizando cada peça pelo marcador "Fls. N", já
  //    que os índices calculados antes das quebras de página não valem mais depois delas.
  //    Agrupado por nome (uma chamada por grupo, juntando todas as peças) para que um grupo
  //    malformado não derrube a formatação das demais peças.
  const paragrafos = await listarParagrafos(documentId);
  const marcadores = paragrafos
    .map((p, idx) => ({ idx, texto: p.texto.replace(/\n$/, "").trim() }))
    .filter((m) => /^Fls\.\s*\d+$/.test(m.texto));

  const gruposPorNome = new Map<string, unknown[]>();
  marcadores.forEach((m, i) => {
    const fimIdx = i + 1 < marcadores.length ? marcadores[i + 1].idx : paragrafos.length;
    const doSegmento = paragrafos.slice(m.idx + 1, fimIdx);
    for (const g of gruposFormatacaoPeca(doSegmento, pecas[i]?.pecaId)) {
      gruposPorNome.set(g.nome, [...(gruposPorNome.get(g.nome) ?? []), ...g.requests]);
    }
  });

  for (const [nome, requests] of gruposPorNome) {
    try {
      await gw("google_docs", `/v1/documents/${documentId}:batchUpdate`, {
        method: "POST",
        body: { requests },
      });
    } catch (e) {
      console.warn(`Falha ao formatar "${nome}" no documento consolidado:`, e);
    }
  }
}

/** Envia um anexo (base64) para a subpasta "Anexos" da sindicância. */
export async function uploadAnexo(params: {
  nome: string;
  mimeType: string;
  base64: string;
  pastaId: string;
}) {
  const boundary = `lovable${Date.now()}`;
  const metadata = JSON.stringify({ name: params.nome, parents: [params.pastaId] });
  const bin = Uint8Array.from(atob(params.base64), (ch) => ch.charCodeAt(0));

  const encoder = new TextEncoder();
  const head = encoder.encode(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n` +
      `--${boundary}\r\nContent-Type: ${params.mimeType || "application/octet-stream"}\r\n\r\n`,
  );
  const tail = encoder.encode(`\r\n--${boundary}--`);
  const body = new Uint8Array(head.length + bin.length + tail.length);
  body.set(head, 0);
  body.set(bin, head.length);
  body.set(tail, head.length + bin.length);

  const res = (await gwRaw("google_drive", "/upload/drive/v3/files", {
    method: "POST",
    contentType: `multipart/related; boundary=${boundary}`,
    query: { uploadType: "multipart", fields: "id,name,webViewLink" },
    body,
  })) as { id: string; name: string; webViewLink?: string };

  return {
    fileId: res.id,
    nome: res.name ?? params.nome,
    url: res.webViewLink ?? `https://drive.google.com/file/d/${res.id}/view`,
  };
}
