import { createServerFn } from "@tanstack/react-start";
import {
  gerarTextoJuntada,
  type AnexoJuntada,
  type Juntada,
  type Sindicancia,
} from "./pecas";
import { rowToSindicancia, sindicanciaToRow } from "./sindicancias.mapper";
import { carregar } from "./sindicancias.server";

/**
 * Cria/atualiza o Google Doc de uma juntada específica (termo + lista de anexos + fotos/PDFs
 * incorporados), registra em atual.documentos (participando da paginação normal dos autos) e
 * reconstrói o documento único. Usado tanto ao criar a juntada quanto ao anexar um arquivo
 * novo — a cada chamada, o conteúdo é regenerado do zero a partir de atual.juntadas, então
 * fica sempre consistente com os anexos realmente cadastrados.
 */
async function sincronizarDocumentoJuntada(
  atual: Sindicancia,
  juntadaId: string,
): Promise<Sindicancia> {
  const {
    createDoc,
    updateDocContent,
    formatarPecaBasica,
    inserirAnexoNoFimDoDocumento,
    ensureAutosDoc,
    rebuildAutos,
    getDocText,
  } = await import("./google.server");

  const juntada = atual.juntadas.find((j) => j.id === juntadaId);
  if (!juntada) return atual;

  const pecaId = `juntada-${juntada.id}`;
  const tituloInterno = `JUNTADA Nº ${juntada.numero}`;
  const tituloDoc = `${tituloInterno} — ${atual.nup || atual.id}`;
  const conteudo = gerarTextoJuntada(atual, juntada);

  const existente = atual.documentos.find((d) => d.pecaId === pecaId);
  const doc = existente
    ? await updateDocContent(existente.documentId, conteudo)
    : await createDoc(tituloDoc, conteudo, atual.pastaId);

  atual.documentos = existente
    ? atual.documentos.map((d) =>
        d.documentId === existente.documentId ? { ...d, titulo: tituloDoc, tituloInterno } : d,
      )
    : [
        ...atual.documentos,
        { titulo: tituloDoc, documentId: doc.documentId, url: doc.url, pecaId, tituloInterno },
      ];

  atual.juntadas = atual.juntadas.map((j) =>
    j.id === juntada.id ? { ...j, documentId: doc.documentId, url: doc.url } : j,
  );

  try {
    await formatarPecaBasica(doc.documentId, pecaId, tituloInterno);
  } catch (e) {
    console.warn("Falha ao formatar a juntada:", e);
  }

  try {
for (const anexo of juntada.anexos) {
      if (!anexo.fileId || !anexo.url) continue;
      await inserirAnexoNoFimDoDocumento(doc.documentId, {
        fileId: anexo.fileId,
        url: anexo.url,
        mimeType: anexo.mimeType,
        nomeArquivo: anexo.nomeArquivo ?? anexo.descricao,
      });
    }
  } catch (e) {
    console.warn("Falha ao incorporar anexos na juntada:", e);
  }

  try {
    const autos = await ensureAutosDoc(atual.nup, atual.autosDocId, atual.pastaId);
    atual.autosDocId = autos.documentId;
    atual.autosUrl = autos.url;

    const pecas: {
      pecaId?: string;
      titulo: string;
      tituloInterno?: string;
      texto: string;
      anexos?: AnexoJuntada[];
    }[] = [];
    for (const d of atual.documentos) {
      const juntadaDoItem = d.pecaId?.startsWith("juntada-")
        ? atual.juntadas.find((j) => `juntada-${j.id}` === d.pecaId)
        : undefined;
      if (d.documentId === doc.documentId) {
        pecas.push({
          pecaId: d.pecaId,
          titulo: d.titulo,
          tituloInterno: d.tituloInterno,
          texto: conteudo,
          anexos: juntadaDoItem?.anexos,
        });
      } else {
        pecas.push({
          pecaId: d.pecaId,
          titulo: d.titulo,
          tituloInterno: d.tituloInterno,
          texto: await getDocText(d.documentId),
          anexos: juntadaDoItem?.anexos,
        });
      }
    }
    await rebuildAutos(autos.documentId, pecas);
  } catch (e) {
    console.warn("Falha ao atualizar o documento único dos autos:", e);
  }

  return atual;
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
      ensureSindicanciaFolders,
      arquivoAtivo,
      rebuildAutos,
      getDocText,
      formatarPecaBasica,
    } = await import("./google.server");

    const { atual, linha } = await carregar(data.sindicanciaId);

    // A pasta da sindicância pode ter sido apagada/movida pra lixeira no Drive por fora do
    // app — nesse caso o ID salvo fica "morto" e os próximos documentos seriam criados fora
    // dela sem avisar ninguém. Confere e recria antes de seguir.
    if (atual.nup?.trim() && !(await arquivoAtivo(atual.pastaId))) {
      try {
        const pastas = await ensureSindicanciaFolders(atual.nup);
        atual.pastaId = pastas.pastaId;
        atual.pastaUrl = pastas.pastaUrl;
        atual.anexosId = pastas.anexosId;
        atual.anexosUrl = pastas.anexosUrl;
      } catch (e) {
        console.warn("Não foi possível recriar a pasta da sindicância no Drive:", e);
      }
    }

    // Peça "única" (ex.: Termo de Abertura) já exportada antes? Atualiza o mesmo documento,
    // na mesma posição, em vez de criar mais um Google Doc duplicado — a menos que o
    // documento individual tenha sido apagado/perdido no Drive, caso em que é recriado na
    // mesma posição em vez de silenciosamente não fazer nada.
    const existenteBruto =
      data.unica && data.pecaId
        ? atual.documentos.find((d) => d.pecaId === data.pecaId)
        : undefined;
    const existenteAtivo =
      existenteBruto && (await arquivoAtivo(existenteBruto.documentId))
        ? existenteBruto
        : undefined;

    let lista = [...atual.documentos];
    let doc: { documentId: string; url: string; embedUrl: string };
    let pos: number;

    if (existenteAtivo) {
      doc = await updateDocContent(existenteAtivo.documentId, data.conteudo);
      pos = lista.findIndex((d) => d.documentId === existenteAtivo.documentId) + 1;
      lista = lista.map((d) =>
        d.documentId === existenteAtivo.documentId ? { ...d, titulo: data.titulo } : d,
      );
    } else if (existenteBruto) {
      doc = await createDoc(data.titulo, data.conteudo, atual.pastaId);
      const idxAntigo = lista.findIndex((d) => d.documentId === existenteBruto.documentId);
      pos = idxAntigo + 1;
      lista[idxAntigo] = {
        titulo: data.titulo,
        documentId: doc.documentId,
        url: doc.url,
        pecaId: data.pecaId,
      };
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

    // Formatação-base (cabeçalho/título/assinatura) — mesma lógica usada no consolidado.
    let avisoFormatacao: string | undefined;
    try {
      await formatarPecaBasica(doc.documentId, data.pecaId);
    } catch (e) {
      console.warn("Falha ao formatar a peça:", e);
      avisoFormatacao = e instanceof Error ? e.message : "Falha desconhecida ao formatar a peça.";
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

      const pecas: {
        pecaId?: string;
        titulo: string;
        tituloInterno?: string;
        texto: string;
        anexos?: AnexoJuntada[];
      }[] = [];
      for (const d of lista) {
        const juntadaDoItem = d.pecaId?.startsWith("juntada-")
          ? atual.juntadas.find((j) => `juntada-${j.id}` === d.pecaId)
          : undefined;
        pecas.push({
          pecaId: d.pecaId,
          titulo: d.titulo,
          tituloInterno: d.tituloInterno,
          texto: d.documentId === doc.documentId ? data.conteudo : await getDocText(d.documentId),
          anexos: juntadaDoItem?.anexos,
        });
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

    return {
      ...doc,
      posicao: pos,
      autosUrl,
      atualizado: Boolean(existenteAtivo),
      recriado: Boolean(existenteBruto) && !existenteAtivo,
      avisoFormatacao,
    };
  });

/** Cria uma nova juntada (numerada) vinculada ao NUP da sindicância, com seu próprio Google
 *  Doc (termo + lista de anexos), já inserido no documento único dos autos. Pode ser chamada
 *  quantas vezes forem necessárias — cada sindicância pode ter várias juntadas. */
export const criarJuntada = createServerFn({ method: "POST" })
  .inputValidator((data: { sindicanciaId: string; titulo: string; data: string }) => data)
  .handler(async ({ data }) => {
    const { updateRow } = await import("./google.server");
    const { atual: atualInicial, linha } = await carregar(data.sindicanciaId);
    let atual = atualInicial;
    const numero = (atual.juntadas?.length ?? 0) + 1;
    const juntada: Juntada = {
      id: `JUN-${Date.now()}`,
      numero,
      titulo: data.titulo || `Juntada nº ${numero}`,
      data: data.data || new Date().toISOString().slice(0, 10),
      anexos: [],
    };
    atual.juntadas = [...(atual.juntadas ?? []), juntada];
    atual.documentos = atual.documentos ?? [];

    atual = await sincronizarDocumentoJuntada(atual, juntada.id);

    await updateRow(linha, sindicanciaToRow(atual));
    return atual.juntadas.find((j) => j.id === juntada.id)!;
  });

/** Envia um anexo para a pasta "Anexos" do NUP, vincula-o a uma juntada e atualiza o Google
 *  Doc dela — fotos ficam incorporadas no texto, PDFs e demais tipos viram um link clicável. */
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
    const { uploadAnexo, updateRow, ensureSindicanciaFolders, arquivoAtivo } =
      await import("./google.server");
    const { atual: atualInicial, linha } = await carregar(data.sindicanciaId);
    let atual = atualInicial;

    let anexosId = atual.anexosId;
    if (!(await arquivoAtivo(anexosId))) {
      const pastas = await ensureSindicanciaFolders(atual.nup);
      atual.pastaId = pastas.pastaId;
      atual.pastaUrl = pastas.pastaUrl;
      atual.anexosId = pastas.anexosId;
      atual.anexosUrl = pastas.anexosUrl;
      anexosId = pastas.anexosId;
    }
    if (!anexosId) {
      throw new Error("Não foi possível localizar ou criar a pasta de anexos no Drive.");
    }

    const arquivo = await uploadAnexo({
      nome: data.nome,
      mimeType: data.mimeType,
      base64: data.base64,
      pastaId: anexosId,
    });

    atual.juntadas = (atual.juntadas ?? []).map((j) =>
      j.id === data.juntadaId
        ? {
            ...j,
            anexos: [
              ...j.anexos,
              {
                id: `ANX-${Date.now()}`,
                descricao: data.nome,
                fileId: arquivo.fileId,
                url: arquivo.url,
                mimeType: arquivo.mimeType,
                nomeArquivo: arquivo.nome,
              } satisfies AnexoJuntada,
            ],
          }
        : j,
    );

    atual = await sincronizarDocumentoJuntada(atual, data.juntadaId);

    await updateRow(linha, sindicanciaToRow(atual));
    return arquivo;
  });

