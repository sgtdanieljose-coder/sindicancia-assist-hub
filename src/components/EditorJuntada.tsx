import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { ExternalLink, Loader2, Paperclip, Plus, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { adicionarAnexo, criarJuntada, salvarJuntada } from "@/lib/sindicancias.functions";
import { textoEfetivoJuntada, type Sindicancia } from "@/lib/pecas";
import { useSyncQueue } from "@/hooks/useSyncQueue";

function lerArquivo(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(new Error("Falha ao ler o arquivo."));
    reader.readAsDataURL(file);
  });
}

/**
 * Gerencia as juntadas de uma sindicância dentro do Gerador Dinâmico de Peças —
 * adapta o que já existia em routes/documentos.tsx (criar juntada + anexar
 * arquivo), acrescentando uma área de texto livre para editar os itens juntados
 * (em vez de só a lista automática numerada). Ver textoEfetivoJuntada em
 * pecas.ts: assim que o usuário digita algo aqui, esse texto passa a valer no
 * documento da juntada em vez da lista automática — apagar o campo volta a
 * gerar a lista automaticamente a partir dos anexos.
 */
export function EditorJuntada({
  sindicancia,
  onAtualizado,
}: {
  sindicancia: Sindicancia;
  onAtualizado: () => void;
}) {
  const juntadas = sindicancia.juntadas ?? [];
  const [juntadaId, setJuntadaId] = useState(juntadas[0]?.id ?? "");
  const [novoTitulo, setNovoTitulo] = useState("");
  const [dataJuntada, setDataJuntada] = useState(new Date().toISOString().slice(0, 10));
  const [texto, setTexto] = useState("");
  const [arquivo, setArquivo] = useState<File | null>(null);

  const juntadaAtual = juntadas.find((j) => j.id === juntadaId);

  // Prioridade 1.7: criar/salvar juntada e enviar anexo já não reconstroem o documento
  // único dos autos por dentro (ver sincronizarDocumentoJuntada em
  // sindicancias.functions.ts) — cada ação bem-sucedida abaixo enfileira essa reconstrução
  // à parte (dedupe automático: várias ações em sequência viram 1 única sincronização).
  const { enfileirarSincronizarAutos } = useSyncQueue();

  // Sempre que a juntada selecionada mudar (ou for atualizada por fora — novo anexo,
  // por exemplo), sincroniza os campos locais com o estado mais recente dela.
  useEffect(() => {
    if (!juntadaAtual) return;
    setDataJuntada(juntadaAtual.data);
    setTexto(textoEfetivoJuntada(sindicancia, juntadaAtual));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [juntadaAtual?.id, juntadaAtual?.textoEditado, juntadaAtual?.anexos.length]);

  const criar = useMutation({
    mutationFn: () =>
      criarJuntada({
        data: { sindicanciaId: sindicancia.id, titulo: novoTitulo, data: dataJuntada },
      }),
    onSuccess: (j) => {
      setJuntadaId(j.id);
      setNovoTitulo("");
      toast.success(`Juntada nº ${j.numero} criada`);
      enfileirarSincronizarAutos({ sindicanciaId: sindicancia.id });
      onAtualizado();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const salvar = useMutation({
    mutationFn: () =>
      salvarJuntada({
        data: {
          sindicanciaId: sindicancia.id,
          juntadaId,
          data: dataJuntada,
          textoEditado: texto,
        },
      }),
    onSuccess: () => {
      toast.success("Juntada salva — autos pendentes de sincronizar");
      enfileirarSincronizarAutos({ sindicanciaId: sindicancia.id });
      onAtualizado();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const enviar = useMutation({
    mutationFn: async () => {
      if (!arquivo) throw new Error("Selecione um arquivo.");
      if (!juntadaId) throw new Error("Selecione ou crie uma juntada primeiro.");
      const base64 = await lerArquivo(arquivo);
      return adicionarAnexo({
        data: {
          sindicanciaId: sindicancia.id,
          juntadaId,
          nome: arquivo.name,
          mimeType: arquivo.type || "application/octet-stream",
          base64,
        },
      });
    },
    onSuccess: () => {
      toast.success("Anexo enviado — autos pendentes de sincronizar");
      setArquivo(null);
      enfileirarSincronizarAutos({ sindicanciaId: sindicancia.id });
      onAtualizado();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      {juntadas.length > 0 && (
        <div className="space-y-1.5">
          <Label>Juntada</Label>
          <Select value={juntadaId} onValueChange={setJuntadaId}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione uma juntada" />
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
      )}

      <div className="space-y-1.5">
        <Label>Nova juntada</Label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            value={novoTitulo}
            onChange={(e) => setNovoTitulo(e.target.value)}
            placeholder="Ex.: Juntada de documentos do sindicado"
            className="flex-1"
          />
          <Button
            variant="secondary"
            onClick={() => criar.mutate()}
            disabled={criar.isPending}
            className="shrink-0"
          >
            {criar.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Plus className="size-4" />
            )}
            Criar juntada
          </Button>
        </div>
      </div>

      {juntadaAtual ? (
        <>
          <div className="space-y-1.5">
            <Label>Data da Peça</Label>
            <Input
              type="date"
              value={dataJuntada}
              onChange={(e) => setDataJuntada(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Texto da juntada (edição livre dos itens juntados aos autos)</Label>
            <Textarea
              className="min-h-56 font-mono text-[13px] leading-relaxed"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              spellCheck={false}
            />
            <p className="text-xs text-muted-foreground">
              Pré-preenchido com a lista automática dos anexos já enviados; edite à vontade — o
              texto digitado aqui passa a valer no documento da juntada em vez da lista automática.
              Apague tudo para voltar a gerar a lista automaticamente.
            </p>
          </div>

          <Button onClick={() => salvar.mutate()} disabled={salvar.isPending}>
            {salvar.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            Salvar juntada e atualizar autos
          </Button>

          <div className="space-y-2 border-t border-border pt-4">
            <Label>Adicionar imagem ou PDF aos autos</Label>
            <Input
              type="file"
              accept="image/*,application/pdf"
              onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
            />
            <p className="text-xs text-muted-foreground">
              Fotos ficam incorporadas no documento da juntada; PDFs viram um link clicável.
            </p>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => enviar.mutate()}
              disabled={enviar.isPending || !arquivo}
            >
              {enviar.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Paperclip className="size-4" />
              )}
              Enviar anexo
            </Button>

            {juntadaAtual.anexos.length > 0 && (
              <ul className="space-y-0.5 pt-1">
                {juntadaAtual.anexos.map((a) => (
                  <li key={a.fileId ?? a.id} className="truncate text-sm text-muted-foreground">
                    {a.url ? (
                      <a
                        href={a.url}
                        target="_blank"
                        rel="noreferrer"
                        className="hover:text-primary"
                      >
                        {a.descricao || a.nomeArquivo}
                      </a>
                    ) : (
                      a.descricao
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {juntadaAtual.url && (
            <a
              href={juntadaAtual.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
            >
              Abrir peça no Google Docs <ExternalLink className="size-3.5" />
            </a>
          )}
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          Nenhuma juntada criada ainda — use o campo acima para criar a primeira.
        </p>
      )}
    </div>
  );
}
