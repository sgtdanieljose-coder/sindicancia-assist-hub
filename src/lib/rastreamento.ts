/**
 * Rastreador de etapas dentro de uma operação de servidor — Prioridade 10 ("log técnico").
 *
 * Cada execução de um server function no Cloudflare Workers é isolada e não sobrevive entre
 * requisições (não há banco de dados além da planilha, e gravar log detalhado nela
 * destruiria o próprio objetivo da Prioridade 1 de reduzir gravações). Em vez de tentar
 * persistir um log no servidor, cada operação instrumentada mede o tempo de suas próprias
 * etapas internas e devolve isso junto com o resultado (`diagnostico`); o cliente é quem
 * guarda esse histórico (ver EntradaHistorico em syncQueue.ts), já que ele já persiste o
 * necessário em memória/IndexedDB para a sessão atual.
 */
export type EtapaMedida = { etapa: string; ms: number };

export function criarRastreador() {
  const etapas: EtapaMedida[] = [];
  return {
    async medir<T>(etapa: string, fn: () => Promise<T>): Promise<T> {
      const inicio = Date.now();
      try {
        return await fn();
      } finally {
        etapas.push({ etapa, ms: Date.now() - inicio });
      }
    },
    etapas,
  };
}

export type Diagnostico = {
  totalMs: number;
  totalRequisicoes: number;
  etapas: EtapaMedida[];
};
