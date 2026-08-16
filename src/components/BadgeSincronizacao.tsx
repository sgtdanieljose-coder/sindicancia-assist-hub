import { useStatusSincronizacao } from "@/hooks/useSyncQueue";

/** Badge de status de sincronização com o Google (fila) — mesma linguagem visual usada em
 *  EditorPeca.tsx e GuiaDocumento.tsx. Extraído de routes/documentos.tsx (Prioridade 2.5)
 *  para ser reaproveitado também por DetalhePecaDialog.tsx, sem duplicar o mapa de textos. */
export function BadgeSincronizacao({ alvo }: { alvo: string }) {
  const status = useStatusSincronizacao(alvo);
  if (!status) return <span className="text-[11px] text-muted-foreground">—</span>;
  const mapa: Record<string, { texto: string; className: string }> = {
    pending: { texto: "🟡 Pendente", className: "text-amber-600" },
    processing: { texto: "🔄 Sincronizando", className: "text-muted-foreground" },
    retrying: { texto: "🔄 Tentando de novo", className: "text-amber-600" },
    completed: { texto: "🟢 Sincronizado", className: "text-green-600" },
    failed: { texto: "🔴 Erro", className: "text-destructive" },
  };
  const info = mapa[status.status];
  return <span className={`text-[11px] ${info.className}`}>{info.texto}</span>;
}
