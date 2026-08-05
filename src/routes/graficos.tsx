import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, BarChart3, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSindicancias } from "@/components/SindicanciaContext";
import { DashboardMetricas } from "@/components/DashboardMetricas";

export const Route = createFileRoute("/graficos")({
  head: () => ({
    meta: [
      { title: "Gráficos e Indicadores | Sindicâncias EB" },
      {
        name: "description",
        content:
          "Indicadores e gráficos das sindicâncias: em andamento, concluídas, em atraso, distribuição por status e tempo médio de conclusão.",
      },
      { property: "og:title", content: "Gráficos e Indicadores — Sindicâncias EB" },
      {
        property: "og:description",
        content: "Painel de indicadores e gráficos, separado do cadastro das sindicâncias.",
      },
    ],
  }),
  component: Graficos,
});

function Graficos() {
  const { itens, erro, carregando, recarregar } = useSindicancias();

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-4 sm:p-6">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 sm:flex sm:flex-wrap sm:justify-between">
        <div className="min-w-0">
          <h1 className="truncate font-serif text-2xl font-semibold">Gráficos e Indicadores</h1>
          <p className="text-sm text-muted-foreground">
            Métricas e gráficos de todas as sindicâncias cadastradas.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={recarregar} className="shrink-0">
          {carregando ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <RefreshCw className="size-4" />
          )}
          Atualizar
        </Button>
      </header>

      {erro && (
        <div className="painel flex items-start gap-2 p-4 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span className="min-w-0 break-words">{erro}</span>
        </div>
      )}

      {itens.length === 0 ? (
        <div className="painel flex flex-col items-center gap-2 p-8 text-center text-sm text-muted-foreground">
          <BarChart3 className="size-6 text-muted-foreground" />
          Nenhuma sindicância cadastrada ainda — os gráficos aparecem aqui assim que houver dados.
        </div>
      ) : (
        <DashboardMetricas itens={itens} />
      )}
    </div>
  );
}

