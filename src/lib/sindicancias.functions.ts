import { createServerFn } from "@tanstack/react-start";
import {
  textoEfetivoJuntada,
  type AnexoJuntada,
  type DadoSindicado,
  type Juntada,
  type Sindicancia,
} from "./pecas";
import { rowToSindicancia, sindicanciaToRow } from "./sindicancias.mapper";
import { carregar, novaVersao } from "./sindicancias.server";

function rowToDadoSindicado(row: string[], linha: number): DadoSindicado {
  return {
    linha,
    sindicanciaId: row[0] ?? "",
    civil: (row[1] as DadoSindicado["civil"]) || "",
    idt: row[2] ?? "",
    cpf: row[3] ?? "",
    nascimento: row[4] ?? "",
    naturalidade: row[5] ?? "",
    estadoCivil: row[6] ?? "",
    filiacao: row[7] ?? "",
    mae: row[8] ?? "",
    enderecoCompleto: row[9] ?? "",
    // row[10] era "cep" — não é mais coletado (o CEP agora vai dentro de enderecoCompleto).
    companhia: row[11] ?? "",
    vocativo: row[12] ?? "",
  };
}

function dadoSindicadoToRow(d: DadoSindicado): string[] {
  return [
    d.sindicanciaId,
    d.civil,
    d.idt,
    d.cpf,
    d.nascimento,
    d.naturalidade,
    d.estadoCivil,
    d.filiacao,
    d.mae,
    d.enderecoCompleto,
    "", // coluna "cep" mantida em branco só para não deslocar companhia/vocativo
    d.companhia,
    d.vocativo,
  ];
}

/** Lista os sindicados (Dados_Sindicado) vinculados a uma sindicância pelo id. */
export const listarSindicados = createServerFn({ method: "GET" })
  .inputValidator((data: { sindicanciaId: string }) => data)
  .handler(async ({ data }) => {
    const { readSindicadosRows } = await import("./google.server");
    const rows = await readSindicadosRows();
    return rows
      .map((row, i) => ({ row, linha: i + 2 }))
      .filter(({ row }) => row[0] === data.sindicanciaId)
      .map(({ row, linha }) => rowToDadoSindicado(row, linha));
  });

/** Cria (sem `linha`) ou atualiza (com `linha`) um registro de Dados_Sindicado. */
export const salvarSindicado = createServerFn({ method: "POST" })
  .inputValidator((data: DadoSindicado) => data)
  .handler(async ({ data }) => {
    const { appendSindicadoRow, updateSindicadoRow, readSindicadosRows } =
      await import("./google.server");
    const row = dadoSindicadoToRow(data);

    if (data.linha) {
      await updateSindicadoRow(data.linha, row);
      return { ...data };
    }

    await appendSindicadoRow(row);
    const rows = await readSindicadosRows();
    const idx = rows.map((r) => r[0]).lastIndexOf(data.sindicanciaId);
    return { ...data, linha: idx >= 0 ? idx + 2 : undefined };
  });

