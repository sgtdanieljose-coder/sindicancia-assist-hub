import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, ExternalLink, FileUp, History, Loader2, RotateCcw, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { desfazerInsercao, listarVersoes, restaurarVersao } from "@/lib/sindicancias.functions";
import { salvarRascunho, chaveRascunho } from "@/lib/localStore";
import { useStatusSincronizacao, useSyncQueue, alvoPeca } from "@/hooks/useSyncQueue";

/** Formato devolvido por exportarParaDocs (ver sindicancias.functions.ts) — repetido aqui
 *  porque a exportação agora passa pela fila (useSyncQueue), que carrega o resultado como
 *  `unknown` até o ponto de consumo. */
type ResultadoExportar = {
  documentId: string;
  url: string;
  embedUrl: string;
  posicao: number;
  autosUrl?: string;
  atualizado: boolean;
  recriado: boolean;
  avisoFormatacao?: string;
};

type Props = {
  titulo: string;
  conteudo: string;
  sindicanciaId: string;
  pecasExistentes: { titulo: string; documentId: string; pecaId?: string }[];
  pecaId?: string;
  unica?: boolean;
  etapa?: string;
  onChange: (texto: string) => void;
  onExportado?: () => void;
};

export function EditorPeca({
  titulo,
  conteudo,
  sindicanciaId,
  pecasExistentes,
  pecaId,
  unica,
  etapa,
  onChange,
  onExportado,
}: Props) {
  const existente = unica && pecaId ? pecasExistentes.find((d) => d.pecaId === pecaId) : undefined;

  const [doc, setDoc] = useState<{ url: string; embedUrl: string } | null>(
    existente
      ? {
          url: `https://docs.google.com/document/d/${existente.documentId}/edit`,
          embedUrl: `https://docs.google.com/document/d/${existente.documentId}/preview`,
        }
      : null,
  );
  const [autosUrl, setAutosUrl] = useState<string | null>(null);
  const [perguntando, setPerguntando] = useState(false);
  const [ultimaInsercao, setUltimaInsercao] = useState<{
    documentId: string;
    posicao: number;
  } | null>(null);
  const total = pecasExistentes.length + 1;
  const [posicao, setPosicao] = useState(String(total));

  useEffect(() => {
    setDoc(
      existente
        ? {
            url: `https://docs.google.com/document/d/${existente.documentId}/edit`,
            embedUrl: `https://docs.google.com/document/d/${existente.documentId}/preview`,
          }
        : null,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existente?.documentId]);

  // ------------------------------------------------------------------------------------
  // Prioridade 1.1 — "Salvar" local: grava o rascunho no IndexedDB (debounce de 600ms)
  // toda vez que o texto muda, sem depender do Google. É só uma rede de segurança contra
  // perda de conteúdo (ex.: aba fechada sem querer); a fonte de verdade em tela continua
  // sendo o estado do componente pai (routes/pecas.tsx) — restaurar esse rascunho
  // automaticamente é um próximo passo, a decidir junto com o fluxo de regeneração do
  // template a partir dos campos.
  // ------------------------------------------------------------------------------------
  const [statusLocal, setStatusLocal] = useState<"salvo" | "salvando">("salvo");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const primeiraRenderizacao = useRef(true);

  useEffect(() => {
    if (primeiraRenderizacao.current) {
      primeiraRenderizacao.current = false;
      return;
    }
    if (!pecaId) return;
    setStatusLocal("salvando");
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void salvarRascunho({
        chave: chaveRascunho(sindicanciaId, pecaId),
        sindicanciaId,
        pecaId,
        texto: conteudo,
        atualizadoEm: new Date().toISOString(),
      }).then(() => setStatusLocal("salvo"));
    }, 600);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [conteudo, sindicanciaId, pecaId]);

  // ------------------------------------------------------------------------------------
  // Prioridade 1.2/1.3/1.7 — "Sincronizar": exportar para o Google Docs passa pela fila de
  // sincronização em vez de uma mutação direta. Isso dá retry com backoff automático (ex.:
  // erro 429 de quota) e evita disparar duas exportações da mesma peça em paralelo se o
  // usuário clicar mais de uma vez.
  // ------------------------------------------------------------------------------------
  const { enfileirarExportarPeca, enfileirarSincronizarAutos } = useSyncQueue();
  const alvoExportacao = alvoPeca(sindicanciaId, pecaId);
  const statusExportacao = useStatusSincronizacao(alvoExportacao);
  const ultimoResultadoTratado = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!statusExportacao || statusExportacao.atualizadoEm === ultimoResultadoTratado.current) {
      return;
    }
    if (statusExportacao.status === "completed") {
      ultimoResultadoTratado.current = statusExportacao.atualizadoEm;
      const d = statusExportacao.resultado as ResultadoExportar;
      setDoc(d);
      setAutosUrl(d.autosUrl ?? null);
      setPerguntando(false);
      // Só é possível desfazer uma inserção nova — atualizações não criam folha adicional.
      setUltimaInsercao(d.atualizado ? null : { documentId: d.documentId, posicao: d.posicao });
      toast.success(
        d.atualizado
          ? `Peça atualizada (Fls. ${d.posicao}) — documento individual sincronizado`
          : d.recriado
            ? `O documento anterior não foi encontrado no Drive — recriado na Fls. ${d.posicao}`
            : `Peça salva individualmente e inserida na página ${d.posicao} dos autos`,
      );
      if (d.avisoFormatacao) {
        toast.warning(`Documento salvo, mas a formatação falhou: ${d.avisoFormatacao}`);
      }
      onExportado?.();
      // Os autos ficam desatualizados após qualquer peça exportada — enfileira a
      // reconstrução do consolidado à parte (dedupe: N exportações seguidas = 1 rebuild).
      enfileirarSincronizarAutos({ sindicanciaId });
    } else if (statusExportacao.status === "failed") {
      ultimoResultadoTratado.current = statusExportacao.atualizadoEm;
      toast.error(statusExportacao.erro ?? "Falha ao sincronizar com o Google Docs.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusExportacao]);

  const exportando =
    statusExportacao?.status === "processing" || statusExportacao?.status === "retrying";

  const exportar = (pos?: number) => {
    enfileirarExportarPeca({ sindicanciaId, titulo, conteudo, posicao: pos, pecaId, unica, etapa });
    setPerguntando(false);
  };

  const desfazer = useMutation({
    mutationFn: (documentId: string) =>
      desfazerInsercao({ data: { sindicanciaId, documentId, etapa } }),
    onSuccess: () => {
      setUltimaInsercao(null);
      setDoc(null);
      toast.success(
        "Inserção desfeita — os autos foram removidos e ficam pendentes de sincronizar.",
      );
      enfileirarSincronizarAutos({ sindicanciaId });
      onExportado?.();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const documentIdAtual = existente?.documentId ?? null;
  const [historicoAberto, setHistoricoAberto] = useState(false);

  const versoes = useQuery({
    queryKey: ["versoes-peca", sindicanciaId, documentIdAtual],
    enabled: Boolean(documentIdAtual),
    queryFn: () =>
      listarVersoes({ data: { sindicanciaId, documentId: documentIdAtual as string } }),
  });

  const restaurar = useMutation({
    mutationFn: (versaoId: string) =>
      restaurarVersao({
        data: { sindicanciaId, documentId: documentIdAtual as string, versaoId, pecaId },
      }),
    onSuccess: (d) => {
      onChange(d.texto);
      setHistoricoAberto(false);
      void versoes.refetch();
      toast.success(
        "Versão anterior restaurada — peça atualizada, autos pendentes de sincronizar.",
      );
      if (d.avisoFormatacao) {
        toast.warning(`Texto restaurado, mas a formatação falhou: ${d.avisoFormatacao}`);
      }
      enfileirarSincronizarAutos({ sindicanciaId });
      onExportado?.();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const listaVersoes = versoes.data?.versoes ?? [];

  const acionar = () => {
    if (existente) {
      exportar(undefined);
    } else {
      setPosicao(String(total));
      setPerguntando(true);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <p className="rotulo">Minuta gerada — revise antes de exportar</p>
          <StatusLocalBadge status={statusLocal} />
          <StatusSincronizacaoBadge status={statusExportacao?.status} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {documentIdAtual && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setHistoricoAberto(true);
                void versoes.refetch();
              }}
            >
              <History className="size-4" />
              Histórico de versões
              {listaVersoes.length > 0 ? ` (${listaVersoes.length})` : ""}
            </Button>
          )}
          <Button onClick={acionar} disabled={exportando || !conteudo.trim()} size="sm">
            {exportando ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <FileUp className="size-4" />
            )}
            {existente ? "Atualizar no Google Docs" : "Exportar para Google Docs"}
          </Button>
        </div>
      </div>

      <Dialog open={historicoAberto} onOpenChange={setHistoricoAberto}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Histórico de versões desta peça</DialogTitle>
            <DialogDescription>
              Cada exportação/atualização guarda o texto anterior. Restaurar reescreve o documento
              individual e repagina os autos — o texto atual vira uma nova entrada do histórico.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[55vh] space-y-2 overflow-y-auto">
            {versoes.isFetching && listaVersoes.length === 0 && (
              <p className="text-sm text-muted-foreground">Carregando histórico...</p>
            )}
            {!versoes.isFetching && listaVersoes.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Ainda não há versões anteriores — o histórico começa na primeira atualização desta
                peça.
              </p>
            )}
            {listaVersoes.map((v, i) => (
              <div key={v.id} className="rounded-md border border-border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium">
                    Versão {listaVersoes.length - i} —{" "}
                    {new Date(v.criadoEm).toLocaleString("pt-BR")}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => restaurar.mutate(v.id)}
                    disabled={restaurar.isPending}
                  >
                    {restaurar.isPending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <RotateCcw className="size-4" />
                    )}
                    Restaurar
                  </Button>
                </div>
                <pre className="mt-2 max-h-32 overflow-hidden whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-muted-foreground">
                  {v.texto.slice(0, 400)}
                  {v.texto.length > 400 ? "..." : ""}
                </pre>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {ultimaInsercao && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-muted/40 px-3 py-2">
          <p className="text-xs text-muted-foreground">
            Peça inserida na Fls. {ultimaInsercao.posicao} dos autos. Confirmou sem querer? Você
            pode desfazer esta inserção — a peça sai dos autos, o documento individual vai para a
            lixeira do Drive e as folhas são renumeradas.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => desfazer.mutate(ultimaInsercao.documentId)}
            disabled={desfazer.isPending}
          >
            {desfazer.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Undo2 className="size-4" />
            )}
            Desfazer inserção
          </Button>
        </div>
      )}

      {existente && (
        <p className="text-xs text-muted-foreground">
          Esta peça já foi exportada (Fls.{" "}
          {pecasExistentes.findIndex((d) => d.pecaId === pecaId) + 1} dos autos). Exportar novamente
          atualiza o mesmo documento em vez de duplicá-lo.
        </p>
      )}

      <Textarea
        value={conteudo}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-[420px] font-mono text-[13px] leading-relaxed"
        spellCheck={false}
      />

      <Dialog open={perguntando} onOpenChange={setPerguntando}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Em qual página inserir esta peça?</DialogTitle>
            <DialogDescription>
              A peça será salva como documento individual e também inserida no documento único dos
              autos, que é repaginado (Fls. 1, 2, 3...) a cada inclusão.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5">
            <Label>Página nos autos</Label>
            <Select value={posicao} onValueChange={setPosicao}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: total }, (_, i) => i + 1).map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    Fls. {n}
                    {pecasExistentes[n - 1]
                      ? ` — antes de "${pecasExistentes[n - 1].titulo}"`
                      : " — ao final dos autos"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPerguntando(false)}>
              Cancelar
            </Button>
            <Button onClick={() => exportar(Number(posicao))} disabled={exportando}>
              {exportando && <Loader2 className="size-4 animate-spin" />}
              Confirmar e exportar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {(doc || autosUrl) && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="rotulo">Documento no Google Docs</p>
            <div className="flex gap-3">
              {autosUrl && (
                <a
                  href={autosUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                >
                  Autos (documento único) <ExternalLink className="size-3.5" />
                </a>
              )}
              {doc && (
                <a
                  href={doc.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                >
                  Abrir peça <ExternalLink className="size-3.5" />
                </a>
              )}
            </div>
          </div>
          {doc && (
            <iframe
              title={titulo}
              src={doc.embedUrl}
              className="h-[520px] w-full rounded-md border border-border bg-card"
            />
          )}
        </div>
      )}
    </div>
  );
}

