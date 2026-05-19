import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Resiliência de realtime. O Supabase auto-reconecta o socket, mas as
 * mensagens que aconteceram durante a queda **perdem-se** — por isso é
 * preciso voltar a buscar o estado quando reconecta.
 *
 * Uso:
 *   const refetch = useCallback(async () => { ...buscar e setState... }, [...]);
 *   const { online, handleStatus } = useReconnect(refetch);
 *   ...
 *   channel.subscribe(handleStatus);
 *
 * `handleStatus` liga-se ao callback do `.subscribe()` do canal:
 *   - SUBSCRIBED        → online; se vínhamos de offline, refetch (catch-up)
 *   - CHANNEL_ERROR /
 *     TIMED_OUT / CLOSED → offline
 *
 * Também faz refetch quando a janela volta online (`window.online`) ou
 * quando o tab/Browser Source volta a ficar visível (`visibilitychange`)
 * — cobre o caso do OBS minimizado ou Wi-Fi do pavilhão a piscar.
 */
export function useReconnect(refetch: () => void | Promise<void>) {
  const [online, setOnline] = useState(true);
  const onlineRef = useRef(true);
  const refetchRef = useRef(refetch);
  refetchRef.current = refetch;

  const handleStatus = useCallback((status: string) => {
    if (status === "SUBSCRIBED") {
      const wasOffline = !onlineRef.current;
      onlineRef.current = true;
      setOnline(true);
      if (wasOffline) void refetchRef.current();
    } else if (
      status === "CHANNEL_ERROR" ||
      status === "TIMED_OUT" ||
      status === "CLOSED"
    ) {
      onlineRef.current = false;
      setOnline(false);
    }
  }, []);

  useEffect(() => {
    function onBackOnline() {
      void refetchRef.current();
    }
    function onVisible() {
      if (document.visibilityState === "visible") {
        void refetchRef.current();
      }
    }
    window.addEventListener("online", onBackOnline);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("online", onBackOnline);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return { online, handleStatus };
}
