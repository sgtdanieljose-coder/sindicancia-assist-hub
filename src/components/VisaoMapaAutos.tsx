import { Link } from "@tanstack/react-router";
import { AlertTriangle, CheckCircle2, CircleDashed, Clock, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { tipoDoItem, type DocumentoItem } from "@/lib/documentos-format";
import { PECAS, type Sindicancia } from "@/lib/pecas";

type Simbolo = "concluido" | "andamento" | "pendencia" | "vazio";

/**
 * Traduz o status de controle de uma peça (Prioridade 2.3) para o símbolo do mapa —
 * Prioridade 5. "Cancelada" vira ⚠ porque uma peça cancelada numa sindicância em andamento
 * normalmente pede uma decisão de acompanhamento (remover de vez ou substituir), não é um
 * estado final como "concluída". Esse mapeamento é uma escolha de leitura, não um dado que
 * o sistema já guardava — se não fizer sentido no seu fluxo, é só pedir para ajustar.
 */
function simboloDe(d: DocumentoItem): Simbolo {
  const status = d.status ?? "concluida";
  if (status === "concluida" || status === "juntada-aos-autos") return "concluido";
  if (status === "em-elaboracao" || status === "em-revisao") return "andamento";
  if (status === "cancelada") return "pendencia";
  return "vazio";
}

function Icone({ simbolo }: { simbolo: Simbolo }) {
  switch (simbolo) {
    case "concluido":
      return <CheckCircle2 className="size-4 shrink-0 text-green-600" />;
    case "andamento":
      return <Clock className="size-4 shrink-0 text-amber-600" />;
    case "pendencia":
      return <AlertTriangle className="size-4 shrink-0 text-destructive" />;
    case "vazio":
      return <CircleDashed className="size-4 shrink-0 text-muted-foreground" />;
  }
}

/**
 * Visão resumida e imprimível dos autos — adaptada de routes/mapa.tsx para a consolidação
 * "Autos da Sindicância" (item 2, análogo ao que foi feito com Peças e Relatório): o
 * seletor de sindicância e o cabeçalho com as ações (Validar/Finalizar/Anexos...) agora
 * vivem em routes/documentos.tsx, únicos para as duas visualizações — aqui fica só o
 * conteúdo específico do mapa. Diferença de comportamento em relação ao original: cada
 * peça já lançada abre o mesmo painel de ações rápidas da Lista (ver DetalhePecaDialog, via
 * onAbrirPeca) em vez de ser só texto estático, e cada peça "não iniciada" agora linka
 * direto para o gerador — o mapa vira também um atalho de navegação, não só um checklist.
 */
export function VisaoMapaAutos({
  sindicancia,
  onAbrirPeca,
}: {
  sindicancia: Sindicancia;
  onAbrirPeca: (documentId: string) => void;
}) {
  const documentos = sindicancia.documentos ?? [];

  // Peças "únicas" do catálogo (esperadas uma vez por sindicância) que ainda não têm
  // nenhum documento correspondente nos autos — mostradas como ○ não iniciada, para o mapa
  // refletir o processo completo esperado, não só o que já foi lançado.
  const naoIniciadas = PECAS.filter((p) => p.unica && !documentos.some((d) => d.pecaId === p.id));

  const contagem = {
    concluido: documentos.filter((d) => simboloDe(d) === "concluido").length,
    andamento: documentos.filter((d) => simboloDe(d) === "andamento").length,
    pendencia: documentos.filter((d) => simboloDe(d) === "pendencia").length,
    vazio: naoIniciadas.length,
  };

  return (
    <div className="space-y-4 print:max-w-full print:space-y-2">
      <div className="flex justify-end print:hidden">
        <Button variant="outline" size="sm" onClick={() => window.print()}>
          <Printer className="size-4" /> Imprimir
        </Button>
      </div>

      <div className="hidden print:block">
        <p className="rotulo">Mapa dos Autos</p>
        <h2 className="font-serif text-xl font-semibold">
          NUP {sindicancia.nup || "—"}
          {sindicancia.sindicado ? ` — ${sindicancia.sindicado}` : ""}
        </h2>
      </div>

      <div className="painel flex flex-wrap gap-x-5 gap-y-1.5 p-3 text-sm print:hidden">
        <span className="inline-flex items-center gap-1.5">
          <CheckCircle2 className="size-4 text-green-600" /> {contagem.concluido} concluída
          {contagem.concluido === 1 ? "" : "s"}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Clock className="size-4 text-amber-600" /> {contagem.andamento} em andamento
        </span>
        <span className="inline-flex items-center gap-1.5">
          <AlertTriangle className="size-4 text-destructive" /> {contagem.pendencia} com pendência
        </span>
        <span className="inline-flex items-center gap-1.5">
          <CircleDashed className="size-4 text-muted-foreground" /> {contagem.vazio} não iniciada
          {contagem.vazio === 1 ? "" : "s"}
        </span>
      </div>

      <ol className="painel divide-y divide-border p-1 print:divide-black/20 print:border print:border-black/30 print:p-0">
        {documentos.map((d, i) => (
          <li key={d.documentId}>
            <button
              type="button"
              onClick={() => onAbrirPeca(d.documentId)}
              className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-muted/40 print:hover:bg-transparent"
            >
              <Icone simbolo={simboloDe(d)} />
              <span className="w-9 shrink-0 text-sm text-muted-foreground">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">{d.titulo}</p>
                <p className="text-[11px] text-muted-foreground">
                  {tipoDoItem(d)} · Fls. {i + 1}
                </p>
              </div>
            </button>
          </li>
        ))}
        {naoIniciadas.map((p) => (
          <li key={p.id}>
            <Link
              to="/pecas"
              search={{ peca: p.id }}
              className="flex items-center gap-3 px-3 py-2 opacity-70 hover:bg-muted/40 hover:opacity-100 print:hover:bg-transparent"
            >
              <Icone simbolo="vazio" />
              <span className="w-9 shrink-0 text-sm text-muted-foreground">—</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">{p.nome}</p>
                <p className="text-[11px] text-muted-foreground print:hidden">
                  Ainda não iniciada — clique para gerar
                </p>
                <p className="hidden text-[11px] text-muted-foreground print:block">
                  Ainda não iniciada
                </p>
              </div>
            </Link>
          </li>
        ))}
        {documentos.length === 0 && naoIniciadas.length === 0 && (
          <li className="p-4 text-sm text-muted-foreground">Nenhuma peça cadastrada ainda.</li>
        )}
      </ol>
    </div>
  );
}
