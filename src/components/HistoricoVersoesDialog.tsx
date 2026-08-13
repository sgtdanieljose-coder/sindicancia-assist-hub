import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Eye, GitCompare, Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { listarVersoes, restaurarVersao } from "@/lib/sindicancias.functions";
import { useSyncQueue } from "@/hooks/useSyncQueue";
import { diffLinhas, resumoDiff } from "@/lib/diff";

type Props = {
  sindicanciaId: string;
  documentId: string | null;
  pecaId?: string;
  aberto: boolean;
  onOpenChange: (aberto: boolean) => void;
  /** Texto atualmente em tela (ou o último salvo conhecido) — usado como referência para
   *  "versão atual × versão anterior" (Prioridade 3.3). Sem isso, a comparação/resumo de
   *  cada versão não é exibida. */
  textoAtual?: string;
  /** Quem tem a peça aberta no editor (EditorPeca) usa isto para atualizar o texto em tela
   *  na hora, sem precisar recarregar. Quem chama de fora do editor (índice dos autos) pode
   *  omitir — a restauração já acontece no servidor de qualquer forma. */
  onRestaurado?: (texto: string) => void;
  /** Chamado após restaurar com sucesso, tipicamente para recarregar a lista da sindicância. */
  onAtualizado?: () => void;
};

/**
 * Histórico de versões de uma peça — extraído de EditorPeca.tsx para ser usado também pelo
 * índice dos autos (Prioridade 2.5), evitando duas implementações da mesma coisa. Amplia o
 * histórico original com visualização integral, resumo e comparação lado a lado com o texto
 * atual (Prioridade 3.2/3.3) — a comparação é só leitura, nunca altera a versão guardada.
 */
export function HistoricoVersoesDialog({
  sindicanciaId,
  documentId,
  pecaId,
  aberto,
  onOpenChange,
  textoAtual,
  onRestaurado,
  onAtualizado,
}: Props) {
  const { enfileirarSincronizarAutos } = useSyncQueue();
  const [expandido, setExpandido] = useState<{ id: string; modo: "texto" | "diff" } | null>(null);

  const versoes = useQuery({
    queryKey: ["versoes-peca", sindicanciaId, documentId],
    enabled: Boolean(documentId) && aberto,
    queryFn: () => listarVersoes({ data: { sindicanciaId, documentId: documentId as string } }),
  });

  const restaurar = useMutation({
    mutationFn: (versaoId: string) =>
      restaurarVersao({
        data: { sindicanciaId, documentId: documentId as string, versaoId, pecaId },
      }),
    onSuccess: (d) => {
      onRestaurado?.(d.texto);
      onOpenChange(false);
      void versoes.refetch();
      toast.success(
        "Versão anterior restaurada — peça atualizada, autos pendentes de sincronizar.",
      );
      if (d.avisoFormatacao) {
        toast.warning(`Texto restaurado, mas a formatação falhou: ${d.avisoFormatacao}`);
      }
      enfileirarSincronizarAutos({ sindicanciaId });
      onAtualizado?.();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const listaVersoes = versoes.data?.versoes ?? [];

  function alternar(id: string, modo: "texto" | "diff") {
    setExpandido((atual) => (atual?.id === id && atual.modo === modo ? null : { id, modo }));
  }

  return (
    <Dialog open={aberto} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Histórico de versões desta peça</DialogTitle>
          <DialogDescription>
            Cada exportação/atualização guarda o texto anterior. Restaurar reescreve o documento
            individual — os autos ficam pendentes de sincronizar, sem repaginar na hora. Comparar é
            só leitura: não altera nem a versão guardada nem o texto atual.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] space-y-2 overflow-y-auto">
          {versoes.isFetching && listaVersoes.length === 0 && (
            <p className="text-sm text-muted-foreground">Carregando histórico...</p>
          )}
          {!versoes.isFetching && listaVersoes.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Ainda não há versões anteriores — o histórico começa na primeira atualização desta
              peça.
            </p>
          )}
          {listaVersoes.map((v, i) => {
            const numero = listaVersoes.length - i;
            const aberto1 = expandido?.id === v.id ? expandido.modo : null;
            return (
              <div key={v.id} className="rounded-md border border-border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">
                      Versão {numero} — {new Date(v.criadoEm).toLocaleString("pt-BR")}
                    </p>
                    {textoAtual !== undefined && (
                      <p className="text-[11px] text-muted-foreground">
                        {resumoDiff(v.texto, textoAtual)} em relação ao texto atual
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => alternar(v.id, "texto")}
                    >
                      <Eye className="size-3.5" /> Visualizar
                    </Button>
                    {textoAtual !== undefined && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => alternar(v.id, "diff")}
                      >
                        <GitCompare className="size-3.5" /> Comparar com atual
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => restaurar.mutate(v.id)}
                      disabled={restaurar.isPending}
                    >
                      {restaurar.isPending ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <RotateCcw className="size-3.5" />
                      )}
                      Restaurar
                    </Button>
                  </div>
                </div>

                {aberto1 === "texto" && (
                  <pre className="mt-2 max-h-64 overflow-y-auto whitespace-pre-wrap rounded bg-muted/40 p-2 font-mono text-[11px] leading-relaxed text-foreground">
                    {v.texto || "(vazio)"}
                  </pre>
                )}

                {aberto1 === "diff" && textoAtual !== undefined && (
                  <div className="mt-2 max-h-64 overflow-y-auto rounded bg-muted/40 p-2 font-mono text-[11px] leading-relaxed">
                    {diffLinhas(v.texto, textoAtual).map((l, idx) => (
                      <div
                        key={idx}
                        className={
                          l.tipo === "adicionada"
                            ? "bg-green-100 text-green-900"
                            : l.tipo === "removida"
                              ? "bg-red-100 text-red-900 line-through decoration-red-400"
                              : "text-muted-foreground"
                        }
                      >
                        {l.tipo === "adicionada" ? "+ " : l.tipo === "removida" ? "− " : "  "}
                        {l.texto || " "}
                      </div>
                    ))}
                  </div>
                )}

                {!aberto1 && (
                  <pre className="mt-2 max-h-20 overflow-hidden whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-muted-foreground">
                    {v.texto.slice(0, 240)}
                    {v.texto.length > 240 ? "..." : ""}
                  </pre>
                )}
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
