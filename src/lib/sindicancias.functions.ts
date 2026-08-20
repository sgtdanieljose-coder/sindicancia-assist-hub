import { createServerFn } from "@tanstack/react-start";
import {
  textoEfetivoJuntada,
  type AnexoJuntada,
  type DadoSindicado,
  type Juntada,
  type Sindicancia,
  type StatusPeca,
  type StatusJuntada,
} from "./pecas";
import { carregar, novaVersao, salvar } from "./sindicancias.server";

/** Lista os sindicados vinculados a uma sindicância pelo id (Supabase). */
export const listarSindicados = createServerFn({ method: "GET" })
  .inputValidator((data: { sindicanciaId: string }) => data)
  .handler(async ({ data }) => {
    const { listarSindicadosDb } = await import("./supabase.server");
    return listarSindicadosDb(data.sindicanciaId);
  });

/** Cria (sem `id`) ou atualiza (com `id`) um sindicado. */
export const salvarSindicado = createServerFn({ method: "POST" })
  .inputValidator((data: DadoSindicado & { id?: string }) => data)
  .handler(async ({ data }) => {
    const { salvarSindicadoDb } = await import("./supabase.server");
    return salvarSindicadoDb(data);
  });

/** Remove um sindicado pelo id. */
export const removerSindicado = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    const { removerSindicadoDb } = await import("./supabase.server");
    await removerSindicadoDb(data.id);
  });

