import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * O Relatório do Sindicante deixou de ser uma página própria: agora é o item
 * "Relatório do Sindicante" (grupo "Documento final" do seletor de peça) dentro de
 * Peças e Relatório — ver routes/pecas.tsx. Esta rota continua existindo só para não
 * quebrar links e favoritos antigos; qualquer acesso a /relatorio cai direto em
 * /pecas com o relatório já pré-selecionado, sem precisar de um segundo clique.
 */
export const Route = createFileRoute("/relatorio")({
  beforeLoad: () => {
    throw redirect({ to: "/pecas", search: { peca: "relatorio" } });
  },
});
