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

// ====================================================================================
// FORMATAÇÃO OBRIGATÓRIA — EB10-IG-01.001 (Instruções Gerais para a Correspondência do
// Exército, arts. 22 a 62 e Anexo, folhas 7 a 76). Estes parâmetros (margens, fonte,
// recuo, espaçamento) são aplicados via API do Google Docs a QUALQUER documento criado
// por este módulo — tanto o documento individual de cada peça (createDoc/
// updateDocContent) quanto o documento único dos autos (ensureAutosDoc/rebuildAutos) —
// para que toda peça gerada pelo app já nasça dentro do padrão gráfico oficial, sem
// depender de ajuste manual no Google Docs.
//
// Referências rápidas usadas neste arquivo:
//   Art. 24  — timbre (brasão a 1 cm do topo, texto em negrito) e fonte do timbre.
//   Art. 25  — margens da folha.
//   Art. 26  — fonte (Times New Roman 12 no texto / 10 no rodapé).
//   Art. 27  — recuo de primeira linha dos parágrafos (4,5 a 5 cm da margem
//              esquerda, ou seja, 1,5 a 2 cm ALÉM da margem de 3 cm).
//   Art. 28  — espaçamento simples entre linhas.
//   Art. 33  — rótulos da epígrafe/ementa (Assunto, Referência(s), Anexo(s)) em negrito.
//   Art. 44  — identificação no rodapé de toda página (inclusive as de continuação,
//              quando a peça ultrapassa uma folha).
//   Art. 45  — evitar assinatura isolada em página própria.
//   Art. 57  — assinatura: nome em negrito (1ª linha) e cargo/função sem negrito
//              (2ª linha), ambas centralizadas, sem traço horizontal.
// ====================================================================================

/** 1 cm convertido para pontos (unidade aceita pela API do Google Docs: 1 pol = 72 pt). */
const CM_EM_PT = 28.3465;

/** Art. 25 — margens da folha. */
const MARGEM_SUPERIOR_PT = 1 * CM_EM_PT; // I   - 1,0 cm
const MARGEM_INFERIOR_PT = 2 * CM_EM_PT; // II  - mínimo 2,0 cm
const MARGEM_ESQUERDA_PT = 3 * CM_EM_PT; // III - 3,0 cm
const MARGEM_DIREITA_PT = 1.5 * CM_EM_PT; // IV  - 1,5 cm

/** Art. 26 — Times New Roman: 12 no texto corrente, 10 nas notas de rodapé/identificação. */
const FONTE_NOME = "Times New Roman";
const FONTE_TAMANHO_TEXTO = 12;
const FONTE_TAMANHO_RODAPE = 10;

/**
 * Art. 27 — "o início do texto será entre 4,5 a 5 cm de distância da margem
 * esquerda": como a margem esquerda já é de 3 cm (art. 25, III), o recuo de
 * primeira linha soma 1,5 a 2 cm a mais. Usa-se aqui o piso da faixa (1,5 cm) —
 * troque por até 2 cm (56,69 pt) se preferir o teto.
 */
const RECUO_PRIMEIRA_LINHA_PT = 1.5 * CM_EM_PT;

/** Requests que aplicam as margens da folha (art. 25) a um documento. Confirmado contra a
 *  API (DocumentStyle.marginTop/marginBottom/marginLeft/marginRight, unit "PT"). */
function requestsMargens(): unknown[] {
  return [
    {
      updateDocumentStyle: {
        documentStyle: {
          marginTop: { magnitude: MARGEM_SUPERIOR_PT, unit: "PT" },
          marginBottom: { magnitude: MARGEM_INFERIOR_PT, unit: "PT" },
          marginLeft: { magnitude: MARGEM_ESQUERDA_PT, unit: "PT" },
          marginRight: { magnitude: MARGEM_DIREITA_PT, unit: "PT" },
        },
        fields: "marginTop,marginBottom,marginLeft,marginRight",
      },
    },
  ];
}

/** Art. 26/28 — Times New Roman 12 + espaçamento simples (lineSpacing 100 = 100%),
 *  aplicados a um intervalo de texto (índices [startIndex, endIndex)) já inserido. */
