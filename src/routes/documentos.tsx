import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState, type DragEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowDown,
  ArrowUp,
  Check,
  ExternalLink,
  Eye,
  FolderOpen,
  GripVertical,
  History,
  Loader2,
  Paperclip,
  Pencil,
  Plus,
  RefreshCw,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { useSindicancias } from "@/components/SindicanciaContext";
import { HistoricoVersoesDialog } from "@/components/HistoricoVersoesDialog";
import {
  adicionarAnexo,
  atualizarStatusPeca,
  criarJuntada,
  reordenarPecas,
} from "@/lib/sindicancias.functions";
import {
  PECAS,
  STATUS_PECA,
  STATUS_PECA_LABEL,
  type Sindicancia,
  type StatusPeca,
} from "@/lib/pecas";
import { useStatusSincronizacao, useSyncQueue, alvoAutos, alvoPeca } from "@/hooks/useSyncQueue";

const PASTA_DRIVE = "https://drive.google.com/drive/folders/1zcQGM4T6-PAiEttCAdK6aqNBrUnQ-u6G";
const PLANILHA =
  "https://docs.google.com/spreadsheets/d/1Fy-JSNpRJXKE89Wm--zo0cFPJwU1Daf_ygUg78-s1jI/edit";

export const Route = createFileRoute("/documentos")({
  head: () => ({
    meta: [
      { title: "Autos e Documentos | Sindicâncias EB" },
      {
        name: "description",
        content:
          "Índice das peças da sindicância: status, ordem nos autos, busca, filtros e histórico — sem depender de abrir o Google Docs para consultar.",
      },
      { property: "og:title", content: "Autos e Documentos — Sindicâncias EB" },
      {
        property: "og:description",
        content: "Índice processual das peças, juntadas e anexos vinculados ao NUP.",
      },
    ],
  }),
  component: Documentos,
});

type DocumentoItem = Sindicancia["documentos"][number];

function lerArquivo(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(new Error("Falha ao ler o arquivo."));
    reader.readAsDataURL(file);
  });
}

function tipoDoItem(d: DocumentoItem): string {
  if (d.pecaId?.startsWith("juntada-")) return "Juntada";
  const base = d.pecaId ? PECAS.find((p) => p.id === d.pecaId) : undefined;
  return base?.nome ?? "Peça avulsa";
}

function formatarData(iso?: string): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("pt-BR");
  } catch {
    return "—";
  }
}

/** Badge de status de sincronização com o Google (fila) — mesma linguagem visual usada em
 *  EditorPeca.tsx e GuiaDocumento.tsx, aqui aplicada por linha do índice. */
function BadgeSincronizacao({ alvo }: { alvo: string }) {
  const status = useStatusSincronizacao(alvo);
  if (!status) return <span className="text-[11px] text-muted-foreground">—</span>;
  const mapa: Record<string, { texto: string; className: string }> = {
    pending: { texto: "🟡 Pendente", className: "text-amber-600" },
    processing: { texto: "🔄 Sincronizando", className: "text-muted-foreground" },
    retrying: { texto: "🔄 Tentando de novo", className: "text-amber-600" },
    completed: { texto: "🟢 Sincronizado", className: "text-green-600" },
    failed: { texto: "🔴 Erro", className: "text-destructive" },
  };
  const info = mapa[status.status];
  return <span className={`text-[11px] ${info.className}`}>{info.texto}</span>;
}