/**
 * Cria/atualiza o Google Doc de uma juntada específica (termo + lista de anexos + fotos/PDFs
 * incorporados), registra em atual.documentos (participando da paginação normal dos autos) e
 * reconstrói o documento único. Usado ao criar a juntada, ao anexar um arquivo novo e ao
 * salvar uma edição manual de texto (ver salvarJuntada) — a cada chamada, o conteúdo é
 * recalculado via textoEfetivoJuntada (texto editado manualmente, se houver, senão a lista
 * automática a partir de atual.juntadas), então fica sempre consistente com o que a
 * sindicância realmente tem cadastrado.
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
  } = await import("./google.server");

  const juntada = atual.juntadas.find((j) => j.id === juntadaId);
  if (!juntada) return atual;

  const pecaId = `juntada-${juntada.id}`;
  const tituloInterno = `JUNTADA Nº ${juntada.numero}`;
  const tituloDoc = `${tituloInterno} — ${atual.nup || atual.id}`;
  // Usa o texto editado manualmente pelo usuário (Gerador Dinâmico de Peças > Juntada de
  // Documentos), quando houver; senão volta a gerar a lista automática a partir dos anexos.
  const conteudo = textoEfetivoJuntada(atual, juntada);

  const existente = atual.documentos.find((d) => d.pecaId === pecaId);
  const doc = existente
    ? await updateDocContent(existente.documentId, conteudo)
    : await createDoc(tituloDoc, conteudo, atual.pastaId);
  const agora = new Date().toISOString();

  atual.documentos = existente
    ? atual.documentos.map((d) =>
        d.documentId === existente.documentId
          ? { ...d, titulo: tituloDoc, tituloInterno, texto: conteudo, atualizadoEm: agora }
          : d,
      )
    : [
        ...atual.documentos,
        {
          titulo: tituloDoc,
          documentId: doc.documentId,
          url: doc.url,
          pecaId,
          tituloInterno,
          texto: conteudo,
          status: "juntada-aos-autos",
          criadoEm: agora,
          atualizadoEm: agora,
        },
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

  // Prioridade 1.7: já não reconstrói os autos aqui a cada juntada salva/anexo enviado —
  // só garante que o documento único exista (ensureAutosDoc é idempotente e, depois da 1ª
  // vez, é só 1 checagem barata) para o link "Autos" continuar disponível. O conteúdo em si
  // é reconstruído à parte por sincronizarAutos, enfileirado pelo cliente (ver syncQueue.ts)
  // logo após esta chamada, ou disparado manualmente em "Sincronizar Autos".
  try {
    const autos = await ensureAutosDoc(atual.nup, atual.autosDocId, atual.pastaId);
    atual.autosDocId = autos.documentId;
    atual.autosUrl = autos.url;
  } catch (e) {
    console.warn("Falha ao garantir o documento único dos autos:", e);
  }

  return atual;
}

export const listarSindicancias = createServerFn({ method: "GET" }).handler(async () => {
  const { listarSindicanciasDb } = await import("./supabase.server");
  try {
    const itens = await listarSindicanciasDb();
    return { itens, erro: null as string | null };
  } catch (e) {
    return { itens: [] as Sindicancia[], erro: (e as Error).message };
  }
});

export const salvarSindicancia = createServerFn({ method: "POST" })
  .inputValidator((data: Sindicancia) => data)
  .handler(async ({ data }) => {
    const { ensureSindicanciaFolders } = await import("./google.server");
    const { salvarSindicanciaDb } = await import("./supabase.server");
    const registro: Sindicancia = { ...data, id: data.id || `SIND-${Date.now()}` };

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

    // salvarSindicanciaDb já faz upsert por id — não precisa mais ler tudo antes pra
    // decidir entre criar/atualizar, nem achar posição nenhuma.
    return salvarSindicanciaDb(registro);
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
      ensureAutosDoc,
      ensureSindicanciaFolders,
      arquivoAtivo,
      getDocText,
      formatarPecaBasica,
      resetarContadorRequisicoes,
      obterContadorRequisicoes,
    } = await import("./google.server");
    const { criarRastreador } = await import("./rastreamento");
    resetarContadorRequisicoes();
    const inicio = Date.now();
    const rastreador = criarRastreador();

    const { atual } = await rastreador.medir("carregar sindicância", () =>
      carregar(data.sindicanciaId),
    );

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
    const agora = new Date().toISOString();

    if (existenteAtivo) {
      // Guarda o texto que estava no documento antes de sobrescrever, para permitir restaurar.
      // Usa o texto já conhecido (evita 1 leitura no Google Docs) quando disponível.
      let anterior = existenteAtivo.texto ?? "";
      if (!existenteAtivo.texto) {
        try {
          anterior = await rastreador.medir("ler texto anterior", () =>
            getDocText(existenteAtivo.documentId),
          );
        } catch (e) {
          console.warn("Não foi possível ler o texto anterior da peça:", e);
        }
      }
      doc = await rastreador.medir("atualizar documento individual", () =>
        updateDocContent(existenteAtivo.documentId, data.conteudo),
      );
      pos = lista.findIndex((d) => d.documentId === existenteAtivo.documentId) + 1;
      lista = lista.map((d) =>
        d.documentId === existenteAtivo.documentId
          ? {
              ...d,
              titulo: data.titulo,
              versoes: novaVersao(d.versoes, anterior, data.conteudo),
              texto: data.conteudo,
              atualizadoEm: agora,
            }
          : d,
      );
    } else if (existenteBruto) {
      doc = await rastreador.medir("recriar documento individual", () =>
        createDoc(data.titulo, data.conteudo, atual.pastaId),
      );
      const idxAntigo = lista.findIndex((d) => d.documentId === existenteBruto.documentId);
      pos = idxAntigo + 1;
      lista[idxAntigo] = {
        titulo: data.titulo,
        documentId: doc.documentId,
        url: doc.url,
        pecaId: data.pecaId,
        versoes: existenteBruto.versoes,
        texto: data.conteudo,
        status: existenteBruto.status ?? "concluida",
        criadoEm: existenteBruto.criadoEm ?? agora,
        atualizadoEm: agora,
      };
    } else {
      doc = await rastreador.medir("criar documento individual", () =>
        createDoc(data.titulo, data.conteudo, atual.pastaId),
      );
      const total = lista.length + 1;
      pos = Math.min(Math.max(data.posicao ?? total, 1), total);
      lista.splice(pos - 1, 0, {
        titulo: data.titulo,
        documentId: doc.documentId,
        url: doc.url,
        pecaId: data.pecaId,
        texto: data.conteudo,
        status: "concluida",
        criadoEm: agora,
        atualizadoEm: agora,
      });
    }
    atual.documentos = lista;

    // Formatação-base (cabeçalho/título/assinatura) — mesma lógica usada no consolidado.
    let avisoFormatacao: string | undefined;
    try {
      await rastreador.medir("formatar peça (batchUpdate)", () =>
        formatarPecaBasica(doc.documentId, data.pecaId),
      );
    } catch (e) {
      console.warn("Falha ao formatar a peça:", e);
      avisoFormatacao = e instanceof Error ? e.message : "Falha desconhecida ao formatar a peça.";
    }

    // Marca automaticamente a etapa correspondente no checklist, se ainda não estiver marcada.
    if (data.etapa && !atual.etapas.includes(data.etapa)) {
      atual.etapas = [...atual.etapas, data.etapa];
    }

    // Prioridade 1.7: já não reconstrói o documento único a cada peça salva — só garante que
    // ele exista (ensureAutosDoc é idempotente e, depois da 1ª vez, é só 1 checagem barata)
    // para o link "Autos" continuar disponível. O conteúdo em si é reconstruído à parte por
    // sincronizarAutos, enfileirado pelo cliente (ver syncQueue.ts) logo após esta exportação,
    // ou disparado manualmente pelo usuário em "Sincronizar Autos".
    let autosUrl = atual.autosUrl;
    try {
      const autos = await rastreador.medir("localizar/garantir documento único", () =>
        ensureAutosDoc(atual.nup, atual.autosDocId, atual.pastaId),
      );
      atual.autosDocId = autos.documentId;
      atual.autosUrl = autos.url;
      autosUrl = autos.url;
    } catch (e) {
      console.warn("Falha ao garantir o documento único dos autos:", e);
    }

    try {
      await rastreador.medir("gravar sindicância", () => salvar(atual));
    } catch (e) {
      console.warn("Falha ao registrar documento na sindicância:", e);
    }

    return {
      ...doc,
      posicao: pos,
      autosUrl,
      atualizado: Boolean(existenteAtivo),
      recriado: Boolean(existenteBruto) && !existenteAtivo,
      avisoFormatacao,
      diagnostico: {
        totalMs: Date.now() - inicio,
        totalRequisicoes: obterContadorRequisicoes(),
        etapas: rastreador.etapas,
      },
    };
  });

/** Cria uma nova juntada (numerada) vinculada ao NUP da sindicância, com seu próprio Google
 *  Doc (termo + lista de anexos), já inserido no documento único dos autos. Pode ser chamada
 *  quantas vezes forem necessárias — cada sindicância pode ter várias juntadas. */
