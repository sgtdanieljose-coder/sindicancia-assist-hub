import { createServerFn } from "@tanstack/react-start";
import type { Juntada, Sindicancia } from "./pecas";
import { rowToSindicancia, sindicanciaToRow } from "./sindicancias.mapper";
import { carregar } from "./sindicancias.server";

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

/**
 * Exporta a peça: cria (ou, se for peça "única" já exportada antes, atualiza) o documento
 * individual e reinsere a peça no documento único dos autos, mantendo a posição já escolhida
 * quando for uma atualização.
 */
export const exportarParaDocs = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      sindicanciaId: string;
      titulo: string;
      conteudo: string;
      posicao?: number;
      pecaId?: string;
      unica?: boolean;
      etapa?: string;
    }) => data,
  )
  .handler(async ({ data }) => {
    const {
      createDoc,
      updateDocContent,
      updateRow,
      ensureAutosDoc,
      rebuildAutos,
      getDocText,
      formatarCapaAutos,
      formatarTermoAbertura,
    } = await import("./google.server");

    const { atual, linha } = await carregar(data.sindicanciaId);

    // Peça "única" (ex.: Termo de Abertura) já exportada antes? Atualiza o mesmo documento,
    // na mesma posição, em vez de criar mais um Google Doc duplicado.
    const existente =
      data.unica && data.pecaId
        ? atual.documentos.find((d) => d.pecaId === data.pecaId)
        : undefined;

    let lista = [...atual.documentos];
    let doc: { documentId: string; url: string; embedUrl: string };
    let pos: number;

    if (existente) {
      doc = await updateDocContent(existente.documentId, data.conteudo);
      pos = lista.findIndex((d) => d.documentId === existente.documentId) + 1;
      lista = lista.map((d) =>
        d.documentId === existente.documentId ? { ...d, titulo: data.titulo } : d,
      );
    } else {
      doc = await createDoc(data.titulo, data.conteudo, atual.pastaId);
      const total = lista.length + 1;
      pos = Math.min(Math.max(data.posicao ?? total, 1), total);
      lista.splice(pos - 1, 0, {
        titulo: data.titulo,
        documentId: doc.documentId,
        url: doc.url,
        pecaId: data.pecaId,
      });
    }
    atual.documentos = lista;

    // Formatação especial (negrito/centralização/sublinhado) de peças com layout próprio.
    if (data.pecaId === "autos") {
      try {
        await formatarCapaAutos(doc.documentId);
      } catch (e) {
        console.warn("Falha ao formatar a Capa dos Autos:", e);
      }
    } else if (data.pecaId === "abertura") {
      try {
        await formatarTermoAbertura(doc.documentId);
      } catch (e) {
        console.warn("Falha ao formatar o Termo de Abertura:", e);
      }
    }

    // Marca automaticamente a etapa correspondente no checklist, se ainda não estiver marcada.
    if (data.etapa && !atual.etapas.includes(data.etapa)) {
      atual.etapas = [...atual.etapas, data.etapa];
    }

    // Documento único paginado.
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

    return { ...doc, posicao: pos, autosUrl, atualizado: Boolean(existente) };
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
