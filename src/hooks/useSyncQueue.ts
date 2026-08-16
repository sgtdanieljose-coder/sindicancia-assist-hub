import { useCallback, useSyncExternalStore } from "react";
import {
  filaSync,
  alvoPeca,
  alvoAutos,
  type StatusAlvo,
  type EntradaHistorico,
  type PayloadExportarPeca,
  type PayloadSincronizarAutos,
} from "@/lib/syncQueue";

const SEM_STATUS: StatusAlvo | undefined = undefined;
const HISTORICO_VAZIO: EntradaHistorico[] = [];

/**
 * Status de sincronização (com o Google) de um alvo específico — uma peça
 * (`alvoPeca(sindicanciaId, pecaId)`) ou os autos de uma sindicância (`alvoAutos(id)`).
 * Reativo: re-renderiza sozinho quando a fila muda de estado.
 */
export function useStatusSincronizacao(alvo: string | undefined): StatusAlvo | undefined {
  return useSyncExternalStore(
    filaSync.subscribe,
    () => (alvo ? filaSync.obterStatusAlvo(alvo) : SEM_STATUS),
    () => SEM_STATUS,
  );
}

/** Prioridade 9 — histórico recente (sessão atual) + horário da última sincronização OK,
 *  usados pelo painel de saúde da sincronização. */
export function useSaudeSincronizacao() {
  const historico = useSyncExternalStore(
    filaSync.subscribe,
    filaSync.obterHistorico,
    () => HISTORICO_VAZIO,
  );
  const ultimoSucesso = useSyncExternalStore(
    filaSync.subscribe,
    filaSync.obterUltimoSucesso,
    () => undefined,
  );
  return { historico, ultimoSucesso };
}

/** Exposição da fila de sincronização para componentes React — ver syncQueue.ts para a
 *  lógica de fila/retry/dedupe em si; este hook só assina o estado e expõe helpers
 *  tipados para enfileirar as duas operações que hoje passam pela fila (Prioridade 1). */
export function useSyncQueue() {
  const fila = useSyncExternalStore(filaSync.subscribe, filaSync.obterInstantaneo, () => []);

  const enfileirarExportarPeca = useCallback(
    (payload: PayloadExportarPeca, opts?: { documentId?: string; prioridade?: number }) =>
      filaSync.enfileirar({
        tipo: "exportarPeca",
        alvo: alvoPeca(payload.sindicanciaId, opts?.documentId, payload.pecaId),
        sindicanciaId: payload.sindicanciaId,
        payload,
        prioridade: opts?.prioridade,
      }),
    [],
  );

  const enfileirarSincronizarAutos = useCallback(
    (payload: PayloadSincronizarAutos, prioridade?: number) =>
      filaSync.enfileirar({
        tipo: "sincronizarAutos",
        alvo: alvoAutos(payload.sindicanciaId),
        sindicanciaId: payload.sindicanciaId,
        payload,
        // Prioridade mais baixa (número maior) que a exportação de peça — não faz sentido
        // reconstruir o consolidado antes de a peça em si terminar de ser gravada.
        prioridade: prioridade ?? 20,
      }),
    [],
  );

  const reenfileirar = useCallback((alvo: string) => filaSync.reenfileirar(alvo), []);

  const reenfileirarTodasComErro = useCallback(() => filaSync.reprocessarFalhas(), []);

  const pendencias = fila.filter((o) => o.status !== "completed").length;

  return {
    fila,
    pendencias,
    enfileirarExportarPeca,
    enfileirarSincronizarAutos,
    reenfileirar,
    reenfileirarTodasComErro,
  };
}

export { alvoPeca, alvoAutos };