function requestsFontePadrao(startIndex: number, endIndex: number): unknown[] {
  if (endIndex <= startIndex) return [];
  return [
    {
      updateTextStyle: {
        range: { startIndex, endIndex },
        textStyle: {
          weightedFontFamily: { fontFamily: FONTE_NOME },
          fontSize: { magnitude: FONTE_TAMANHO_TEXTO, unit: "PT" },
        },
        fields: "weightedFontFamily,fontSize",
      },
    },
    {
      updateParagraphStyle: {
        range: { startIndex, endIndex },
        paragraphStyle: { lineSpacing: 100 },
        fields: "lineSpacing",
      },
    },
  ];
}

/**
 * Art. 44 — toda peça deve trazer, no rodapé de TODAS as páginas (inclusive as de
 * continuação, quando o texto ultrapassa uma folha), uma identificação centralizada
 * a pelo menos 1 cm da borda inferior, no padrão "(Tipo nº X – Seção/OM, de DATA –
 * NUP ... N/T)".
 *
 * LIMITAÇÃO CONHECIDA: a API do Google Docs (batchUpdate) não expõe nenhum recurso
 * para inserir um campo automático de número de página / total de páginas — isso só
 * existe pela interface (Inserir > Números de página). Por isso este rodapé traz
 * apenas a identificação do documento (o parâmetro `identificacao`, normalmente o
 * título da peça já com o NUP embutido) e fica sem o "N/T". Duas saídas possíveis
 * para quem precisar do "N/T" completo: (a) inserir manualmente pelo Google Docs, ou
 * (b) usar a numeração "Fls. N" já aplicada por peça no documento único dos autos
 * (ver rebuildAutos), que cumpre um papel equivalente para o dossiê consolidado.
 * Roda só na CRIAÇÃO do documento (createDoc) — o título não muda depois disso.
 */
async function garantirRodapeIdentificacao(documentId: string, identificacao: string) {
  try {
    const doc = await gw<{ footers?: Record<string, unknown> }>(
      "google_docs",
      `/v1/documents/${documentId}`,
      { query: { fields: "footers" } },
    );

    let footerId: string | undefined = Object.keys(doc.footers ?? {})[0];
    if (!footerId) {
      const criado = await gw<{ replies?: { createFooter?: { footerId?: string } }[] }>(
        "google_docs",
        `/v1/documents/${documentId}:batchUpdate`,
        { method: "POST", body: { requests: [{ createFooter: { type: "DEFAULT" } }] } },
      );
      footerId = criado.replies?.[0]?.createFooter?.footerId;
      if (!footerId) throw new Error("A API não devolveu o ID do rodapé criado.");
    }

    const texto = `(${identificacao})`;
    await gw("google_docs", `/v1/documents/${documentId}:batchUpdate`, {
      method: "POST",
      body: {
        requests: [
          { insertText: { location: { index: 1, segmentId: footerId }, text: texto } },
          {
            updateTextStyle: {
              range: { startIndex: 1, endIndex: 1 + texto.length, segmentId: footerId },
              textStyle: {
                weightedFontFamily: { fontFamily: FONTE_NOME },
                fontSize: { magnitude: FONTE_TAMANHO_RODAPE, unit: "PT" },
              },
              fields: "weightedFontFamily,fontSize",
            },
          },
          {
            updateParagraphStyle: {
              range: { startIndex: 1, endIndex: 1 + texto.length, segmentId: footerId },
              paragraphStyle: { alignment: "CENTER" },
              fields: "alignment",
            },
          },
        ],
      },
    });
  } catch (e) {
    console.warn("Não foi possível aplicar a identificação de rodapé (art. 44):", e);
  }
}

/** Monta (sem chamar a API) as requests que inserem o brasão da República
 *  centralizado a partir de um índice — reaproveitada tanto por inserirBrasao
 *  (chamada isolada) quanto pelo laço de rebuildAutos, que a agrupa na MESMA
 *  chamada da quebra de página (ver ali) para economizar uma rodada de rede por
 *  peça.
 *
 *  Art. 24 — o timbre (do qual o brasão faz parte) fica "a um centímetro da borda
 *  superior do papel": como o brasão é sempre o primeiro conteúdo inserido no
 *  corpo do documento (índice 1) e a margem superior do documento é de 1 cm (ver
 *  MARGEM_SUPERIOR_PT/requestsMargens), o brasão já nasce a 1 cm do topo da folha
 *  sem precisar de ajuste extra aqui. O tamanho abaixo (altura 70 pt ≈ 2,47 cm)
 *  respeita o limite de "no máximo dois vírgula cinco centímetros" na maior
 *  dimensão. */
