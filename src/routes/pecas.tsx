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
import { EditorJuntada } from "@/components/EditorJuntada";
import { GuiaDocumento } from "@/components/GuiaDocumento";
import { PECAS, RODAPE_DIEX_OPCOES, gerarPeca, type PecaCampos, type PecaId } from "@/lib/pecas";

export const Route = createFileRoute("/pecas")({
  head: () => ({
    meta: [
      { title: "Gerador de Peças Jurídico-Administrativas | Sindicâncias EB" },
      {
        name: "description",
        content:
          "Gere termos, notificações, ofícios, DIEx e pedidos de prorrogação nos padrões da EB10-IG-01.001 e exporte diretamente para o Google Docs.",
      },
      { property: "og:title", content: "Gerador de Peças — Sindicâncias EB" },
      {
        property: "og:description",
        content:
          "Minutas de abertura, inquirição, juntada, DIEx, encerramento e prorrogação com exportação para Google Docs.",
      },
    ],
  }),
  component: Pecas,
});

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
  const [peca, setPeca] = useState<PecaId | "juntada">("abertura");
  const [campos, setCampos] = useState<PecaCampos>(camposVazios);
  const [texto, setTexto] = useState("");

  const ehJuntada = peca === "juntada";

  const gerado = useMemo(
    () => (selecionada && !ehJuntada ? gerarPeca(peca, selecionada, campos) : ""),
    [peca, ehJuntada, selecionada, campos],
  );

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
    <div className="mx-auto w-full max-w-7xl space-y-6 p-4 sm:p-6">
      <header className="min-w-0">
        <h1 className="font-serif text-2xl font-semibold">Gerador Dinâmico de Peças</h1>
        <p className="text-sm text-muted-foreground">
          Textos pré-formatados conforme as normas de redação oficial EB10-IG-01.001.
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-[240px_320px_1fr]">
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
                {PECAS.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nome}
                  </SelectItem>
                ))}
                <SelectItem value="juntada">Juntada de Documentos</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {ehJuntada ? (
            <p className="text-xs text-muted-foreground">
              Crie ou selecione uma juntada, edite o texto livre e anexe fotos/PDFs no painel ao
              lado.
            </p>
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
