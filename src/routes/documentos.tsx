import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState, type DragEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowDown,
  ArrowUp,
  ExternalLink,
  FolderOpen,
  GripVertical,
  Loader2,
  Paperclip,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Lock,
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSindicancias } from "@/components/SindicanciaContext";
import { SeletorAnexos } from "@/components/SeletorAnexos";
import { PainelValidacao } from "@/components/PainelValidacao";
import { FinalizarAutosDialog } from "@/components/FinalizarAutosDialog";
import { DetalhePecaDialog } from "@/components/DetalhePecaDialog";
import { VisaoMapaAutos } from "@/components/VisaoMapaAutos";
import { BadgeSincronizacao } from "@/components/BadgeSincronizacao";
import { atualizarStatusPeca, criarJuntada, reordenarPecas } from "@/lib/sindicancias.functions";
import { tipoDoItem, formatarDataHora, type DocumentoItem } from "@/lib/documentos-format";
import type { ItemValidacao } from "@/lib/validacao";
import { STATUS_PECA, STATUS_PECA_LABEL, STATUS_JUNTADA_LABEL, type StatusPeca } from "@/lib/pecas";
import { useStatusSincronizacao, useSyncQueue, alvoAutos, alvoPeca } from "@/hooks/useSyncQueue";

const PASTA_DRIVE = "https://drive.google.com/drive/folders/1zcQGM4T6-PAiEttCAdK6aqNBrUnQ-u6G";
const PLANILHA =
  "https://docs.google.com/spreadsheets/d/1Fy-JSNpRJXKE89Wm--zo0cFPJwU1Daf_ygUg78-s1jI/edit";

export const Route = createFileRoute("/documentos")({
  validateSearch: (search: Record<string, unknown>): { visao?: "lista" | "mapa" } => ({
    visao: search.visao === "lista" || search.visao === "mapa" ? search.visao : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Autos da Sindicância | Sindicâncias EB" },
      {
        name: "description",
        content:
          "Autos completos da sindicância em duas visualizações: lista (status, ordem, busca, filtros e histórico) e mapa (checklist resumido e imprimível) — sem depender de abrir o Google Docs para consultar.",
      },
      { property: "og:title", content: "Autos da Sindicância — Sindicâncias EB" },
      {
        property: "og:description",
        content: "Índice processual das peças, juntadas e anexos, com lista e mapa dos autos.",
      },
    ],
  }),
  component: Documentos,
});

