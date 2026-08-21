import { formatarBlocosPreview, type PecaId } from "@/lib/pecas";

// URL pública do brasão — mirrorada de BRASAO_URL em google.server.ts (módulo server-only,
// não pode ser importado no cliente). É um asset público, sem segredo nenhum envolvido.
const BRASAO_URL =
  "https://sindicancia-assist-hub.lovable.app/__l5e/assets-v1/f23d5d02-916f-4e73-809c-9fe4c6876f2e/brasao-republica.png";

/**
 * Aproximação visual de como a peça vai ficar formatada no Google Docs (EB10-IG-01.001),
 * pra revisar antes de exportar. Não é pixel-perfect — o Docs real aplica as regras via API
 * sobre índices de caracteres; aqui é a mesma lógica (ver formatarBlocosPreview em pecas.ts)
 * aplicada a texto puro, com CSS aproximando o resultado (fonte serifada, negrito, sublinhado,
 * centralizado, justificado com recuo de primeira linha).
 */
export function PreviewPeca({ texto, pecaId }: { texto: string; pecaId?: PecaId }) {
  const blocos = formatarBlocosPreview(texto, pecaId);

  if (blocos.length === 0) {
    return (
      <p className="p-8 text-center text-sm text-muted-foreground">
        Nada para pré-visualizar ainda — escreva o texto da peça primeiro.
      </p>
    );
  }

  return (
    <div className="max-h-[70vh] overflow-y-auto rounded-md border bg-muted/30 p-4">
      <div
        className="mx-auto max-w-[210mm] space-y-3 bg-white p-10 text-black shadow-sm"
        style={{ fontFamily: '"Times New Roman", Times, serif' }}
      >
        <img src={BRASAO_URL} alt="Brasão da República" className="mx-auto h-12 w-auto" />
        {blocos.map((b, i) => (
          <p
            key={i}
            className={[
              "text-[13px] leading-normal",
              b.centralizado ? "text-center" : "",
              b.justificado ? "text-justify" : "",
              b.negrito ? "font-bold" : "",
              b.sublinhado ? "underline" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            style={b.recuo ? { textIndent: "1.5cm" } : undefined}
          >
            {!b.negrito && b.rotulo ? (
              <>
                <span className="font-bold">{b.rotulo}</span>
                {b.texto.slice(b.rotulo.length)}
              </>
            ) : (
              b.texto
            )}
          </p>
        ))}
      </div>
    </div>
  );
}
