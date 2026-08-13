import { useState, type DragEvent } from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, ExternalLink, Loader2, Paperclip, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { adicionarAnexo } from "@/lib/sindicancias.functions";
import type { AnexoJuntada } from "@/lib/pecas";

type StatusEnvio = "aguardando" | "enviando" | "enviado" | "erro";

type ArquivoPendente = {
  id: string;
  file: File;
  descricao: string;
  status: StatusEnvio;
  erro?: string;
};

type Props = {
  sindicanciaId: string;
  juntadaId: string;
  /** Anexos já enviados desta juntada — mostrados com metadados (Prioridade 4.3). */
  anexosExistentes: AnexoJuntada[];
  disabled?: boolean;
  /** Chamado depois de CADA arquivo enviado com sucesso (não só no fim do lote), para o
   *  chamador recarregar a sindicância e enfileirar a sincronização dos autos. */
  onEnviado?: () => void;
};

function formatarTamanho(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatarData(iso?: string): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("pt-BR");
  } catch {
    return "—";
  }
}

function BadgeStatusEnvio({ status, erro }: { status: StatusEnvio; erro?: string }) {
  const mapa: Record<StatusEnvio, { texto: string; className: string }> = {
    aguardando: { texto: "🟡 Aguardando", className: "text-amber-600" },
    enviando: { texto: "🔄 Enviando...", className: "text-muted-foreground" },
    enviado: { texto: "🟢 Enviado", className: "text-green-600" },
    erro: { texto: "🔴 Erro", className: "text-destructive" },
  };
  const info = mapa[status];
  return (
    <span className={`shrink-0 text-[11px] ${info.className}`} title={erro}>
      {info.texto}
    </span>
  );
}

/**
 * Seleção e envio de múltiplos anexos — Prioridade 4.1 (seleção múltipla, arrastar,
 * listar/renomear/remover/ordenar antes de enviar) e 4.3 (status por arquivo). O envio em
 * si (Prioridade 4.2) manda o arquivo como FormData/multipart direto — sem passar por
 * FileReader→base64 no navegador, que é o gargalo de memória/tráfego em arquivos grandes.
 *
 * O envio é sequencial (um arquivo de cada vez, com retry curto em caso de falha) em vez de
 * paralelo, na mesma linha da Prioridade 1: evita rajadas de chamadas simultâneas ao Google.
 */