/**
 * Desfaz a última inserção no documento único: remove a peça da lista dos autos, manda o
 * documento individual para a lixeira do Drive e reconstrói os autos com a numeração
 * corrigida. Usado pelo botão "Desfazer" logo após uma exportação confirmada sem querer.
 */
export const desfazerInsercao = createServerFn({ method: "POST" })
  .inputValidator((data: { sindicanciaId: string; documentId: string; etapa?: string }) => data)
  .handler(async ({ data }) => {
    const { updateRow, ensureAutosDoc, rebuildAutos, getDocText, moverParaLixeira } =
      await import("./google.server");

    const { atual, linha } = await carregar(data.sindicanciaId);
    const alvo = atual.documentos.find((d) => d.documentId === data.documentId);
    if (!alvo) throw new Error("A peça já não consta mais nos autos.");

    atual.documentos = atual.documentos.filter((d) => d.documentId !== data.documentId);
    if (alvo.pecaId?.startsWith("juntada-")) {
      atual.juntadas = (atual.juntadas ?? []).filter((j) => `juntada-${j.id}` !== alvo.pecaId);
    }
    if (data.etapa) {
      atual.etapas = (atual.etapas ?? []).filter((e) => e !== data.etapa);
    }

    try {
      await moverParaLixeira(data.documentId);
    } catch (e) {
      console.warn("Falha ao mover o documento individual para a lixeira:", e);
    }

    try {
      const autos = await ensureAutosDoc(atual.nup, atual.autosDocId, atual.pastaId);
      atual.autosDocId = autos.documentId;
      atual.autosUrl = autos.url;
      const pecas: {
        pecaId?: string;
        titulo: string;
        tituloInterno?: string;
        texto: string;
        anexos?: AnexoJuntada[];
      }[] = [];
      for (const d of atual.documentos) {
        const juntadaDoItem = d.pecaId?.startsWith("juntada-")
          ? atual.juntadas.find((j) => `juntada-${j.id}` === d.pecaId)
          : undefined;
        pecas.push({
          pecaId: d.pecaId,
          titulo: d.titulo,
          tituloInterno: d.tituloInterno,
          texto: await getDocText(d.documentId),
          anexos: juntadaDoItem?.anexos,
        });
      }
      await rebuildAutos(autos.documentId, pecas);
    } catch (e) {
      console.warn("Falha ao reconstruir o documento único após desfazer:", e);
    }

    await updateRow(linha, sindicanciaToRow(atual));
    return { removido: alvo.titulo, total: atual.documentos.length };
  });
