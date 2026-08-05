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

/** URL pública do carimbo de paginação aplicado a cada folha do documento único dos autos. */
export const CARIMBO_URL =
  "https://sindicancia-assist-hub.lovable.app/__l5e/assets-v1/9928ead0-897e-4ecf-b986-7b3ec13979cc/carimbo-paginacao.png";

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
  "local_trabalhos",
  "tags",
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

// ====================================================================================
// Aba "Dados_Sindicado" — um registro por sindicado (uma sindicância pode ter vários),
// vinculado pelo id da sindicância (coluna A), não pelo NUP.
// ====================================================================================

export const SINDICADOS_TAB = "Dados_Sindicado";

export const SINDICADOS_HEADERS = [
  "id",
  "civil",
  "idt",
  "cpf",
  "nascimento",
  "naturalidade",
  "estado_civil",
  "filiacao",
  "mae",
  "endereco_completo",
  "cep", // não editável mais pelo formulário (CEP passou a fazer parte de endereco_completo) —
  // coluna mantida só para não deslocar companhia/vocativo em linhas já gravadas
  "companhia",
  "vocativo",
];

const ULTIMA_COLUNA_SINDICADOS = columnLetter(SINDICADOS_HEADERS.length);

async function ensureSindicadosTab() {
  const meta = await gw<{ sheets: { properties: { title: string } }[] }>(
    "google_sheets",
    `/v4/spreadsheets/${SPREADSHEET_ID}`,
    { query: { fields: "sheets.properties.title" } },
  );
  const exists = meta.sheets?.some((s) => s.properties.title === SINDICADOS_TAB);

  if (!exists) {
    await gw("google_sheets", `/v4/spreadsheets/${SPREADSHEET_ID}:batchUpdate`, {
      method: "POST",
      body: { requests: [{ addSheet: { properties: { title: SINDICADOS_TAB } } }] },
    });
    await gw(
      "google_sheets",
      `/v4/spreadsheets/${SPREADSHEET_ID}/values/${SINDICADOS_TAB}!A1:${ULTIMA_COLUNA_SINDICADOS}1`,
      {
        method: "PUT",
        query: { valueInputOption: "RAW" },
        body: { values: [SINDICADOS_HEADERS] },
      },
    );
    return;
  }

  // Migração: se a aba já existia com menos colunas, completa o cabeçalho sem tocar nos dados.
  const cabecalhoAtual = await gw<{ values?: string[][] }>(
    "google_sheets",
    `/v4/spreadsheets/${SPREADSHEET_ID}/values/${SINDICADOS_TAB}!A1:${ULTIMA_COLUNA_SINDICADOS}1`,
  );
  if ((cabecalhoAtual.values?.[0]?.length ?? 0) < SINDICADOS_HEADERS.length) {
    await gw(
      "google_sheets",
      `/v4/spreadsheets/${SPREADSHEET_ID}/values/${SINDICADOS_TAB}!A1:${ULTIMA_COLUNA_SINDICADOS}1`,
      {
        method: "PUT",
        query: { valueInputOption: "RAW" },
        body: { values: [SINDICADOS_HEADERS] },
      },
    );
  }
}

/** Lê todas as linhas de Dados_Sindicado (não filtra vazias — quem chama sabe a posição real). */
export async function readSindicadosRows(): Promise<string[][]> {
  await ensureSindicadosTab();
  const data = await gw<{ values?: string[][] }>(
    "google_sheets",
    `/v4/spreadsheets/${SPREADSHEET_ID}/values/${SINDICADOS_TAB}!A2:${ULTIMA_COLUNA_SINDICADOS}1000`,
  );
  return data.values ?? [];
}

export async function appendSindicadoRow(row: string[]) {
  await ensureSindicadosTab();
  await gw(
    "google_sheets",
    `/v4/spreadsheets/${SPREADSHEET_ID}/values/${SINDICADOS_TAB}!A:${ULTIMA_COLUNA_SINDICADOS}:append`,
    {
      method: "POST",
      query: { valueInputOption: "USER_ENTERED", insertDataOption: "INSERT_ROWS" },
      body: { values: [row] },
    },
  );
}

export async function updateSindicadoRow(rowIndex: number, row: string[]) {
  const a1 = `${SINDICADOS_TAB}!A${rowIndex}:${ULTIMA_COLUNA_SINDICADOS}${rowIndex}`;
  await gw("google_sheets", `/v4/spreadsheets/${SPREADSHEET_ID}/values/${a1}`, {
    method: "PUT",
    query: { valueInputOption: "USER_ENTERED" },
    body: { values: [row] },
  });
}

/** "Remove" um sindicado limpando a linha (mantém a posição das demais — evita reindexação). */
export async function limparSindicadoRow(rowIndex: number) {
  const a1 = `${SINDICADOS_TAB}!A${rowIndex}:${ULTIMA_COLUNA_SINDICADOS}${rowIndex}`;
  await gw("google_sheets", `/v4/spreadsheets/${SPREADSHEET_ID}/values/${a1}:clear`, {
    method: "POST",
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
  "despacho-inicial": "DESPACHO",
  "despacho-diversos": "DESPACHO",
  abertura: "TERMO DE ABERTURA",
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
  co