function requestsBrasao(index: number): unknown[] {
  return [
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
  ];
}

/** Insere o brasão da República centralizado no início do documento (best-effort). */
async function inserirBrasao(documentId: string, index = 1) {
  try {
    await gw("google_docs", `/v1/documents/${documentId}:batchUpdate`, {
      method: "POST",
      body: { requests: requestsBrasao(index) },
    });
  } catch (e) {
    console.warn("Não foi possível inserir o brasão no documento:", e);
  }
}

/**
 * Cria um Google Doc com brasão + texto e devolve id/url. O passo de inserção de
 * conteúdo roda isolado e SEM try/catch (se falhar, precisa mesmo propagar o erro,
 * já que sem ele a peça não existe); tudo que vem depois é formatação da
 * EB10-IG-01.001 — margens (art. 25), fonte/espaçamento (arts. 26/28), brasão
 * (art. 24) e identificação de rodapé (art. 44) — e roda best-effort, para nunca
 * arriscar o conteúdo que já foi salvo.
 */
export async function createDoc(title: string, content: string, pastaId?: string) {
  const doc = await gw<{ documentId: string }>("google_docs", "/v1/documents", {
    method: "POST",
    body: { title },
  });

  const texto = `\n${content}`;
  await gw("google_docs", `/v1/documents/${doc.documentId}:batchUpdate`, {
    method: "POST",
    body: { requests: [{ insertText: { location: { index: 1 }, text: texto } }] },
  });

  try {
    await gw("google_docs", `/v1/documents/${doc.documentId}:batchUpdate`, {
      method: "POST",
      body: { requests: [...requestsMargens(), ...requestsFontePadrao(1, 1 + texto.length)] },
    });
  } catch (e) {
    console.warn("Não foi possível aplicar margens/fonte da EB10-IG-01.001:", e);
  }
  await inserirBrasao(doc.documentId, 1);
  await garantirRodapeIdentificacao(doc.documentId, title);

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
//   5) Corpo do texto (peças com parágrafo narrativo) justificado, com recuo na
//      primeira linha (art. 27 — ver RECUO_PRIMEIRA_LINHA_PT).
//   6) Rótulos (Assunto/Referência(s)/Anexo(s), ou NUP/Sindicante/Sindicado/Objeto na
//      capa) em negrito — art. 33.
//   7) Assinatura ao final: nome centralizado E EM NEGRITO (1ª linha) e a
//      função/cargo (ex.: "Sindicante") centralizada, SEM negrito (2ª linha) —
//      sempre as duas últimas linhas não vazias (art. 57, II).
//   8) O trecho final (última frase do corpo + assinatura) fica marcado para não
//      ser separado por uma quebra de página (art. 45).
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
  notificacao: "NOTIFICAÇÃO PRÉVIA DO SINDICADO",
  inquiricao: "TERMO DE INQUIRIÇÃO DE TESTEMUNHA",
  depoimento: "TERMO DE DECLARAÇÕES DO SINDICADO",
  oficio: "OFÍCIO",
  encerramento: "TERMO DE ENCERRAMENTO DA INSTRUÇÃO",
  alegacoes: "NOTIFICAÇÃO PARA APRESENTAÇÃO DE ALEGAÇÕES FINAIS",
  prorrogacao: "PEDIDO DE PRORROGAÇÃO DE PRAZO",
  // "relatorio" não está em PECAS (pecaId próprio, fixo, usado só em routes/relatorio.tsx).
  relatorio: "RELATÓRIO DO SINDICANTE",
};

/**
 * Rótulos que a EB10-IG-01.001 manda destacar em negrito:
 *  - "NUP:", "SINDICANTE:", "SINDICADO:", "OBJETO:" — convenção própria da capa dos
 *    autos deste sistema, no mesmo espírito do art. 33 (epígrafe/ementa);
 *  - "Assunto:", "Referência(s):", "Anexo(s):" — art. 33, IV, e Anexo I.1 (item 2,
 *    alínea "e") e Anexo II.2 (DIEx): assunto, referência e anexo vêm sempre em
 *    negrito nos ofícios e documentos internos.
 * Aplica-se em QUALQUER peça (não só na capa), mantendo o valor após os dois-pontos
 * com peso normal.
 */
