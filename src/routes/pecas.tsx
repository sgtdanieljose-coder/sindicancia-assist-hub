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
    { campo: "local",