/** Remove (limpa) um registro de Dados_Sindicado pela posição na planilha. */
export const removerSindicado = createServerFn({ method: "POST" })
  .inputValidator((data: { linha: number }) => data)
  .handler(async ({ data }) => {
    const { limparSindicadoRow } = await import("./google.server");
    await limparSindicadoRow(data.linha);
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

  atual.documentos = existente
    ? atual.documentos.map((d) =>
        d.documentId === existente.documentId
          ? { ...d, titulo: tituloDoc, tituloInterno, texto: conteudo }
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
      // Guarda o texto que estava no documento antes de sobrescrever, para permitir restaurar.
      // Usa o texto já conhecido (evita 1 leitura no Google Docs) quando disponível.
      let anterior = existenteAtivo.texto ?? "";
      if (!existenteAtivo.texto) {
        try {
          anterior = await getDocText(existenteAtivo.documentId);
        } catch (e) {
          console.warn("Não foi possível ler o texto anterior da peça:", e);
        }
      }
      doc = await updateDocContent(existenteAtivo.documentId, data.conteudo);
      pos = lista.findIndex((d) => d.documentId === existenteAtivo.documentId) + 1;
      lista = lista.map((d) =>
        d.documentId === existenteAtivo.documentId
          ? {
              ...d,
              titulo: data.titulo,
              versoes: novaVersao(d.versoes, anterior, data.conteudo),
              texto: data.conteudo,
            }
          : d,
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
        versoes: existenteBruto.versoes,
        texto: data.conteudo,
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
        texto: data.conteudo,
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

    // Prioridade 1.7: já não reconstrói o documento único a cada peça salva — só garante que
    // ele exista (ensureAutosDoc é idempotente e, depois da 1ª vez, é só 1 checagem barata)
    // para o link "Autos" continuar disponível. O conteúdo em si é reconstruído à parte por
    // sincronizarAutos, enfileirado pelo cliente (ver syncQueue.ts) logo após esta exportação,
    // ou disparado manualmente pelo usuário em "Sincronizar Autos".
    let autosUrl = atual.autosUrl;
    try {
      const autos = await ensureAutosDoc(atual.nup, atual.autosDocId, atual.pastaId);
      atual.autosDocId = autos.documentId;
      atual.autosUrl = autos.url;
      autosUrl = autos.url;
    } catch (e) {
      console.warn("Falha ao garantir o documento único dos autos:", e);
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

/**
 * Atualiza a data e/ou o texto editado manualmente de uma juntada já existente, e
 * ressincroniza o Google Doc dela (e os autos). Usada pela aba "Juntada de
 * Documentos" do Gerador Dinâmico de Peças — ao contrário de adicionarAnexo, não
 * exige nenhum arquivo: serve só para digitar/ajustar o texto dos itens juntados.
 * `textoEditado` vazio ("") faz a juntada voltar a usar a lista automática de
 * anexos (ver textoEfetivoJuntada em pecas.ts).
 */
export const salvarJuntada = createServerFn({ method: "POST" })
  .inputValidator(
    (data: { sindicanciaId: string; juntadaId: string; data?: string; textoEditado?: string }) =>
      data,
  )
  .handler(async ({ data }) => {
    const { updateRow } = await import("./google.server");
    const { atual: atualInicial, linha } = await carregar(data.sindicanciaId);
    let atual = atualInicial;

    atual.juntadas = (atual.juntadas ?? []).map((j) =>
      j.id === data.juntadaId
        ? {
            ...j,
            data: data.data ?? j.data,
            textoEditado: data.textoEditado !== undefined ? data.textoEditado : j.textoEditado,
          }
        : j,
    );

    atual = await sincronizarDocumentoJuntada(atual, data.juntadaId);

    await updateRow(linha, sindicanciaToRow(atual));
    return atual.juntadas.find((j) => j.id === data.juntadaId)!;
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
    const { updateRow, ensureAutosDoc, moverParaLixeira } = await import("./google.server");

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

    await updateRow(linha, sindicanciaToRow(atual));
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
    const { updateDocContent, updateRow, ensureAutosDoc, getDocText, formatarPecaBasica } =
      await import("./google.server");

    const { atual, linha } = await carregar(data.sindicanciaId);
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
      await updateRow(linha, sindicanciaToRow(atual));
    } catch (e) {
      console.warn("Falha ao registrar a restauração na planilha:", e);
    }

    return { texto: versao.texto, avisoFormatacao };
  });

/**
 * Reconstrói o documento único dos autos (repagina "Fls. N", reaplica formatação) a partir
 * do estado atual salvo na planilha — Prioridade 1.7/1.8 da evolução do sistema.
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
export const sincronizarAutos = createServerFn({ method: "POST" })
  .inputValidator((data: { sindicanciaId: string }) => data)
  .handler(async ({ data }) => {
    const { ensureAutosDoc, rebuildAutos, getDocText, updateRow } = await import("./google.server");

    const { atual, linha } = await carregar(data.sindicanciaId);

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
        texto: d.texto ?? (await getDocText(d.documentId)),
        anexos: juntadaDoItem?.anexos,
      });
    }
    await rebuildAutos(autos.documentId, pecas);

    await updateRow(linha, sindicanciaToRow(atual));

    return { autosUrl: atual.autosUrl, autosDocId: atual.autosDocId, totalPecas: pecas.length };
  });