export const criarJuntada = createServerFn({ method: "POST" })
  .inputValidator(
    (data: { sindicanciaId: string; titulo: string; data: string; responsavel?: string }) => data,
  )
  .handler(async ({ data }) => {
    const { atual: atualInicial } = await carregar(data.sindicanciaId);
    let atual = atualInicial;
    const numero = (atual.juntadas?.length ?? 0) + 1;
    const juntada: Juntada = {
      id: `JUN-${Date.now()}`,
      numero,
      titulo: data.titulo || `Juntada nº ${numero}`,
      data: data.data || new Date().toISOString().slice(0, 10),
      anexos: [],
      responsavel: data.responsavel || undefined,
      status: "aberta",
    };
    atual.juntadas = [...(atual.juntadas ?? []), juntada];
    atual.documentos = atual.documentos ?? [];

    atual = await sincronizarDocumentoJuntada(atual, juntada.id);

    await salvar(atual);
    return atual.juntadas.find((j) => j.id === juntada.id)!;
  });

/**
 * Atualiza a data, o responsável, o status e/ou o texto editado manualmente de uma juntada
 * já existente, e ressincroniza o Google Doc dela (e os autos). Usada pela aba "Juntada de
 * Documentos" do Gerador Dinâmico de Peças e pelo índice dos autos — ao contrário de
 * adicionarAnexo, não exige nenhum arquivo. `textoEditado` vazio ("") faz a juntada voltar
 * a usar a lista automática de anexos (ver textoEfetivoJuntada em pecas.ts).
 */
export const salvarJuntada = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      sindicanciaId: string;
      juntadaId: string;
      data?: string;
      textoEditado?: string;
      responsavel?: string;
      status?: StatusJuntada;
    }) => data,
  )
  .handler(async ({ data }) => {
    const { atual: atualInicial } = await carregar(data.sindicanciaId);
    let atual = atualInicial;

    atual.juntadas = (atual.juntadas ?? []).map((j) =>
      j.id === data.juntadaId
        ? {
            ...j,
            data: data.data ?? j.data,
            textoEditado: data.textoEditado !== undefined ? data.textoEditado : j.textoEditado,
            responsavel: data.responsavel !== undefined ? data.responsavel : j.responsavel,
            status: data.status ?? j.status,
          }
        : j,
    );

    atual = await sincronizarDocumentoJuntada(atual, data.juntadaId);

    await salvar(atual);
    return atual.juntadas.find((j) => j.id === data.juntadaId)!;
  });

