import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { DadoSindicado, Sindicancia } from "./pecas";

// ---------------------------------------------------------------------------
// Etapa 1 da migração do banco (Sheets -> Supabase). Este arquivo é o
// equivalente, para o Supabase, da parte de leitura/escrita de dados que hoje
// vive em google.server.ts (readRows/appendRow/updateRow e os mesmos para
// Dados_Sindicado). Docs e Drive continuam em google.server.ts, sem mudança —
// aqui só entra o que era "linha de planilha".
// ---------------------------------------------------------------------------

let cliente: SupabaseClient | null = null;

function obterCliente(): SupabaseClient {
  if (cliente) return cliente;
  const url = process.env.SUPA_API_URL;
  const chave = process.env.SUPA_API_KEY;
  if (!url || !chave) {
    throw new Error(
      "Supabase indisponível: defina SUPA_API_URL e SUPA_API_KEY nas variáveis de ambiente do projeto.",
    );
  }
  // secret key (sb_secret_...), equivalente à service_role: só usada aqui, no
  // servidor — nunca é enviada ao navegador.
  cliente = createClient(url, chave, { auth: { persistSession: false } });
  return cliente;
}

// ====================================================================================
// Tabela "sindicancias" — equivalente à aba Sindicancias.
// ====================================================================================

type LinhaSindicancia = {
  id: string;
  nup: string;
  portaria_numero: string;
  portaria_data: string;
  om: string;
  autoridade: string;
  sindicante: string;
  sindicado: string;
  objeto: string;
  status: string;
  etapas: string[];
  documentos: Sindicancia["documentos"];
  atualizado_em: string;
  pasta_id: string | null;
  pasta_url: string | null;
  anexos_id: string | null;
  anexos_url: string | null;
  local: string;
  subordinacao: string;
  om_instauradora: string;
  autos_doc_id: string | null;
  autos_url: string | null;
  juntadas: Sindicancia["juntadas"];
  prazo_prorrogado_dias: number;
  local_trabalhos: string;
  tags: string[];
  autos_finais: Sindicancia["autosFinais"];
};

function linhaParaSindicancia(l: LinhaSindicancia): Sindicancia {
  return {
    id: l.id,
    nup: l.nup,
    portariaNumero: l.portaria_numero,
    portariaData: l.portaria_data,
    om: l.om,
    autoridade: l.autoridade,
    sindicante: l.sindicante,
    sindicado: l.sindicado,
    objeto: l.objeto,
    status: l.status,
    etapas: l.etapas ?? [],
    documentos: l.documentos ?? [],
    atualizadoEm: l.atualizado_em,
    pastaId: l.pasta_id ?? undefined,
    pastaUrl: l.pasta_url ?? undefined,
    anexosId: l.anexos_id ?? undefined,
    anexosUrl: l.anexos_url ?? undefined,
    local: l.local,
    subordinacao: l.subordinacao,
    omInstauradora: l.om_instauradora,
    autosDocId: l.autos_doc_id ?? undefined,
    autosUrl: l.autos_url ?? undefined,
    juntadas: l.juntadas ?? [],
    prazoProrrogadoDias: l.prazo_prorrogado_dias ?? 0,
    localTrabalhos: l.local_trabalhos,
    tags: l.tags ?? [],
    autosFinais: l.autos_finais ?? [],
  };
}

function sindicanciaParaLinha(s: Sindicancia): Omit<LinhaSindicancia, "atualizado_em"> {
  return {
    id: s.id,
    nup: s.nup,
    portaria_numero: s.portariaNumero,
    portaria_data: s.portariaData,
    om: s.om,
    autoridade: s.autoridade,
    sindicante: s.sindicante,
    sindicado: s.sindicado,
    objeto: s.objeto,
    status: s.status,
    etapas: s.etapas ?? [],
    documentos: s.documentos ?? [],
    pasta_id: s.pastaId ?? null,
    pasta_url: s.pastaUrl ?? null,
    anexos_id: s.anexosId ?? null,
    anexos_url: s.anexosUrl ?? null,
    local: s.local,
    subordinacao: s.subordinacao,
    om_instauradora: s.omInstauradora,
    autos_doc_id: s.autosDocId ?? null,
    autos_url: s.autosUrl ?? null,
    juntadas: s.juntadas ?? [],
    prazo_prorrogado_dias: s.prazoProrrogadoDias ?? 0,
    local_trabalhos: s.localTrabalhos,
    tags: s.tags ?? [],
    autos_finais: s.autosFinais ?? [],
  };
}

