/**
 * Fila de sincronização com o Google (Docs/Drive/Sheets) — Prioridade 1.2/1.3/1.7 da
 * evolução do sistema.
 *
 * Características:
 *  - Processa UMA operação por vez (nunca em paralelo) — evita rajadas de chamadas
 *    simultâneas ao Google e concorrência entre duas sincronizações da mesma sindicância.
 *  - Deduplica por "alvo": se já existe uma operação pendente para o mesmo alvo (ex.: a
 *    mesma peça, ou os autos da mesma sindicância), uma nova chamada só atualiza o payload
 *    da que já está na fila em vez de empilhar outra — várias edições/exportações em
 *    sequência viram 1 única chamada ao Google.
 *  - Retry com backoff progressivo (2s, 4s, 8s... até 30s) em caso de erro, até um número
 *    máximo de tentativas configurável; depois disso marca como "failed" e preserva o erro
 *    para o usuário decidir (nunca perde a alteração — ela continua salva localmente).
 *  - Persiste operações pendentes/em retry no IndexedDB (ver localStore.ts), então
 *    sobrevivem a um F5 ou fechar a aba.
 *
 * Import de server functions: em código de cliente, uma função exportada de
 * `createServerFn()` já é segura para importar direto — o bundler do TanStack Start troca a
 * implementação por uma chamada de rede no bundle do navegador.
 */
import { exportarParaDocs, sincronizarAutos } from "./sindicancias.functions";
import {
  listarOperacoesPersistidas,
  salvarOperacaoPersistida,
  apagarOperacaoPersistida,
} from "./localStore";

export type StatusOperacao = "pending" | "processing" | "completed" | "failed" | "retrying";

export type TipoOperacao = "exportarPeca" | "sincronizarAutos";

export type PayloadExportarPeca = {
  sindicanciaId: string;
  titulo: string;
  conteudo: string;
  posicao?: number;
  pecaId?: string;
  unica?: boolean;
  etapa?: string;
};

export type PayloadSincronizarAutos = { sindicanciaId: string };

export type OperacaoSync = {
  id: string;
  tipo: TipoOperacao;
  /** Chave de deduplicação/status — ex.: `peca:<sindicanciaId>:<pecaId>` ou
   *  `autos:<sindicanciaId>`. Duas operações com o mesmo alvo nunca ficam pendentes ao
   *  mesmo tempo (ver enfileirar). */
  alvo: string;
  sindicanciaId: string;
  payload: PayloadExportarPeca | PayloadSincronizarAutos;
  /** Menor = processada primeiro. */
  prioridade: number;
  criadoEm: string;
  status: StatusOperacao;
  tentativas: number;
  erro?: string;
  ultimaTentativa?: string;
};

export type StatusAlvo = {
  status: StatusOperacao;
  erro?: string;
  atualizadoEm: string;
  resultado?: unknown;
};

/** Uma linha do histórico recente — usada pelo painel de saúde da sincronização
 *  (Prioridade 9) para "Última sincronização" e "Ver detalhes". Fica só em memória
 *  (não persiste no IndexedDB): é um resumo da sessão atual, não um log permanente — um
 *  log técnico persistente de verdade é a Prioridade 10, ainda não implementada. */
export type EntradaHistorico = {
  id: string;
  tipo: TipoOperacao;
  alvo: string;
  sindicanciaId: string;
  status: "completed" | "failed";
  em: string;
  erro?: string;
};

const HISTORICO_MAX = 30;

const MAX_TENTATIVAS = 5;
const BACKOFF_BASE_MS = 2000;
const BACKOFF_MAX_MS = 30000;

type Ouvinte = () => void;

class FilaSincronizacao {
  private fila: OperacaoSync[] = [];
  private statusPorAlvo = new Map<string, StatusAlvo>();
  private ouvintes = new Set<Ouvinte>();
  private processando = false;
  private hidratacao: Promise<void> | null = null;
  private historico: EntradaHistorico[] = [];
  private ultimoSucesso: string | undefined;

