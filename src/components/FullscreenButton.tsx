"use client";

import { useEffect, useState } from "react";

/**
 * Botão discreto de ecrã inteiro para a TV. Aparece quando se mexe o rato,
 * esconde-se sozinho ao fim de 3 s (não aparece na transmissão). Tecla "f"
 * também alterna. Em ecrã inteiro o botão desaparece.
 */
export function FullscreenButton() {
  const [isFs, setIsFs] = useState(false);
  const [show, setShow] = useState(true);

  useEffect(() => {
    const onChange = () => setIsFs(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    onChange();
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  // Auto-hide: mostra ao mexer rato/tocar, esconde 3 s depois.
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const ping = () => {
      setShow(true);
      clearTimeout(t);
      t = setTimeout(() => setShow(false), 3000);
    };
    ping();
    window.addEventListener("mousemove", ping);
    window.addEventListener("touchstart", ping);
    window.addEventListener("keydown", ping);
    return () => {
      clearTimeout(t);
      window.removeEventListener("mousemove", ping);
      window.removeEventListener("touchstart", ping);
      window.removeEventListener("keydown", ping);
    };
  }, []);

  async function toggle() {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      /* navegador bloqueou — precisa de gesto do utilizador (o click é um) */
    }
  }

  // Atalho de teclado "f"
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "f" || e.key === "F") toggle();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (isFs || !show) return null;

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Ecrã inteiro"
      style={{
        position: "fixed",
        right: 18,
        bottom: 18,
        zIndex: 99999,
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "10px 16px",
        borderRadius: 999,
        border: "1px solid rgba(66,215,255,0.35)",
        background: "rgba(8,13,22,0.72)",
        color: "#cdeaff",
        font: '700 13px/1 system-ui, sans-serif',
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        backdropFilter: "blur(4px)",
        cursor: "pointer",
      }}
    >
      <svg
        viewBox="0 0 24 24"
        width="16"
        height="16"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M8 3H5a2 2 0 0 0-2 2v3" />
        <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
        <path d="M3 16v3a2 2 0 0 0 2 2h3" />
        <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
      </svg>
      Ecrã inteiro
    </button>
  );
}
