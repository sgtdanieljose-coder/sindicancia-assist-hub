import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * O Mapa dos Autos deixou de ser uma página própria: agora é a aba "Mapa dos Autos" dentro
 * de Autos da Sindicância — ver routes/documentos.tsx (VisaoMapaAutos). Esta rota continua
 * existindo só para não quebrar links e favoritos antigos; qualquer acesso a /mapa cai
 * direto em /documentos com o mapa já selecionado.
 */
export const Route = createFileRoute("/mapa")({
  beforeLoad: () => {
    throw redirect({ to: "/documentos", search: { visao: "mapa" } });
  },
});
