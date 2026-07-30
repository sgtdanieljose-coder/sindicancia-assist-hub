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

export const SPREADSHEET_ID = "1Fy-JSNpRJXKE89Wm--zo0cFPJwU1Daf_ygUg78-s1jI";
export const DRIVE_FOLDER_ID = "1zcQGM4T6-PAiEttCAdK6aqNBrUnQ-u6G";
export const SHEET_TAB = "Sindicancias";

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

/** Cria um Google Doc com o texto informado e devolve id/url. */
export async function createDoc(title: string, content: string, pastaId?: string) {
  const doc = await gw<{ documentId: string }>("google_docs", "/v1/documents", {
    method: "POST",
    body: { title },
  });

  await gw("google_docs", `/v1/documents/${doc.documentId}:batchUpdate`, {
    method: "POST",
    body: {
      requests: [{ insertText: { location: { index: 1 }, text: content } }],
    },
  });

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