/** Indicador do "Salvar" local (Prioridade 1.1) — instantâneo, nunca depende do Google. */
function StatusLocalBadge({ status }: { status: "salvo" | "salvando" }) {
  if (status === "salvando") {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
        <Loader2 className="size-3 animate-spin" /> Salvando...
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
      <Check className="size-3 text-green-600" /> Salvo
    </span>
  );
}

/** Indicador do "Sincronizar" com o Google Docs (Prioridade 1.2/1.8) — reflete o status da
 *  operação na fila (ver useSyncQueue). Ausente = ainda não foi exportado nesta sessão. */
function StatusSincronizacaoBadge({
  status,
}: {
  status?: "pending" | "processing" | "completed" | "failed" | "retrying";
}) {
  if (!status) return null;
  const mapa: Record<string, { texto: string; className: string }> = {
    pending: { texto: "🟡 Alterações pendentes", className: "text-amber-600" },
    processing: { texto: "🔄 Sincronizando...", className: "text-muted-foreground" },
    retrying: { texto: "🔄 Tentando novamente...", className: "text-amber-600" },
    completed: { texto: "🟢 Sincronizado", className: "text-green-600" },
    failed: { texto: "🔴 Erro de sincronização", className: "text-destructive" },
  };
  const info = mapa[status];
  if (!info) return null;
  return <span className={`text-[11px] ${info.className}`}>{info.texto}</span>;
}
