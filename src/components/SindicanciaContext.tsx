import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { listarSindicancias } from "@/lib/sindicancias.functions";
import { lerCacheSindicancias, salvarCacheSindicancias } from "@/lib/localStore";
import type { Sindicancia } from "@/lib/pecas";

type Ctx = {
  itens: Sindicancia[];
  erro: string | null;
  carregando: boolean;
  selecionadaId: string | null;
  setSelecionadaId: (id: string | null) => void;
  selecionada: Sindicancia | null;
  recarregar: () => void;
  /** Verdadeiro quando os dados exibidos vêm do cache local (servidor indisponível). */
  usandoCache: boolean;
  /** Momento da última leitura bem-sucedida das sindicâncias, se houver cache. */
  cacheEm: string | null;
};

const SindicanciaContext = createContext<Ctx | null>(null);

export function SindicanciaProvider({ children }: { children: ReactNode }) {
  const [selecionadaId, setSelecionadaId] = useState<string | null>(null);
  const [cache, setCache] = useState<{ itens: Sindicancia[]; atualizadoEm: string } | null>(null);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["sindicancias"],
    queryFn: () => listarSindicancias(),
  });

  // Hidrata o cache local uma vez no navegador — assim, se o servidor estiver fora do ar, o
  // dashboard já tem o que mostrar antes mesmo da primeira falha.
  useEffect(() => {
    void lerCacheSindicancias<Sindicancia>().then((c) => {
      if (c) setCache({ itens: c.itens, atualizadoEm: c.atualizadoEm });
    });
  }, []);

  // Toda leitura bem-sucedida (com dados) atualiza o cache local.
  useEffect(() => {
    const lidos = data?.itens;
    if (!lidos || lidos.length === 0) return;
    setCache({ itens: lidos, atualizadoEm: new Date().toISOString() });
    void salvarCacheSindicancias(lidos);
  }, [data]);

  const falhou = isError || Boolean(data?.erro);
  const itensRemotos = data?.itens ?? [];
  const usandoCache = falhou && itensRemotos.length === 0 && (cache?.itens.length ?? 0) > 0;
  const itens = usandoCache ? (cache?.itens ?? []) : itensRemotos;

  const erroBruto =
    data?.erro ??
    (isError
      ? error instanceof Error
        ? error.message
        : "Falha ao carregar as sindicâncias."
      : null);
  const erro = usandoCache
    ? `Servidor indisponível no momento — exibindo a última cópia local dos dados. (${erroBruto})`
    : erroBruto;

  const selecionada = useMemo(
    () => itens.find((i) => i.id === selecionadaId) ?? itens[0] ?? null,
    [itens, selecionadaId],
  );

  return (
    <SindicanciaContext.Provider
      value={{
        itens,
        erro,
        carregando: isLoading && !usandoCache,
        selecionadaId,
        setSelecionadaId,
        selecionada,
        recarregar: () => void refetch(),
        usandoCache,
        cacheEm: cache?.atualizadoEm ?? null,
      }}
    >
      {children}
    </SindicanciaContext.Provider>
  );
}

export function useSindicancias() {
  const ctx = useContext(SindicanciaContext);
  if (!ctx) throw new Error("useSindicancias precisa estar dentro de SindicanciaProvider");
  return ctx;
}
