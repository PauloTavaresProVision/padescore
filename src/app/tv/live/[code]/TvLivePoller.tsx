"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/**
 * Faz poll a /api/tv/<code>/active a cada 5 s. Quando o jogo activo do canal
 * muda (operador carregou "Pôr na TV" noutro jogo, ou um jogo foi tirado),
 * faz router.refresh() — o server component re-renderiza com o novo jogo.
 * 5 s de latência é irrelevante (troca-se entre jogos, não a meio).
 */
export function TvLivePoller({
  code,
  activeCode,
}: {
  code: string;
  activeCode: string | null;
}) {
  const router = useRouter();
  const current = useRef(activeCode);
  current.current = activeCode;

  useEffect(() => {
    let stopped = false;
    const id = setInterval(async () => {
      try {
        const r = await fetch(`/api/tv/${code}/active`, { cache: "no-store" });
        if (!r.ok) return;
        const j = (await r.json()) as { matchCode: string | null };
        if (!stopped && (j.matchCode ?? null) !== current.current) {
          router.refresh();
        }
      } catch {
        /* sem rede — tenta no próximo tick */
      }
    }, 5000);
    return () => {
      stopped = true;
      clearInterval(id);
    };
  }, [code, router]);

  return null;
}