const ROTULOS_NEGRITO = [
  "NUP:",
  "SINDICANTE:",
  "SINDICADO:",
  "OBJETO:",
  "Assunto:",
  "Referência:",
  "Referências:",
  "Anexo:",
  "Anexos:",
];

/** Cabeçalho (tudo antes do título) em negrito+centralizado; título em negrito+sublinhado+
 *  centralizado. Não faz nada se o título não for encontrado (evita negritar o documento
 *  inteiro por engano quando a peça ainda não tem uma convenção de título cadastrada).
 *  Arts. 24 (timbre em negrito) e 29 (uso comedido de negrito/sublinhado/caixa alta) —
 *  por isso o negrito fica restrito ao cabeçalho e ao título, nunca ao corpo do texto. */
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
 *  primeira linha — o corpo narrativo da peça. Art. 27: recuo de 1,5 cm além da margem
 *  esquerda de 3 cm (ver RECUO_PRIMEIRA_LINHA_PT). */
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
        paragraphStyle: { alignment: "JUSTIFIED", indentFirstLine: { magnitude: RECUO_PRIMEIRA_LINHA_PT, unit: "PT" } },
        fields: "alignment,indentFirstLine",
      },
    });
  }
  return requests;
}

/** Assinatura final: sempre os dois últimos parágrafos não vazios. Art. 57, I e II:
 *  sem traço horizontal, tudo centralizado; o NOME (1ª linha) vem em negrito e
 *  maiúsculo, e o cargo/função (2ª linha, ex.: "Sindicante") vem centralizado mas SEM
 *  negrito. (Antes desta correção o negrito estava trocado — na função, não no nome.)
 *  Não usar na Capa, que não tem assinatura. */
