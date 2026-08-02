import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { ExternalLink, FolderOpen, Loader2, Paperclip, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { useSindicancias } from "@/components/SindicanciaContext";
import { adicionarAnexo, criarJuntada } from "@/lib/sindicancias.functions";

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
          "Consulte as peças geradas no Google Docs, anexe documentos às juntadas dos autos e acesse a pasta de anexos e a planilha-base no Google Drive.",
      },
      { property: "og:title", content: "Autos e Documentos — Sindicâncias EB" },
      {
        property: "og:description",
        content: "Peças da sindicância no Google Docs, juntadas e anexos vinculados ao NUP.",
      },
    ],
  }),
  component: Documentos,
});

function lerArquivo(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(new Error("Falha ao ler o arquivo."));
    reader.readAsDataURL(file);
  });
}

function Documentos() {
  const { itens, selecionada, setSelecionadaId, recarregar } = useSindicancias();
  const [aberto, setAberto] = useState<{ titulo: string; documentId: string } | null>(null);
  const [dialogo, setDialogo] = useState(false);
  const [juntadaId, setJuntadaId] = useState<string>("");
  const [novaJuntada, setNovaJuntada] = useState("");
  const [arquivo, setArquivo] = useState<File | null>(null);

  const juntadas = selecionada?.juntadas ?? [];

  const criar = useMutation({
    mutationFn: () =>
      criarJuntada({
        data: {
          sindicanciaId: selecionada!.id,
          titulo: novaJuntada,
          data: new Date().toISOString().slice(0, 10),
        },
      }),
    onSuccess: (j) => {
      setJuntadaId(j.id);
      setNovaJuntada("");
      toast.success(`Juntada nº ${j.numero} criada`);
      recarregar();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const enviar = useMutation({
    mutationFn: async () => {
      if (!arquivo) throw new Error("Selecione um arquivo.");
      if (!juntadaId) throw new Error("Selecione ou crie uma juntada.");
      const base64 = await lerArquivo(arquivo);
      return adicionarAnexo({
        data: {
          sindicanciaId: selecionada!.id,
          juntadaId,
          nome: arquivo.name,
          mimeType: arquivo.type || "application/octet-stream",
          base64,
        },
      });
    },
    onSuccess: () => {
      toast.success("Anexo enviado e vinculado à juntada");
      setArquivo(null);
      setDialogo(false);
      recarregar();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-4 sm:p-6">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 sm:flex sm:flex-wrap sm:justify-between">
        <div className="min-w-0">
          <h1 className="truncate font-serif text-2xl font-semibold">Autos e Documentos</h1>
          <p className="text-sm text-muted-foreground">
            Peças geradas nesta sindicância, documento único paginado e anexos das juntadas.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button size="sm" disabled={!selecionada} onClick={() => setDialogo(true)}>
            <Paperclip className="size-4" /> Adicionar anexos aos Autos
          </Button>
          {selecionada?.autosUrl && (
            <Button variant="outline" size="sm" asChild>
              <a href={selecionada.autosUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="size-4" /> Autos (documento único)
              </a>
            </Button>
          )}
          {selecionada?.pastaUrl && (
            <Button variant="outline" size="sm" asChild>
              <a href={selecionada.pastaUrl} target="_blank" rel="noreferrer">
                <FolderOpen className="size-4" /> Pasta da sindicância
              </a>
            </Button>
          )}
          <Button variant="outline" size="sm" asChild>
            <a href={selecionada?.anexosUrl || PASTA_DRIVE} target="_blank" rel="noreferrer">
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
        <div className="space-y-4">
          <ul className="painel divide-y divide-border">
            {(selecionada?.documentos ?? []).map((d, i) => (
              <li key={d.documentId} className="flex items-center justify-between gap-2 p-3">
                <button
                  onClick={() => setAberto(d)}
                  className="min-w-0 flex-1 truncate text-left text-sm hover:text-primary"
                >
                  <span className="text-muted-foreground">Fls. {i + 1} — </span>
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

          <div className="painel space-y-3 p-4">
            <h2 className="rotulo">Juntadas e anexos</h2>
            {juntadas.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Nenhuma juntada registrada. Use “Adicionar anexos aos Autos”.
              </p>
            )}
            {juntadas.map((j) => (
              <div key={j.id} className="space-y-1">
                <p className="text-sm font-medium">
                  Juntada nº {j.numero} — {j.titulo}
                  {j.url && (
                    <a
                      href={j.url}
                      target="_blank"
                      rel="noreferrer"
                      className="ml-2 inline-flex items-center text-primary hover:underline"
                    >
                      <ExternalLink className="size-3.5" />
                    </a>
                  )}
                </p>
                <ul className="space-y-0.5 pl-3">
                  {j.anexos.map((a) => (
                    <li key={a.fileId} className="truncate text-sm text-muted-foreground">
                      <a
                        href={a.url}
                        target="_blank"
                        rel="noreferrer"
                        className="hover:text-primary"
                      >
                        {a.descricao || a.nomeArquivo}
                      </a>
                    </li>
                  ))}
                  {j.anexos.length === 0 && (
                    <li className="text-xs text-muted-foreground">sem anexos</li>
                  )}
                </ul>
              </div>
            ))}
          </div>
        </div>

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

      <Dialog open={dialogo} onOpenChange={setDialogo}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar anexo aos Autos</DialogTitle>
            <DialogDescription>
              O arquivo é enviado à pasta “Anexos” do NUP {selecionada?.nup || "—"} e fica vinculado
              à juntada escolhida, preservando a ordem dos autos.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Juntada</Label>
              <Select value={juntadaId} onValueChange={setJuntadaId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a juntada" />
                </SelectTrigger>
                <SelectContent>
                  {juntadas.map((j) => (
                    <SelectItem key={j.id} value={j.id}>
                      Juntada nº {j.numero} — {j.titulo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Nova juntada</Label>
              <div className="flex gap-2">
                <Input
                  value={novaJuntada}
                  onChange={(e) => setNovaJuntada(e.target.value)}
                  placeholder="Ex.: Juntada de documentos do sindicado"
                />
                <Button
                  variant="secondary"
                  onClick={() => criar.mutate()}
                  disabled={criar.isPending || !selecionada}
                >
                  {criar.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Plus className="size-4" />
                  )}
                  Criar
                </Button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Arquivo (foto ou PDF)</Label>
              <Input
                type="file"
                accept="image/*,application/pdf"
                onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
              />
              <p className="text-xs text-muted-foreground">
                Fotos ficam incorporadas no texto da juntada; PDFs viram um link clicável.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogo(false)}>
              Cancelar
            </Button>
            <Button onClick={() => enviar.mutate()} disabled={enviar.isPending}>
              {enviar.isPending && <Loader2 className="size-4 animate-spin" />}
              Enviar anexo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
