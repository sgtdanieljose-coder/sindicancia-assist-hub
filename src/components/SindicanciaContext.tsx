import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { listarSindicancias } from "@/lib/sindicancias.functions";
import type { Sindicancia } from "@/lib/pecas";

type Ctx = {
  itens: Sindicancia[];
  erro: string | null;
  carregando: boolean;
  selecionadaId: string | null;
  setSelecionadaId: (id: string | null) => void;
  selecionada: Sindicancia | null;
  recarregar: () => void;
};

const SindicanciaContext = createContext<Ctx | null>(null);

export function SindicanciaProvider({ children }: { children: ReactNode }) {
  const [selecionadaId, setSelecionadaId] = useState<string | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["sindicancias"],
    queryFn: () => listarSindicancias(),
  });

  const itens = data?.itens ?? [];
  const selecionada = useMemo(
    () => itens.find((i) => i.id === selecionadaId) ?? itens[0] ?? null,
    [itens, selecionadaId],
  );

  return (
    <SindicanciaContext.Provider
      value={{
        itens,
        erro: data?.erro ?? null,
        carregando: isLoading,
        selecionadaId,
        setSelecionadaId,
        selecionada,
        recarregar: () => void refetch(),
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
