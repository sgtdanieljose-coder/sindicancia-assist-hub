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
];

export async function ensureTab() {
  const meta = await gw<{ sheets: { properties: { title: string } }[] }>(
    "google_sheets",
    `/v4/spreadsheets/${SPREADSHEET_ID}`,
    { query: { fields: "sheets.properties.title" } },
  );
  const exists = meta.sheets?.some((s) => s.properties.title === SHEET_TAB);
  if (exists) return;

  await gw("google_sheets", `/v4/spreadsheets/${SPREADSHEET_ID}:batchUpdate`, {
    method: "POST",
    body: { requests: [{ addSheet: { properties: { title: SHEET_TAB } } }] },
  });
  await gw(
    "google_sheets",
    `/v4/spreadsheets/${SPREADSHEET_ID}/values/${SHEET_TAB}!A1:M1`,
    {
      method: "PUT",
      query: { valueInputOption: "RAW" },
      body: { values: [HEADERS] },
    },
  );
}

export async function readRows(): Promise<string[][]> {
  await ensureTab();
  const data = await gw<{ values?: string[][] }>(
    "google_sheets",
    `/v4/spreadsheets/${SPREADSHEET_ID}/values/${SHEET_TAB}!A2:M1000`,
  );
  return (data.values ?? []).filter((r) => r[0]);
}

export async function appendRow(row: string[]) {
  await ensureTab();
  await gw("google_sheets", `/v4/spreadsheets/${SPREADSHEET_ID}/values/${SHEET_TAB}!A:M:append`, {
    method: "POST",
    query: { valueInputOption: "USER_ENTERED", insertDataOption: "INSERT_ROWS" },
    body: { values: [row] },
  });
}

export async function updateRow(rowIndex: number, row: string[]) {
  const a1 = `${SHEET_TAB}!A${rowIndex}:M${rowIndex}`;
  await gw("google_sheets", `/v4/spreadsheets/${SPREADSHEET_ID}/values/${a1}`, {
    method: "PUT",
    query: { valueInputOption: "USER_ENTERED" },
    body: { values: [row] },
  });
}

/** Cria um Google Doc com o texto informado e devolve id/url. */
export async function createDoc(title: string, content: string) {
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

  // Tenta arquivar na pasta de anexos do usuário (best-effort).
  try {
    await gw("google_drive", `/drive/v3/files/${doc.documentId}`, {
      method: "PATCH",
      query: { addParents: DRIVE_FOLDER_ID, fields: "id,parents" },
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
