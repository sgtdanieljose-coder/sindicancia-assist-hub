import { AlignLeft, ExternalLink } from "lucide-react";
import { PECAS, type PecaId, type Sindicancia } from "@/lib/pecas";

type Props = {
  documentos: Sindicancia["documentos"];
  autosUrl?: string;
  /** Peça atualmente selecionada no formulário à direita, para realçar o item correspondente. */
  pecaSelecionada?: PecaId;
  /** Chamado ao clicar numa peça "única" já existente, para carregá-la de volta no editor. */
  onSelecionarPeca?: (pecaId: PecaId) => void;
};

/**
 * Lista, em ordem de paginação — a MESMA ordem usada por rebuildAutos (google.server.ts) para
 * numerar "Fls. N" no documento único —, todas as peças já lançadas nesta sindicância.
 * Inspirado no "Guia do documento" do Google Docs: uma coluna estreita e discreta, fixa à
 * esquerda, servindo de índice/navegação para os autos.
 */
export function GuiaDocumento({ documentos, autosUrl, pecaSelecionada, onSelecionarPeca }: Props) {
  return (
    <div className="painel flex h-fit flex-col gap-1 p-3 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto">
      <div className="flex items-center gap-1.5 px-1 pb-1">
        <AlignLeft className="size-3.5 text-muted-foreground" />
        <h2 className="rotulo">Guia do documento</h2>
      </div>

      {autosUrl && (
        <a
          href={autosUrl}
          target="_blank"
          rel="noreferrer"
          className="mb-1 flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-primary hover:bg-muted/60 hover:underline"
        >
          <ExternalLink className="size-3.5 shrink-0" />
          Ver autos completos
        </a>
      )}

      {documentos.length === 0 ? (
        <p className="px-2 py-1 text-xs text-muted-foreground">
          Nenhuma peça lançada ainda. As peças exportadas aparecem aqui, na ordem em que entram nos
          autos.
        </p>
      ) : (
        <ol className="space-y-0.5">
          {documentos.map((d, i) => {
            const pecaBase = d.pecaId ? PECAS.find((p) => p.id === d.pecaId) : undefined;
            const editavel = Boolean(pecaBase?.unica && onSelecionarPeca);
            const ativa = editavel && pecaSelecionada === d.pecaId;

            return (
              <li key={d.documentId}>
                <div
                  className={`group flex items-start gap-2 rounded-md px-2 py-1.5 text-xs transition-colors hover:bg-muted/60 ${
                    ativa ? "bg-muted text-foreground" : "text-muted-foreground"
                  }`}
                >
                  <span className="mt-px shrink-0 font-mono tabular-nums">Fls. {i + 1}</span>
                  <button
                    type="button"
                    onClick={() => editavel && onSelecionarPeca?.(d.pecaId as PecaId)}
                    disabled={!editavel}
                    className={`min-w-0 flex-1 truncate text-left leading-snug ${
                      editavel ? "cursor-pointer hover:text-foreground" : "cursor-default"
                    }`}
                    title={d.tituloInterno || d.titulo}
                  >
                    {d.tituloInterno || d.titulo}
                  </button>
                  <a
                    href={d.url}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                    title="Abrir esta peça no Google Docs"
                  >
                    <ExternalLink className="size-3.5" />
                  </a>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
