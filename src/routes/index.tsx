import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertTriangle,
  CalendarClock,
  ChevronDown,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useSindicancias } from "@/components/SindicanciaContext";
import { ListaItensValidacao } from "@/components/PainelValidacao";
import { cn } from "@/lib/utils";
import {
  listarSindicados,
  removerSindicado,
  salvarSindicado,
  salvarSindicancia,
} from "@/lib/sindicancias.functions";
import { CAMPOS_BLOQUEANTES, validarCadastro } from "@/lib/validacao";
import {
  ESTADO_CIVIL_OPCOES,
  ETAPAS,
  PRAZO_ALERTA_ANTECEDENCIA_DIAS,
  STATUS,
  TAGS_DISPONIVEIS,
  diasCorridos,
  formatarCPF,
  prazoTotalDias,
  type DadoSindicado,
  type Sindicancia,
} from "@/lib/pecas";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Painel de Sindicâncias | Gestão do Encarregado — EB" },
      {
        name: "description",
        content:
          "Painel de controle de sindicâncias do Exército Brasileiro: cadastro digital, cronômetro de prazo de 30 dias e checklist de etapas processuais.",
      },
      { property: "og:title", content: "Painel de Sindicâncias | Gestão do Encarregado — EB" },
      {
        property: "og:description",
        content:
          "Painel de controle de sindicâncias do Exército Brasileiro: cadastro digital, cronômetro de prazo de 30 dias e checklist de etapas processuais.",
      },
    ],
  }),
  component: Dashboard,
});

const vazia: Sindicancia = {
  id: "",
  nup: "",
  portariaNumero: "",
  portariaData: "",
  om: "",
  autoridade: "",
  sindicante: "",
  sindicado: "",
  objeto: "",
  status: "Em instrução",
  etapas: [],
  documentos: [],
  atualizadoEm: "",
  local: "",
  localTrabalhos: "",

  subordinacao: "",
  omInstauradora: "",
  juntadas: [],
  prazoProrrogadoDias: 0,
  tags: [],
};