function Documentos() {
  const { itens, selecionada, setSelecionadaId, recarregar } = useSindicancias();
  const { enfileirarExportarPeca, enfileirarSincronizarAutos } = useSyncQueue();

  const [dialogo, setDialogo] = useState(false);
  const [juntadaId, setJuntadaId] = useState<string>("");
  const [novaJuntada, setNovaJuntada] = useState("");
  const [arquivo, setArquivo] = useState<File | null>(null);

  // Prioridade 2.4 — busca e filtros (client-side, sem chamada nenhuma ao Google).
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<StatusPeca | "todos">("todos");
  const [filtroTipo, setFiltroTipo] = useState<string>("todos");

  // Prioridade 2.5 — painel de visualização interna (em vez de abrir o Google Docs direto).
  const [pecaAberta, setPecaAberta] = useState<DocumentoItem | null>(null);
  const [mostrarPreview, setMostrarPreview] = useState(false);
  const [historicoAberto, setHistoricoAberto] = useState(false);

  const juntadas = selecionada?.juntadas ?? [];
  const documentos = useMemo(() => selecionada?.documentos ?? [], [selecionada]);

  const tiposDisponiveis = useMemo(
    () => Array.from(new Set(documentos.map((d) => tipoDoItem(d)))).sort(),
    [documentos],
  );

  const filtrosAtivos = Boolean(busca.trim()) || filtroStatus !== "todos" || filtroTipo !== "todos";

  const documentosFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return documentos
      .map((d, i) => ({ item: d, posicao: i + 1 }))
      .filter(({ item, posicao }) => {
        if (termo) {
          const alvoBusca = `${item.titulo} fls. ${posicao}`.toLowerCase();
          if (!alvoBusca.includes(termo)) return false;
        }
        if (filtroStatus !== "todos" && (item.status ?? "concluida") !== filtroStatus) return false;
        if (filtroTipo !== "todos" && tipoDoItem(item) !== filtroTipo) return false;
        return true;
      });
  }, [documentos, busca, filtroStatus, filtroTipo]);

  // ------------------------------------------------------------------------------------
  // Prioridade 2.2 — reordenação (arrastar ou setas). Só é permitida com os filtros
  // limpos, porque os índices das setas/arraste correspondem à posição REAL nos autos —
  // com busca/filtro ativos, a lista exibida é um subconjunto e esses índices não bateriam.
  // ------------------------------------------------------------------------------------
  const [arrastando, setArrastando] = useState<number | null>(null);

  const reordenar = useMutation({
    mutationFn: (ordem: string[]) =>
      reordenarPecas({ data: { sindicanciaId: selecionada!.id, ordem } }),
    onSuccess: () => {
      toast.success("Ordem atualizada — autos pendentes de sincronizar");
      enfileirarSincronizarAutos({ sindicanciaId: selecionada!.id });
      recarregar();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function mover(indice: number, direcao: -1 | 1) {
    const alvo = indice + direcao;
    if (alvo < 0 || alvo >= documentos.length) return;
    const nova = [...documentos];
    [nova[indice], nova[alvo]] = [nova[alvo], nova[indice]];
    reordenar.mutate(nova.map((d) => d.documentId));
  }

  function soltar(indiceDestino: number) {
    if (arrastando === null || arrastando === indiceDestino) {
      setArrastando(null);
      return;
    }
    const nova = [...documentos];
    const [item] = nova.splice(arrastando, 1);
    nova.splice(indiceDestino, 0, item);
    setArrastando(null);
    reordenar.mutate(nova.map((d) => d.documentId));
  }

  // ------------------------------------------------------------------------------------
  // Prioridade 2.3 — alterar status sem abrir o Google Docs (é só 1 gravação na planilha).
  // ------------------------------------------------------------------------------------
  const atualizarStatus = useMutation({
    mutationFn: (p: { documentId: string; status: StatusPeca }) =>
      atualizarStatusPeca({
        data: { sindicanciaId: selecionada!.id, documentId: p.documentId, status: p.status },
      }),
    onSuccess: (_r, variaveis) => {
      setPecaAberta((atual) =>
        atual && atual.documentId === variaveis.documentId
          ? { ...atual, status: variaveis.status }
          : atual,
      );
      recarregar();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const criar = useMutation({
    mutationFn: () =>
      criarJuntada({
        data: {
          sindicanciaId: selecionada!.id,
          titulo: novaJuntada,
          data: new Date().toISOString().slice(0, 10),
        },
      }),
    onSuccess: (j) => {
      setJuntadaId(j.id);
      setNovaJuntada("");
      toast.success(`Juntada nº ${j.numero} criada`);
      recarregar();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const enviar = useMutation({
    mutationFn: async () => {
      if (!arquivo) throw new Error("Selecione um arquivo.");
      if (!juntadaId) throw new Error("Selecione ou crie uma juntada.");
      const base64 = await lerArquivo(arquivo);
      return adicionarAnexo({
        data: {
          sindicanciaId: selecionada!.id,
          juntadaId,
          nome: arquivo.name,
          mimeType: arquivo.type || "application/octet-stream",
          base64,
        },
      });
    },
    onSuccess: () => {
      toast.success("Anexo enviado — autos pendentes de sincronizar");
      setArquivo(null);
      setDialogo(false);
      enfileirarSincronizarAutos({ sindicanciaId: selecionada!.id });
      recarregar();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const statusAutos = useStatusSincronizacao(selecionada ? alvoAutos(selecionada.id) : undefined);
  const infoAutos: Record<string, { texto: string; className: string }> = {
    pending: { texto: "🟡 Autos pendentes", className: "text-amber-600" },
    processing: { texto: "🔄 Sincronizando autos...", className: "text-muted-foreground" },
    retrying: { texto: "🔄 Tentando de novo...", className: "text-amber-600" },
    completed: { texto: "🟢 Autos sincronizados", className: "text-green-600" },
    failed: { texto: "🔴 Erro ao sincronizar autos", className: "text-destructive" },
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-4 sm:p-6">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 sm:flex sm:flex-wrap sm:justify-between">
        <div className="min-w-0">
          <h1 className="truncate font-serif text-2xl font-semibold">Autos e Documentos</h1>
          <p className="text-sm text-muted-foreground">
            Índice das peças desta sindicância — status, ordem, juntadas e anexos.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button size="sm" disabled={!selecionada} onClick={() => setDialogo(true)}>
            <Paperclip className="size-4" /> Adicionar anexos aos Autos
          </Button>
          {selecionada?.autosUrl && (
            <Button variant="outline" size="sm" asChild>
              <a href={selecionada.autosUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="size-4" /> Autos (documento único)
              </a>
            </Button>
          )}
          {selecionada?.pastaUrl && (
            <Button variant="outline" size="sm" asChild>
              <a href={selecionada.pastaUrl} target="_blank" rel="noreferrer">
                <FolderOpen className="size-4" /> Pasta da sindicância
              </a>
            </Button>
          )}
          <Button variant="outline" size="sm" asChild>
            <a href={selecionada?.anexosUrl || PASTA_DRIVE} target="_blank" rel="noreferrer">
              <FolderOpen className="size-4" /> Pasta de anexos
            </a>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a href={PLANILHA} target="_blank" rel="noreferrer">
              <ExternalLink className="size-4" /> Planilha-base
            </a>
          </Button>
        </div>
      </header>

      {itens.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {itens.map((i) => (
            <Button
              key={i.id}
              size="sm"
              variant={selecionada?.id === i.id ? "default" : "secondary"}
              onClick={() => setSelecionadaId(i.id)}
            >
              {i.nup || i.id}
            </Button>
          ))}
        </div>
      )}

      {selecionada && documentos.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-1">
          {statusAutos ? (
            <span className={`text-xs ${infoAutos[statusAutos.status]?.className ?? ""}`}>
              {infoAutos[statusAutos.status]?.texto}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">Autos: sincronizados nesta sessão</span>
          )}
          <button
            type="button"
            onClick={() => enfileirarSincronizarAutos({ sindicanciaId: selecionada.id })}
            disabled={statusAutos?.status === "processing" || statusAutos?.status === "retrying"}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-60"
          >
            <RefreshCw className="size-3.5" /> Sincronizar Autos
          </button>
        </div>
      )}

      {/* Prioridade 2.1/2.4 — índice visual das peças, com busca e filtros. */}
      <div className="painel space-y-3 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por título ou nº de folha..."
              className="h-8 pl-8 text-sm"
            />
          </div>
          <Select
            value={filtroStatus}
            onValueChange={(v) => setFiltroStatus(v as StatusPeca | "todos")}
          >
            <SelectTrigger className="h-8 w-[170px] text-xs">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os status</SelectItem>
              {STATUS_PECA.map((s) => (
                <SelectItem key={s} value={s}>
                  {STATUS_PECA_LABEL[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filtroTipo} onValueChange={setFiltroTipo}>
            <SelectTrigger className="h-8 w-[190px] text-xs">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os tipos</SelectItem>
              {tiposDisponiveis.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {filtrosAtivos && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs"
              onClick={() => {
                setBusca("");
                setFiltroStatus("todos");
                setFiltroTipo("todos");
              }}
            >
              Limpar filtros
            </Button>
          )}
        </div>

        {filtrosAtivos && (
          <p className="text-xs text-muted-foreground">
            Reordenar (arrastar/setas) fica disponível com os filtros limpos — a posição precisa
            corresponder à lista completa dos autos.
          </p>
        )}

        <ul className="divide-y divide-border">
          {documentosFiltrados.map(({ item: d, posicao }) => (
            <li
              key={d.documentId}
              draggable={!filtrosAtivos}
              onDragStart={() => setArrastando(posicao - 1)}
              onDragOver={(e: DragEvent) => e.preventDefault()}
              onDrop={() => soltar(posicao - 1)}
              className={`flex flex-wrap items-center gap-2 py-2.5 ${
                arrastando === posicao - 1 ? "opacity-50" : ""
              }`}
            >
              {!filtrosAtivos && (
                <span className="flex shrink-0 items-center gap-0.5 text-muted-foreground">
                  <GripVertical className="size-4 cursor-grab" />
                  <span className="flex flex-col">
                    <button
                      type="button"
                      onClick={() => mover(posicao - 1, -1)}
                      disabled={posicao === 1 || reordenar.isPending}
                      className="disabled:opacity-30"
                      title="Mover para cima"
                    >
                      <ArrowUp className="size-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => mover(posicao - 1, 1)}
                      disabled={posicao === documentos.length || reordenar.isPending}
                      className="disabled:opacity-30"
                      title="Mover para baixo"
                    >
                      <ArrowDown className="size-3" />
                    </button>
                  </span>
                </span>
              )}

              <button
                onClick={() => {
                  setPecaAberta(d);
                  setMostrarPreview(false);
                }}
                className="min-w-0 flex-1 text-left"
              >
                <p className="truncate text-sm hover:text-primary">
                  <span className="text-muted-foreground">Fls. {posicao} — </span>
                  {d.titulo}
                </p>
                <p className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                  <span>{tipoDoItem(d)}</span>
                  <span>· últ. alteração {formatarData(d.atualizadoEm)}</span>
                </p>
              </button>

              <Select
                value={d.status ?? "concluida"}
                onValueChange={(v) =>
                  atualizarStatus.mutate({ documentId: d.documentId, status: v as StatusPeca })
                }
              >
                <SelectTrigger className="h-7 w-[150px] shrink-0 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_PECA.map((s) => (
                    <SelectItem key={s} value={s}>
                      {STATUS_PECA_LABEL[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <span className="w-[110px] shrink-0 text-right">
                <BadgeSincronizacao
                  alvo={alvoPeca(selecionada?.id ?? "", d.documentId, d.pecaId)}
                />
              </span>

              <a
                href={d.url}
                target="_blank"
                rel="noreferrer"
                className="shrink-0 text-primary"
                title="Abrir no Google Docs"
              >
                <ExternalLink className="size-4" />
              </a>
            </li>
          ))}
          {documentos.length === 0 && (
            <li className="p-4 text-sm text-muted-foreground">
              Nenhuma peça exportada até o momento.
            </li>
          )}
          {documentos.length > 0 && documentosFiltrados.length === 0 && (
            <li className="p-4 text-sm text-muted-foreground">
              Nenhuma peça corresponde à busca/filtros atuais.
            </li>
          )}
        </ul>
      </div>

      <div className="painel space-y-3 p-4">
        <h2 className="rotulo">Juntadas e anexos</h2>
        {juntadas.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Nenhuma juntada registrada. Use “Adicionar anexos aos Autos”.
          </p>
        )}
        {juntadas.map((j) => (
          <div key={j.id} className="space-y-1">
            <p className="text-sm font-medium">
              Juntada nº {j.numero} — {j.titulo}
              {j.url && (
                <a
                  href={j.url}
                  target="_blank"
                  rel="noreferrer"
                  className="ml-2 inline-flex items-center text-primary hover:underline"
                >
                  <ExternalLink className="size-3.5" />
                </a>
              )}
            </p>
            <ul className="space-y-0.5 pl-3">
              {j.anexos.map((a) => (
                <li key={a.fileId} className="truncate text-sm text-muted-foreground">
                  <a href={a.url} target="_blank" rel="noreferrer" className="hover:text-primary">
                    {a.descricao || a.nomeArquivo}
                  </a>
                </li>
              ))}
              {j.anexos.length === 0 && (
                <li className="text-xs text-muted-foreground">sem anexos</li>
              )}
            </ul>
          </div>
        ))}
      </div>

      {/* Prioridade 2.5 — painel de visualização interna: metadados + ações, sem abrir o
          Google Docs por padrão. */}
      <Dialog
        open={Boolean(pecaAberta)}
        onOpenChange={(v) => {
          if (!v) {
            setPecaAberta(null);
            setMostrarPreview(false);
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          {pecaAberta && selecionada && (
            <>
              <DialogHeader>
                <DialogTitle className="pr-6">{pecaAberta.titulo}</DialogTitle>
                <DialogDescription>
                  {tipoDoItem(pecaAberta)} · Fls.{" "}
                  {documentos.findIndex((d) => d.documentId === pecaAberta.documentId) + 1}
                </DialogDescription>
              </DialogHeader>

              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                <p className="text-muted-foreground">Status</p>
                <Select
                  value={pecaAberta.status ?? "concluida"}
                  onValueChange={(v) =>
                    atualizarStatus.mutate({
                      documentId: pecaAberta.documentId,
                      status: v as StatusPeca,
                    })
                  }
                >
                  <SelectTrigger className="h-7 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_PECA.map((s) => (
                      <SelectItem key={s} value={s}>
                        {STATUS_PECA_LABEL[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-muted-foreground">Criada em</p>
                <p>{formatarData(pecaAberta.criadoEm)}</p>
                <p className="text-muted-foreground">Última alteração</p>
                <p>{formatarData(pecaAberta.atualizadoEm)}</p>
                <p className="text-muted-foreground">Sincronização</p>
                <BadgeSincronizacao
                  alvo={alvoPeca(selecionada.id, pecaAberta.documentId, pecaAberta.pecaId)}
                />
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                {!pecaAberta.pecaId?.startsWith("juntada-") && (
                  <Button variant="outline" size="sm" asChild>
                    <Link
                      to="/pecas"
                      search={{ peca: pecaAberta.pecaId as never }}
                      onClick={() => setPecaAberta(null)}
                    >
                      <Pencil className="size-4" /> Editar peça
                    </Link>
                  </Button>
                )}
                {pecaAberta.pecaId?.startsWith("juntada-") && (
                  <Button variant="outline" size="sm" asChild>
                    <Link
                      to="/pecas"
                      search={{ peca: "juntada" }}
                      onClick={() => setPecaAberta(null)}
                    >
                      <Pencil className="size-4" /> Editar juntada
                    </Link>
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={() => setMostrarPreview((v) => !v)}>
                  <Eye className="size-4" /> {mostrarPreview ? "Ocultar" : "Visualizar"}
                </Button>
                <Button variant="outline" size="sm" onClick={() => setHistoricoAberto(true)}>
                  <History className="size-4" /> Histórico
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <a href={pecaAberta.url} target="_blank" rel="noreferrer">
                    <ExternalLink className="size-4" /> Abrir no Google Docs
                  </a>
                </Button>
                {!pecaAberta.pecaId?.startsWith("juntada-") && pecaAberta.texto !== undefined && (
                  <Button
                    size="sm"
                    onClick={() => {
                      const base = pecaAberta.pecaId
                        ? PECAS.find((p) => p.id === pecaAberta.pecaId)
                        : undefined;
                      enfileirarExportarPeca(
                        {
                          sindicanciaId: selecionada.id,
                          titulo: pecaAberta.titulo,
                          conteudo: pecaAberta.texto ?? "",
                          pecaId: pecaAberta.pecaId,
                          unica: base?.unica ?? false,
                          etapa: base?.etapa,
                        },
                        { documentId: pecaAberta.documentId },
                      );
                      toast.success("Sincronização enfileirada");
                    }}
                  >
                    <Check className="size-4" /> Sincronizar
                  </Button>
                )}
              </div>

              {mostrarPreview && (
                <iframe
                  title={pecaAberta.titulo}
                  src={`https://docs.google.com/document/d/${pecaAberta.documentId}/preview`}
                  className="h-[50vh] w-full rounded-md border border-border"
                />
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      {pecaAberta && selecionada && (
        <HistoricoVersoesDialog
          sindicanciaId={selecionada.id}
          documentId={pecaAberta.documentId}
          pecaId={pecaAberta.pecaId}
          aberto={historicoAberto}
          onOpenChange={setHistoricoAberto}
          onAtualizado={recarregar}
        />
      )}

      <Dialog open={dialogo} onOpenChange={setDialogo}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar anexo aos Autos</DialogTitle>
            <DialogDescription>
              O arquivo é enviado à pasta “Anexos” do NUP {selecionada?.nup || "—"} e fica vinculado
              à juntada escolhida, preservando a ordem dos autos.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Juntada</Label>
              <Select value={juntadaId} onValueChange={setJuntadaId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a juntada" />
                </SelectTrigger>
                <SelectContent>
                  {juntadas.map((j) => (
                    <SelectItem key={j.id} value={j.id}>
                      Juntada nº {j.numero} — {j.titulo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Nova juntada</Label>
              <div className="flex gap-2">
                <Input
                  value={novaJuntada}
                  onChange={(e) => setNovaJuntada(e.target.value)}
                  placeholder="Ex.: Juntada de documentos do sindicado"
                />
                <Button
                  variant="secondary"
                  onClick={() => criar.mutate()}
                  disabled={criar.isPending || !selecionada}
                >
                  {criar.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Plus className="size-4" />
                  )}
                  Criar
                </Button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Arquivo (foto ou PDF)</Label>
              <Input
                type="file"
                accept="image/*,application/pdf"
                onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
              />
              <p className="text-xs text-muted-foreground">
                Fotos ficam incorporadas no texto da juntada; PDFs viram um link clicável.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogo(false)}>
              Cancelar
            </Button>
            <Button onClick={() => enviar.mutate()} disabled={enviar.isPending}>
              {enviar.isPending && <Loader2 className="size-4 animate-spin" />}
              Enviar anexo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