export async function listarSindicanciasDb(): Promise<Sindicancia[]> {
  const { data, error } = await obterCliente()
    .from("sindicancias")
    .select("*")
    .order("atualizado_em", { ascending: false });
  if (error) throw new Error(`Supabase (listar sindicâncias): ${error.message}`);
  return (data as LinhaSindicancia[]).map(linhaParaSindicancia);
}

export async function carregarSindicanciaDb(id: string): Promise<Sindicancia> {
  const { data, error } = await obterCliente()
    .from("sindicancias")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Supabase (carregar sindicância): ${error.message}`);
  if (!data) throw new Error("Sindicância não localizada.");
  return linhaParaSindicancia(data as LinhaSindicancia);
}

/** Upsert por id — cria se não existir, atualiza se existir. Substitui o par
 *  appendRow/updateRow do Sheets, e o "achar a linha antes de gravar". */
export async function salvarSindicanciaDb(registro: Sindicancia): Promise<Sindicancia> {
  const linha = { ...sindicanciaParaLinha(registro), atualizado_em: new Date().toISOString() };
  const { data, error } = await obterCliente()
    .from("sindicancias")
    .upsert(linha, { onConflict: "id" })
    .select()
    .single();
  if (error) throw new Error(`Supabase (salvar sindicância): ${error.message}`);
  return linhaParaSindicancia(data as LinhaSindicancia);
}

// ====================================================================================
// Tabela "sindicados" — equivalente à aba Dados_Sindicado. Agora com id próprio
// (uuid) em vez de endereçamento por posição de linha ("linha").
// ====================================================================================

type LinhaSindicado = {
  id: string;
  sindicancia_id: string;
  civil: string;
  idt: string;
  cpf: string;
  nascimento: string;
  naturalidade: string;
  estado_civil: string;
  filiacao: string;
  mae: string;
  endereco_completo: string;
  companhia: string;
  vocativo: string;
};

function linhaParaSindicado(l: LinhaSindicado): DadoSindicado & { id: string } {
  return {
    id: l.id,
    sindicanciaId: l.sindicancia_id,
    civil: (l.civil as DadoSindicado["civil"]) || "",
    idt: l.idt,
    cpf: l.cpf,
    nascimento: l.nascimento,
    naturalidade: l.naturalidade,
    estadoCivil: l.estado_civil,
    filiacao: l.filiacao,
    mae: l.mae,
    enderecoCompleto: l.endereco_completo,
    companhia: l.companhia,
    vocativo: l.vocativo,
  };
}

export async function listarSindicadosDb(
  sindicanciaId: string,
): Promise<(DadoSindicado & { id: string })[]> {
  const { data, error } = await obterCliente()
    .from("sindicados")
    .select("*")
    .eq("sindicancia_id", sindicanciaId)
    .order("criado_em", { ascending: true });
  if (error) throw new Error(`Supabase (listar sindicados): ${error.message}`);
  return (data as LinhaSindicado[]).map(linhaParaSindicado);
}

/** Cria (sem `id`) ou atualiza (com `id`) um sindicado. */
export async function salvarSindicadoDb(
  dado: DadoSindicado & { id?: string },
): Promise<DadoSindicado & { id: string }> {
  const linha = {
    sindicancia_id: dado.sindicanciaId,
    civil: dado.civil,
    idt: dado.idt,
    cpf: dado.cpf,
    nascimento: dado.nascimento,
    naturalidade: dado.naturalidade,
    estado_civil: dado.estadoCivil,
    filiacao: dado.filiacao,
    mae: dado.mae,
    endereco_completo: dado.enderecoCompleto,
    companhia: dado.companhia,
    vocativo: dado.vocativo,
  };

  if (dado.id) {
    const { data, error } = await obterCliente()
      .from("sindicados")
      .update(linha)
      .eq("id", dado.id)
      .select()
      .single();
    if (error) throw new Error(`Supabase (atualizar sindicado): ${error.message}`);
    return linhaParaSindicado(data as LinhaSindicado);
  }

  const { data, error } = await obterCliente().from("sindicados").insert(linha).select().single();
  if (error) throw new Error(`Supabase (criar sindicado): ${error.message}`);
  return linhaParaSindicado(data as LinhaSindicado);
}

export async function removerSindicadoDb(id: string): Promise<void> {
  const { error } = await obterCliente().from("sindicados").delete().eq("id", id);
  if (error) throw new Error(`Supabase (remover sindicado): ${error.message}`);
}
