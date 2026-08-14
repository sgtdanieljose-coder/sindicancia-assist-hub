import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, CheckCircle2, CircleDashed, Clock, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSindicancias } from "@/components/SindicanciaContext";
import { tipoDoItem, type DocumentoItem } from "@/lib/documentos-format";
import { PECAS } from "@/lib/pecas";

export const Route = createFileRoute("/mapa")({
  head: () => ({
    meta: [
      { title: "Mapa dos Autos | Sindicâncias EB" },
      {
        name: "description",
        content:
          "Visão resumida de todo o processo: cada peça dos autos com um indicador visual de status, pronta para consulta rápida ou impressão.",
      },
      { property: "og:title", content: "Mapa dos Autos — Sindicâncias EB" },
      {
        property: "og:description",
        content: "Checklist visual das peças da sindicância, da abertura ao relatório final.",
      },
    ],
  }),
  component: MapaAutos,
});

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

function MapaAutos() {
  const { itens, selecionada, setSelecionadaId } = useSindicancias();
  const documentos = selecionada?.documentos ?? [];

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
    <div className="mx-auto w-full max-w-3xl space-y-6 p-4 sm:p-6 print:max-w-full print:p-0">
      <header className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="min-w-0">
          <h1 className="font-serif text-2xl font-semibold">Mapa dos Autos</h1>
          <p className="text-sm text-muted-foreground">
            Visão resumida de todo o processo — consulta rápida, sem entrar em cada peça.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => window.print()} disabled={!selecionada}>
          <Printer className="size-4" /> Imprimir
        </Button>
      </header>

      <div className="hidden print:block">
        <p className="rotulo">Mapa dos Autos</p>
        <h1 className="font-serif text-xl font-semibold">
          NUP {selecionada?.nup || "—"}
          {selecionada?.sindicado ? ` — ${selecionada.sindicado}` : ""}
        </h1>
      </div>

      {itens.length > 1 && (
        <div className="flex flex-wrap gap-2 print:hidden">
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

      {selecionada && (
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
      )}

      <ol className="painel divide-y divide-border p-1 print:divide-black/20 print:border print:border-black/30 print:p-0">
        {documentos.map((d, i) => (
          <li key={d.documentId} className="flex items-center gap-3 px-3 py-2">
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
          </li>
        ))}
        {naoIniciadas.map((p) => (
          <li key={p.id} className="flex items-center gap-3 px-3 py-2 opacity-70">
            <Icone simbolo="vazio" />
            <span className="w-9 shrink-0 text-sm text-muted-foreground">—</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm">{p.nome}</p>
              <p className="text-[11px] text-muted-foreground">Ainda não iniciada</p>
            </div>
          </li>
        ))}
        {documentos.length === 0 && naoIniciadas.length === 0 && (
          <li className="p-4 text-sm text-muted-foreground">
            {selecionada ? "Nenhuma peça cadastrada ainda." : "Selecione uma sindicância."}
          </li>
        )}
      </ol>
    </div>
  );
}