  /** Compatível com useSyncExternalStore: registra o ouvinte e dispara a hidratação (lazy,
   *  só roda 1x) a partir da fila persistida no IndexedDB. */
  subscribe = (ouvinte: Ouvinte): (() => void) => {
    this.ouvintes.add(ouvinte);
    void this.hidratar();
    return () => {
      this.ouvintes.delete(ouvinte);
    };
  };

  obterInstantaneo = (): OperacaoSync[] => this.fila;

  obterStatusAlvo = (alvo: string): StatusAlvo | undefined => this.statusPorAlvo.get(alvo);

  obterHistorico = (): EntradaHistorico[] => this.historico;

  obterUltimoSucesso = (): string | undefined => this.ultimoSucesso;

  private registrarHistorico(entrada: EntradaHistorico) {
    this.historico = [entrada, ...this.historico].slice(0, HISTORICO_MAX);
  }

  private hidratar(): Promise<void> {
    if (!this.hidratacao) {
      this.hidratacao = listarOperacoesPersistidas<OperacaoSync>().then((persistidas) => {
        if (!persistidas.length) return;
        // Uma operação que ficou "processing" na última sessão (aba fechada no meio de uma
        // chamada) volta a ser "pending" — idempotência do lado do Google garante que
        // reprocessar não duplica nada (updateDocContent/updateRow sobrescrevem; createDoc
        // só roda para peças que ainda não têm documentId salvo).
        const normalizadas = persistidas.map((o) =>
          o.status === "processing" ? { ...o, status: "pending" as const } : o,
        );
        this.fila = [...normalizadas, ...this.fila];
        this.notificar();
        void this.processar();
      });
    }
    return this.hidratacao;
  }

  private notificar() {
    this.fila = [...this.fila];
    this.ouvintes.forEach((o) => o());
  }

  private definirStatusAlvo(alvo: string, status: StatusAlvo) {
    this.statusPorAlvo.set(alvo, status);
    this.notificar();
  }

