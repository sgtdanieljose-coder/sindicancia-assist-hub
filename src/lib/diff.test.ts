import { describe, expect, it } from "vitest";
import { diffLinhas, resumoDiff } from "./diff";

describe("diffLinhas", () => {
  it("marca tudo como igual quando os textos são idênticos", () => {
    const r = diffLinhas("a\nb\nc", "a\nb\nc");
    expect(r.every((l) => l.tipo === "igual")).toBe(true);
    expect(r.map((l) => l.texto)).toEqual(["a", "b", "c"]);
  });

  it("detecta uma linha alterada no meio do texto", () => {
    const r = diffLinhas("linha1\nlinha2\nlinha3", "linha1\nlinha2 mudou\nlinha3");
    expect(r).toEqual([
      { tipo: "igual", texto: "linha1" },
      { tipo: "removida", texto: "linha2" },
      { tipo: "adicionada", texto: "linha2 mudou" },
      { tipo: "igual", texto: "linha3" },
    ]);
  });

  it("detecta linhas adicionadas no fim", () => {
    const r = diffLinhas("a\nb", "a\nb\nc");
    expect(r.at(-1)).toEqual({ tipo: "adicionada", texto: "c" });
  });

  it("detecta linhas removidas no fim", () => {
    const r = diffLinhas("a\nb\nc", "a\nb");
    expect(r.at(-1)).toEqual({ tipo: "removida", texto: "c" });
  });

  it("lida com texto vazio de um dos lados", () => {
    const r = diffLinhas("", "a\nb");
    expect(r.filter((l) => l.tipo === "adicionada")).toHaveLength(2);
  });
});

describe("resumoDiff", () => {
  it("informa 'sem alterações' quando os textos são iguais", () => {
    expect(resumoDiff("igual", "igual")).toBe("sem alterações de texto");
  });

  it("resume adições e remoções", () => {
    expect(resumoDiff("a\nb", "a\nb\nc\nd")).toContain("+2");
  });
});
