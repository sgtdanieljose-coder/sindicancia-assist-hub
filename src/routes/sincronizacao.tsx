import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AlertCircle, CheckCircle2, Circle, Clock, RefreshCw, RotateCcw } from "lucide-react";
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
          "Monitoramento da integração com o Google: pendências, erros recentes e histórico de sincronização desta sessão.",
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

function SaudeSincronizacao() {
  const { itens } = useSindicancias();
  const { fila, pendencias, reenfileirarTodasComErro, reenfileirar } = useSyncQueue();
  const { historico, ultimoSucesso } = useSaudeSincronizacao();
  const [detalhesAbertos, setDetalhesAbertos] = useState(false);

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

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 p-4 sm:p-6">
      <header>
        <h1 className="font-serif text-2xl font-semibold">Saúde da Sincronização</h1>
        <p className="text-sm text-muted-foreground">
          Integração com o Google Sheets, Docs e Drive — baseado na atividade real desta sessão, sem
          gerar chamadas extras só para exibir o painel.
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
                Sheets (planilha-base) · Docs (peças e autos) · Drive (pastas e anexos)
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

      <div className="painel p-4">
        <button
          type="button"
          onClick={() => setDetalhesAbertos((v) => !v)}
          className="rotulo w-full text-left"
        >
          Ver detalhes {detalhesAbertos ? "▲" : "▼"}
        </button>
        {detalhesAbertos && (
          <ul className="mt-3 divide-y divide-border">
            {historico.length === 0 && (
              <li className="py-2 text-sm text-muted-foreground">
                Nenhuma sincronização registrada ainda nesta sessão.
              </li>
            )}
            {historico.map((h) => (
              <li key={h.id} className="flex items-center gap-2 py-1.5 text-xs">
                {h.status === "completed" ? (
                  <CheckCircle2 className="size-3.5 shrink-0 text-green-600" />
                ) : (
                  <AlertCircle className="size-3.5 shrink-0 text-destructive" />
                )}
                <span className="text-muted-foreground">{formatarDataHora(h.em)}</span>
                <span>
                  {rotuloOperacao(h.tipo)} — NUP {nupDe(h.sindicanciaId)}
                </span>
                {h.erro && <span className="truncate text-destructive">{h.erro}</span>}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-[11px] text-muted-foreground">
          Mostra só a sessão atual do navegador — um log técnico permanente entre sessões é a
          Prioridade 10, ainda não implementada.
        </p>
      </div>
    </div>
  );
}
