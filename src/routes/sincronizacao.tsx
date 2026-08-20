import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  AlertCircle,
  CheckCircle2,
  Circle,
  Clock,
  Gauge,
  RefreshCw,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSindicancias } from "@/components/SindicanciaContext";
import { useSyncQueue, useSaudeSincronizacao } from "@/hooks/useSyncQueue";
import type { TipoOperacao } from "@/lib/syncQueue";

export const Route = createFileRoute("/sincronizacao")({
  head: () => ({
    meta: [
      { title: "Saúde da Sincronização | Sindicâncias EB" },
      {
        name: "description",
        content:
          "Monitoramento da integração com o Google e diagnóstico técnico: pendências, erros recentes, tempo por operação e histórico desta sessão.",
      },
    ],
  }),
  component: SaudeSincronizacao,
});

function rotuloOperacao(tipo: TipoOperacao): string {
  return tipo === "sincronizarAutos" ? "Documento único dos autos" : "Peça individual";
}

function formatarDataHora(iso?: string): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("pt-BR");
  } catch {
    return "—";
  }
}

function formatarDuracao(ms?: number): string {
  if (ms === undefined) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

/** O prefixo "[status]" nas mensagens de erro do Google (ver mensagemErroGoogle em
 *  google.server.ts) é o que permite classificar 429/404 aqui sem depender de
 *  propriedades de Error que não sobrevivem à borda do server function. */
function statusHttpDoErro(msg?: string): string | undefined {
  return /^\[(\d{3})\]/.exec(msg ?? "")?.[1];
}

function SaudeSincronizacao() {
  const { itens } = useSindicancias();
  const { fila, pendencias, reenfileirarTodasComErro, reenfileirar } = useSyncQueue();
  const { historico, ultimoSucesso } = useSaudeSincronizacao();
  const [detalhesAbertos, setDetalhesAbertos] = useState(false);
  const [etapaAberta, setEtapaAberta] = useState<string | null>(null);

  const nupDe = (sindicanciaId: string) =>
    itens.find((i) => i.id === sindicanciaId)?.nup || sindicanciaId;

  const emErro = fila.filter((o) => o.status === "failed");
  const emAndamento = fila.filter((o) => o.status === "pending" || o.status === "retrying");
  const processando = fila.some((o) => o.status === "processing");

  // Prioridade 9 — este painel não faz NENHUMA chamada nova ao Google só para "checar
  // conexão": o status vem inteiramente da atividade real que já passou pela fila nesta
  // sessão (ver syncQueue.ts). Sem atividade ainda, o estado fica neutro (⚪), não "🟢
  // conectado" — não dá pra afirmar isso sem uma checagem de verdade, e criar uma checagem
  // só pra esse indicador iria contra a Prioridade 1 (reduzir chamadas ao Google).
  const statusGeral: "ok" | "erro" | "sem-atividade" =
    emErro.length > 0 ? "erro" : ultimoSucesso ? "ok" : "sem-atividade";

  // Prioridade 10 — diagnóstico, calculado inteiramente a partir do histórico da sessão
  // (ver syncQueue.ts): quantidade de erros 429/404, tempo médio por operação concluída.
  const erros429 = historico.filter((h) => statusHttpDoErro(h.erro) === "429").length;
  const erros404 = historico.filter((h) => statusHttpDoErro(h.erro) === "404").length;
  const falhas = historico.filter((h) => h.status === "failed").length;
  const duracoes = historico
    .filter((h) => h.status === "completed" && h.duracaoMs !== undefined)
    .map((h) => h.duracaoMs!);
  const tempoMedioMs =
    duracoes.length > 0
      ? Math.round(duracoes.reduce((a, b) => a + b, 0) / duracoes.length)
      : undefined;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 p-4 sm:p-6">
      <header>
        <h1 className="font-serif text-2xl font-semibold">Saúde da Sincronização</h1>
        <p className="text-sm text-muted-foreground">
          Integração com o Google Docs e Drive — baseado na atividade real desta sessão, sem gerar
          chamadas extras só para exibir o painel.
        </p>
      </header>

      <div className="painel space-y-4 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {statusGeral === "ok" && <CheckCircle2 className="size-5 text-green-600" />}
            {statusGeral === "erro" && <AlertCircle className="size-5 text-destructive" />}
            {statusGeral === "sem-atividade" && <Circle className="size-5 text-muted-foreground" />}
            <div>
              <p className="text-sm font-medium">
                {statusGeral === "ok" && "Google respondendo normalmente"}
                {statusGeral === "erro" && "Com erro de sincronização"}
                {statusGeral === "sem-atividade" && "Sem atividade nesta sessão ainda"}
              </p>
              <p className="text-xs text-muted-foreground">
                Supabase (banco de dados) · Docs (peças e autos) · Drive (pastas e anexos)
              </p>
            </div>
          </div>
          {emErro.length > 0 && (
            <Button size="sm" variant="outline" onClick={reenfileirarTodasComErro}>
              <RefreshCw className="size-4" /> Sincronizar agora
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 border-t border-border pt-3 sm:grid-cols-3">
          <div>
            <p className="text-xs text-muted-foreground">Última sincronização</p>
            <p className="text-sm">{formatarDataHora(ultimoSucesso)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Pendências</p>
            <p className="text-sm">
              {pendencias === 0
                ? "Nenhuma"
                : `🟡 ${pendencias} alteraç${pendencias === 1 ? "ão" : "ões"} aguardando`}
              {processando ? " (sincronizando agora)" : ""}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Erros</p>
            <p className="text-sm">{emErro.length === 0 ? "Nenhum" : `🔴 ${emErro.length}`}</p>
          </div>
        </div>
      </div>

      {emErro.length > 0 && (
        <div className="painel space-y-2 p-4">
          <h2 className="rotulo">Operações com erro</h2>
          <ul className="divide-y divide-border">
            {emErro.map((op) => (
              <li key={op.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <div className="min-w-0">
                  <p className="text-sm">
                    {rotuloOperacao(op.tipo)} — NUP {nupDe(op.sindicanciaId)}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{op.erro}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {op.tentativas} tentativa{op.tentativas === 1 ? "" : "s"} · última em{" "}
                    {formatarDataHora(op.ultimaTentativa)}
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={() => reenfileirar(op.alvo)}>
                  <RotateCcw className="size-4" /> Tentar novamente
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {emAndamento.length > 0 && (
        <div className="painel space-y-2 p-4">
          <h2 className="rotulo">Aguardando sincronizar</h2>
          <ul className="divide-y divide-border">
            {emAndamento.map((op) => (
              <li key={op.id} className="flex items-center gap-2 py-2 text-sm">
                <Clock className="size-4 shrink-0 text-amber-600" />
                {rotuloOperacao(op.tipo)} — NUP {nupDe(op.sindicanciaId)}
                {op.status === "retrying" ? " (tentando de novo...)" : ""}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Prioridade 10 — área de diagnóstico: números agregados a partir do mesmo histórico
          de sessão (nada disso gera chamada nova ao Google). */}
      <div className="painel space-y-3 p-4">
        <div className="flex items-center gap-1.5">
          <Gauge className="size-4 text-muted-foreground" />
          <h2 className="rotulo">Diagnóstico</h2>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div>
            <p className="text-xs text-muted-foreground">Chamadas registradas</p>
            <p className="text-sm">{historico.length}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Tempo médio por operação</p>
            <p className="text-sm">{formatarDuracao(tempoMedioMs)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Fila pendente</p>
            <p className="text-sm">{pendencias}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Erros 429 (limite de requisições)</p>
            <p className="text-sm">{erros429}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Erros 404 (recurso não encontrado)</p>
            <p className="text-sm">{erros404}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Falhas de sincronização</p>
            <p className="text-sm">{falhas}</p>
          </div>
        </div>
        {historico.length === 0 && (
          <p className="text-xs text-muted-foreground">
            Ainda sem chamadas registradas nesta sessão — os números aparecem assim que uma peça ou
            os autos forem sincronizados.
          </p>
        )}
      </div>

      <div className="painel p-4">
        <button
          type="button"
          onClick={() => setDetalhesAbertos((v) => !v)}
          className="rotulo w-full text-left"
        >
          Ver detalhes (chamadas recentes) {detalhesAbertos ? "▲" : "▼"}
        </button>
        {detalhesAbertos && (
          <ul className="mt-3 divide-y divide-border">
            {historico.length === 0 && (
              <li className="py-2 text-sm text-muted-foreground">
                Nenhuma sincronização registrada ainda nesta sessão.
              </li>
            )}
            {historico.map((h) => (
              <li key={h.id} className="py-1.5 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  {h.status === "completed" ? (
                    <CheckCircle2 className="size-3.5 shrink-0 text-green-600" />
                  ) : (
                    <AlertCircle className="size-3.5 shrink-0 text-destructive" />
                  )}
                  <span className="text-muted-foreground">{formatarDataHora(h.em)}</span>
                  <span>
                    {rotuloOperacao(h.tipo)} — NUP {nupDe(h.sindicanciaId)}
                  </span>
                  <span className="text-muted-foreground">{formatarDuracao(h.duracaoMs)}</span>
                  {h.totalRequisicoes !== undefined && (
                    <span className="text-muted-foreground">
                      · {h.totalRequisicoes} requisiç{h.totalRequisicoes === 1 ? "ão" : "ões"}
                    </span>
                  )}
                  {h.erro && <span className="truncate text-destructive">{h.erro}</span>}
                  {h.etapas && h.etapas.length > 0 && (
                    <button
                      type="button"
                      className="text-primary hover:underline"
                      onClick={() => setEtapaAberta((v) => (v === h.id ? null : h.id))}
                    >
                      etapas {etapaAberta === h.id ? "▲" : "▼"}
                    </button>
                  )}
                </div>
                {etapaAberta === h.id && h.etapas && (
                  <ul className="ml-5 mt-1 space-y-0.5 border-l border-border pl-3">
                    {h.etapas.map((e, i) => (
                      <li key={i} className="text-[11px] text-muted-foreground">
                        {e.etapa} — {formatarDuracao(e.ms)}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-[11px] text-muted-foreground">
          Mostra só a sessão atual do navegador — este histórico de chamadas ao Google não fica
          gravado em lugar nenhum entre sessões (o que muda de verdade — sindicâncias, peças,
          juntadas — vai pro Supabase).
        </p>
      </div>
    </div>
  );
}
