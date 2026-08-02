import { createServerFn } from "@tanstack/react-start";
import {
  cabecalho,
  gerarTextoJuntada,
  type AnexoJuntada,
  type Juntada,
  type Sindicancia,
} from "./pecas";
import { rowToSindicancia, sindicanciaToRow } from "./sindicancias.mapper";
import { carregar } from "./sindicancias.server";

/** Reconstrói o documento único dos autos a partir de atual.documentos — compartilhado entre
 *  o fluxo normal de exportação de peças e o de juntadas/anexos, para nunca ficarem
 *  dessincronizados. `conteudoAtual` evita reler do Drive o documento que acabou de ser
 *  escrito (já temos o texto em mãos). */
async function reconstruirAutos(
  atual: Sindicancia,
  doc: { documentId: string },
  conteudoAtual: string,
): Promise<Sindicancia> {
  const { ensureAutosDoc, rebuildAutos, getDocText } = await import("./google.server");
  try {
    const autos = await ensureAutosDoc(atual.nup, atual.autosDocId, atual.pastaId);
    atual.autosDocId = autos.documentId;
    atual.autosUrl = autos.url;

    const pecas: { pecaId?: string; titulo: string; tituloInterno?: string; texto: string }[] = [];
    for (const d of atual.documentos) {
      pecas.push({
        pecaId: d.pecaId,
        titulo: d.titulo,
        tituloInterno: d.tituloInterno,
        texto: d.documentId === doc.documentId ? conteudoAtual : await getDocText(d.documentId),
      });
    }
    await rebuildAutos(autos.documentId, pecas);
  } catch (e) {
    console.warn("Falha ao atualizar o documento único dos autos:", e);
  }
  return atual;
}

/**
 * Cria/atualiza o Google Doc de uma juntada específica (termo + lista numerada dos itens
 * digitados), registra em atual.documentos (participando da paginação normal dos autos) e
 * reconstrói o documento único. A cada chamada o conteúdo é regenerado do zero a partir de
 * atual.juntadas, então fica sempre consistente com os itens realmente cadastrados. As
 * fotos/PDFs de cada item ficam em folhas próprias — ver sincronizarDocumentoItemAnexo.
 */
async function sincronizarDocumentoJuntada(
  atual: Sindicancia,
  juntadaId: string,
): Promise<Sindicancia> {
  const { createDoc, updateDocContent, formatarPecaBasica } = await import("./google.server");

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

  return reconstruirAutos(atual, doc, conteudo);
}

/**
 * Cria/atualiza a folha própria de um item de juntada que tenha arquivo anexado — a foto
 * incorporada, ou um link para abrir o PDF/demais tipos. Fica em página separada, logo após
 * a juntada (ou o último item já anexado a ela), nunca embutida sob a linha do item.
 */