function Dashboard() {
  const {
    itens,
    erro,
    carregando,
    selecionada,
    setSelecionadaId,
    recarregar,
    usandoCache,
    cacheEm,
  } = useSindicancias();

  const [form, setForm] = useState<Sindicancia>(vazia);
  const [tagsAbertas, setTagsAbertas] = useState(false);

  useEffect(() => {
    if (selecionada) setForm(selecionada);
  }, [selecionada]);

  const salvar = useMutation({
    mutationFn: (s: Sindicancia) => salvarSindicancia({ data: s }),
    onSuccess: (s) => {
      toast.success("Sindicância salva");
      setSelecionadaId(s.id);
      recarregar();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Validação de cadastro (NUP, OM, portaria, prazo) antes de salvar — ver validacao.ts.
  // Só bloqueia nos itens de CAMPOS_BLOQUEANTES; o resto (hoje, NUP duplicado) já tem seu
  // próprio aviso inline mais abaixo e não impede o salvamento.
  const [pendenciasCadastro, setPendenciasCadastro] = useState<ReturnType<
    typeof validarCadastro
  > | null>(null);

  const tentarSalvar = () => {
    const pendencias = validarCadastro(form, itens);
    const bloqueios = pendencias.filter(
      (i) => !i.ok && (CAMPOS_BLOQUEANTES as readonly string[]).includes(i.titulo),
    );
    if (bloqueios.length > 0) {
      setPendenciasCadastro(pendencias.filter((i) => !i.ok));
      return;
    }
    salvar.mutate(form);
  };

  const set = (k: keyof Sindicancia, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const dias = diasCorridos(form.portariaData);
  const totalPrazo = prazoTotalDias(form);
  const restantes = totalPrazo - dias;
  const alerta = dias >= totalPrazo - PRAZO_ALERTA_ANTECEDENCIA_DIAS && dias < totalPrazo;
  const vencido = dias >= totalPrazo;

  const nupDuplicado = form.nup.trim()
    ? itens.some(
        (i) => i.id !== form.id && i.nup.trim().toLowerCase() === form.nup.trim().toLowerCase(),
      )
    : false;

  const toggleEtapa = (etapa: string) => {
    setForm((f) => ({
      ...f,
      etapas: f.etapas.includes(etapa) ? f.etapas.filter((e) => e !== etapa) : [...f.etapas, etapa],
    }));
  };

  const toggleTag = (tag: string) => {
    setForm((f) => ({
      ...f,
      tags: (f.tags ?? []).includes(tag)
        ? f.tags.filter((t) => t !== tag)
        : [...(f.tags ?? []), tag],
    }));
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-4 sm:p-6">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 sm:flex sm:flex-wrap sm:justify-between">
        <div className="min-w-0">
          <h1 className="truncate font-serif text-2xl font-semibold">Gestor do Processo</h1>
          <p className="text-sm text-muted-foreground">
            Cadastro, prazos e etapas — dados salvos automaticamente.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" size="sm" onClick={recarregar}>
            <RefreshCw className="size-4" /> Atualizar
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setForm(vazia)}>
            <Plus className="size-4" /> Nova
          </Button>
        </div>
      </header>

      {erro && (
        <div
          className={`painel flex items-start gap-2 p-4 text-sm ${
            usandoCache ? "text-warning" : "text-destructive"
          }`}
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span className="min-w-0 break-words">
            {erro}
            {usandoCache && cacheEm && (
              <span className="block text-xs text-muted-foreground">
                Cópia local de {new Date(cacheEm).toLocaleString("pt-BR")} — novas gravações só
                serão aplicadas quando o Google voltar.
              </span>
            )}
          </span>
        </div>
      )}

      {itens.length > 0 && (
        <div className="painel space-y-3 p-4 sm:p-5">
          <h2 className="rotulo">Painel geral — todas as sindicâncias</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="py-2 pr-3 font-normal">NUP</th>
                  <th className="py-2 pr-3 font-normal">Sindicado</th>
                  <th className="py-2 pr-3 font-normal">Status</th>
                  <th className="py-2 pr-3 font-normal">Prazo</th>
                </tr>
              </thead>
              <tbody>
                {itens.map((i) => {
                  const diasItem = diasCorridos(i.portariaData);
                  const totalItem = prazoTotalDias(i);
                  const venceuItem = i.portariaData ? diasItem >= totalItem : false;
                  const pertoItem =
                    !!i.portariaData &&
                    diasItem >= totalItem - PRAZO_ALERTA_ANTECEDENCIA_DIAS &&
                    diasItem < totalItem;
                  return (
                    <tr
                      key={i.id}
                      onClick={() => setSelecionadaId(i.id)}
                      className={`cursor-pointer border-b border-border/60 last:border-0 hover:bg-muted/50 ${
                        selecionada?.id === i.id ? "bg-muted/70" : ""
                      }`}
                    >
                      <td className="py-2 pr-3">{i.nup || i.id}</td>
                      <td className="py-2 pr-3">{i.sindicado || "—"}</td>
                      <td className="py-2 pr-3">
                        <Badge variant="outline">{i.status}</Badge>
                      </td>
                      <td className="py-2 pr-3">
                        {!i.portariaData ? (
                          "—"
                        ) : venceuItem ? (
                          <Badge variant="destructive">Vencido</Badge>
                        ) : pertoItem ? (
                          <Badge
                            className="border-warning/40 bg-warning/10 text-warning"
                            variant="outline"
                          >
                            {totalItem - diasItem} dia(s)
                          </Badge>
                        ) : (
                          `${Math.max(totalItem - diasItem, 0)} dia(s)`
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Tabs defaultValue="geral" className="space-y-4">
        <TabsList>
          <TabsTrigger value="geral">Dados Gerais</TabsTrigger>
          <TabsTrigger value="sindicados">Sindicado(s)</TabsTrigger>
        </TabsList>

        <TabsContent value="geral" className="mt-0">
          <section className="grid gap-4 lg:grid-cols-[1fr_320px]">
            <div className="painel space-y-4 p-4 sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="rotulo">Dados cadastrais</h2>
                {carregando && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
              </div>

              {itens.length > 0 && (
                <div className="space-y-1.5">
                  <Label>Sindicância em edição</Label>
                  <Select value={selecionada?.id ?? ""} onValueChange={(v) => setSelecionadaId(v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {itens.map((i) => (
                        <SelectItem key={i.id} value={i.id}>
                          {i.nup || i.id} — {i.sindicado || "sem sindicado"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <Campo label="NUP / NUD" value={form.nup} onChange={(v) => set("nup", v)} />
                <Campo
                  label="Número da Portaria"
                  value={form.portariaNumero}
                  onChange={(v) => set("portariaNumero", v)}
                />
                <div className="space-y-1.5">
                  <Label>Data da Portaria</Label>
                  <Input
                    type="date"
                    value={form.portariaData}
                    onChange={(e) => set("portariaData", e.target.value)}
                  />
                </div>
                <Campo
                  label="Local (cidade dos atos)"
                  value={form.local}
                  onChange={(v) => set("local", v)}
                />
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Subordinação (timbre — uma linha por linha do cabeçalho)</Label>
                  <Textarea
                    value={form.subordinacao}
                    onChange={(e) => set("subordinacao", e.target.value)}
                    placeholder={
                      "63º Batalhão de Infantaria\n(Regimento do Moura / 1767)\nBatalhão Fernando Machado"
                    }
                    className="min-h-20 font-mono text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Seção dos Atos</Label>
                  <Input value={form.om} onChange={(e) => set("om", e.target.value)} />
                  <p className="text-xs text-muted-foreground">
                    Local/seção onde são feitas as inquirições — preenche automaticamente o "local
                    dos trabalhos" do Despacho Inicial e da Notificação Prévia no Gerador de Peças.
                  </p>
                </div>

                <Campo
                  label="OM Instauradora"
                  value={form.omInstauradora}
                  onChange={(v) => set("omInstauradora", v)}
                />
                <Campo
                  label="Autoridade Instauradora"
                  value={form.autoridade}
                  onChange={(v) => set("autoridade", v)}
                />

                <Campo
                  label="Sindicante (Posto/Grad e Nome de Guerra)"
                  value={form.sindicante}
                  onChange={(v) => set("sindicante", v)}
                />
                <Campo
                  label="Sindicado (Posto/Grad e Nome de Guerra)"
                  value={form.sindicado}
                  onChange={(v) => set("sindicado", v)}
                />
                <div className="space-y-1.5">
                  <Label>Status</Label>
                  <Select value={form.status} onValueChange={(v) => set("status", v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {nupDuplicado && (
                <div className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 p-3 text-sm text-warning">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                  <span>
                    Já existe outra sindicância cadastrada com este NUP. Como a pasta do Drive é
                    reaproveitada pelo nome, confira se não é duplicidade antes de salvar.
                  </span>
                </div>
              )}

              <div className="space-y-1.5">
                <Label>Objeto da apuração</Label>
                <Textarea
                  value={form.objeto}
                  onChange={(e) => set("objeto", e.target.value)}
                  placeholder="apurar os fatos relacionados a..."
                  className="min-h-24"
                />
              </div>

              <Collapsible open={tagsAbertas} onOpenChange={setTagsAbertas} className="space-y-1.5">
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-2 rounded-md py-1 text-left"
                  >
                    <Label className="cursor-pointer">
                      Tags (para facilitar buscas futuras)
                      {(form.tags?.length ?? 0) > 0 && (
                        <span className="ml-1.5 font-normal text-muted-foreground">
                          — {form.tags.length} selecionada(s)
                        </span>
                      )}
                    </Label>
                    <ChevronDown
                      className={cn(
                        "size-4 shrink-0 text-muted-foreground transition-transform",
                        tagsAbertas && "rotate-180",
                      )}
                    />
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-2 rounded-md border border-border p-3 sm:grid-cols-3">
                    {TAGS_DISPONIVEIS.map((tag) => (
                      <div key={tag} className="flex items-start gap-2">
                        <Checkbox
                          id={`tag-${tag}`}
                          checked={(form.tags ?? []).includes(tag)}
                          onCheckedChange={() => toggleTag(tag)}
                          className="mt-0.5"
                        />
                        <Label htmlFor={`tag-${tag}`} className="text-sm leading-snug font-normal">
                          {tag}
                        </Label>
                      </div>
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>

              <Button onClick={tentarSalvar} disabled={salvar.isPending}>
                {salvar.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Save className="size-4" />
                )}
                Salvar sindicância
              </Button>
            </div>

            <div className="space-y-4">
              <div className="painel space-y-3 p-4">
                <div className="flex items-center gap-2">
                  <CalendarClock className="size-4 text-primary" />
                  <h2 className="rotulo">Cronômetro de prazo</h2>
                </div>
                <p className="font-serif text-3xl font-semibold">
                  {form.portariaData ? `${Math.max(dias, 0)} / ${totalPrazo}` : `— / ${totalPrazo}`}
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    dias corridos
                  </span>
                </p>
                <Progress value={Math.min((dias / totalPrazo) * 100, 100)} />
                {form.portariaData && (
                  <p className="text-sm text-muted-foreground">
                    {vencido
                      ? "Prazo regulamentar esgotado."
                      : `Restam ${restantes} dia(s) para a conclusão.`}
                  </p>
                )}
                <div className="space-y-1.5">
                  <Label>Dias de prorrogação concedidos</Label>
                  <Input
                    type="number"
                    min={0}
                    value={form.prazoProrrogadoDias ?? 0}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        prazoProrrogadoDias: Math.max(0, Number(e.target.value) || 0),
                      }))
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Preencha após a prorrogação ser deferida — soma-se aos 30 dias regulamentares.
                  </p>
                </div>
                {(alerta || vencido) && (
                  <div className="space-y-2 rounded-md border border-warning/40 bg-warning/10 p-3 text-sm text-warning">
                    <div>
                      <AlertTriangle className="mb-1 size-4" />
                      {vencido
                        ? "Prazo esgotado — se ainda não houve prorrogação, gere e registre o Pedido de Prorrogação de Prazo o quanto antes."
                        : `Faltam ${restantes} dia(s) para o fim do prazo: avalie gerar o Pedido de Prorrogação de Prazo.`}
                    </div>
                    <Button variant="outline" size="sm" className="h-7 text-xs" asChild>
                      <Link to="/pecas" search={{ peca: "prorrogacao" }}>
                        Gerar Pedido de Prorrogação de Prazo
                      </Link>
                    </Button>
                  </div>
                )}
                <Badge variant="outline">{form.status}</Badge>
              </div>

              <div className="painel space-y-3 p-4">
                <h2 className="rotulo">Checklist de etapas</h2>
                <ul className="space-y-2">
                  {ETAPAS.map((etapa) => (
                    <li key={etapa} className="flex items-start gap-2">
                      <Checkbox
                        id={etapa}
                        checked={form.etapas.includes(etapa)}
                        onCheckedChange={() => toggleEtapa(etapa)}
                        className="mt-0.5"
                      />
                      <Label htmlFor={etapa} className="text-sm leading-snug font-normal">
                        {etapa}
                      </Label>
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-muted-foreground">
                  Marque as etapas e clique em salvar para registrar as alterações.
                </p>
              </div>
            </div>
          </section>
        </TabsContent>

        <TabsContent value="sindicados" className="mt-0">
          <PainelSindicados sindicanciaId={selecionada?.id} />
        </TabsContent>
      </Tabs>

      <Dialog
        open={pendenciasCadastro !== null}
        onOpenChange={(aberto) => !aberto && setPendenciasCadastro(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Antes de salvar, confira estes pontos</DialogTitle>
            <DialogDescription>
              Alguns campos obrigatórios do cadastro ainda precisam de atenção.
            </DialogDescription>
          </DialogHeader>
          {pendenciasCadastro && <ListaItensValidacao itens={pendenciasCadastro} />}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendenciasCadastro(null)}>
              Voltar e corrigir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Campo({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

const SINDICADO_VAZIO: DadoSindicado = {
  sindicanciaId: "",
  civil: "",
  idt: "",
  cpf: "",
  nascimento: "",
  naturalidade: "",
  estadoCivil: "",
  filiacao: "",
  mae: "",
  enderecoCompleto: "",
  companhia: "",
  vocativo: "",
};

function PainelSindicados({ sindicanciaId }: { sindicanciaId?: string }) {
  const [editando, setEditando] = useState<DadoSindicado | null>(null);

  const {
    data: sindicados = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["sindicados", sindicanciaId],
    queryFn: () => listarSindicados({ data: { sindicanciaId: sindicanciaId! } }),
    enabled: !!sindicanciaId,
  });

  const salvar = useMutation({
    mutationFn: (d: DadoSindicado) => salvarSindicado({ data: d }),
    onSuccess: () => {
      toast.success("Sindicado salvo");
      setEditando(null);
      refetch();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remover = useMutation({
    mutationFn: (id: string) => removerSindicado({ data: { id } }),
    onSuccess: () => {
      toast.success("Sindicado removido");
      refetch();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!sindicanciaId) {
    return (
      <div className="painel p-4 text-sm text-muted-foreground sm:p-5">
        Salve a sindicância em "Dados Gerais" antes de cadastrar sindicados.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="painel space-y-3 p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="rotulo">Sindicados cadastrados</h2>
          <Button size="sm" onClick={() => setEditando({ ...SINDICADO_VAZIO, sindicanciaId })}>
            <Plus className="size-4" /> Novo sindicado
          </Button>
        </div>

        {isLoading && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
        {!isLoading && sindicados.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhum sindicado cadastrado ainda.</p>
        )}

        <div className="space-y-2">
          {sindicados.map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between gap-3 rounded-md border border-border p-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {s.civil || "—"} · {s.idt || "sem identidade"}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {s.civil === "Militar" ? s.companhia || "—" : s.vocativo || "—"}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button size="sm" variant="outline" onClick={() => setEditando(s)}>
                  Editar
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => s.id && remover.mutate(s.id)}
                  disabled={remover.isPending}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {editando && (
        <div className="painel space-y-4 p-4 sm:p-5">
          <h2 className="rotulo">{editando.id ? "Editar sindicado" : "Novo sindicado"}</h2>

          <div className="space-y-1.5">
            <Label>Militar ou Civil</Label>
            <Select
              value={editando.civil}
              onValueChange={(v) =>
                setEditando({ ...editando, civil: v as DadoSindicado["civil"] })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Militar">Militar</SelectItem>
                <SelectItem value="Civil">Civil</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Campo
              label="Identidade (RG ou identidade militar)"
              value={editando.idt}
              onChange={(v) => setEditando({ ...editando, idt: v })}
            />
            <div className="space-y-1.5">
              <Label>CPF</Label>
              <Input
                value={editando.cpf}
                onChange={(e) => setEditando({ ...editando, cpf: formatarCPF(e.target.value) })}
                placeholder="000.000.000-00"
                inputMode="numeric"
                maxLength={14}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Data de nascimento</Label>
              <Input
                type="date"
                value={editando.nascimento}
                onChange={(e) => setEditando({ ...editando, nascimento: e.target.value })}
              />
            </div>
            <Campo
              label="Naturalidade"
              value={editando.naturalidade}
              onChange={(v) => setEditando({ ...editando, naturalidade: v })}
            />
            <Campo
              label="Pai"
              value={editando.filiacao}
              onChange={(v) => setEditando({ ...editando, filiacao: v })}
            />
            <Campo
              label="Mãe"
              value={editando.mae}
              onChange={(v) => setEditando({ ...editando, mae: v })}
            />
            <div className="space-y-1.5">
              <Label>Estado civil</Label>
              <Select
                value={editando.estadoCivil}
                onValueChange={(v) => setEditando({ ...editando, estadoCivil: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {ESTADO_CIVIL_OPCOES.map((opcao) => (
                    <SelectItem key={opcao} value={opcao}>
                      {opcao}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {editando.civil !== "Civil" && (
              <Campo
                label="Companhia/Unidade"
                value={editando.companhia}
                onChange={(v) => setEditando({ ...editando, companhia: v })}
              />
            )}
            {editando.civil !== "Militar" && (
              <Campo
                label="Vocativo"
                value={editando.vocativo}
                onChange={(v) => setEditando({ ...editando, vocativo: v })}
              />
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Endereço completo</Label>
            <Textarea
              value={editando.enderecoCompleto}
              onChange={(e) => setEditando({ ...editando, enderecoCompleto: e.target.value })}
              placeholder="Rua, número, bairro, cidade/UF, CEP"
            />
            <p className="text-xs text-muted-foreground">Inclua o CEP junto ao endereço.</p>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setEditando(null)}>
              Cancelar
            </Button>
            <Button
              onClick={() => salvar.mutate(editando)}
              disabled={salvar.isPending || !editando.civil}
            >
              {salvar.isPending && <Loader2 className="size-4 animate-spin" />}
              <Save className="size-4" /> Salvar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
