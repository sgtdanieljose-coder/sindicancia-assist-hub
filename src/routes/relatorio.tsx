import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Wand2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useSindicancias } from "@/components/SindicanciaContext";
import { EditorPeca } from "@/components/EditorPeca";
import { gerarDiligenciasRealizadas, gerarRelatorio, type Relatorio } from "@/lib/pecas";

export const Route = createFileRoute("/relatorio")({
  head: () => ({
    meta: [
      { title: "Relatório do Sindicante | Estruturação em 4 Partes" },
      {
        name: "description",
        content:
          "Assistente para montagem do Relatório Final do Sindicante: introdução, diligências realizadas, análise dos fatos e conclusão, com exportação para Google Docs.",
      },
      { property: "og:title", content: "Relatório do Sindicante — Sindicâncias EB" },
      {
        property: "og:description",
        content:
          "Monte o relatório final nas quatro partes obrigatórias e exporte para o Google Docs.",
      },
    ],
  }),
  component: RelatorioPage,
});

const partes: { key: keyof Relatorio; titulo: string; dica: string }[] = [
  {
    key: "introducao",
    titulo: "1. INTRODUÇÃO",
    dica: "Portaria de instauração, autoridade, objeto e designação do encarregado.",
  },
  {
    key: "diligencias",
    titulo: "2. DILIGÊNCIAS REALIZADAS",
    dica: 'Relação cronológica dos atos (padrão do Anexo W da EB10-IG-09.001); use "Preencher com diligências" para montar a lista a partir dos despachos, DIEx/ofícios e juntadas já exportados, e ajuste o texto conforme necessário.',
  },
  {
    key: "analise",
    titulo: "3. ANÁLISE DOS FATOS",
    dica: "Confronto das provas, enquadramento regulamentar e apreciação da conduta.",
  },
  {
    key: "conclusao",
    titulo: "4. CONCLUSÃO",
    dica: "Resposta objetiva ao objeto, autoria/materialidade e sugestões à autoridade.",
  },
];

function RelatorioPage() {
  const { selecionada, recarregar } = useSindicancias();
  const [rel, setRel] = useState<Relatorio>({
    introducao: "",
    diligencias: "",
    analise: "",
    conclusao: "",
  });
  const [local, setLocal] = useState("");
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [texto, setTexto] = useState("");

  const gerado = useMemo(
    () => (selecionada ? gerarRelatorio(selecionada, rel, local, data) : ""),
    [selecionada, rel, local, data],
  );

  useEffect(() => setTexto(gerado), [gerado]);

  if (!selecionada) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        Cadastre uma sindicância no painel para montar o relatório.
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-4 sm:p-6">
      <header className="min-w-0">
        <h1 className="font-serif text-2xl font-semibold">Relatório do Sindicante</h1>
        <p className="text-sm text-muted-foreground">
          Estrutura obrigatória em quatro partes, conforme a EB10-IG-09.001.
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,420px)_1fr]">
        <div className="painel space-y-4 p-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Local</Label>
              <Input value={local} onChange={(e) => setLocal(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Data</Label>
              <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
            </div>
          </div>

          {partes.map((p) => (
            <div key={p.key} className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <Label>{p.titulo}</Label>
                {p.key === "diligencias" && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 gap-1.5 text-xs"
                    onClick={() =>
                      setRel((r) => ({
                        ...r,
                        diligencias: gerarDiligenciasRealizadas(selecionada),
                      }))
                    }
                  >
                    <Wand2 className="size-3.5" />
                    Preencher com diligências
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">{p.dica}</p>
              <Textarea
                className="min-h-32"
                value={rel[p.key]}
                onChange={(e) => setRel((r) => ({ ...r, [p.key]: e.target.value }))}
              />
            </div>
          ))}
        </div>

        <div className="painel p-4">
          <EditorPeca
            titulo={`Relatório do Sindicante — ${selecionada.nup || selecionada.id}`}
            conteudo={texto}
            sindicanciaId={selecionada.id}
            pecasExistentes={selecionada.documentos ?? []}
            pecaId="relatorio"
            unica
            etapa="Relatório do Sindicante"
            onChange={setTexto}
            onExportado={recarregar}
          />
        </div>
      </div>
    </div>
  );
}
