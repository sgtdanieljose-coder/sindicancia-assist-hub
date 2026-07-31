import { createServerFn } from "@tanstack/react-start";
import type { Juntada, Sindicancia } from "./pecas";

function safeParse<T>(v: string | undefined, fallback: T): T {
  if (!v) return fallback;
  try {
    return JSON.parse(v) as T;
  } catch {
    return fallback;
  }
}

function rowToSindicancia(row: string[]): Sindicancia {
  return {
    id: row[0] ?? "",
    nup: row[1] ?? "",
    portariaNumero: row[2] ?? "",
    portariaData: row[3] ?? "",
    om: row[4] ?? "",
    autoridade: row[5] ?? "",
    sindicante: row[6] ?? "",
    sindicado: row[7] ?? "",
    objeto: row[8] ?? "",
    status: row[9] ?? "Em instrução",
    etapas: safeParse<string[]>(row[10], []),
    documentos: safeParse<Sindicancia["documentos"]>(row[11], []),
    atualizadoEm: row[12] ?? "",
    pastaId: row[13] || undefined,
    pastaUrl: row[14] || undefined,
    anexosId: row[15] || undefined,
    anexosUrl: row[16] || undefined,
    local: row[17] ?? "",
    subordinacao: row[18] ?? "",
    omInstauradora: row[19] ?? "",
    autosDocId: row[20] || undefined,
    autosUrl: row[21] || undefined,
    juntadas: safeParse<Juntada[]>(row[22], []),
  };
}

function sindicanciaToRow(s: Sindicancia): string[] {
  return [
    s.id,
    s.nup,
    s.portariaNumero,
    s.portariaData,
    s.om,
    s.autoridade,
    s.sindicante,
    s.sindicado,
    s.objeto,
    s.status,
    JSON.stringify(s.etapas ?? []),
    JSON.stringify(s.documentos ?? []),
    new Date().toISOString(),
    s.pastaId ?? "",
    s.pastaUrl ?? "",
    s.anexosId ?? "",
    s.anexosUrl ?? "",
    s.local ?? "",
    s.subordinacao ?? "",
    s.omInstauradora ?? "",
    s.autosDocId ?? "",
    s.autosUrl ?? "",
    JSON.stringify(s.juntadas ?? []),
  ];
}

export const listarSindicancias = createServerFn({ method: "GET" }).handler(async () => {
  const { readRows } = await import("./google.server");
  try {
    const rows = await readRows();
    return { itens: rows.map(rowToSindicancia), erro: null as string | null };
  } catch (e) {
    return { itens: [] as Sindicancia[], erro: (e as Error).message };
  }
});

export const salvarSindicancia = createServerFn({ method: "POST" })
  .inputValidator((data: Sindicancia) => data)
  .handler(async ({ data }) => {
    const { readRows, appendRow, updateRow, ensureSindicanciaFolders } =
      await import("./google.server");
    const registro: Sindicancia = { ...data, id: data.id || `SIND-${Date.now()}` };
    const rows = await readRows();
    const idx = rows.findIndex((r) => r[0] === registro.id);

    // Cria a pasta da sindicância (nome = NUP) com a subpasta "Anexos" no Drive.
    if (registro.nup?.trim() && !registro.pastaId) {
      try {
        const pastas = await ensureSindicanciaFolders(registro.nup);
        registro.pastaId = pastas.pastaId;
        registro.pastaUrl = pastas.pastaUrl;
        registro.anexosId = pastas.anexosId;
        registro.anexosUrl = pastas.anexosUrl;
      } catch (e) {
        console.warn("Não foi possível criar a pasta da sindicância no Drive:", e);
      }
    }

    const row = sindicanciaToRow(registro);
    if (idx >= 0) {
      await updateRow(idx + 2, row);
    } else {
      await appendRow(row);
    }
    return rowToSindicancia(row);
  });

async function carregar(sindicanciaId: string) {
  const { readRows } = await import("./google.server");
  const rows = await readRows();
  const idx = rows.findIndex((r) => r[0] === sindicanciaId);
  if (idx < 0) throw new Error("Sindicância não localizada na planilha.");
  return { atual: rowToSindicancia(rows[idx]), linha: idx + 2 };
}

