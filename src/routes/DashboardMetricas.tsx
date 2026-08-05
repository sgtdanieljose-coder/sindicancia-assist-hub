import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

const CHAVE_TEMA = "siges-tema";

function aplicarTema(escuro: boolean) {
  document.documentElement.classList.toggle("dark", escuro);
}

/** Alterna entre modo claro e escuro, persistindo a escolha em localStorage. */
export function ThemeToggle({ collapsed }: { collapsed?: boolean }) {
  const [escuro, setEscuro] = useState(false);

  useEffect(() => {
    const salvo = localStorage.getItem(CHAVE_TEMA);
    const preferido = salvo
      ? salvo === "escuro"
      : window.matchMedia("(prefers-color-scheme: dark)").matches;
    setEscuro(preferido);
    aplicarTema(preferido);
  }, []);

  const alternar = () => {
    const novo = !escuro;
    setEscuro(novo);
    aplicarTema(novo);
    localStorage.setItem(CHAVE_TEMA, novo ? "escuro" : "claro");
  };

  return (
    <Button
      variant="ghost"
      size={collapsed ? "icon" : "sm"}
      onClick={alternar}
      className={collapsed ? "" : "w-full justify-start gap-2"}
    >
      {escuro ? <Sun className="size-4 shrink-0" /> : <Moon className="size-4 shrink-0" />}
      {!collapsed && <span>{escuro ? "Modo claro" : "Modo escuro"}</span>}
    </Button>
  );
}

