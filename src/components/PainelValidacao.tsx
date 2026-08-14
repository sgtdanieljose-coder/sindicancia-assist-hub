import { Link } from "@tanstack/react-router";
import { AlertTriangle, CheckCircle2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { validarAutos, type ItemValidacao } from "@/lib/validacao";
import type { Sindicancia } from "@/lib/pecas";

/**
 * Lista de itens ✓/⚠ com link de correção — extraída para ser reaproveitada tanto pelo
 * painel "Validar Autos" (Prioridade 6) quanto pelo diálogo "Finalizar Autos" (Prioridade 7),
 * que precisa exatamente da mesma lista antes de confirmar.
 */
export function ListaItensValidacao({
  itens,
  onNavegar,
}: {
  itens: ItemValidacao[];
  /** Chamado quando o usuário clica em "Corrigir" — tipicamente para fechar o diálogo atual
   *  antes de navegar. */
  onNavegar?: () => void;
}) {
  return (
    <ul className="max-h-[45vh] space-y-1.5 overflow-y-auto">
      {itens.map((item, i) => (
        <li
          key={`${item.titulo}-${i}`}
          className="flex items-start justify-between gap-3 rounded-md px-2 py-1.5 text-sm"
        >
          <span className="flex min-w-0 items-start gap-2">
            {item.ok ? (
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-green-600" />
            ) : (
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
            )}
            <span className="min-w-0">
              <span className={item.ok ? "" : "font-medium"}>{item.titulo}</span>
              {item.detalhe && (
                <span className="block text-[11px] text-muted-foreground">{item.detalhe}</span>
              )}
            </span>
          </span>
          {!item.ok && item.corrigirEm && (
            <Button variant="outline" size="sm" className="h-7 shrink-0 text-xs" asChild>
              <Link to={item.corrigirEm.to} search={item.corrigirEm.search} onClick={onNavegar}>
                Corrigir
              </Link>
            </Button>
          )}
        </li>
      ))}
    </ul>
  );
}

type Props = {
  sindicancia: Sindicancia;
  aberto: boolean;
  onOpenChange: (aberto: boolean) => void;
  /** Itens extras — usados pelo chamador (documentos.tsx) para acrescentar o estado de
   *  sincronização da sessão atual, que não é um dado da sindicância em si (ver
   *  validarAutos em validacao.ts). */
  itensExtras?: ItemValidacao[];
};

/**
 * "Validar Autos" (Prioridade 6) — roda inteiramente sobre os dados já carregados em
 * memória, sem nenhuma chamada ao Google: é só conferir o que já se sabe sobre a
 * sindicância. Cada pendência com destino conhecido (corrigirEm) vira um link direto.
 */
export function PainelValidacao({ sindicancia, aberto, onOpenChange, itensExtras = [] }: Props) {
  const itens = [...validarAutos(sindicancia), ...itensExtras];
  const pendencias = itens.filter((i) => !i.ok);

  return (
    <Dialog open={aberto} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="size-5" /> Validação dos Autos
          </DialogTitle>
          <DialogDescription>
            {pendencias.length === 0
              ? "Nenhuma pendência encontrada — os autos estão prontos para os próximos passos."
              : `${pendencias.length} pendência${pendencias.length === 1 ? "" : "s"} encontrada${pendencias.length === 1 ? "" : "s"}.`}
          </DialogDescription>
        </DialogHeader>

        <ListaItensValidacao itens={itens} onNavegar={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}