/**
 * Exporta a peça: cria um Google Doc individual e insere a peça no documento único
 * dos autos, na página (posição) escolhida pelo usuário.
 */
export const exportarParaDocs = createServerFn({ method: "POST" })
  .inputValidator(
    (data: { sindicanciaId: string; titulo: string; conteudo: string; posicao?: number }) => data,
  )
  .handler(async ({ data }) => {
    const { createDoc, updateRow, ensureAutosDoc, rebuildAutos, getDocText } =
      await import("./google.server");

    const { atual, linha } = await carregar(data.sindicanciaId);

    // 1) Documento individual da peça.
    const doc = await createDoc(data.titulo, data.conteudo, atual.pastaId);

    // 2) Posição desejada dentro dos autos (1-based).
    const lista = [...atual.documentos];
    const total = lista.length + 1;
    const pos = Math.min(Math.max(data.posicao ?? total, 1), total);
    lista.splice(pos - 1, 0, { titulo: data.titulo, documentId: doc.documentId, url: doc.url });
    atual.documentos = lista;

    // 3) Documento único paginado.
    let autosUrl = atual.autosUrl;
    try {
      const autos = await ensureAutosDoc(atual.nup, atual.autosDocId, atual.pastaId);
      atual.autosDocId = autos.documentId;
      atual.autosUrl = autos.url;
      autosUrl = autos.url;

      const pecas: { titulo: string; texto: string }[] = [];
      for (const d of lista) {
        if (d.documentId === doc.documentId) {
          pecas.push({ titulo: d.titulo, texto: data.conteudo });
        } else {
          pecas.push({ titulo: d.titulo, texto: await getDocText(d.documentId) });
        }
      }
      await rebuildAutos(autos.documentId, pecas);
    } catch (e) {
      console.warn("Falha ao atualizar o documento único dos autos:", e);
    }

    try {
      await updateRow(linha, sindicanciaToRow(atual));
    } catch (e) {
      console.warn("Falha ao registrar documento na planilha:", e);
    }

    return { ...doc, posicao: pos, autosUrl };
  });

/** Cria uma nova juntada (numerada) vinculada ao NUP da sindicância. */
export const criarJuntada = createServerFn({ method: "POST" })
  .inputValidator((data: { sindicanciaId: string; titulo: string; data: string }) => data)
  .handler(async ({ data }) => {
    const { updateRow } = await import("./google.server");
    const { atual, linha } = await carregar(data.sindicanciaId);
    const juntada: Juntada = {
      id: `JUN-${Date.now()}`,
      numero: (atual.juntadas?.length ?? 0) + 1,
      titulo: data.titulo || `Juntada nº ${(atual.juntadas?.length ?? 0) + 1}`,
      data: data.data || new Date().toISOString().slice(0, 10),
      anexos: [],
    };
    atual.juntadas = [...(atual.juntadas ?? []), juntada];
    await updateRow(linha, sindicanciaToRow(atual));
    return juntada;
  });

/** Envia um anexo para a pasta "Anexos" do NUP e vincula-o a uma juntada. */
export const adicionarAnexo = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      sindicanciaId: string;
      juntadaId: string;
      nome: string;
      mimeType: string;
      base64: string;
    }) => data,
  )
  .handler(async ({ data }) => {
    const { uploadAnexo, updateRow, ensureSindicanciaFolders } = await import("./google.server");
    const { atual, linha } = await carregar(data.sindicanciaId);

    let anexosId = atual.anexosId;
    if (!anexosId) {
      const pastas = await ensureSindicanciaFolders(atual.nup);
      atual.pastaId = pastas.pastaId;
      atual.pastaUrl = pastas.pastaUrl;
      atual.anexosId = pastas.anexosId;
      atual.anexosUrl = pastas.anexosUrl;
      anexosId = pastas.anexosId;
    }

    const arquivo = await uploadAnexo({
      nome: data.nome,
      mimeType: data.mimeType,
      base64: data.base64,
      pastaId: anexosId,
    });

    atual.juntadas = (atual.juntadas ?? []).map((j) =>
      j.id === data.juntadaId ? { ...j, anexos: [...j.anexos, arquivo] } : j,
    );

    await updateRow(linha, sindicanciaToRow(atual));
    return arquivo;
  });
