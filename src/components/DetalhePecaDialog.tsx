import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, ExternalLink, Eye, History, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { HistoricoVersoesDialog } from "@/components/HistoricoVersoesDialog";
import { BadgeSincronizacao } from "@/components/BadgeSincronizacao";
import { atualizarStatusPeca } from "@/lib/sindicancias.functions";
import { tipoDoItem, formatarDataHora, type DocumentoItem } from "@/lib/documentos-format";
import { PECAS, STATUS_PECA, STATUS_PECA_LABEL, type StatusPeca } from "@/lib/pecas";
import { useSyncQueue, alvoPeca } from "@/hooks/useSyncQueue";

type Props = {
  sindicanciaId: string;
  /** A peça a exibir, ou null para o diálogo ficar fechado/vazio. Passe sempre o item vivo
   *  de `sindicancia.documentos` (por ex. via `.find(...)`), não uma cópia congelada — assim
   *  o diálogo acompanha sozinho qualquer atualização vinda de `recarregar()`. */
  peca: DocumentoItem | null;
  /** Número da folha (Fls.) já calculado pelo chamador — Lista e Mapa numeram de formas
   *  ligeiramente diferentes (posição na lista completa vs. no `<ol>` renderizado), então é
   *  mais simples cada um calcular o seu do que este componente receber o array inteiro. */
  posicao: number;
  aberto: boolean;
  onOpenChange: (aberto: boolean) => void;
  /** Chamado após qualquer alteração (status ou restauração de versão) — tipicamente
   *  `recarregar` da sindicância selecionada. */
  onAtualizado: () => void;
};

/**
 * Painel de detalhes/ações rápidas de uma peça dos autos — Visualizar, Editar, Histórico,
 * Abrir no Google Docs e (quando aplicável) Sincronizar — extraído de routes/documentos.tsx
 * (Prioridade 2.5) para a consolidação "Autos da Sindicância". Antes só a Lista dos Autos
 * abria isto ao clicar numa peça; agora o Mapa dos Autos usa o mesmo componente, então as
 * duas visualizações compartilham exatamente as mesmas ações em vez de cada uma reimplementar
 * as suas.
 */
export function DetalhePecaDialog({
  sindicanciaId,
  peca,
  posicao,
  aberto,
  onOpenChange,
  onAtualizado,
}: Props) {
  const { enfileirarExportarPeca } = useSyncQueue();
  const [mostrarPreview, setMostrarPreview] = useState(false);
  const [historicoAberto, setHistoricoAberto] = useState(false);

  const atualizarStatus = useMutation({
    mutationFn: (p: { documentId: string; status: StatusPeca }) =>
      atualizarStatusPeca({ data: { sindicanciaId, documentId: p.documentId, status: p.status } }),
    onSuccess: onAtualizado,
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <Dialog
        open={aberto}
        onOpenChange={(v) => {
          onOpenChange(v);
          if (!v) setMostrarPreview(false);
        }}
      >
        <DialogContent className="max-w-2xl">
          {peca && (
            <>
              <DialogHeader>
                <DialogTitle className="pr-6">{peca.titulo}</DialogTitle>
                <DialogDescription>
                  {tipoDoItem(peca)} · Fls. {posicao}
                </DialogDescription>
              </DialogHeader>

              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                <p className="text-muted-foreground">Status</p>
                <Select
                  value={peca.status ?? "concluida"}
                  onValueChange={(v) =>
                    atualizarStatus.mutate({ documentId: peca.documentId, status: v as StatusPeca })
                  }
                >
                  <SelectTrigger className="h-7 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_PECA.map((s) => (
                      <SelectItem key={s} value={s}>
                        {STATUS_PECA_LABEL[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-muted-foreground">Criada em</p>
                <p>{formatarDataHora(peca.criadoEm)}</p>
                <p className="text-muted-foreground">Última alteração</p>
                <p>{formatarDataHora(peca.atualizadoEm)}</p>
                <p className="text-muted-foreground">Sincronização</p>
                <BadgeSincronizacao alvo={alvoPeca(sindicanciaId, peca.documentId, peca.pecaId)} />
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                {!peca.pecaId?.startsWith("juntada-") && (
                  <Button variant="outline" size="sm" asChild>
                    <Link
                      to="/pecas"
                      search={{ peca: peca.pecaId as never }}
                      onClick={() => onOpenChange(false)}
                    >
                      <Pencil className="size-4" /> Editar peça
                    </Link>
                  </Button>
                )}
                {peca.pecaId?.startsWith("juntada-") && (
                  <Button variant="outline" size="sm" asChild>
                    <Link
                      to="/pecas"
                      search={{ peca: "juntada" }}
                      onClick={() => onOpenChange(false)}
                    >
                      <Pencil className="size-4" /> Editar juntada
                    </Link>
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={() => setMostrarPreview((v) => !v)}>
                  <Eye className="size-4" /> {mostrarPreview ? "Ocultar" : "Visualizar"}
                </Button>
                <Button variant="outline" size="sm" onClick={() => setHistoricoAberto(true)}>
                  <History className="size-4" /> Histórico
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <a href={peca.url} target="_blank" rel="noreferrer">
                    <ExternalLink className="size-4" /> Abrir no Google Docs
                  </a>
                </Button>
                {!peca.pecaId?.startsWith("juntada-") && peca.texto !== undefined && (
                  <Button
                    size="sm"
                    onClick={() => {
                      const base = peca.pecaId
                        ? PECAS.find((p) => p.id === peca.pecaId)
                        : undefined;
                      enfileirarExportarPeca(
                        {
                          sindicanciaId,
                          titulo: peca.titulo,
                          conteudo: peca.texto ?? "",
                          pecaId: peca.pecaId,
                          unica: base?.unica ?? false,
                          etapa: base?.etapa,
                        },
                        { documentId: peca.documentId },
                      );
                      toast.success("Sincronização enfileirada");
                    }}
                  >
                    <Check className="size-4" /> Sincronizar
                  </Button>
                )}
              </div>

              {mostrarPreview && (
                <iframe
                  title={peca.titulo}
                  src={`https://docs.google.com/document/d/${peca.documentId}/preview`}
                  className="h-[50vh] w-full rounded-md border border-border"
                />
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      {peca && (
        <HistoricoVersoesDialog
          sindicanciaId={sindicanciaId}
          documentId={peca.documentId}
          pecaId={peca.pecaId}
          aberto={historicoAberto}
          onOpenChange={setHistoricoAberto}
          textoAtual={peca.texto}
          onAtualizado={onAtualizado}
        />
      )}
    </>
  );
}
