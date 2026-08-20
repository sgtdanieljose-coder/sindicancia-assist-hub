import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { AlertCircle, CheckCircle2, DatabaseZap } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { migrarSheetsParaSupabase } from "@/lib/migracao.functions";

export const Route = createFileRoute("/migrar-supabase")({
  head: () => ({
    meta: [
      { title: "Migração para o Supabase | Sindicâncias EB" },
      {
        name: "description",
        content:
          "Copia sindicâncias e sindicados da planilha Google Sheets para o banco de dados do sistema de sindicâncias.",
      },
      { property: "og:title", content: "Migração para o Supabase | Sindicâncias EB" },
      {
        property: "og:description",
        content: "Ferramenta de migração única dos dados da planilha para o banco de dados.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MigrarSupabase,
});

function MigrarSupabase() {
  const [confirmando, setConfirmando] = useState(false);

  const migrar = useMutation({
    mutationFn: () => migrarSheetsParaSupabase(),
    onSuccess: (r) => {
      setConfirmando(false);
      if (r.erros.length === 0) {
        toast.success("Migração concluída sem erros.");
      } else {
        toast.warning(
          `Migração concluída com ${r.erros.length} erro(s) — veja os detalhes abaixo.`,
        );
      }
    },
    onError: (e) => {
      setConfirmando(false);
      toast.error(`Falha ao migrar: ${(e as Error).message}`);
    },
  });

  const resultado = migrar.data;

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 p-4 sm:p-6">
      <header>
        <h1 className="flex items-center gap-2 font-serif text-2xl font-semibold">
          <DatabaseZap className="size-6" />
          Migração para o Supabase
        </h1>
        <p className="text-sm text-muted-foreground">
          Copia as sindicâncias e os sindicados que hoje estão na planilha Google Sheets para o
          Supabase. Só leitura na planilha — nada é apagado ou alterado nela. Peças, autos, imagens
          e PDFs não são tocados: continuam no Google Docs/Drive.
        </p>
      </header>

      <div className="painel space-y-4 p-4">
        <p className="text-sm">
          Pode rodar mais de uma vez sem medo: cada execução apaga o que já estiver no Supabase e
          regrava tudo de novo a partir da planilha, então clicar de novo não duplica nada.
        </p>

        {!confirmando ? (
          <Button onClick={() => setConfirmando(true)} disabled={migrar.isPending}>
            Migrar dados agora
          </Button>
        ) : (
          <div className="space-y-2 rounded-md border border-amber-300 bg-amber-50 p-3">
            <p className="text-sm font-medium text-amber-900">
              Confirma? Isso substitui tudo que já estiver no Supabase pelo conteúdo atual da
              planilha.
            </p>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => migrar.mutate()} disabled={migrar.isPending}>
                {migrar.isPending ? "Migrando..." : "Sim, migrar"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setConfirmando(false)}
                disabled={migrar.isPending}
              >
                Cancelar
              </Button>
            </div>
          </div>
        )}
      </div>

      {resultado && (
        <div className="painel space-y-3 p-4">
          <div className="flex items-center gap-2">
            {resultado.erros.length === 0 ? (
              <CheckCircle2 className="size-5 text-green-600" />
            ) : (
              <AlertCircle className="size-5 text-amber-600" />
            )}
            <h2 className="rotulo">Resultado</h2>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div>
              <p className="text-xs text-muted-foreground">Sindicâncias na planilha</p>
              <p>{resultado.sindicanciasEncontradas}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Sindicâncias migradas</p>
              <p>{resultado.sindicanciasMigradas}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Sindicados na planilha</p>
              <p>{resultado.sindicadosEncontrados}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Sindicados migrados</p>
              <p>{resultado.sindicadosMigrados}</p>
            </div>
          </div>
          {resultado.erros.length > 0 && (
            <div className="space-y-1 border-t border-border pt-2">
              <p className="text-xs font-medium text-destructive">Erros:</p>
              <ul className="list-inside list-disc space-y-0.5 text-xs text-destructive">
                {resultado.erros.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Depois de conferir que os números batem com a planilha, esta página e o arquivo que ela usa
        podem ser apagados — não fazem parte do funcionamento normal do sistema.
      </p>
    </div>
  );
}