export function SeletorAnexos({
  sindicanciaId,
  juntadaId,
  anexosExistentes,
  disabled,
  onEnviado,
}: Props) {
  const [pendentes, setPendentes] = useState<ArquivoPendente[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [arrastando, setArrastando] = useState(false);

  function adicionarArquivos(lista: FileList | File[]) {
    const novos: ArquivoPendente[] = Array.from(lista).map((file) => ({
      id: `PEND-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      file,
      descricao: file.name,
      status: "aguardando",
    }));
    setPendentes((atual) => [...atual, ...novos]);
  }

  function remover(id: string) {
    setPendentes((atual) => atual.filter((p) => p.id !== id));
  }

  function renomear(id: string, descricao: string) {
    setPendentes((atual) => atual.map((p) => (p.id === id ? { ...p, descricao } : p)));
  }

  function mover(indice: number, direcao: -1 | 1) {
    setPendentes((atual) => {
      const alvo = indice + direcao;
      if (alvo < 0 || alvo >= atual.length) return atual;
      const nova = [...atual];
      [nova[indice], nova[alvo]] = [nova[alvo], nova[indice]];
      return nova;
    });
  }

  async function enviarUm(p: ArquivoPendente) {
    const MAX_TENTATIVAS = 3;
    for (let tentativa = 1; tentativa <= MAX_TENTATIVAS; tentativa++) {
      setPendentes((atual) =>
        atual.map((x) => (x.id === p.id ? { ...x, status: "enviando", erro: undefined } : x)),
      );
      try {
        const formData = new FormData();
        formData.append("sindicanciaId", sindicanciaId);
        formData.append("juntadaId", juntadaId);
        formData.append("descricao", p.descricao || p.file.name);
        formData.append("arquivo", p.file, p.file.name);
        await adicionarAnexo({ data: formData });
        setPendentes((atual) =>
          atual.map((x) => (x.id === p.id ? { ...x, status: "enviado" } : x)),
        );
        onEnviado?.();
        return;
      } catch (e) {
        if (tentativa === MAX_TENTATIVAS) {
          const msg = e instanceof Error ? e.message : "Falha ao enviar.";
          setPendentes((atual) =>
            atual.map((x) => (x.id === p.id ? { ...x, status: "erro", erro: msg } : x)),
          );
          return;
        }
        // Retry curto com backoff — os anexos são enviados um a um, então uma falha de
        // rede passageira não deve exigir que o usuário refaça tudo manualmente.
        await new Promise((r) => setTimeout(r, 1500 * tentativa));
      }
    }
  }

  async function enviarTodos() {
    if (!juntadaId) {
      toast.error("Selecione ou crie uma juntada primeiro.");
      return;
    }
    setEnviando(true);
    const fila = pendentes.filter((p) => p.status === "aguardando" || p.status === "erro");
    for (const p of fila) {
      await enviarUm(p);
    }
    setEnviando(false);
  }

  function limparEnviados() {
    setPendentes((atual) => atual.filter((p) => p.status !== "enviado"));
  }

  const pendentesParaEnviar = pendentes.filter(
    (p) => p.status === "aguardando" || p.status === "erro",
  ).length;

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e: DragEvent) => {
          e.preventDefault();
          setArrastando(true);
        }}
        onDragLeave={() => setArrastando(false)}
        onDrop={(e: DragEvent) => {
          e.preventDefault();
          setArrastando(false);
          if (e.dataTransfer.files?.length) adicionarArquivos(e.dataTransfer.files);
        }}
        className={`rounded-md border-2 border-dashed p-4 text-center text-sm transition-colors ${
          arrastando ? "border-primary bg-primary/5" : "border-border"
        }`}
      >
        <p className="text-muted-foreground">Arraste arquivos aqui ou</p>
        <label className="mt-1 inline-flex cursor-pointer items-center gap-1 text-sm text-primary hover:underline">
          <Upload className="size-4" /> escolher arquivos
          <input
            type="file"
            multiple
            accept="image/*,application/pdf"
            className="hidden"
            disabled={disabled}
            onChange={(e) => {
              if (e.target.files?.length) adicionarArquivos(e.target.files);
              e.target.value = "";
            }}
          />
        </label>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Fotos ficam incorporadas no documento da juntada; PDFs viram um link clicável.
        </p>
      </div>

      {pendentes.length > 0 && (
        <ul className="divide-y divide-border rounded-md border border-border">
          {pendentes.map((p, i) => (
            <li key={p.id} className="flex flex-wrap items-center gap-2 p-2">
              <span className="flex shrink-0 flex-col text-muted-foreground">
                <button
                  type="button"
                  onClick={() => mover(i, -1)}
                  disabled={i === 0}
                  className="disabled:opacity-30"
                  title="Mover para cima"
                >
                  <ArrowUp className="size-3" />
                </button>
                <button
                  type="button"
                  onClick={() => mover(i, 1)}
                  disabled={i === pendentes.length - 1}
                  className="disabled:opacity-30"
                  title="Mover para baixo"
                >
                  <ArrowDown className="size-3" />
                </button>
              </span>
              <div className="min-w-0 flex-1">
                <Input
                  value={p.descricao}
                  onChange={(e) => renomear(p.id, e.target.value)}
                  disabled={p.status === "enviando" || p.status === "enviado"}
                  className="h-7 text-xs"
                />
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {formatarTamanho(p.file.size)} · {p.file.type || "tipo desconhecido"}
                </p>
              </div>
              <BadgeStatusEnvio status={p.status} erro={p.erro} />
              {p.status !== "enviando" && (
                <button
                  type="button"
                  onClick={() => remover(p.id)}
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                  title="Remover da lista"
                >
                  <X className="size-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="secondary"
          onClick={() => void enviarTodos()}
          disabled={disabled || enviando || pendentesParaEnviar === 0}
        >
          {enviando ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Paperclip className="size-4" />
          )}
          Enviar {pendentesParaEnviar > 0 ? `${pendentesParaEnviar} ` : ""}anexo
          {pendentesParaEnviar === 1 ? "" : "s"}
        </Button>
        {pendentes.some((p) => p.status === "enviado") && (
          <Button variant="ghost" size="sm" onClick={limparEnviados}>
            Limpar enviados da lista
          </Button>
        )}
      </div>

      {anexosExistentes.length > 0 && (
        <ul className="space-y-1 border-t border-border pt-2">
          {anexosExistentes.map((a) => (
            <li key={a.fileId ?? a.id} className="flex flex-wrap items-center gap-2 text-sm">
              {a.url ? (
                <a
                  href={a.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-w-0 flex-1 items-center gap-1 truncate text-muted-foreground hover:text-primary"
                >
                  <ExternalLink className="size-3.5 shrink-0" />
                  <span className="truncate">{a.descricao || a.nomeArquivo}</span>
                </a>
              ) : (
                <span className="min-w-0 flex-1 truncate text-muted-foreground">{a.descricao}</span>
              )}
              <span className="shrink-0 text-[11px] text-muted-foreground">
                {a.tamanho !== undefined ? formatarTamanho(a.tamanho) : "—"} ·{" "}
                {a.mimeType ?? "tipo desconhecido"} · enviado em {formatarData(a.criadoEm)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