function requestsAssinatura(paragrafos: Paragrafo[]): unknown[] {
  const naoVazios = paragrafos.filter((p) => p.texto.trim());
  if (naoVazios.length < 2) return [];

  const requests: unknown[] = [];
  naoVazios.slice(-2).forEach((p, i) => {
    const texto = p.texto.replace(/\n$/, "");
    const inicio = p.startIndex;
    const fim = p.startIndex + texto.length;
    const ehNome = i === 0;
    requests.push(
      {
        updateParagraphStyle: {
          range: { startIndex: inicio, endIndex: fim },
          paragraphStyle: { alignment: "CENTER" },
          fields: "alignment",
        },
      },
      ...(ehNome
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

/**
 * Art. 45 — "recomenda-se não deixar a assinatura em página isolada do expediente,
 * devendo-se transferir para essa página ao menos a última frase anterior ao
 * fecho". Encadeia `keepWithNext` (campo confirmado no ParagraphStyle da API) do
 * último parágrafo de corpo até o nome do signatário, passando pelas linhas em
 * branco do meio — assim o Google Docs nunca quebra a página bem ali: a assinatura
 * só migra para a página seguinte junto com aquela última frase, nunca sozinha.
 */
function requestsEvitarAssinaturaIsolada(paragrafos: Paragrafo[]): unknown[] {
  const naoVazios = paragrafos.filter((p) => p.texto.trim());
  if (naoVazios.length < 3) return [];
  const ultimoCorpo = naoVazios[naoVazios.length - 3];
  const nome = naoVazios[naoVazios.length - 2];
  const idxUltimoCorpo = paragrafos.findIndex((p) => p.startIndex === ultimoCorpo.startIndex);
  const idxNome = paragrafos.findIndex((p) => p.startIndex === nome.startIndex);
  if (idxUltimoCorpo < 0 || idxNome < 0 || idxNome < idxUltimoCorpo) return [];

  const requests: unknown[] = [];
  for (let i = idxUltimoCorpo; i <= idxNome; i++) {
    const p = paragrafos[i];
    requests.push({
      updateParagraphStyle: {
        range: { startIndex: p.startIndex, endIndex: p.startIndex + 1 },
        paragraphStyle: { keepWithNext: true },
        fields: "keepWithNext",
      },
    });
  }
  return requests;
}

/** Rótulos em negrito (ver ROTULOS_NEGRITO) — mantém o valor após os dois-pontos com
 *  peso normal. Usada em QUALQUER peça, não só na capa dos autos. */
function requestsRotulosNegrito(paragrafos: Paragrafo[]): unknown[] {
  const requests: unknown[] = [];
  for (const p of paragrafos) {
    const texto = p.texto.replace(/\n$/, "");
    const conteudo = texto.trim();
    const rotulo = ROTULOS_NEGRITO.find((r) => conteudo.startsWith(r));
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
function gruposFormatacaoPeca(
  paragrafos: Paragrafo[],
  pecaId?: string,
  tituloExplicito?: string,
): GrupoFormatacao[] {
  if (!pecaId) return [];
  const titulo = tituloExplicito ?? TITULOS_PECA[pecaId];
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

  // Arts. 33/64/65 e Anexo — rótulos (NUP/Sindicante/Sindicado/Objeto na capa;
  // Assunto/Referência(s)/Anexo(s) em ofícios e afins) sempre em negrito, em
  // QUALQUER peça (antes só rodava na capa dos autos).
  grupos.push({ nome: "rótulos em negrito", requests: requestsRotulosNegrito(paragrafos) });

  if (pecaId !== "autos") {
    grupos.push({ nome: "assinatura", requests: requestsAssinatura(paragrafos) });
    grupos.push({
      nome: "evitar assinatura isolada",
      requests: requestsEvitarAssinaturaIsolada(paragrafos),
    });
  }
  return grupos.filter((g) => g.requests.length);
}

/** Aplica a formatação-base (ver comentário acima) ao documento individual de uma peça, um
 *  grupo por vez. Se algum grupo falhar, os demais ainda são aplicados; ao final, lança um
 *  erro descrevendo exatamente quais grupos falharam (para diagnóstico, em vez de silêncio).
 *  `tituloExplicito` é usado por peças com título dinâmico (ex.: "JUNTADA Nº 2"), que não têm
 *  uma entrada fixa em TITULOS_PECA. */
export async function formatarPecaBasica(
  documentId: string,
  pecaId?: string,
  tituloExplicito?: string,
) {
  const paragrafos = await listarParagrafos(documentId);
  const grupos = gruposFormatacaoPeca(paragrafos, pecaId, tituloExplicito);
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

/** Atualiza o texto de uma peça já existente. Assim como em createDoc, o passo de
 *  substituir o conteúdo roda sem try/catch (é o essencial); margens/fonte/espaçamento
 *  (arts. 25/26/28) rodam depois, isolados, best-effort — reaplicados a cada edição para
 *  que peças criadas antes desta formatação também fiquem em conformidade assim que
 *  forem editadas. */
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
  const texto = `\n${content}`;
  requests.push({ insertText: { location: { index: 1 }, text: texto } });

  await gw("google_docs", `/v1/documents/${documentId}:batchUpdate`, {
    method: "POST",
    body: { requests },
  });

  try {
    await gw("google_docs", `/v1/documents/${documentId}:batchUpdate`, {
      method: "POST",
      body: { requests: [...requestsMargens(), ...requestsFontePadrao(1, 1 + texto.length)] },
    });
  } catch (e) {
    console.warn("Não foi possível aplicar margens/fonte da EB10-IG-01.001:", e);
  }
  await inserirBrasao(documentId, 1);

  return {
    documentId,
    url: `https://docs.google.com/document/d/${documentId}/edit`,
    embedUrl: `https://docs.google.com/document/d/${documentId}/preview`,
  };
}

/** Cria (se necessário) o documento único dos autos e devolve seus dados. Também aplica
 *  as margens da EB10-IG-01.001 (art. 25) — a fonte/espaçamento (arts. 26/28) do texto em
 *  si são aplicados em rebuildAutos, que é quem insere o conteúdo. Não recebe uma
 *  identificação de rodapé própria (art. 44) porque o documento único já numera cada
 *  peça com o marcador "Fls. N" (ver rebuildAutos), que cumpre papel equivalente para o
 *  dossiê consolidado — cada peça repete seu próprio timbre e brasão, como nos
 *  processos físicos reais. */
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
    await gw("google_docs", `/v1/documents/${doc.documentId}:batchUpdate`, {
      method: "POST",
      body: { requests: requestsMargens() },
    });
  } catch (e) {
    console.warn("Não foi possível aplicar as margens da EB10-IG-01.001 aos autos:", e);
  }
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
 * Garante que o documento tenha um cabeçalho de página com o carimbo fixo, alinhado à
 * direita. Cabeçalhos se repetem automaticamente em toda página e ficam na margem — não
 * disputam espaço com o texto/fotos do corpo, ao contrário de uma imagem solta no meio do
 * texto. Idempotente: não insere um segundo carimbo se o cabeçalho já tiver um.
 *
 * OBS.: este carimbo é uma convenção própria deste sistema (não é exigido pela
 * EB10-IG-01.001) para facilitar a conferência visual das folhas nos autos consolidados;
 * não confundir com a identificação de rodapé do art. 44, aplicada nas peças individuais
 * por garantirRodapeIdentificacao.
 */
async function garantirCarimboFixo(documentId: string) {
  try {
    const doc = await gw<{
      headers?: Record<
        string,
        { content?: { paragraph?: { elements?: { inlineObjectElement?: unknown }[] } }[] }
      >;
    }>("google_docs", `/v1/documents/${documentId}`, { query: { fields: "headers" } });

    const headersMap = doc.headers ?? {};
    let headerId: string | undefined = Object.keys(headersMap)[0];

    if (headerId) {
      const jaTemImagem = (headersMap[headerId].content ?? []).some((el) =>
        (el.paragraph?.elements ?? []).some((e) => e.inlineObjectElement),
      );
      if (jaTemImagem) return;
    } else {
      const criado = await gw<{ replies?: { createHeader?: { headerId?: string } }[] }>(
        "google_docs",
        `/v1/documents/${documentId}:batchUpdate`,
        { method: "POST", body: { requests: [{ createHeader: { type: "DEFAULT" } }] } },
      );
      headerId = criado.replies?.[0]?.createHeader?.headerId;
      if (!headerId) throw new Error("A API não devolveu o ID do cabeçalho criado.");
    }

    await gw("google_docs", `/v1/documents/${documentId}:batchUpdate`, {
      method: "POST",
      body: {
        requests: [
          {
            insertInlineImage: {
              location: { index: 1, segmentId: headerId },
              uri: CARIMBO_URL,
              objectSize: {
                height: { magnitude: 56.7, unit: "PT" },
                width: { magnitude: 56.7, unit: "PT" },
              },
            },
          },
          {
            updateParagraphStyle: {
              range: { startIndex: 1, endIndex: 2, segmentId: headerId },
              paragraphStyle: { alignment: "END" },
              fields: "alignment",
            },
          },
        ],
      },
    });
  } catch (e) {
    console.warn("Não foi possível fixar o carimbo no cabeçalho de página:", e);
  }
}

/**
 * Reescreve o documento único dos autos com as peças na ordem informada, numerando as
 * folhas ("Fls. N"), sempre em página própria (quebra de página de verdade, não um simples
 * caractere de texto), com o brasão no início de cada uma, e reaplicando a MESMA formatação
 * usada no documento individual de cada peça — ver gruposFormatacaoPeca. O carimbo fica
 * fixo no cabeçalho de página (ver garantirCarimboFixo), não mais solto no meio do texto.
 * Também aplica a fonte/espaçamento padrão (arts. 26/28) a todo o texto inserido e
 * centraliza o marcador "Fls. N" em corpo reduzido (art. 44 — identificação de página
 * centralizada), já que a API do Google Docs não numera páginas físicas automaticamente.
 */
export async function rebuildAutos(
  documentId: string,
  pecas: { pecaId?: string; titulo: string; tituloInterno?: string; texto: string }[],
) {
  await garantirCarimboFixo(documentId);

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
  try {
    await gw("google_docs", `/v1/documents/${documentId}:batchUpdate`, {
      method: "POST",
      body: { requests: requestsFontePadrao(1, 1 + texto.length) },
    });
  } catch (e) {
    console.warn("Não foi possível aplicar a fonte padrão (EB10-IG-01.001) aos autos:", e);
  }

  // 3) Quebra de página de verdade (não caractere de texto) + brasão no início de cada peça —
  //    sempre em página própria. De trás para frente: como cada peça só mexe em índices a
  //    partir do próprio início, os índices das peças anteriores continuam válidos.
  for (let i = pecas.length - 1; i >= 0; i--) {
    if (i > 0) {
      // Quebra de página + brasão numa ÚNICA chamada (antes eram 2 chamadas por peça) —
      // reduz pela metade o número de requisições desta etapa, que crescem com o total de
      // peças já existentes nos autos.
      try {
        await gw("google_docs", `/v1/documents/${documentId}:batchUpdate`, {
          method: "POST",
          body: {
            requests: [
              { insertPageBreak: { location: { index: inicios[i] } } },
              ...requestsBrasao(inicios[i] + 1),
            ],
          },
        });
      } catch (e) {
        console.warn(`Não foi possível quebrar página/inserir brasão na peça ${i + 1}:`, e);
      }
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
  marcadores.forEach((m) => {
    const p = paragrafos[m.idx];
    gruposPorNome.set("marcador de folha", [
      ...(gruposPorNome.get("marcador de folha") ?? []),
      // Art. 44 — identificação de página centralizada (aqui adaptada para numerar
      // cada PEÇA dentro do consolidado, já que a API não numera páginas físicas).
      {
        updateParagraphStyle: {
          range: { startIndex: p.startIndex, endIndex: p.startIndex + m.texto.length },
          paragraphStyle: { alignment: "CENTER" },
          fields: "alignment",
        },
      },
      {
        updateTextStyle: {
          range: { startIndex: p.startIndex, endIndex: p.startIndex + m.texto.length },
          textStyle: { fontSize: { magnitude: FONTE_TAMANHO_RODAPE, unit: "PT" } },
          fields: "fontSize",
        },
      },
    ]);
  });
  marcadores.forEach((m, i) => {
    const fimIdx = i + 1 < marcadores.length ? marcadores[i + 1].idx : paragrafos.length;
    const doSegmento = paragrafos.slice(m.idx + 1, fimIdx);
    for (const g of gruposFormatacaoPeca(doSegmento, pecas[i]?.pecaId, pecas[i]?.tituloInterno)) {
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

  // Necessário para o Google Docs conseguir buscar a imagem e incorporá-la (ver
  // inserirAnexosNaJuntada) — sem isso, a incorporação falha silenciosamente para arquivos
  // privados. Best-effort: se falhar, o anexo continua salvo, só não vira foto incorporada.
  try {
    await gw("google_drive", `/drive/v3/files/${res.id}/permissions`, {
      method: "POST",
      body: { type: "anyone", role: "reader" },
    });
  } catch (e) {
    console.warn("Não foi possível tornar o anexo acessível por link:", e);
  }

  return {
    fileId: res.id,
    nome: res.name ?? params.nome,
    mimeType: params.mimeType || "application/octet-stream",
    url: res.webViewLink ?? `https://drive.google.com/file/d/${res.id}/view`,
  };
}

/**
 * Insere, ao final de um documento (o "folha própria" de um item de juntada), a foto
 * incorporada (imagens) ou um link clicável para abrir o arquivo (PDFs e demais tipos).
 * O texto do link também recebe a fonte padrão (art. 26), pela mesma lógica de
 * requestsFontePadrao.
 */
export async function inserirAnexoNoFimDoDocumento(
  documentId: string,
  anexo: { fileId: string; url: string; mimeType?: string; nomeArquivo?: string },
) {
  const doc = await gw<{ body?: { content?: { endIndex?: number }[] } }>(
    "google_docs",
    `/v1/documents/${documentId}`,
  );
  const fim = (doc.body?.content?.at(-1)?.endIndex ?? 2) - 1;

  const requests: unknown[] = [];
  if ((anexo.mimeType ?? "").startsWith("image/")) {
    requests.push({
      insertInlineImage: {
        location: { index: fim },
        uri: `https://drive.google.com/uc?export=view&id=${anexo.fileId}`,
      },
    });
  } else {
    const texto = `📎 Abrir arquivo: ${anexo.nomeArquivo ?? "anexo"}\n`;
    requests.push(
      { insertText: { location: { index: fim }, text: texto } },
      {
        updateTextStyle: {
          range: { startIndex: fim, endIndex: fim + texto.length - 1 },
          textStyle: {
            link: { url: anexo.url },
            weightedFontFamily: { fontFamily: FONTE_NOME },
            fontSize: { magnitude: FONTE_TAMANHO_TEXTO, unit: "PT" },
          },
          fields: "link,weightedFontFamily,fontSize",
        },
      },
    );
  }

  await gw("google_docs", `/v1/documents/${documentId}:batchUpdate`, {
    method: "POST",
    body: { requests },
  });
}

/** Move um arquivo do Drive para a lixeira (usado ao desfazer a inserção de uma peça). */
export async function moverParaLixeira(fileId: string) {
  await gw("google_drive", `/drive/v3/files/${fileId}`, {
    method: "PATCH",
    body: { trashed: true },
  });
}