function Documentos() {
  const buscaUrl = Route.useSearch();
  const visao = buscaUrl.visao ?? "lista";
  const navigate = useNavigate();
  const { itens, selecionada, setSelecionadaId, recarregar } = useSindicancias();
  const { enfileirarSincronizarAutos, fila } = useSyncQueue();

  const [dialogo, setDialogo] = useState(false);
  const [validacaoAberta, setValidacaoAberta] = useState(false);
  const [finalizacaoAberta, setFinalizacaoAberta] = useState(false);
  const [juntadaId, setJuntadaId] = useState<string>("");
  const [novaJuntada, setNovaJuntada] = useState("");

  // Prioridade 2.4 — busca e filtros (client-side, sem chamada nenhuma ao Google).
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<StatusPeca | "todos">("todos");
  const [filtroTipo, setFiltroTipo] = useState<string>("todos");

  // Prioridade 2.5 — painel de visualização interna (em vez de abrir o Google Docs direto).
  // Guarda só o id, não o objeto: `pecaAberta` abaixo é derivado de `documentos` a cada
  // render, então acompanha sozinho qualquer atualização vinda de recarregar() (mudar o
  // status, por exemplo) sem precisar de nenhum código extra para "sincronizar" o painel.
  const [pecaAbertaId, setPecaAbertaId] = useState<string | null>(null);

  const juntadas = selecionada?.juntadas ?? [];
  const documentos = useMemo(() => selecionada?.documentos ?? [], [selecionada]);
  const pecaAberta = documentos.find((d) => d.documentId === pecaAbertaId) ?? null;
  const posicaoAberta = pecaAbertaId
    ? documentos.findIndex((d) => d.documentId === pecaAbertaId) + 1
    : 0;

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
    onSuccess: recarregar,
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

  const statusAutos = useStatusSincronizacao(selecionada ? alvoAutos(selecionada.id) : undefined);
  const infoAutos: Record<string, { texto: string; className: string }> = {
    pending: { texto: "🟡 Autos pendentes", className: "text-amber-600" },
    processing: { texto: "🔄 Sincronizando autos...", className: "text-muted-foreground" },
    retrying: { texto: "🔄 Tentando de novo...", className: "text-amber-600" },
    completed: { texto: "🟢 Autos sincronizados", className: "text-green-600" },
    failed: { texto: "🔴 Erro ao sincronizar autos", className: "text-destructive" },
  };

  // Prioridade 6 — a validação em si (validarAutos) só olha o dado da sindicância; o
  // estado de sincronização é da sessão do navegador, então é complementado aqui a partir
  // da fila (qualquer operação que falhou vira uma pendência a mais no painel).
  const itensSincronizacao: ItemValidacao[] = fila
    .filter((op) => op.status === "failed")
    .map((op) => ({
      titulo:
        op.tipo === "sincronizarAutos"
          ? "Sincronização do documento único dos autos"
          : "Sincronização de uma peça com o Google Docs",
      ok: false,
      detalhe: op.erro ?? "falha ao sincronizar com o Google — tentativas esgotadas",
    }));

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-4 sm:p-6 print:max-w-full">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 sm:flex sm:flex-wrap sm:justify-between print:hidden">
        <div className="min-w-0">
          <h1 className="truncate font-serif text-2xl font-semibold">Autos da Sindicância</h1>
          <p className="text-sm text-muted-foreground">
            Lista dos autos ou mapa resumido — status, ordem, juntadas, anexos e histórico.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button
            size="sm"
            variant="secondary"
            disabled={!selecionada}
            onClick={() => setValidacaoAberta(true)}
          >
            <ShieldCheck className="size-4" /> Validar Autos
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={!selecionada || documentos.length === 0}
            onClick={() => setFinalizacaoAberta(true)}
          >
            <Lock className="size-4" /> Finalizar Autos
          </Button>
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

      <Tabs
        value={visao}
        onValueChange={(v) =>
          navigate({ to: "/documentos", search: { visao: v as "lista" | "mapa" } })
        }
        className="print:hidden"
      >
        <TabsList>
          <TabsTrigger value="lista" asChild>
            <Link to="/documentos" search={{ visao: "lista" }}>
              Lista dos Autos
            </Link>
          </TabsTrigger>
          <TabsTrigger value="mapa" asChild>
            <Link to="/documentos" search={{ visao: "mapa" }}>
              Mapa dos Autos
            </Link>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {itens.length > 1 && (
        <div className="flex flex-wrap gap-2 print:hidden">
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

      {visao === "lista" && selecionada && documentos.length > 0 && (
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

      {visao === "lista" && selecionada && (selecionada.autosFinais?.length ?? 0) > 0 && (
        <div className="flex flex-wrap items-center gap-2 px-1 text-xs text-muted-foreground">
          <Lock className="size-3.5" />
          <span>Versões finalizadas:</span>
          {selecionada.autosFinais!.map((f) => (
            <a
              key={f.versao}
              href={f.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-0.5 text-primary hover:underline"
            >
              v{f.versao} <ExternalLink className="size-3" />
            </a>
          ))}
        </div>
      )}

      {visao === "mapa" && selecionada && (
        <VisaoMapaAutos sindicancia={selecionada} onAbrirPeca={setPecaAbertaId} />
      )}
      {visao === "mapa" && !selecionada && (
        <p className="p-4 text-sm text-muted-foreground">Selecione uma sindicância.</p>
      )}

      {/* Prioridade 2.1/2.4 — índice visual das peças, com busca e filtros. */}
      {visao === "lista" && (
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
                  onClick={() => setPecaAbertaId(d.documentId)}
                  className="min-w-0 flex-1 text-left"
                >
                  <p className="truncate text-sm hover:text-primary">
                    <span className="text-muted-foreground">Fls. {posicao} — </span>
                    {d.titulo}
                  </p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                    <span>{tipoDoItem(d)}</span>
                    <span>· últ. alteração {formatarDataHora(d.atualizadoEm)}</span>
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
      )}

      <div className="painel space-y-3 p-4 print:hidden">
        <h2 className="rotulo">Juntadas e anexos</h2>
        {juntadas.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Nenhuma juntada registrada. Use “Adicionar anexos aos Autos”.
          </p>
        )}
        {juntadas.map((j) => (
          <div key={j.id} className="space-y-1">
            <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
              Juntada nº {j.numero} — {j.titulo}
              <span className="text-[11px] font-normal text-muted-foreground">
                {STATUS_JUNTADA_LABEL[j.status ?? "aberta"]}
                {j.responsavel ? ` · resp.: ${j.responsavel}` : ""}
              </span>
              {j.url && (
                <a
                  href={j.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center text-primary hover:underline"
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
          Google Docs por padrão. Extraído para DetalhePecaDialog.tsx para ser reaproveitado
          também pela visão Mapa (visao === "mapa" acima). */}
      <DetalhePecaDialog
        sindicanciaId={selecionada?.id ?? ""}
        peca={pecaAberta}
        posicao={posicaoAberta}
        aberto={Boolean(pecaAberta)}
        onOpenChange={(v) => {
          if (!v) setPecaAbertaId(null);
        }}
        onAtualizado={recarregar}
      />

      {selecionada && (
        <PainelValidacao
          sindicancia={selecionada}
          aberto={validacaoAberta}
          onOpenChange={setValidacaoAberta}
          itensExtras={itensSincronizacao}
        />
      )}

      {selecionada && (
        <FinalizarAutosDialog
          sindicancia={selecionada}
          aberto={finalizacaoAberta}
          onOpenChange={setFinalizacaoAberta}
          itensExtras={itensSincronizacao}
          onFinalizado={recarregar}
        />
      )}

      <Dialog open={dialogo} onOpenChange={setDialogo}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar anexos aos Autos</DialogTitle>
            <DialogDescription>
              Os arquivos são enviados à pasta “Anexos” do NUP {selecionada?.nup || "—"} e ficam
              vinculados à juntada escolhida, preservando a ordem dos autos.
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

            {selecionada && juntadaId && (
              <SeletorAnexos
                sindicanciaId={selecionada.id}
                juntadaId={juntadaId}
                anexosExistentes={juntadas.find((j) => j.id === juntadaId)?.anexos ?? []}
                onEnviado={() => {
                  enfileirarSincronizarAutos({ sindicanciaId: selecionada.id });
                  recarregar();
                }}
              />
            )}
            {!juntadaId && (
              <p className="text-xs text-muted-foreground">
                Selecione ou crie uma juntada acima para poder enviar arquivos.
              </p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogo(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
