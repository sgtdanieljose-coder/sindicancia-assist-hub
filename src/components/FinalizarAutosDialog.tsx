import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, ExternalLink, Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ListaItensValidacao } from "@/components/PainelValidacao";
import { validarAutos, type ItemValidacao } from "@/lib/validacao";
import { finalizarAutos } from "@/lib/sindicancias.functions";
import type { Sindicancia } from "@/lib/pecas";

type Props = {
  sindicancia: Sindicancia;
  aberto: boolean;
  onOpenChange: (aberto: boolean) => void;
  itensExtras?: ItemValidacao[];
  onFinalizado?: () => void;
};

/**
 * "Finalizar Autos" (Prioridade 7): 1) valida, 2) mostra as pendências, 3) permite corrigir
 * (mesmos links da validação), 4) só então confirma. Com pendências em aberto, exige marcar
 * "estou ciente" antes de liberar o botão — a validação nunca bloqueia sozinha, quem decide
 * é o encarregado.
 *
 * O resultado é uma cópia independente dos Autos de Trabalho ("Autos Finais — vN") — editar
 * peças depois não muda essa cópia (Prioridade 8). Não gera PDF automaticamente: a
 * infraestrutura de exportação de PDF por trás do gateway do Google não pôde ser confirmada
 * nesta etapa (ver nota no chat), então o caminho confiável por enquanto é abrir o
 * documento gerado e usar Arquivo → Fazer download → PDF, direto no Google Docs.
 */
export function FinalizarAutosDialog({
  sindicancia,
  aberto,
  onOpenChange,
  itensExtras = [],
  onFinalizado,
}: Props) {
  const [ciente, setCiente] = useState(false);
  const itens = [...validarAutos(sindicancia), ...itensExtras];
  const pendencias = itens.filter((i) => !i.ok);
  const proximaVersao = (sindicancia.autosFinais?.length ?? 0) + 1;
  const ultimaFinalizacao = sindicancia.autosFinais?.at(-1);

  const finalizar = useMutation({
    mutationFn: () =>
      finalizarAutos({
        data: { sindicanciaId: sindicancia.id, forcarComPendencias: pendencias.length > 0 },
      }),
    onSuccess: (registro) => {
      toast.success(`Autos Finais — v${registro.versao} gerados com sucesso.`);
      setCiente(false);
      onOpenChange(false);
      onFinalizado?.();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog
      open={aberto}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) setCiente(false);
      }}
    >
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="size-5" /> Finalizar Autos — v{proximaVersao}
          </DialogTitle>
          <DialogDescription>
            Gera uma cópia independente dos autos, separada dos Autos de Trabalho — editar peças
            depois não altera essa cópia.
          </DialogDescription>
        </DialogHeader>

        <ListaItensValidacao itens={itens} onNavegar={() => onOpenChange(false)} />

        {ultimaFinalizacao && (
          <p className="text-xs text-muted-foreground">
            Já existe{sindicancia.autosFinais!.length > 1 ? "m" : ""}{" "}
            {sindicancia.autosFinais!.length} versão(ões) finalizada(s) — a mais recente é{" "}
            <a
              href={ultimaFinalizacao.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-0.5 text-primary hover:underline"
            >
              v{ultimaFinalizacao.versao} <ExternalLink className="size-3" />
            </a>
            , de {new Date(ultimaFinalizacao.data).toLocaleString("pt-BR")}.
          </p>
        )}

        {pendencias.length > 0 && (
          <label className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            <Checkbox
              checked={ciente}
              onCheckedChange={(v) => setCiente(Boolean(v))}
              className="mt-0.5"
            />
            Estou ciente d{pendencias.length === 1 ? "a" : "as"} {pendencias.length} pendência
            {pendencias.length === 1 ? "" : "s"} acima e quero finalizar mesmo assim.
          </label>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => finalizar.mutate()}
            disabled={finalizar.isPending || (pendencias.length > 0 && !ciente)}
          >
            {finalizar.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <CheckCircle2 className="size-4" />
            )}
            Finalizar Autos
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