async function sincronizarDocumentoItemAnexo(
  atual: Sindicancia,
  juntadaId: string,
  itemId: string,
): Promise<Sindicancia> {
  const { createDoc, updateDocContent, inserirAnexoNoFimDoDocumento } =
    await import("./google.server");

  const juntada = atual.juntadas.find((j) => j.id === juntadaId);
  const item = juntada?.anexos.find((a) => a.id === itemId);
  if (!juntada || !item || !item.fileId || !item.url) return atual;

  const pecaId = `juntada-${juntadaId}-item-${item.id}`;
  const tituloDoc = `Anexo — ${item.descricao} — ${atual.nup || atual.id}`;
  const conteudo = `${cabecalho(atual).replace(/\n+$/, "")}\n\n${item.descricao}\n`;

  const existente = atual.documentos.find((d) => d.pecaId === pecaId);
  const doc = existente
    ? await updateDocContent(existente.documentId, conteudo)
    : await createDoc(tituloDoc, conteudo, atual.pastaId);

  if (existente) {
    atual.documentos = atual.documentos.map((d) =>
      d.documentId === existente.documentId ? { ...d, titulo: tituloDoc } : d,
    );
  } else {
    // Insere logo após a juntada ou o último item já anexado a ela, mantendo a sequência
    // de folhas coerente mesmo quando há vários itens.
    const prefixoJuntada = `juntada-${juntadaId}`;
    let idxInsercao = -1;
    atual.documentos.forEach((d, idx) => {
      if (d.pecaId === prefixoJuntada || d.pecaId?.startsWith(`${prefixoJuntada}-item-`)) {
        idxInsercao = idx;
      }
    });
    const novaEntrada = { titulo: tituloDoc, documentId: doc.documentId, url: doc.url, pecaId };
    atual.documentos =
      idxInsercao >= 0
        ? [
            ...atual.documentos.slice(0, idxInsercao + 1),
            novaEntrada,
            ...atual.documentos.slice(idxInsercao + 1),
          ]
        : [...atual.documentos, novaEntrada];
  }

  atual.juntadas = atual.juntadas.map((j) =>
    j.id === juntadaId
      ? {
          ...j,
          anexos: j.anexos.map((a) =>
            a.id === itemId ? { ...a, documentId: doc.documentId, docUrl: doc.url } : a,
          ),
        }
      : j,
  );

  try {
    await inserirAnexoNoFimDoDocumento(doc.documentId, {
      fileId: item.fileId,
      url: item.url,
      mimeType: item.mimeType,
      nomeArquivo: item.nomeArquivo,
    });
  } catch (e) {
    console.warn("Falha ao incorporar o anexo na folha própria:", e);
  }

  return reconstruirAutos(atual, doc, conteudo);
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
      ensureSindicanciaFolders,
      arquivoAtivo,
      formatarPecaBasica,
    } = await import("./google.server");

    const { atual: atualInicial, linha } = await carregar(data.sindicanciaId);
    let atual = atualInicial;

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
    atual = await reconstruirAutos(atual, doc, data.conteudo);
    autosUrl = atual.autosUrl;

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

/**
 * Adiciona um item digitado a uma juntada — a descrição é texto livre (pode ter vírgula,
 * dois-pontos etc.), independente do nome de um eventual arquivo anexado. Se um arquivo for
 * enviado junto, ele ganha sua própria folha nos autos (foto incorporada, ou link para PDFs
 * e demais tipos) — nunca embutido embaixo da linha do item.
 */
export const adicionarItemJuntada = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      sindicanciaId: string;
      juntadaId: string;
      descricao: string;
      arquivo?: { nome: string; mimeType: string; base64: string };
    }) => data,
  )
  .handler(async ({ data }) => {
    const { uploadAnexo, updateRow, ensureSindicanciaFolders, arquivoAtivo } =
      await import("./google.server");
    const { atual: atualInicial, linha } = await carregar(data.sindicanciaId);
    let atual = atualInicial;

    let arquivoInfo: { fileId: string; url: string; mimeType: string; nome: string } | undefined;
    if (data.arquivo) {
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

      const up = await uploadAnexo({
        nome: data.arquivo.nome,
        mimeType: data.arquivo.mimeType,
        base64: data.arquivo.base64,
        pastaId: anexosId,
      });
      arquivoInfo = { fileId: up.fileId, url: up.url, mimeType: up.mimeType, nome: up.nome };
    }

    const item: AnexoJuntada = {
      id: `ITEM-${Date.now()}`,
      descricao: data.descricao,
      fileId: arquivoInfo?.fileId,
      url: arquivoInfo?.url,
      mimeType: arquivoInfo?.mimeType,
      nomeArquivo: arquivoInfo?.nome,
    };

    atual.juntadas = (atual.juntadas ?? []).map((j) =>
      j.id === data.juntadaId ? { ...j, anexos: [...j.anexos, item] } : j,
    );

    atual = await sincronizarDocumentoJuntada(atual, data.juntadaId);
    if (item.fileId) {
      atual = await sincronizarDocumentoItemAnexo(atual, data.juntadaId, item.id);
    }

    await updateRow(linha, sindicanciaToRow(atual));
    return item;
  });