/** Envia um anexo para a pasta "Anexos" do NUP, vincula-o a uma juntada e atualiza o Google
 *  Doc dela — fotos ficam incorporadas no texto, PDFs e demais tipos viram um link clicável. */
/**
 * Envia um anexo para a juntada — recebe FormData (Prioridade 4.2), não mais JSON com o
 * arquivo em base64: o navegador manda o arquivo bruto (multipart/form-data), sem passar
 * por FileReader/base64 no cliente nem por uma decodificação equivalente aqui no servidor.
 * Campos esperados no FormData: sindicanciaId, juntadaId, descricao (opcional — usa o nome
 * do arquivo se ausente) e arquivo (o File em si).
 */
export const adicionarAnexo = createServerFn({ method: "POST" })
  .inputValidator((data: FormData) => data)
  .handler(async ({ data }) => {
    const sindicanciaId = String(data.get("sindicanciaId") ?? "");
    const juntadaId = String(data.get("juntadaId") ?? "");
    const arquivo = data.get("arquivo");
    if (!sindicanciaId || !juntadaId) {
      throw new Error("Sindicância ou juntada não informada.");
    }
    if (!(arquivo instanceof File)) {
      throw new Error("Nenhum arquivo recebido.");
    }
    const descricao = String(data.get("descricao") ?? arquivo.name);
    const mimeType = arquivo.type || "application/octet-stream";
    const bytes = new Uint8Array(await arquivo.arrayBuffer());

    const { uploadAnexo, ensureSindicanciaFolders, arquivoAtivo } = await import("./google.server");
    const { atual: atualInicial } = await carregar(sindicanciaId);
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

    const enviado = await uploadAnexo({
      nome: arquivo.name,
      mimeType,
      bytes,
      pastaId: anexosId,
    });

    const agora = new Date().toISOString();
    atual.juntadas = (atual.juntadas ?? []).map((j) =>
      j.id === juntadaId
        ? {
            ...j,
            anexos: [
              ...j.anexos,
              {
                id: `ANX-${Date.now()}`,
                descricao,
                fileId: enviado.fileId,
                url: enviado.url,
                mimeType: enviado.mimeType,
                nomeArquivo: enviado.nome,
                tamanho: bytes.length,
                criadoEm: agora,
              } satisfies AnexoJuntada,
            ],
          }
        : j,
    );

    atual = await sincronizarDocumentoJuntada(atual, juntadaId);

    await salvar(atual);
    return enviado;
  });

/**
 * Desfaz a última inserção no documento único: remove a peça da lista dos autos, manda o
 * documento individual para a lixeira do Drive e reconstrói os autos com a numeração
 * corrigida. Usado pelo botão "Desfazer" logo após uma exportação confirmada sem querer.
 */
export const desfazerInsercao = createServerFn({ method: "POST" })
  .inputValidator((data: { sindicanciaId: string; documentId: string; etapa?: string }) => data)
  .handler(async ({ data }) => {
    const { ensureAutosDoc, moverParaLixeira } = await import("./google.server");

    const { atual } = await carregar(data.sindicanciaId);
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

    // Prioridade 1.7: a repaginação do documento único não roda mais aqui — fica pendente
    // até sincronizarAutos rodar (enfileirado pelo cliente logo após o desfazer, ou disparado
    // manualmente). Só garante que o documento único continue existindo/vinculado.
    try {
      const autos = await ensureAutosDoc(atual.nup, atual.autosDocId, atual.pastaId);
      atual.autosDocId = autos.documentId;
      atual.autosUrl = autos.url;
    } catch (e) {
      console.warn("Falha ao garantir o documento único dos autos:", e);
    }

    await salvar(atual);
    return { removido: alvo.titulo, total: atual.documentos.length };
  });

