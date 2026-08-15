import { describe, expect, it } from "vitest";
import { criarRastreador } from "./rastreamento";

describe("criarRastreador", () => {
  it("registra a etapa e o tempo mesmo quando a função tem sucesso", async () => {
    const r = criarRastreador();
    const resultado = await r.medir("etapa 1", async () => {
      await new Promise((res) => setTimeout(res, 5));
      return "ok";
    });
    expect(resultado).toBe("ok");
    expect(r.etapas).toHaveLength(1);
    expect(r.etapas[0].etapa).toBe("etapa 1");
    expect(r.etapas[0].ms).toBeGreaterThanOrEqual(0);
  });

  it("registra a etapa mesmo quando a função falha, e repropaga o erro", async () => {
    const r = criarRastreador();
    await expect(
      r.medir("etapa com erro", async () => {
        throw new Error("falhou");
      }),
    ).rejects.toThrow("falhou");
    expect(r.etapas).toHaveLength(1);
    expect(r.etapas[0].etapa).toBe("etapa com erro");
  });

  it("acumula etapas na ordem em que foram medidas", async () => {
    const r = criarRastreador();
    await r.medir("primeira", async () => 1);
    await r.medir("segunda", async () => 2);
    expect(r.etapas.map((e) => e.etapa)).toEqual(["primeira", "segunda"]);
  });
});
