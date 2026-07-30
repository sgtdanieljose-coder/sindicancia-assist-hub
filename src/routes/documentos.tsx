import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ExternalLink, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSindicancias } from "@/components/SindicanciaContext";

const PASTA_DRIVE = "https://drive.google.com/drive/folders/1zcQGM4T6-PAiEttCAdK6aqNBrUnQ-u6G";
const PLANILHA =
  "https://docs.google.com/spreadsheets/d/1Fy-JSNpRJXKE89Wm--zo0cFPJwU1Daf_ygUg78-s1jI/edit";

export const Route = createFileRoute("/documentos")({
  head: () => ({
    meta: [
      { title: "Autos e Documentos | Sindicâncias EB" },
      {
        name: "description",
        content:
          "Consulte as peças geradas no Google Docs, visualize-as no próprio app e acesse a pasta de anexos e a planilha-base no Google Drive.",
      },
      { property: "og:title", content: "Autos e Documentos — Sindicâncias EB" },
      {
        property: "og:description",
        content: "Peças da sindicância armazenadas no Google Docs, com visualização integrada.",
      },
    ],
  }),
  component: Documentos,
});

function Documentos() {
  const { itens, selecionada, setSelecionadaId } = useSindicancias();
  const [aberto, setAberto] = useState<{ titulo: string; documentId: string } | null>(null);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-4 sm:p-6">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 sm:flex sm:flex-wrap sm:justify-between">
        <div className="min-w-0">
          <h1 className="truncate font-serif text-2xl font-semibold">Autos e Documentos</h1>
          <p className="text-sm text-muted-foreground">
            Peças geradas nesta sindicância, armazenadas no Google Docs.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <a href={PASTA_DRIVE} target="_blank" rel="noreferrer">
              <FolderOpen className="size-4" /> Pasta de anexos
            </a>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a href={PLANILHA} target="_blank" rel="noreferrer">
              <ExternalLink className="size-4" /> Planilha-base
            </a>
          </Button>
        </div>
      </header>

      {itens.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {itens.map((i) => (
            <Button
              key={i.id}
              size="sm"
              variant={selecionada?.id === i.id ? "default" : "secondary"}
              onClick={() => setSelecionadaId(i.id)}
            >
              {i.nup || i.id}
            </Button>
          ))}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,340px)_1fr]">
        <ul className="painel divide-y divide-border">
          {(selecionada?.documentos ?? []).map((d) => (
            <li key={d.documentId} className="flex items-center justify-between gap-2 p-3">
              <button
                onClick={() => setAberto(d)}
                className="min-w-0 flex-1 truncate text-left text-sm hover:text-primary"
              >
                {d.titulo}
              </button>
              <a href={d.url} target="_blank" rel="noreferrer" className="shrink-0 text-primary">
                <ExternalLink className="size-4" />
              </a>
            </li>
          ))}
          {!selecionada?.documentos?.length && (
            <li className="p-4 text-sm text-muted-foreground">
              Nenhuma peça exportada até o momento.
            </li>
          )}
        </ul>

        <div className="painel p-3">
          {aberto ? (
            <iframe
              title={aberto.titulo}
              src={`https://docs.google.com/document/d/${aberto.documentId}/preview`}
              className="h-[70vh] w-full rounded-md border border-border"
            />
          ) : (
            <p className="p-6 text-sm text-muted-foreground">
              Selecione uma peça à esquerda para visualizá-la aqui.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