/** Lista o histórico de versões de uma peça (mais recente primeiro). */
export const listarVersoes = createServerFn({ method: "POST" })
  .inputValidator((data: { sindicanciaId: string; documentId: string }) => data)
  .handler(async ({ data }) => {
    const { atual } = await carregar(data.sindicanciaId);
    const alvo = atual.documentos.find((d) => d.documentId === data.documentId);
    return { versoes: [...(alvo?.versoes ?? [])].reverse() };
  });

/**
 * Restaura uma versão anterior do texto da peça: reescreve o documento individual, guarda o
 * texto atual como nova versão (para poder voltar atrás) e reconstrói o documento único.
 */
export const restaurarVersao = createServerFn({ method: "POST" })
  .inputValidator(
    (data: { sindicanciaId: string; documentId: string; versaoId: string; pecaId?: string }) =>
      data,
  )
  .handler(async ({ data }) => {
    const { updateDocContent, ensureAutosDoc, getDocText, formatarPecaBasica } =
      await import("./google.server");

    const { atual } = await carregar(data.sindicanciaId);
    const alvo = atual.documentos.find((d) => d.documentId === data.documentId);
    if (!alvo) throw new Error("Peça não localizada nos autos.");
    const versao = (alvo.versoes ?? []).find((v) => v.id === data.versaoId);
    if (!versao) throw new Error("Versão não localizada no histórico desta peça.");

    let atualTexto = alvo.texto ?? "";
    if (!alvo.texto) {
      try {
        atualTexto = await getDocText(data.documentId);
      } catch (e) {
        console.warn("Não foi possível ler o texto atual da peça:", e);
      }
    }

    await updateDocContent(data.documentId, versao.texto);

    let avisoFormatacao: string | undefined;
    try {
      await formatarPecaBasica(data.documentId, alvo.pecaId ?? data.pecaId);
    } catch (e) {
      avisoFormatacao = e instanceof Error ? e.message : "Falha ao formatar a peça restaurada.";
    }

    atual.documentos = atual.documentos.map((d) =>
      d.documentId === data.documentId
        ? {
            ...d,
            versoes: novaVersao(d.versoes, atualTexto, versao.texto).filter(
              (v) => v.id !== versao.id,
            ),
            texto: versao.texto,
          }
        : d,
    );

    // Prioridade 1.7: a repaginação do documento único não roda mais aqui — fica pendente
    // até sincronizarAutos rodar (enfileirado pelo cliente logo após restaurar, ou disparado
    // manualmente). Só garante que o documento único continue existindo/vinculado.
    try {
      const autos = await ensureAutosDoc(atual.nup, atual.autosDocId, atual.pastaId);
      atual.autosDocId = autos.documentId;
      atual.autosUrl = autos.url;
    } catch (e) {
      console.warn("Falha ao garantir o documento único dos autos:", e);
    }

    try {
      await salvar(atual);
    } catch (e) {
      console.warn("Falha ao registrar a restauração na sindicância:", e);
    }

    return { texto: versao.texto, avisoFormatacao };
  });

/**
 * Reconstrói o documento único dos autos (repagina "Fls. N", reaplica formatação) a partir
 * do estado atual salvo no Supabase — Prioridade 1.7/1.8 da evolução do sistema.
 *
 * Antes, essa reconstrução rodava embutida (e duplicada 4x, com pequenas variações) dentro
 * de exportarParaDocs, sincronizarDocumentoJuntada, desfazerInsercao e restaurarVersao —
 * disparando a cada peça/juntada salva, com custo crescendo linearmente com o total de
 * peças já lançadas nos autos. Agora é uma operação própria, separada: as 4 funções acima
 * só marcam o documento único como existente (ensureAutosDoc) e devolvem o controle; quem
 * decide QUANDO reconstruir de fato é o cliente — via a fila de sincronização
 * (src/lib/syncQueue.ts), que enfileira esta função automaticamente logo após qualquer
 * alteração relevante (com deduplicação: várias alterações em sequência viram 1 única
 * reconstrução) e que também pode ser disparada manualmente pelo botão "Sincronizar Autos".
 */
