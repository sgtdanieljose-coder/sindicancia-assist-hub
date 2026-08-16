import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Wand2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSindicancias } from "@/components/SindicanciaContext";
import { EditorPeca } from "@/components/EditorPeca";
import { EditorJuntada } from "@/components/EditorJuntada";
import { GuiaDocumento } from "@/components/GuiaDocumento";
import {
  PECAS,
  RODAPE_DIEX_OPCOES,
  gerarDiligenciasRealizadas,
  gerarPeca,
  gerarRelatorio,
  type PecaCampos,
  type PecaId,
  type Relatorio,
} from "@/lib/pecas";

export const Route = createFileRoute("/pecas")({
  validateSearch: (search: Record<string, unknown>): { peca?: PecaId | "juntada" } => ({
    peca:
      typeof search.peca === "string" &&
      (search.peca === "juntada" || PECAS.some((p) => p.id === search.peca))
        ? (search.peca as PecaId | "juntada")
        : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Peças e Relatório | Sindicâncias EB" },
      {
        name: "description",
        content:
          "Gere termos, notificações, ofícios, DIEx, pedidos de prorrogação e o Relatório Final do Sindicante nos padrões da EB10-IG-01.001 e EB10-IG-09.001, com exportação direta para o Google Docs.",
      },
      { property: "og:title", content: "Peças e Relatório — Sindicâncias EB" },
      {
        property: "og:description",
        content:
          "Minutas de abertura, inquirição, juntada, DIEx, encerramento, prorrogação e o Relatório do Sindicante, com exportação para Google Docs.",
      },
    ],
  }),
  component: Pecas,
});

/** As quatro partes obrigatórias do Relatório do Sindicante (EB10-IG-09.001) — mesma
 *  definição que existia em routes/relatorio.tsx, agora exibida como o formulário do
 *  item "Relatório do Sindicante" dentro deste gerador (grupo "Documento final" do
 *  seletor de peça abaixo), em vez de numa página à parte. */
