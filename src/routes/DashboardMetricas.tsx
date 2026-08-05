import { useMemo, type ComponentType } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AlertTriangle, Archive, CheckCircle2, Clock, FileWarning } from "lucide-react";
import {
  diasCorridos,
  prazoTotalDias,
  PRAZO_ALERTA_ANTECEDENCIA_DIAS,
  type Sindicancia,
} from "@/lib/pecas";

const CORES_STATUS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
  "oklch(0.6 0.05 200)",
];

const ESTILO_TOOLTIP = {
  background: "var(--color-popover)",
  border: "1px solid var(--color-border)",
  borderRadius: 8,
  fontSize: 12,
};

function CardMetrica({
  titulo,
  valor,
  icone: Icone,
  tom,
}: {
  titulo: string;
  valor: number;
  icone: ComponentType<{ className?: string }>;
  tom?: "warning" | "destructive" | "success";
}) {
  const corIcone =
    tom === "destructive"
      ? "bg-destructive/10 text-destructive"
      : tom === "warning"
        ? "bg-warning/10 text-warning"
        : tom === "success"
          ? "bg-success/10 text-success"
          : "bg-primary/10 text-primary";

  return (
    <div className="painel flex items-center gap-3 p-4">
      <div className={`flex size-10 shrink-0 items-center justify-center rounded-md ${corIcone}`}>
        <Icone className="size-5" />
      </div>
      <div className="min-w-0">
        <p className="font-serif text-2xl font-semibold">{valor}</p>
        <p className="rotulo truncate">{titulo}</p>
      </div>
    </div>
  );
}

/**
 * Cards de métricas, gráficos (por mês / por status) e atividades recentes do Dashboard.
 * Puramente aditivo — não substitui nem depende do formulário de cadastro existente.
 *
 * Duas aproximações que valem a pena confirmar com o usuário:
 * - "Distribuição por tipo" virou "Distribuição por status", já que Sindicancia não tem um
 *   campo de tipo/categoria hoje.
 * - "Tempo médio de conclusão" é estimado (Portaria até a última atualização das concluídas),
 *   já que não há um campo específico de "data de conclusão".
 */
