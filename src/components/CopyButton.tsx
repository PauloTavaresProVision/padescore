"use client";

import { useState } from "react";
import { CheckIcon, CopyIcon } from "@/components/icons";

async function copyToClipboard(text: string): Promise<boolean> {
  // Preferred: modern async API (only works in secure contexts — HTTPS or localhost)
  if (typeof navigator !== "undefined" && navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // fall through to legacy path
    }
  }
  // Fallback for http://server-ip:port — uses a hidden textarea + execCommand
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.top = "0";
    ta.style.left = "0";
    ta.style.width = "1px";
    ta.style.height = "1px";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    ta.setSelectionRange(0, text.length);
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export function CopyButton({ text }: { text: string }) {
  const [state, setState] = useState<"idle" | "copied" | "error">("idle");

  return (
    <button
      type="button"
      onClick={async () => {
        const ok = await copyToClipboard(text);
        setState(ok ? "copied" : "error");
        setTimeout(() => setState("idle"), 1800);
      }}
      title={state === "error" ? "Não foi possível copiar — selecciona e copia manualmente" : text}
      className={[
        "flex flex-1 items-center justify-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition",
        state === "copied"
          ? "border-emerald-300 bg-emerald-50 text-emerald-700"
          : state === "error"
            ? "border-red-200 bg-red-50 text-red-700"
            : "border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50",
      ].join(" ")}
    >
      {state === "copied" ? (
        <CheckIcon className="h-3.5 w-3.5" />
      ) : (
        <CopyIcon className="h-3.5 w-3.5" />
      )}
      {state === "copied" ? "Copiado" : state === "error" ? "Falhou" : "Copiar"}
    </button>
  );
}
