import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSindicancias } from "@/components/SindicanciaContext";
import { EditorPeca } from "@/components/EditorPeca";
import { PECAS, gerarPeca, type PecaCampos, type PecaId } from "@/lib/pecas";

export const Route = createFileRoute("/pecas")({
  head: () => ({
    meta: [
      { title: "Gerador de Peças Jurídico-Administrativas | Sindicâncias EB" },
      {
        name: "description",
        content:
          "Gere termos, notificações, ofícios e pedidos de prorrogação nos padrões da EB10-IG-01.001 e exporte diretamente para o Google Docs.",
      },
      { property: "og:title", content: "Gerador de Peças — Sindicâncias EB" },
      {
        property: "og:description",
        content:
          "Minutas de abertura, inquirição, juntada, encerramento e prorrogação com exportação para Google Docs.",
      },
    ],
  }),
  component: Pecas,
});

const camposVazios: PecaCampos = {
  local: "",
  data: new Date().toISOString().slice(0, 10),
  hora: "",
  destinatario: "",
  qualificacao: "",
  documentos: "",
  perguntas: "",
  respostas: "",
  justificativa: "",
  prazoDias: "",
};

function Pecas() {
  const { itens, selecionada, setSelecionadaId, recarregar } = useSindicancias();
  const [peca, setPeca] = useState<PecaId>("abertura");
  const [campos, setCampos] = useState<PecaCampos>(camposVazios);
  const [texto, setTexto] = useState("");

  const gerado = useMemo(
    () => (selecionada ? gerarPeca(peca, selecionada, campos) : ""),
    [peca, selecionada, campos],
  );

  useEffect(() => setTexto(gerado), [gerado]);

  const set = (k: keyof PecaCampos, v: string) => setCampos((c) => ({ ...c, [k]: v }));
  const nome = PECAS.find((p) => p.id === peca)?.nome ?? "Peça";

  if (!selecionada) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        Cadastre uma sindicância no painel para gerar peças.
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-4 sm:p-6">
      <header className="min-w-0">
        <h1 className="font-serif text-2xl font-semibold">Gerador Dinâmico de Peças</h1>
        <p className="text-sm text-muted-foreground">
          Textos pré-formatados conforme as normas de redação oficial EB10-IG-01.001.
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <div className="painel space-y-4 p-4">
          <div className="space-y-1.5">
            <Label>Sindicância</Label>
            <Select value={selecionada.id} onValueChange={setSelecionadaId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {itens.map((i) => (
                  <SelectItem key={i.id} value={i.id}>
                    {i.nup || i.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Peça</Label>
            <Select value={peca} onValueChange={(v) => setPeca(v as PecaId)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PECAS.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <div className="space-y-1.5">
              <Label>Local</Label>
              <Input value={campos.local} onChange={(e) => set("local", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Data do ato</Label>
              <Input
                type="date"
                value={campos.data}
                onChange={(e) => set("data", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Hora</Label>
              <Input
                type="time"
                value={campos.hora}
                onChange={(e) => set("hora", e.target.value)}
              />
            </div>

            {(peca === "inquiricao" || peca === "oficio") && (
              <div className="space-y-1.5">
                <Label>Destinatário / Testemunha</Label>
                <Input
                  value={campos.destinatario}
                  onChange={(e) => set("destinatario", e.target.value)}
                />
              </div>
            )}

            {["inquiricao", "depoimento", "notificacao", "oficio"].includes(peca) && (
              <div className="space-y-1.5">
                <Label>Qualificação / Função</Label>
                <Input
                  value={campos.qualificacao}
                  onChange={(e) => set("qualificacao", e.target.value)}
                />
              </div>
            )}

            {(peca === "inquiricao" || peca === "depoimento") && (
              <>
                <div className="space-y-1.5">
                  <Label>Perguntas</Label>
                  <Textarea
                    className="min-h-28"
                    value={campos.perguntas}
                    onChange={(e) => set("perguntas", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Respostas</Label>
                  <Textarea
                    className="min-h-28"
                    value={campos.respostas}
                    onChange={(e) => set("respostas", e.target.value)}
                  />
                </div>
              </>
            )}

            {peca === "juntada" && (
              <div className="space-y-1.5">
                <Label>Documentos juntados</Label>
                <Textarea
                  className="min-h-28"
                  value={campos.documentos}
                  onChange={(e) => set("documentos", e.target.value)}
                />
              </div>
            )}

            {["oficio", "juntada", "encerramento", "prorrogacao"].includes(peca) && (
              <div className="space-y-1.5">
                <Label>Justificativa / Finalidade</Label>
                <Textarea
                  className="min-h-24"
                  value={campos.justificativa}
                  onChange={(e) => set("justificativa", e.target.value)}
                />
              </div>
            )}

            {(peca === "alegacoes" || peca === "prorrogacao") && (
              <div className="space-y-1.5">
                <Label>Prazo (dias)</Label>
                <Input
                  value={campos.prazoDias}
                  onChange={(e) => set("prazoDias", e.target.value)}
                  inputMode="numeric"
                />
              </div>
            )}
          </div>
        </div>

        <div className="painel p-4">
          <EditorPeca
            titulo={`${nome} — ${selecionada.nup || selecionada.id}`}
            conteudo={texto}
            sindicanciaId={selecionada.id}
            pecasExistentes={selecionada.documentos ?? []}
            onChange={setTexto}
            onExportado={recarregar}
          />
        </div>
      </div>
    </div>
  );
}
