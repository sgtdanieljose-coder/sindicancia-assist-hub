import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { ExternalLink, FileUp, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { exportarParaDocs } from "@/lib/sindicancias.functions";

type Props = {
  titulo: string;
  conteudo: string;
  sindicanciaId: string;
  onChange: (texto: string) => void;
  onExportado?: () => void;
};

export function EditorPeca({ titulo, conteudo, sindicanciaId, onChange, onExportado }: Props) {
  const [doc, setDoc] = useState<{ url: string; embedUrl: string } | null>(null);

  const exportar = useMutation({
    mutationFn: () => exportarParaDocs({ data: { sindicanciaId, titulo, conteudo } }),
    onSuccess: (d) => {
      setDoc(d);
      toast.success("Documento criado no Google Docs");
      onExportado?.();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="rotulo">Minuta gerada — revise antes de exportar</p>
        <Button
          onClick={() => exportar.mutate()}
          disabled={exportar.isPending || !conteudo.trim()}
          size="sm"
        >
          {exportar.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <FileUp className="size-4" />
          )}
          Exportar para Google Docs
        </Button>
      </div>

      <Textarea
        value={conteudo}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-[420px] font-mono text-[13px] leading-relaxed"
        spellCheck={false}
      />

      {doc && (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="rotulo">Documento no Google Docs</p>
            <a
              href={doc.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
            >
              Abrir para edição <ExternalLink className="size-3.5" />
            </a>
          </div>
          <iframe
            title={titulo}
            src={doc.embedUrl}
            className="h-[520px] w-full rounded-md border border-border bg-card"
          />
        </div>
      )}
    </div>
  );
}