/**
 * Reconstrói o documento único dos autos (repagina "Fls. N", reaplica formatação) a partir
 * do estado atual salvo no Supabase — Prioridade 1.7/1.8 da evolução do sistema.
 *
 * Antes, essa reconstrução rodava embutida (e duplicada 4x, com pequenas variações) dentro
 * de exportarParaDocs, sincronizarDocumentoJuntada, desfazerInsercao e restaurarVersao —
 * disparando a cada peça/juntada salva, com custo crescendo linearmente com o total de
 * peças já lançadas nos autos. Agora é uma operação própria, separada: as 4 funções acima
 * só marcam o documento único como existente (ensureAutosDoc) e devolvem o controle; quem
 * decide QUANDO reconstruir de fato é o cliente — via a fila de sincronização
 * (src/lib/syncQueue.ts), que enfileira esta função automaticamente logo após qualquer
 * alteração relevante (com deduplicação: várias alterações em sequência viram 1 única
 * reconstrução) e que também pode ser disparada manualmente pelo botão "Sincronizar Autos".
 *
 * Extraída como helper interna porque finalizarAutos (Prioridade 7) precisa do mesmo passo
 * — garantir que os Autos de Trabalho estão com o conteúdo mais recente — antes de congelar
 * uma cópia como versão final.
 */
async function reconstruirAutosDeTrabalho(
  atual: Sindicancia,
  rastreador: ReturnType<typeof import("./rastreamento").criarRastreador>,
): Promise<Sindicancia> {
  const { ensureAutosDoc, rebuildAutos, getDocText } = await import("./google.server");

  const autos = await rastreador.medir("localizar/garantir documento único", () =>
    ensureAutosDoc(atual.nup, atual.autosDocId, atual.pastaId),
  );
  atual.autosDocId = autos.documentId;
  atual.autosUrl = autos.url;

  const pecas: {
    pecaId?: string;
    titulo: string;
    tituloInterno?: string;
    texto: string;
    anexos?: AnexoJuntada[];
  }[] = [];
  await rastreador.medir("montar lista de peças", async () => {
    for (const d of atual.documentos) {
      const juntadaDoItem = d.pecaId?.startsWith("juntada-")
        ? atual.juntadas.find((j) => `juntada-${j.id}` === d.pecaId)
        : undefined;
      pecas.push({
        pecaId: d.pecaId,
        titulo: d.titulo,
        tituloInterno: d.tituloInterno,
        texto: d.texto ?? (await getDocText(d.documentId)),
        anexos: juntadaDoItem?.anexos,
      });
    }
  });
  await rastreador.medir("reconstruir documento único (batchUpdate)", () =>
    rebuildAutos(autos.documentId, pecas),
  );

  return atual;
}

export const sincronizarAutos = createServerFn({ method: "POST" })
  .inputValidator((data: { sindicanciaId: string }) => data)
  .handler(async ({ data }) => {
    const { resetarContadorRequisicoes, obterContadorRequisicoes } =
      await import("./google.server");
    const { criarRastreador } = await import("./rastreamento");
    resetarContadorRequisicoes();
    const inicio = Date.now();
    const rastreador = criarRastreador();

    const { atual: atualInicial } = await rastreador.medir("carregar sindicância", () =>
      carregar(data.sindicanciaId),
    );
    const atual = await reconstruirAutosDeTrabalho(atualInicial, rastreador);

    await rastreador.medir("gravar sindicância", () => salvar(atual));

    return {
      autosUrl: atual.autosUrl,
      autosDocId: atual.autosDocId,
      totalPecas: atual.documentos.length,
      diagnostico: {
        totalMs: Date.now() - inicio,
        totalRequisicoes: obterContadorRequisicoes(),
        etapas: rastreador.etapas,
      },
    };
  });

/**
 * "Finalizar Autos" (Prioridade 7/8): confere pendências (mesma validação do painel
 * "Validar Autos" — ver validacao.ts), garante que os Autos de Trabalho estão atualizados e
 * então congela uma cópia independente no Drive como "Autos Finais — vN". A cópia é um
 * arquivo à parte (files.copy do Drive) — editar os Autos de Trabalho depois não altera essa
 * cópia, o que já resolve a Prioridade 8 (separar Autos de Trabalho de Autos Finais) sem
 * precisar de nenhuma estrutura nova além do histórico de versões finalizadas.
 *
 * `forcarComPendencias` deixa finalizar mesmo com pendências em aberto — a validação é
 * informativa, não um bloqueio automático: quem decide se uma pendência impede ou não a
 * finalização é o encarregado, não o sistema.
 */
