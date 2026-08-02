import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { ExternalLink, FileUp, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { exportarParaDocs } from "@/lib/sindicancias.functions";

type Props = {
  titulo: string;
  conteudo: string;
  sindicanciaId: string;
  pecasExistentes: { titulo: string; documentId: string; pecaId?: string }[];
  pecaId?: string;
  unica?: boolean;
  etapa?: string;
  onChange: (texto: string) => void;
  onExportado?: () => void;
};

export function EditorPeca({
  titulo,
  conteudo,
  sindicanciaId,
  pecasExistentes,
  pecaId,
  unica,
  etapa,
  onChange,
  onExportado,
}: Props) {
  const existente = unica && pecaId ? pecasExistentes.find((d) => d.pecaId === pecaId) : undefined;

  const [doc, setDoc] = useState<{ url: string; embedUrl: string } | null>(
    existente
      ? {
          url: `https://docs.google.com/document/d/${existente.documentId}/edit`,
          embedUrl: `https://docs.google.com/document/d/${existente.documentId}/preview`,
        }
      : null,
  );
  const [autosUrl, setAutosUrl] = useState<string | null>(null);
  const [perguntando, setPerguntando] = useState(false);
  const total = pecasExistentes.length + 1;
  const [posicao, setPosicao] = useState(String(total));

  useEffect(() => {
    setDoc(
      existente
        ? {
            url: `https://docs.google.com/document/d/${existente.documentId}/edit`,
            embedUrl: `https://docs.google.com/document/d/${existente.documentId}/preview`,
          }
        : null,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existente?.documentId]);

  const exportar = useMutation({
    mutationFn: (pos?: number) =>
      exportarParaDocs({
        data: { sindicanciaId, titulo, conteudo, posicao: pos, pecaId, unica, etapa },
      }),
    onSuccess: (d) => {
      setDoc(d);
      setAutosUrl(d.autosUrl ?? null);
      setPerguntando(false);
      toast.success(
        d.atualizado
          ? `Peça atualizada (Fls. ${d.posicao}) — documento individual e autos sincronizados`
          : d.recriado
            ? `O documento anterior não foi encontrado no Drive — recriado na Fls. ${d.posicao}`
            : `Peça salva individualmente e inserida na página ${d.posicao} dos autos`,
      );
      if (d.avisoFormatacao) {
        toast.warning(`Documento salvo, mas a formatação falhou: ${d.avisoFormatacao}`);
      }
      onExportado?.();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const alvo = Number(posicao);
  const previa = [
    ...pecasExistentes.slice(0, alvo - 1).map((p, i) => ({
      chave: `a-${p.documentId}-${i}`,
      titulo: p.titulo,
      novaPos: i + 1,
      antigaPos: i + 1,
      tipo: "inalterada" as const,
    })),
    { chave: "nova", titulo, novaPos: alvo, antigaPos: alvo, tipo: "nova" as const },
    ...pecasExistentes.slice(alvo - 1).map((p, i) => ({
      chave: `d-${p.documentId}-${i}`,
      titulo: p.titulo,
      novaPos: alvo + i + 1,
      antigaPos: alvo + i,
      tipo: "deslocada" as const,
    })),
  ];
  const deslocadas = pecasExistentes.length - (alvo - 1);

  const acionar = () => {
    if (existente) {
      exportar.mutate(undefined);
    } else {
      setPosicao(String(total));
      setPerguntando(true);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="rotulo">Minuta gerada — revise antes de exportar</p>
        <Button onClick={acionar} disabled={exportar.isPending || !conteudo.trim()} size="sm">
          {exportar.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <FileUp className="size-4" />
          )}
          {existente ? "Atualizar no Google Docs" : "Exportar para Google Docs"}
        </Button>
      </div>

      {existente && (
        <p className="text-xs text-muted-foreground">
          Esta peça já foi exportada (Fls.{" "}
          {pecasExistentes.findIndex((d) => d.pecaId === pecaId) + 1} dos autos). Exportar novamente
          atualiza o mesmo documento em vez de duplicá-lo.
        </p>
      )}

      <Textarea
        value={conteudo}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-[420px] font-mono text-[13px] leading-relaxed"
        spellCheck={false}
      />

      <Dialog open={perguntando} onOpenChange={setPerguntando}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Em qual página inserir esta peça?</DialogTitle>
            <DialogDescription>
              A peça será salva como documento individual e também inserida no documento único dos
              autos, que é repaginado (Fls. 1, 2, 3...) a cada inclusão.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5">
            <Label>Página nos autos</Label>
            <Select value={posicao} onValueChange={setPosicao}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: total }, (_, i) => i + 1).map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    Fls. {n}
                    {pecasExistentes[n - 1]
                      ? ` — antes de "${pecasExistentes[n - 1].titulo}"`
                      : " — ao final dos autos"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 rounded-md border border-border bg-muted/30 p-3">
            <p className="rotulo">Prévia da nova numeração dos autos</p>
            <ul className="max-h-52 space-y-1 overflow-y-auto text-xs">
              {previa.map((l) => (
                <li
                  key={l.chave}
                  className={
                    l.tipo === "nova"
                      ? "font-medium text-primary"
                      : l.tipo === "deslocada"
                        ? "text-foreground"
                        : "text-muted-foreground"
                  }
                >
                  <span className="tabular-nums">Fls. {l.novaPos}</span> — {l.titulo}
                  {l.tipo === "nova" && " (nova peça)"}
                  {l.tipo === "deslocada" && ` (antes Fls. ${l.antigaPos})`}
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground">
              {deslocadas === 0
                ? "Nenhuma folha existente será renumerada."
                : `${deslocadas} folha(s) serão renumeradas: Fls. ${Number(posicao)}–${pecasExistentes.length} passam a Fls. ${Number(posicao) + 1}–${total}.`}
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPerguntando(false)}>
              Cancelar
            </Button>
            <Button onClick={() => exportar.mutate(Number(posicao))} disabled={exportar.isPending}>
              {exportar.isPending && <Loader2 className="size-4 animate-spin" />}
              Confirmar e exportar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {(doc || autosUrl) && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="rotulo">Documento no Google Docs</p>
            <div className="flex gap-3">
              {autosUrl && (
                <a
                  href={autosUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                >
                  Autos (documento único) <ExternalLink className="size-3.5" />
                </a>
              )}
              {doc && (
                <a
                  href={doc.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                >
                  Abrir peça <ExternalLink className="size-3.5" />
                </a>
              )}
            </div>
          </div>
          {doc && (
            <iframe
              title={titulo}
              src={doc.embedUrl}
              className="h-[520px] w-full rounded-md border border-border bg-card"
            />
          )}
        </div>
      )}
    </div>
  );
}