  /** Enfileira uma operação. Se já houver uma pendente/em retry para o mesmo alvo, só
   *  atualiza o payload dela (dedupe) em vez de duplicar. Devolve o id da operação (nova ou
   *  reaproveitada). */
  enfileirar(op: {
    tipo: TipoOperacao;
    alvo: string;
    sindicanciaId: string;
    payload: OperacaoSync["payload"];
    prioridade?: number;
  }): string {
    const existente = this.fila.find(
      (o) => o.alvo === op.alvo && (o.status === "pending" || o.status === "retrying"),
    );
    if (existente) {
      existente.payload = op.payload;
      existente.criadoEm = new Date().toISOString();
      void salvarOperacaoPersistida(existente);
      this.notificar();
      void this.processar();
      return existente.id;
    }

    const nova: OperacaoSync = {
      id: `OP-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      tipo: op.tipo,
      alvo: op.alvo,
      sindicanciaId: op.sindicanciaId,
      payload: op.payload,
      prioridade: op.prioridade ?? 10,
      criadoEm: new Date().toISOString(),
      status: "pending",
      tentativas: 0,
    };
    this.fila.push(nova);
    this.definirStatusAlvo(op.alvo, { status: "pending", atualizadoEm: nova.criadoEm });
    void salvarOperacaoPersistida(nova);
    void this.processar();
    return nova.id;
  }

  private proximaOperacao(): OperacaoSync | undefined {
    const candidatas = this.fila.filter((o) => o.status === "pending" || o.status === "retrying");
    if (!candidatas.length) return undefined;
    return [...candidatas].sort((a, b) =>
      a.prioridade !== b.prioridade
        ? a.prioridade - b.prioridade
        : a.criadoEm.localeCompare(b.criadoEm),
    )[0];
  }

  private async processar(): Promise<void> {
    if (this.processando) return;
    this.processando = true;
    try {
      for (;;) {
        const op = this.proximaOperacao();
        if (!op) break;

        op.status = "processing";
        this.definirStatusAlvo(op.alvo, {
          status: "processing",
          atualizadoEm: new Date().toISOString(),
        });
        this.notificar();

        try {
          const resultado = await this.executar(op);
          this.fila = this.fila.filter((o) => o.id !== op.id);
          const agora = new Date().toISOString();
          this.ultimoSucesso = agora;
          this.registrarHistorico({
            id: op.id,
            tipo: op.tipo,
            alvo: op.alvo,
            sindicanciaId: op.sindicanciaId,
            status: "completed",
            em: agora,
          });
          this.definirStatusAlvo(op.alvo, {
            status: "completed",
            atualizadoEm: agora,
            resultado,
          });
          void apagarOperacaoPersistida(op.id);
        } catch (e) {
          op.tentativas += 1;
          op.ultimaTentativa = new Date().toISOString();
          op.erro = e instanceof Error ? e.message : "Falha desconhecida ao sincronizar.";

          if (op.tentativas >= MAX_TENTATIVAS) {
            op.status = "failed";
            this.registrarHistorico({
              id: op.id,
              tipo: op.tipo,
              alvo: op.alvo,
              sindicanciaId: op.sindicanciaId,
              status: "failed",
              em: op.ultimaTentativa,
              erro: op.erro,
            });
            this.definirStatusAlvo(op.alvo, {
              status: "failed",
              erro: op.erro,
              atualizadoEm: op.ultimaTentativa,
            });
            void salvarOperacaoPersistida(op);
          } else {
            op.status = "retrying";
            this.definirStatusAlvo(op.alvo, {
              status: "retrying",
              erro: op.erro,
              atualizadoEm: op.ultimaTentativa,
            });
            void salvarOperacaoPersistida(op);
            const espera = Math.min(BACKOFF_BASE_MS * 2 ** (op.tentativas - 1), BACKOFF_MAX_MS);
            await new Promise((r) => setTimeout(r, espera));
          }
        }
        this.notificar();
      }
    } finally {
      this.processando = false;
    }
  }

  /** Refaz manualmente uma operação que falhou (zera tentativas e volta pra fila). Usado
   *  pelo botão "Tentar novamente" quando o status de um alvo é "failed". */
  reenfileirar(alvo: string) {
    const op = this.fila.find((o) => o.alvo === alvo && o.status === "failed");
    if (!op) return;
    op.status = "pending";
    op.tentativas = 0;
    op.erro = undefined;
    this.definirStatusAlvo(alvo, { status: "pending", atualizadoEm: new Date().toISOString() });
    void salvarOperacaoPersistida(op);
    void this.processar();
  }

  private executar(op: OperacaoSync): Promise<unknown> {
    if (op.tipo === "exportarPeca") {
      return exportarParaDocs({ data: op.payload as PayloadExportarPeca });
    }
    if (op.tipo === "sincronizarAutos") {
      return sincronizarAutos({ data: op.payload as PayloadSincronizarAutos });
    }
    throw new Error(`Tipo de operação de sincronização desconhecido: ${op.tipo}`);
  }
}

/** Instância única, compartilhada pela aba inteira — todas as sindicâncias/peças passam
 *  pela mesma fila, o que garante o processamento sequencial global. */
export const filaSync = new FilaSincronizacao();

export function alvoPeca(
  sindicanciaId: string,
  documentId: string | undefined,
  pecaId: string | undefined,
): string {
  // Uma vez que o documento já existe no Drive, o documentId é a identidade real e única da
  // peça — necessário porque peças "não únicas" (Ofício, DIEx, Despacho Diverso...)
  // compartilham o mesmo pecaId entre várias instâncias; sem isso, exportar duas peças do
  // mesmo tipo em sequência faria a segunda sobrescrever o status/pendência da primeira na
  // fila (mesmo alvo). Antes do primeiro salvamento (documentId ainda não existe), usa
  // sindicanciaId+pecaId como identidade provisória.
  return documentId ? `peca-doc:${documentId}` : `peca-novo:${sindicanciaId}:${pecaId ?? "livre"}`;
}

export function alvoAutos(sindicanciaId: string): string {
  return `autos:${sindicanciaId}`;
}
