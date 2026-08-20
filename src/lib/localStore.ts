/**
 * Camada de armazenamento local (IndexedDB) — Prioridade 1.1/1.2 da evolução do sistema.
 *
 * Usada para duas coisas:
 *  1) Rascunhos de peça: salvos instantaneamente ao digitar, sem depender do Google —
 *     ver salvarRascunho/lerRascunho, consumidos por EditorPeca.tsx.
 *  2) Fila de sincronização: as operações pendentes (ver syncQueue.ts) são espelhadas aqui
 *     para sobreviverem a um F5/fechar a aba — sem isso, uma alteração ainda não
 *     sincronizada com o Google seria perdida ao recarregar a página.
 *
 * Só existe no navegador — TanStack Start também executa este módulo durante o SSR, então
 * toda função aqui vira no-op (ou resolve undefined/[]) quando `indexedDB` não existe.
 */
 
const DB_NOME = "sindicancia-local";
const DB_VERSAO = 2;
const STORE_RASCUNHOS = "rascunhos";
const STORE_FILA = "fila-sync";
const STORE_CACHE = "cache";
 
function suportado(): boolean {
  return typeof indexedDB !== "undefined";
}
 
let dbPromise: Promise<IDBDatabase> | null = null;
 
function abrirDb(): Promise<IDBDatabase> {
  if (!suportado()) return Promise.reject(new Error("IndexedDB indisponível (SSR)."));
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NOME, DB_VERSAO);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_RASCUNHOS)) {
        db.createObjectStore(STORE_RASCUNHOS, { keyPath: "chave" });
      }
      if (!db.objectStoreNames.contains(STORE_FILA)) {
        db.createObjectStore(STORE_FILA, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STORE_CACHE)) {
        db.createObjectStore(STORE_CACHE, { keyPath: "chave" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("Falha ao abrir o armazenamento local."));
  });
  return dbPromise;
}
 
function comStore<T>(
  nome: string,
  modo: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return abrirDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(nome, modo);
        const req = fn(tx.objectStore(nome));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () =>
          reject(req.error ?? new Error("Falha na operação de armazenamento local."));
      }),
  );
}
 
// ==================================================================================
// Rascunhos de peça
// ==================================================================================
 
export type RascunhoPeca = {
  /** `${sindicanciaId}:${pecaId}` — ver chaveRascunho. */
  chave: string;
  sindicanciaId: string;
  pecaId: string;
  texto: string;
  campos?: Record<string, string>;
  atualizadoEm: string;
};
 
export function chaveRascunho(sindicanciaId: string, pecaId: string): string {
  return `${sindicanciaId}:${pecaId}`;
}
 
/** Salva o rascunho local — best-effort: se o navegador não suportar/negar IndexedDB, só
 *  avisa no console (o usuário ainda consegue trabalhar, só perde o autosave local). */
export async function salvarRascunho(r: RascunhoPeca): Promise<void> {
  if (!suportado()) return;
  try {
    await comStore(STORE_RASCUNHOS, "readwrite", (s) => s.put(r));
  } catch (e) {
    console.warn("Não foi possível salvar o rascunho localmente:", e);
  }
}
 
export async function lerRascunho(chave: string): Promise<RascunhoPeca | undefined> {
  if (!suportado()) return undefined;
  try {
    return await comStore<RascunhoPeca | undefined>(STORE_RASCUNHOS, "readonly", (s) =>
      s.get(chave),
    );
  } catch {
    return undefined;
  }
}
 
export async function apagarRascunho(chave: string): Promise<void> {
  if (!suportado()) return;
  try {
    await comStore(STORE_RASCUNHOS, "readwrite", (s) => s.delete(chave));
  } catch {
    // Ignora — o rascunho fica órfão no IndexedDB, sem impacto funcional.
  }
}
 
// ==================================================================================
// Fila de sincronização persistida (ver syncQueue.ts, que é quem decide O QUÊ salvar aqui)
// ==================================================================================
 
export async function listarOperacoesPersistidas<T>(): Promise<T[]> {
  if (!suportado()) return [];
  try {
    return await comStore<T[]>(STORE_FILA, "readonly", (s) => s.getAll() as IDBRequest<T[]>);
  } catch {
    return [];
  }
}
 
export async function salvarOperacaoPersistida(op: { id: string }): Promise<void> {
  if (!suportado()) return;
  try {
    await comStore(STORE_FILA, "readwrite", (s) => s.put(op));
  } catch (e) {
    console.warn("Não foi possível persistir a operação de sincronização:", e);
  }
}
 
export async function apagarOperacaoPersistida(id: string): Promise<void> {
  if (!suportado()) return;
  try {
    await comStore(STORE_FILA, "readwrite", (s) => s.delete(id));
  } catch {
    // Ignora — na pior hipótese a operação concluída fica órfã na fila persistida e é
    // reprocessada (idempotente) na próxima hidratação; não trava o app.
  }
}
 
// ==================================================================================
// Cache local das sindicâncias (Supabase)
// ==================================================================================
 
/** Última leitura bem-sucedida das sindicâncias, guardada para o dashboard continuar
 *  funcionando (em modo somente-leitura) quando o Google estiver indisponível. */
export type CacheSindicancias<T> = {
  chave: string;
  itens: T[];
  atualizadoEm: string;
};
 
const CHAVE_CACHE_SINDICANCIAS = "sindicancias";
 
export async function salvarCacheSindicancias<T>(itens: T[]): Promise<void> {
  if (!suportado()) return;
  try {
    await comStore(STORE_CACHE, "readwrite", (s) =>
      s.put({
        chave: CHAVE_CACHE_SINDICANCIAS,
        itens,
        atualizadoEm: new Date().toISOString(),
      }),
    );
  } catch (e) {
    console.warn("Não foi possível guardar o cache local das sindicâncias:", e);
  }
}
 
export async function lerCacheSindicancias<T>(): Promise<CacheSindicancias<T> | undefined> {
  if (!suportado()) return undefined;
  try {
    return await comStore<CacheSindicancias<T> | undefined>(STORE_CACHE, "readonly", (s) =>
      s.get(CHAVE_CACHE_SINDICANCIAS),
    );
  } catch {
    return undefined;
  }
}
 