export const finalizarAutos = createServerFn({ method: "POST" })
  .inputValidator((data: { sindicanciaId: string; forcarComPendencias?: boolean }) => data)
  .handler(async ({ data }) => {
    const { copiarArquivoDrive, resetarContadorRequisicoes, obterContadorRequisicoes } =
      await import("./google.server");
    const { validarAutos } = await import("./validacao");
    const { criarRastreador } = await import("./rastreamento");
    resetarContadorRequisicoes();
    const inicio = Date.now();
    const rastreador = criarRastreador();

    const { atual: atualInicial } = await rastreador.medir("carregar sindicância", () =>
      carregar(data.sindicanciaId),
    );
    const atual = await reconstruirAutosDeTrabalho(atualInicial, rastreador);

    const pendencias = validarAutos(atual).filter((i) => !i.ok);
    if (pendencias.length > 0 && !data.forcarComPendencias) {
      const erro = new Error(
        `Há ${pendencias.length} pendência(s) nos autos. Corrija-as ou confirme a finalização mesmo assim.`,
      );
      (erro as Error & { pendencias?: typeof pendencias }).pendencias = pendencias;
      throw erro;
    }

    if (!atual.autosDocId) {
      throw new Error("Não foi possível localizar o documento único dos autos para finalizar.");
    }

    const versao = (atual.autosFinais?.length ?? 0) + 1;
    const nomeArquivo = `Autos Finais — v${versao} — NUP ${atual.nup}`;
    const copia = await rastreador.medir("copiar arquivo no Drive", () =>
      copiarArquivoDrive(atual.autosDocId!, nomeArquivo, atual.pastaId),
    );

    const registro = {
      versao,
      data: new Date().toISOString(),
      documentId: copia.documentId,
      url: copia.url,
      totalPecas: atual.documentos.length,
      pendenciasNaFinalizacao: pendencias.length,
    };
    atual.autosFinais = [...(atual.autosFinais ?? []), registro];

    await rastreador.medir("gravar sindicância", () => salvar(atual));

    return {
      ...registro,
      diagnostico: {
        totalMs: Date.now() - inicio,
        totalRequisicoes: obterContadorRequisicoes(),
        etapas: rastreador.etapas,
      },
    };
  });

/**
 * Altera a situação de controle de uma peça já lançada nos autos (Prioridade 2.3) sem
 * precisar abrir o Google Docs — é só 1 gravação no Supabase; o Google Docs em si nem é
 * tocado (o status é metadado do índice, não faz parte do conteúdo do documento).
 */
export const atualizarStatusPeca = createServerFn({ method: "POST" })
  .inputValidator((data: { sindicanciaId: string; documentId: string; status: StatusPeca }) => data)
  .handler(async ({ data }) => {
    const { atual } = await carregar(data.sindicanciaId);

    const alvo = atual.documentos.find((d) => d.documentId === data.documentId);
    if (!alvo) throw new Error("Peça não encontrada nos autos.");

    atual.documentos = atual.documentos.map((d) =>
      d.documentId === data.documentId ? { ...d, status: data.status } : d,
    );

    await salvar(atual);
    return { documentId: data.documentId, status: data.status };
  });

/**
 * Reordena as peças no índice dos autos (Prioridade 2.2 — arrastar/mover). Só grava a nova
 * ordem no Supabase; NÃO repagina o Google Docs (a repaginação real acontece à parte, em
 * sincronizarAutos, para não disparar uma reconstrução cara a cada arrasto).
 */
export const reordenarPecas = createServerFn({ method: "POST" })
  .inputValidator((data: { sindicanciaId: string; ordem: string[] }) => data)
  .handler(async ({ data }) => {
    const { atual } = await carregar(data.sindicanciaId);

    const porId = new Map(atual.documentos.map((d) => [d.documentId, d]));
    const reordenados = data.ordem
      .map((id) => porId.get(id))
      .filter((d): d is (typeof atual.documentos)[number] => Boolean(d));
    // Segurança: qualquer documento que não veio na lista de ordem (ex.: criado em outra
    // aba entre o carregamento e o clique) entra no fim, em vez de ser descartado.
    const faltantes = atual.documentos.filter((d) => !data.ordem.includes(d.documentId));
    atual.documentos = [...reordenados, ...faltantes];

    await salvar(atual);
    return { total: atual.documentos.length };
  });
