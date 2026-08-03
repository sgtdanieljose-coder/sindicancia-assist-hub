import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { ExternalLink, FolderOpen, Loader2, Paperclip, Plus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { gerarTextoJuntada } from "@/lib/pecas";
import {
  adicionarItemJuntada,
  criarJuntada,
  salvarTextoJuntada,
} from "@/lib/sindicancias.functions";

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
  const [descricao, setDescricao] = useState("");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [textoJuntada, setTextoJuntada] = useState("");

  const juntadas = selecionada?.juntadas ?? [];
  const juntadaAtual = juntadas.find((j) => j.id === juntadaId);

  // Só recarrega a sugestão de texto quando a juntada selecionada muda — nunca sozinho
  // enquanto o usuário está editando, pra não apagar o que ele digitou por engano.
  useEffect(() => {
    if (juntadaAtual && selecionada) {
      setTextoJuntada(gerarTextoJuntada(selecionada, juntadaAtual));
    } else {
      setTextoJuntada("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [juntadaId]);

  const recarregarSugestao = () => {
    if (juntadaAtual && selecionada) {
      setTextoJuntada(gerarTextoJuntada(selecionada, juntadaAtual));
      toast.info("Sugestão recarregada com os itens atuais");
    }
  };

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
      if (!descricao.trim()) throw new Error("Descreva o item juntado.");
      if (!juntadaId) throw new Error("Selecione ou crie uma juntada.");
      const arquivoPayload = arquivo
        ? {
            nome: arquivo.name,
            mimeType: arquivo.type || "application/octet-stream",
            base64: await lerArquivo(arquivo),
          }
        : undefined;
      return adicionarItemJuntada({
        data: {
          sindicanciaId: selecionada!.id,
          juntadaId,
          descricao: descricao.trim(),
          arquivo: arquivoPayload,
        },
      });
    },
    onSuccess: () => {
      toast.success('Item adicionado — use "Recarregar sugestão" pra trazê-lo pro texto abaixo');
      setDescricao("");
      setArquivo(null);
      recarregar();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const salvar = useMutation({
    mutationFn: () =>
      salvarTextoJuntada({
        data: { sindicanciaId: selecionada!.id, juntadaId, texto: textoJuntada },
      }),
    onSuccess: () => {
      toast.success("Termo da juntada salvo");
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
                    <li key={a.id} className="truncate text-sm text-muted-foreground">
                      {a.url ? (
                        <a
                          href={a.url}
                          target="_blank"
                          rel="noreferrer"
                          className="hover:text-primary"
                        >
                          {a.descricao}
                        </a>
                      ) : (
                        a.descricao
                      )}
                    </li>
                  ))}
                  {j.anexos.length === 0 && (
                    <li className="text-xs text-muted-foreground">sem itens</li>
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
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Juntada — itens e termo</DialogTitle>
            <DialogDescription>
              Adicione itens digitados (com arquivo opcional) e revise o texto do termo antes de
              salvar — nada é gravado nos autos até você clicar em "Salvar termo".
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

            <div className="space-y-2 rounded-md border border-border p-3">
              <Label>Adicionar item à juntada selecionada</Label>
              <Textarea
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Ex.: Ofício nº 123, de 15 de julho de 2026: solicitação de documentos ao Sr. Fulano;"
                className="min-h-16"
              />
              <p className="text-xs text-muted-foreground">
                Texto livre — pode ter vírgula, dois-pontos etc.
              </p>
              <Input
                type="file"
                accept="image/*,application/pdf"
                onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
              />
              <p className="text-xs text-muted-foreground">
                Arquivo opcional — se anexado, ganha folha própria nos autos (foto incorporada, ou
                link para PDF).
              </p>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => enviar.mutate()}
                disabled={enviar.isPending || !juntadaId}
              >
                {enviar.isPending && <Loader2 className="size-4 animate-spin" />}
                Adicionar item
              </Button>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>Texto do termo (revise e edite antes de salvar)</Label>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={recarregarSugestao}
                  disabled={!juntadaId}
                >
                  <RefreshCw className="size-3.5" /> Recarregar sugestão
                </Button>
              </div>
              <Textarea
                value={textoJuntada}
                onChange={(e) => setTextoJuntada(e.target.value)}
                disabled={!juntadaId}
                className="min-h-64 font-mono text-sm"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogo(false)}>
              Fechar
            </Button>
            <Button
              onClick={() => salvar.mutate()}
              disabled={salvar.isPending || !juntadaId || !textoJuntada.trim()}
            >
              {salvar.isPending && <Loader2 className="size-4 animate-spin" />}
              Salvar termo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