const partesRelatorio: { key: keyof Relatorio; titulo: string; dica: string }[] = [
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

const relatorioVazio: Relatorio = { introducao: "", diligencias: "", analise: "", conclusao: "" };

const camposVazios: PecaCampos = {
  local: "",
  data: new Date().toISOString().slice(0, 10),
  dataInquiricao: "",
  hora: "",
  destinatario: "",
  qualificacao: "",
  destinatario2: "",
  qualificacao2: "",
  documentos: "",
  perguntas: "",
  respostas: "",
  justificativa: "",
  prazoDias: "",
  numeroOficio: "",
  numeroDiex: "",
  assunto: "",
  referencia: "",
  rodapeDiex: "recebimento",
};

// ====================================================================================
// Campos exibidos por peça no Gerador Dinâmico de Peças. Cada peça mostra SÓ os campos
// listados aqui (em vez do antigo bloco "Local/Data/Hora sempre visíveis + condicionais
// avulsas") — mais fácil de auditar e de estender. "Data da Peça" é o novo nome do antigo
// "Data do ato"; "Data da inquirição" é um campo novo, específico da data marcada para a
// oitiva (distinta da data da própria peça) — ver PecaCampos em src/lib/pecas.ts.
// ====================================================================================

type CampoTipo = "text" | "date" | "time" | "textarea" | "select-rodape-diex";

type CampoDef = {
  campo: keyof PecaCampos;
  label: string;
  tipo?: CampoTipo;
  placeholder?: string;
};

const CAMPOS_POR_PECA: Partial<Record<PecaId, CampoDef[]>> = {
  autos: [{ campo: "data", label: "Data da Peça", tipo: "date" }],

  abertura: [{ campo: "data", label: "Data da Peça", tipo: "date" }],

  "despacho-inicial": [
    { campo: "dataInquiricao", label: "Data da inquirição", tipo: "date" },
    { campo: "hora", label: "Hora", tipo: "time" },
    { campo: "data", label: "Data da Peça", tipo: "date" },
  ],

  "despacho-diversos": [
    { campo: "data", label: "Data da Peça", tipo: "date" },
    { campo: "justificativa", label: "Conteúdo do despacho", tipo: "textarea" },
  ],

  notificacao: [
    { campo: "dataInquiricao", label: "Data da inquirição", tipo: "date" },
    { campo: "hora", label: "Hora", tipo: "time" },
    { campo: "data", label: "Data da Peça", tipo: "date" },
    { campo: "qualificacao", label: "Qualificação do sindicado", tipo: "text" },
  ],

  diex: [
    {
      campo: "numeroDiex",
      label: "Número do DIEx",
      tipo: "text",
      placeholder: "Sugerido automaticamente; ajuste se necessário",
    },
    { campo: "data", label: "Data da Peça", tipo: "date" },
    {
      campo: "destinatario",
      label: "Ao (destinatário)",
      tipo: "text",
      placeholder: "Ex.: Sr Chefe da 3ª Seção",
    },
    {
      campo: "assunto",
      label: "Assunto",
      tipo: "text",
      placeholder: "Ex.: solicitação de documento",
    },
    {
      campo: "referencia",
      label: "Referência (opcional)",
      tipo: "text",
      placeholder: "Ex.: Portaria nº 66-Asse Ap As Jurd, de 14 de outubro de 2025",
    },
    {
      campo: "documentos",
      label: "Anexo(s) (opcional)",
      tipo: "text",
      placeholder: "Ex.: cópia da Portaria nº 66...",
    },
    {
      campo: "justificativa",
      label: "Corpo do DIEx (itens numerados)",
      tipo: "textarea",
      placeholder: "1. Solicito-vos...\n\n2. ...",
    },
    { campo: "rodapeDiex", label: "Rodapé", tipo: "select-rodape-diex" },
  ],

  inquiricao: [
    { campo: "local", label: "Local", tipo: "text" },
    { campo: "data", label: "Data da Peça", tipo: "date" },
    { campo: "hora", label: "Hora", tipo: "time" },
    { campo: "destinatario", label: "Destinatário / Testemunha", tipo: "text" },
    { campo: "qualificacao", label: "Qualificação / Função", tipo: "text" },
    { campo: "perguntas", label: "Perguntas", tipo: "textarea" },
    { campo: "respostas", label: "Respostas", tipo: "textarea" },
  ],

  depoimento: [
    { campo: "local", label: "Local", tipo: "text" },
    { campo: "data", label: "Data da Peça", tipo: "date" },
    { campo: "hora", label: "Hora", tipo: "time" },
    { campo: "qualificacao", label: "Qualificação / Função", tipo: "text" },
    { campo: "perguntas", label: "Perguntas", tipo: "textarea" },
    { campo: "respostas", label: "Respostas", tipo: "textarea" },
  ],

  acareacao: [
    { campo: "local", label: "Local", tipo: "text" },
    { campo: "data", label: "Data da Peça", tipo: "date" },
    { campo: "hora", label: "Hora", tipo: "time" },
    { campo: "destinatario", label: "1º Acareado (Posto/Grad e Nome)", tipo: "text" },
    { campo: "qualificacao", label: "Qualificação do 1º acareado", tipo: "text" },
    { campo: "destinatario2", label: "2º Acareado (Posto/Grad e Nome)", tipo: "text" },
    { campo: "qualificacao2", label: "Qualificação do 2º acareado", tipo: "text" },
    { campo: "perguntas", label: "Ponto de divergência", tipo: "textarea" },
    { campo: "respostas", label: "Declarações após a acareação", tipo: "textarea" },
  ],

  oficio: [
    { campo: "local", label: "Local", tipo: "text" },
    { campo: "data", label: "Data da Peça", tipo: "date" },
    { campo: "hora", label: "Hora", tipo: "time" },
    {
      campo: "numeroOficio",
      label: "Número do Ofício",
      tipo: "text",
      placeholder: "Sugerido automaticamente; ajuste se necessário",
    },
    { campo: "destinatario", label: "Destinatário / Testemunha", tipo: "text" },
    { campo: "qualificacao", label: "Qualificação / Função", tipo: "text" },
    { campo: "justificativa", label: "Justificativa / Finalidade", tipo: "textarea" },
  ],

  certidao: [
    { campo: "data", label: "Data da Peça", tipo: "date" },
    {
      campo: "justificativa",
      label: "Fato certificado",
      tipo: "textarea",
      placeholder:
        "Ex.: decorreu o prazo concedido, sem que o sindicado apresentasse defesa prévia",
    },
  ],

  encerramento: [
    { campo: "local", label: "Local", tipo: "text" },
    { campo: "data", label: "Data da Peça", tipo: "date" },
    { campo: "hora", label: "Hora", tipo: "time" },
    { campo: "justificativa", label: "Justificativa / Finalidade", tipo: "textarea" },
  ],

  alegacoes: [
    { campo: "local", label: "Local", tipo: "text" },
    { campo: "data", label: "Data da Peça", tipo: "date" },
    { campo: "hora", label: "Hora", tipo: "time" },
    { campo: "prazoDias", label: "Prazo (dias)", tipo: "text" },
  ],

  prorrogacao: [
    { campo: "local", label: "Local", tipo: "text" },
    { campo: "data", label: "Data da Peça", tipo: "date" },
    { campo: "hora", label: "Hora", tipo: "time" },
    { campo: "justificativa", label: "Justificativa / Finalidade", tipo: "textarea" },
    { campo: "prazoDias", label: "Prazo (dias)", tipo: "text" },
  ],
};

/** Aviso mostrado acima dos campos, quando a peça puxa algo automaticamente de outro
 *  lugar (hoje, só a "Seção dos Atos" cadastrada no Gestor do Processo). */
const NOTA_POR_PECA: Partial<Record<PecaId, string>> = {
  "despacho-inicial":
    'O local dos trabalhos é preenchido automaticamente com a "Seção dos Atos" cadastrada no Gestor do Processo.',
  notificacao:
    'O local dos trabalhos é preenchido automaticamente com a "Seção dos Atos" cadastrada no Gestor do Processo.',
};

function Pecas() {
  const { itens, selecionada, setSelecionadaId, recarregar } = useSindicancias();
  // Prioridade 2.5 — "Editar peça" no índice dos autos leva pra cá já com a peça certa
  // pré-selecionada, via ?peca=<id> (ver validateSearch acima e o botão em documentos.tsx).
  const buscaUrl = Route.useSearch();
  const [peca, setPeca] = useState<PecaId | "juntada">(buscaUrl.peca ?? "abertura");
  const [campos, setCampos] = useState<PecaCampos>(camposVazios);
  // Estado do Relatório do Sindicante (Documento final) — mesmos três campos que existiam
  // em routes/relatorio.tsx, só que vivendo aqui agora. Como as demais peças, não é limpo
  // ao trocar de item no seletor (mesmo comportamento de `campos` acima).
  const [rel, setRel] = useState<Relatorio>(relatorioVazio);
  const [relLocal, setRelLocal] = useState("");
  const [relData, setRelData] = useState(new Date().toISOString().slice(0, 10));
  const [texto, setTexto] = useState("");

  const ehJuntada = peca === "juntada";
  const ehRelatorio = peca === "relatorio";

  const gerado = useMemo(() => {
    if (!selecionada || ehJuntada) return "";
    return ehRelatorio
      ? gerarRelatorio(selecionada, rel, relLocal, relData)
      : gerarPeca(peca, selecionada, campos);
  }, [peca, ehJuntada, ehRelatorio, selecionada, campos, rel, relLocal, relData]);

  useEffect(() => setTexto(gerado), [gerado]);

  const set = (k: keyof PecaCampos, v: string) => setCampos((c) => ({ ...c, [k]: v }));
  const pecaAtual = !ehJuntada ? PECAS.find((p) => p.id === peca) : undefined;
  const nome = pecaAtual?.nome ?? "Peça";
  const unica = pecaAtual?.unica ?? false;
  const etapa = pecaAtual?.etapa;
  const camposDaPeca = !ehJuntada ? (CAMPOS_POR_PECA[peca] ?? []) : [];
  const nota = !ehJuntada ? NOTA_POR_PECA[peca] : undefined;

  // Sugere o próximo número de ofício com base em quantos já foram exportados nesta sindicância.
  useEffect(() => {
    if (peca !== "oficio" || !selecionada) return;
    const proximo = (selecionada.documentos ?? []).filter((d) => d.pecaId === "oficio").length + 1;
    setCampos((c) => (c.numeroOficio ? c : { ...c, numeroOficio: String(proximo) }));
  }, [peca, selecionada]);

  // Sugere o próximo número de DIEx (zero-padded a 3 dígitos, ex.: "004"), seguindo o padrão
  // observado nos DIEx reais anexados ao projeto.
  useEffect(() => {
    if (peca !== "diex" || !selecionada) return;
    const proximo = (selecionada.documentos ?? []).filter((d) => d.pecaId === "diex").length + 1;
    setCampos((c) => (c.numeroDiex ? c : { ...c, numeroDiex: String(proximo).padStart(3, "0") }));
  }, [peca, selecionada]);

  if (!selecionada) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        Cadastre uma sindicância no painel para gerar peças.
      </div>
    );
  }

  return (
    <div className="mx-auto w-full space-y-6 p-4 sm:p-6">
      <header className="min-w-0">
        <h1 className="font-serif text-2xl font-semibold">Peças e Relatório</h1>
        <p className="text-sm text-muted-foreground">
          Textos pré-formatados conforme a EB10-IG-01.001, e o Relatório Final do Sindicante
          conforme a EB10-IG-09.001 — selecione abaixo o que deseja produzir.
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <div className="flex h-fit flex-col gap-4 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto">
          <GuiaDocumento
            sindicanciaId={selecionada.id}
            documentos={selecionada.documentos ?? []}
            autosUrl={selecionada.autosUrl}
            pecaSelecionada={ehJuntada ? undefined : peca}
            onSelecionarPeca={setPeca}
          />

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
              <Select value={peca} onValueChange={(v) => setPeca(v as PecaId | "juntada")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Peças</SelectLabel>
                    {PECAS.filter((p) => p.id !== "relatorio").map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.nome}
                      </SelectItem>
                    ))}
                    <SelectItem value="juntada">Juntada de Documentos</SelectItem>
                  </SelectGroup>
                  <SelectGroup>
                    <SelectLabel>Documento final</SelectLabel>
                    <SelectItem value="relatorio">Relatório do Sindicante</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            {ehJuntada ? (
              <p className="text-xs text-muted-foreground">
                Crie ou selecione uma juntada, edite o texto livre e anexe fotos/PDFs no painel ao
                lado.
              </p>
            ) : ehRelatorio ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Local</Label>
                    <Input value={relLocal} onChange={(e) => setRelLocal(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Data</Label>
                    <Input type="date" value={relData} onChange={(e) => setRelData(e.target.value)} />
                  </div>
                </div>

                {partesRelatorio.map((p) => (
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
              </>
            ) : (
              <>
                {nota && (
                  <p className="rounded-md border border-border bg-muted/40 p-2 text-xs text-muted-foreground">
                    {nota}
                  </p>
                )}
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                  {camposDaPeca.map((def) => (
                    <CampoPeca key={def.campo} def={def} campos={campos} set={set} />
                  ))}
                  {camposDaPeca.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      Esta peça não usa campos adicionais — revise o texto ao lado.
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="painel p-4">
          {ehJuntada ? (
            <EditorJuntada sindicancia={selecionada} onAtualizado={recarregar} />
          ) : (
            <EditorPeca
              titulo={`${nome} — ${selecionada.nup || selecionada.id}`}
              conteudo={texto}
              sindicanciaId={selecionada.id}
              pecasExistentes={selecionada.documentos ?? []}
              pecaId={peca}
              unica={unica}
              etapa={etapa}
              onChange={setTexto}
              onExportado={recarregar}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function CampoPeca({
  def,
  campos,
  set,
}: {
  def: CampoDef;
  campos: PecaCampos;
  set: (k: keyof PecaCampos, v: string) => void;
}) {
  const valor = campos[def.campo];

  if (def.tipo === "select-rodape-diex") {
    return (
      <div className="space-y-1.5">
        <Label>{def.label}</Label>
        <Select value={campos.rodapeDiex} onValueChange={(v) => set("rodapeDiex", v)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {RODAPE_DIEX_OPCOES.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  if (def.tipo === "textarea") {
    return (
      <div className="space-y-1.5">
        <Label>{def.label}</Label>
        <Textarea
          className="min-h-28"
          value={valor}
          onChange={(e) => set(def.campo, e.target.value)}
          placeholder={def.placeholder}
        />
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <Label>{def.label}</Label>
      <Input
        type={def.tipo === "date" || def.tipo === "time" ? def.tipo : "text"}
        value={valor}
        onChange={(e) => set(def.campo, e.target.value)}
        placeholder={def.placeholder}
        inputMode={def.campo === "prazoDias" ? "numeric" : undefined}
      />
    </div>
  );
}