export function DashboardMetricas({ itens }: { itens: Sindicancia[] }) {
  const m = useMemo(() => {
    const emAndamento = itens.filter((i) => i.status !== "Concluída" && i.status !== "Arquivada");
    const concluidas = itens.filter((i) => i.status === "Concluída");
    const arquivadas = itens.filter((i) => i.status === "Arquivada");

    let emAtraso = 0;
    let proximasVencimento = 0;
    for (const i of emAndamento) {
      if (!i.portariaData) continue;
      const dias = diasCorridos(i.portariaData);
      const total = prazoTotalDias(i);
      if (dias >= total) emAtraso++;
      else if (dias >= total - PRAZO_ALERTA_ANTECEDENCIA_DIAS) proximasVencimento++;
    }

    const porMes = new Map<string, number>();
    for (const i of itens) {
      if (!i.portariaData) continue;
      const chave = i.portariaData.slice(0, 7);
      porMes.set(chave, (porMes.get(chave) ?? 0) + 1);
    }
    const dadosPorMes = [...porMes.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([mes, qtd]) => ({
        mes: new Date(`${mes}-01T00:00:00`).toLocaleDateString("pt-BR", {
          month: "short",
          year: "2-digit",
        }),
        qtd,
      }));

    const porStatus = new Map<string, number>();
    for (const i of itens) {
      const chave = i.status || "Sem status";
      porStatus.set(chave, (porStatus.get(chave) ?? 0) + 1);
    }
    const dadosPorStatus = [...porStatus.entries()].map(([status, qtd]) => ({ status, qtd }));

    const temposConclusao = concluidas
      .filter((i) => i.portariaData && i.atualizadoEm)
      .map((i) => {
        const inicio = new Date(i.portariaData).getTime();
        const fim = new Date(i.atualizadoEm).getTime();
        return Math.max(0, Math.round((fim - inicio) / 86400000));
      });
    const tempoMedio = temposConclusao.length
      ? Math.round(temposConclusao.reduce((a, b) => a + b, 0) / temposConclusao.length)
      : null;

    const percentualConcluido = itens.length
      ? Math.round((concluidas.length / itens.length) * 100)
      : 0;

    const recentes = [...itens]
      .filter((i) => i.atualizadoEm)
      .sort((a, b) => (a.atualizadoEm < b.atualizadoEm ? 1 : -1))
      .slice(0, 6);

    return {
      emAndamento: emAndamento.length,
      concluidas: concluidas.length,
      arquivadas: arquivadas.length,
      emAtraso,
      proximasVencimento,
      dadosPorMes,
      dadosPorStatus,
      tempoMedio,
      percentualConcluido,
      recentes,
    };
  }, [itens]);

  if (itens.length === 0) return null;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <CardMetrica titulo="Em andamento" valor={m.emAndamento} icone={Clock} />
        <CardMetrica titulo="Concluídas" valor={m.concluidas} icone={CheckCircle2} tom="success" />
        <CardMetrica titulo="Arquivadas" valor={m.arquivadas} icone={Archive} />
        <CardMetrica
          titulo="Em atraso"
          valor={m.emAtraso}
          icone={AlertTriangle}
          tom="destructive"
        />
        <CardMetrica
          titulo="Próximas do vencimento"
          valor={m.proximasVencimento}
          icone={FileWarning}
          tom="warning"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="painel space-y-2 p-4 lg:col-span-2">
          <h2 className="rotulo">Sindicâncias instauradas por mês</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={m.dadosPorMes}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="mes" stroke="var(--color-muted-foreground)" fontSize={12} />
              <YAxis allowDecimals={false} stroke="var(--color-muted-foreground)" fontSize={12} />
              <Tooltip contentStyle={ESTILO_TOOLTIP} />
              <Bar
                dataKey="qtd"
                name="Sindicâncias"
                fill="var(--color-primary)"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="painel space-y-2 p-4">
          <h2 className="rotulo">Distribuição por status</h2>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie
                data={m.dadosPorStatus}
                dataKey="qtd"
                nameKey="status"
                innerRadius={40}
                outerRadius={75}
                paddingAngle={2}
              >
                {m.dadosPorStatus.map((_, i) => (
                  <Cell key={i} fill={CORES_STATUS[i % CORES_STATUS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={ESTILO_TOOLTIP} />
            </PieChart>
          </ResponsiveContainer>
          <ul className="space-y-1 text-xs">
            {m.dadosPorStatus.map((d, i) => (
              <li key={d.status} className="flex items-center gap-1.5 text-muted-foreground">
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={{ background: CORES_STATUS[i % CORES_STATUS.length] }}
                />
                <span className="truncate">
                  {d.status} — {d.qtd}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="painel p-4">
          <p className="rotulo">Tempo médio de conclusão (estimado)</p>
          <p className="font-serif text-2xl font-semibold">
            {m.tempoMedio !== null ? `${m.tempoMedio} dias` : "—"}
          </p>
        </div>
        <div className="painel p-4">
          <p className="rotulo">Percentual concluído</p>
          <p className="font-serif text-2xl font-semibold">{m.percentualConcluido}%</p>
        </div>
        <div className="painel space-y-2 p-4">
          <p className="rotulo">Atividade recente</p>
          <ul className="space-y-1.5">
            {m.recentes.length === 0 && (
              <li className="text-xs text-muted-foreground">Sem movimentações registradas.</li>
            )}
            {m.recentes.map((i) => (
              <li key={i.id} className="truncate text-xs">
                <span className="font-medium">{i.nup || i.id}</span>{" "}
                <span className="text-muted-foreground">— {i.status || "sem status"}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
          }
