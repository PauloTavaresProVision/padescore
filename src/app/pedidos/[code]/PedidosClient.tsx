"use client";

import { useState } from "react";

// =============================================================================
// ÍCONES (SVG line-style, herda currentColor)
// =============================================================================
const IconPhone = (p: { className?: string }) => (
  <svg
    className={p.className}
    width="20" height="20" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
  >
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
  </svg>
);
const IconMail = (p: { className?: string }) => (
  <svg
    className={p.className}
    width="20" height="20" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
  >
    <rect x="2" y="4" width="20" height="16" rx="2" />
    <path d="m22 7-10 5L2 7" />
  </svg>
);
const IconLock = (p: { className?: string }) => (
  <svg
    className={p.className}
    width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
  >
    <rect x="3" y="11" width="18" height="11" rx="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);
const IconArrowRight = (p: { className?: string }) => (
  <svg
    className={p.className}
    width="16" height="16" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
  >
    <path d="M5 12h14M13 5l7 7-7 7" />
  </svg>
);
const IconArrowLeft = (p: { className?: string }) => (
  <svg
    className={p.className}
    width="12" height="12" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
  >
    <path d="M19 12H5M12 5l-7 7 7 7" />
  </svg>
);
const IconCheck = (p: { className?: string }) => (
  <svg
    className={p.className}
    width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
  >
    <path d="m5 12 5 5L20 7" />
  </svg>
);
const IconCalendar = (p: { className?: string }) => (
  <svg
    className={p.className}
    width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
  >
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <path d="M16 2v4M8 2v4M3 10h18" />
  </svg>
);
const IconClock = (p: { className?: string }) => (
  <svg
    className={p.className}
    width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="10" />
    <path d="M12 6v6l4 2" />
  </svg>
);
const IconPin = (p: { className?: string }) => (
  <svg
    className={p.className}
    width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
  >
    <path d="M20 10c0 7-8 12-8 12s-8-5-8-12a8 8 0 0 1 16 0Z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);
const IconEdit = (p: { className?: string }) => (
  <svg
    className={p.className}
    width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
  >
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);
const IconPlus = (p: { className?: string }) => (
  <svg
    className={p.className}
    width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
  >
    <path d="M12 5v14M5 12h14" />
  </svg>
);
const IconRacket = (p: { className?: string }) => (
  <svg
    className={p.className}
    width="32" height="32" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
  >
    <ellipse cx="9" cy="9" rx="6" ry="6" />
    <path d="M13.5 13.5 21 21" />
    <path d="M5 9h8M9 5v8M6 7l6 6M12 7l-6 6" />
  </svg>
);

export interface GameForUI {
  id: number;
  scheduledAt: string; // ISO
  field: string;
  teamA: string;
  teamB: string;
  status: "open" | "closed";
}

interface PlayerOption {
  name: string;
  category: string | null;
  gender: "M" | "F" | null;
  phone?: string;
  email?: string | null;
}

interface LookupResponse {
  players: PlayerOption[];
  selectedPlayer: PlayerOption | null;
  games: GameForUI[];
  competitionDates?: { from: string; to: string };
  error?: string;
}

interface Props {
  competitionCode: string;
  accentColor: string;
}

// =============================================================================
// CLASSES PARTILHADAS (design system dark)
// =============================================================================
const cardClass =
  "rounded-2xl border border-white/10 bg-white/5 p-6 shadow-2xl shadow-black/40 backdrop-blur-xl";
const inputBaseClass =
  "w-full rounded-xl border border-white/15 bg-white/95 text-base !text-slate-900 shadow-inner placeholder:text-slate-400 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40 disabled:opacity-50";

// =============================================================================
// COMPONENTE PRINCIPAL
// =============================================================================
export function PedidosClient({ competitionCode, accentColor }: Props) {
  // Identificador pode ser telemóvel OU email (auto-detect por '@')
  const [identifier, setIdentifier] = useState("");
  const [lookingUp, setLookingUp] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);

  // Estado após lookup
  const [players, setPlayers] = useState<PlayerOption[] | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerOption | null>(
    null,
  );
  const [games, setGames] = useState<GameForUI[]>([]);
  const [competitionDates, setCompetitionDates] = useState<
    { from: string; to: string } | null
  >(null);

  // Modal de pedido
  const [selectedGame, setSelectedGame] = useState<GameForUI | null>(null);
  const [submittedId, setSubmittedId] = useState<string | null>(null);

  async function doLookup(selectedName?: string) {
    setLookingUp(true);
    setLookupError(null);
    try {
      const res = await fetch(`/api/pedidos/${competitionCode}/lookup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, selectedName }),
      });
      const data: LookupResponse = await res.json();
      if (!res.ok) {
        setLookupError(data.error || `Erro ${res.status}`);
        return;
      }
      setPlayers(data.players);
      setSelectedPlayer(data.selectedPlayer);
      setGames(data.games);
      if (data.competitionDates) setCompetitionDates(data.competitionDates);
    } catch (e) {
      setLookupError(e instanceof Error ? e.message : "Erro de rede");
    } finally {
      setLookingUp(false);
    }
  }

  function reset() {
    setPlayers(null);
    setSelectedPlayer(null);
    setGames([]);
    setLookupError(null);
    setSubmittedId(null);
  }

  const looksLikeEmail = identifier.includes("@");

  // =========================================================================
  // TELA 1: pedir identificador
  // =========================================================================
  if (!players) {
    return (
      <div className={cardClass}>
        <h2 className="mb-1 text-xl font-extrabold text-white">
          Identifica-te
        </h2>
        <p className="mb-5 text-sm text-slate-300">
          Indica o teu <b className="text-white">telemóvel</b> ou{" "}
          <b className="text-white">email</b> para vermos os teus jogos.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void doLookup();
          }}
          className="space-y-4"
        >
          <div className="relative">
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
              {looksLikeEmail ? <IconMail /> : <IconPhone />}
            </span>
            <input
              type="text"
              inputMode={looksLikeEmail ? "email" : "tel"}
              autoComplete={looksLikeEmail ? "email" : "tel"}
              required
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="923 456 789 ou o.teu@email.com"
              disabled={lookingUp}
              className={`${inputBaseClass} pl-11 pr-4 py-3.5`}
              autoFocus
            />
          </div>
          {lookupError && (
            <div className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-200">
              {lookupError}
            </div>
          )}
          <button
            type="submit"
            disabled={lookingUp || !identifier.trim()}
            className="w-full rounded-xl px-4 py-3.5 text-base font-bold text-white shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
            style={{
              background: `linear-gradient(135deg, ${accentColor}, ${accentColor}dd)`,
              boxShadow: `0 10px 30px -10px ${accentColor}`,
            }}
          >
            <span className="inline-flex items-center justify-center gap-2">
              {lookingUp ? "A procurar..." : "Ver os meus jogos"}
              {!lookingUp && <IconArrowRight />}
            </span>
          </button>
          <p className="inline-flex items-center justify-center gap-1.5 w-full text-center text-[11px] text-slate-400">
            <IconLock className="text-slate-500" />
            O teu contacto é usado apenas para validar identidade.
          </p>
        </form>
      </div>
    );
  }

  // =========================================================================
  // TELA 2: escolher entre múltiplos jogadores (casais com mesmo nº)
  // =========================================================================
  if (!selectedPlayer && players.length > 1) {
    return (
      <div className={cardClass}>
        <h2 className="mb-1 text-xl font-extrabold text-white">Quem és?</h2>
        <p className="mb-5 text-sm text-slate-300">
          Este contacto está associado a mais de uma inscrição. Escolhe a
          tua.
        </p>
        <div className="space-y-2">
          {players.map((p) => (
            <button
              key={p.name}
              onClick={() => void doLookup(p.name)}
              disabled={lookingUp}
              className="group flex w-full items-center justify-between rounded-xl border border-white/15 bg-white/5 p-4 text-left transition-all hover:border-emerald-400/50 hover:bg-emerald-500/10 disabled:opacity-50"
            >
              <div>
                <div className="font-semibold text-white">{p.name}</div>
                {p.category && (
                  <div className="mt-0.5 text-xs text-slate-400">
                    Categoria {p.category}
                  </div>
                )}
              </div>
              <span className="text-slate-400 transition-transform group-hover:translate-x-1">
                <IconArrowRight />
              </span>
            </button>
          ))}
        </div>
        <button
          onClick={reset}
          className="mt-5 inline-flex w-full items-center justify-center gap-1.5 text-center text-xs text-slate-400 hover:text-white"
        >
          <IconArrowLeft />
          Mudar contacto
        </button>
      </div>
    );
  }

  // =========================================================================
  // TELA 3: jogos do jogador identificado
  // =========================================================================
  return (
    <div>
      {/* Identificação confirmada */}
      <div
        className="mb-4 rounded-2xl border p-4 backdrop-blur-xl"
        style={{
          background: `${accentColor}20`,
          borderColor: `${accentColor}50`,
        }}
      >
        <div className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-300">
          <IconCheck className="h-3 w-3" />
          Identificado como
        </div>
        <div className="mt-1 flex items-baseline justify-between gap-2">
          <div className="text-lg font-extrabold text-white">
            {selectedPlayer!.name}
            {selectedPlayer!.category && (
              <span
                className="ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                style={{
                  background: `${accentColor}40`,
                  color: "#fff",
                }}
              >
                {selectedPlayer!.category}
              </span>
            )}
          </div>
          <button
            onClick={reset}
            className="text-[11px] text-emerald-200 underline hover:text-white"
          >
            Mudar
          </button>
        </div>
      </div>

      {/* Lista jogos / estado vazio */}
      {games.length === 0 ? (
        <div className={`${cardClass} text-center`}>
          <div
            className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-full"
            style={{
              background: `${accentColor}20`,
              color: accentColor,
            }}
          >
            <IconRacket />
          </div>
          <h2 className="text-lg font-bold text-white">
            Sem jogos definidos ainda
          </h2>
          <p className="mt-1.5 text-sm text-slate-300">
            O organizador ainda não publicou os teus jogos no PadelTeams.
            Volta mais tarde.
          </p>
        </div>
      ) : (
        <>
          <h2 className="mb-3 px-1 text-xs font-bold uppercase tracking-wider text-slate-400">
            Os teus jogos <span className="text-emerald-400">({games.length})</span>
          </h2>
          <div className="space-y-3">
            {games.map((g) => (
              <article
                key={g.id}
                className="overflow-hidden rounded-2xl border border-white/10 bg-white/5 shadow-xl shadow-black/20 backdrop-blur-xl transition-all hover:border-white/20"
              >
                <div className="flex items-stretch">
                  {/* Hora + Campo (lado esquerdo, accent color) */}
                  <div
                    className="flex shrink-0 flex-col items-center justify-center px-4 py-4 text-white"
                    style={{ background: `${accentColor}30` }}
                  >
                    <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-200">
                      {formatDayShort(g.scheduledAt)}
                    </div>
                    <div className="text-2xl font-black leading-none">
                      {formatTime(g.scheduledAt)}
                    </div>
                    <div className="mt-1.5 inline-flex items-center rounded-md bg-black/30 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-200">
                      {g.field}
                    </div>
                  </div>

                  {/* Teams */}
                  <div className="flex min-w-0 flex-1 flex-col justify-center px-4 py-3">
                    <div className="text-sm font-semibold text-white">
                      {g.teamA}
                    </div>
                    <div
                      className="my-1.5 text-[10px] font-black"
                      style={{ color: accentColor }}
                    >
                      VS
                    </div>
                    <div className="text-sm font-semibold text-white">
                      {g.teamB}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setSelectedGame(g);
                    setSubmittedId(null);
                  }}
                  className="flex w-full items-center justify-center gap-2 border-t border-white/10 px-4 py-2.5 text-xs font-bold text-emerald-300 transition-all hover:bg-emerald-500/10 hover:text-emerald-200"
                >
                  <IconEdit />
                  Pedir alteração de horário
                </button>
              </article>
            ))}
          </div>
        </>
      )}

      {selectedGame && selectedPlayer && (
        <RequestModal
          competitionCode={competitionCode}
          accentColor={accentColor}
          game={selectedGame}
          requesterName={selectedPlayer.name}
          requesterPhone={selectedPlayer.phone ?? identifier}
          competitionDates={competitionDates}
          onClose={() => {
            setSelectedGame(null);
            setSubmittedId(null);
          }}
          onSubmitted={(id) => setSubmittedId(id)}
          submittedId={submittedId}
        />
      )}
    </div>
  );
}

// =============================================================================
// REQUEST MODAL
// =============================================================================
interface TimeSlot {
  day: string;
  from: string;
  to: string;
}

/**
 * Calcula as opções de dia para reagendamento. Regra: só permitir o próprio
 * dia do jogo OU o dia seguinte (cap do range do torneio).
 *
 * Ex: jogo dia 13 num torneio 13-20 → opções: [13, 14]
 *     jogo dia 20 num torneio 13-20 → opções: [20]
 */
function buildDayOptions(
  dates: { from: string; to: string } | null,
  gameDay: string,
): string[] {
  if (!dates || !gameDay) return [];

  const tournamentEnd = new Date(`${dates.to}T12:00:00`);
  const game = new Date(`${gameDay}T12:00:00`);
  if (isNaN(game.getTime())) return [];

  const days: string[] = [gameDay];

  // Adicionar dia seguinte (se cabe no torneio)
  const next = new Date(game);
  next.setDate(next.getDate() + 1);
  if (next <= tournamentEnd) {
    const iso = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-${String(next.getDate()).padStart(2, "0")}`;
    days.push(iso);
  }

  return days;
}

function formatSlotsForApi(slots: TimeSlot[]): string {
  return slots
    .filter((s) => s.day && s.from && s.to)
    .map((s) => `${formatDayLong(s.day)} ${s.from}–${s.to}`)
    .join(" · ");
}

function RequestModal({
  competitionCode,
  accentColor,
  game,
  requesterName,
  requesterPhone,
  competitionDates,
  onClose,
  onSubmitted,
  submittedId,
}: {
  competitionCode: string;
  accentColor: string;
  game: GameForUI;
  requesterName: string;
  requesterPhone: string;
  competitionDates: { from: string; to: string } | null;
  onClose: () => void;
  onSubmitted: (id: string) => void;
  submittedId: string | null;
}) {
  const [reason, setReason] = useState("");
  // Default: pré-seleccionar o dia do jogo (jogador pode mudar para o dia
  // seguinte se quiser)
  const defaultDay = game.scheduledAt.slice(0, 10);
  const [slots, setSlots] = useState<TimeSlot[]>([
    { day: defaultDay, from: "17:00", to: "22:00" },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [acceptances, setAcceptances] = useState<
    { player_name: string; player_role: string; acceptance_token: string }[]
  >([]);

  const dayOptions = buildDayOptions(
    competitionDates,
    game.scheduledAt.slice(0, 10),
  );
  const gameDay = game.scheduledAt.slice(0, 10);

  function updateSlot(idx: number, patch: Partial<TimeSlot>) {
    setSlots((prev) =>
      prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)),
    );
  }
  function addSlot() {
    setSlots((prev) => [...prev, { day: defaultDay, from: "17:00", to: "22:00" }]);
  }
  function removeSlot(idx: number) {
    setSlots((prev) => prev.filter((_, i) => i !== idx));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const preferredSlot = formatSlotsForApi(slots);
      const res = await fetch("/api/reschedule-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          competitionCode,
          padelteamsGameId: game.id,
          requesterName,
          requesterPhone,
          reason,
          preferredSlot: preferredSlot || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || `Erro ${res.status}`);
        setSubmitting(false);
        return;
      }
      setAcceptances(data.acceptances ?? []);
      onSubmitted(data.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro de rede");
    } finally {
      setSubmitting(false);
    }
  }

  // Tela de sucesso
  if (submittedId) {
    const preferredText = formatSlotsForApi(slots);
    const origin =
      typeof window !== "undefined" ? window.location.origin : "";

    const intro =
      `Olá! Pedi alteração de horário para o nosso jogo:\n\n` +
      `📅 ${formatDayLong(game.scheduledAt.slice(0, 10))} às ${formatTime(game.scheduledAt)}\n` +
      `🎾 ${game.teamA} vs ${game.teamB}\n` +
      `🏟 ${game.field}\n\n` +
      `${preferredText ? `Disponibilidade alternativa: ${preferredText}\n\n` : ""}` +
      `*Por favor cada um confirma se concorda* (cada link é único):\n\n` +
      acceptances
        .map((a) => `${a.player_name}: ${origin}/c/${a.acceptance_token}`)
        .join("\n");
    const waText = encodeURIComponent(intro);

    return (
      <ModalShell onClose={onClose} title="Pedido enviado">
        <div className="space-y-4">
          <div
            className="mx-auto grid h-16 w-16 place-items-center rounded-full"
            style={{
              background: `linear-gradient(135deg, ${accentColor}, ${accentColor}aa)`,
              boxShadow: `0 0 40px ${accentColor}60`,
            }}
          >
            <IconCheck className="h-8 w-8 text-white" />
          </div>
          <p className="text-center text-sm text-slate-200">
            O teu pedido foi registado.
          </p>

          {acceptances.length > 0 ? (
            <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-3.5 text-xs text-emerald-100">
              <b className="mb-1 flex items-center gap-1.5 text-emerald-300">
                <IconPhone className="h-3 w-3" />
                SMS enviado
              </b>
              Os {acceptances.length} jogadores envolvidos receberam um SMS
              com o link para aceitar. Podes também partilhar no grupo WhatsApp:
            </div>
          ) : (
            <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 p-3.5 text-xs text-amber-100">
              Não conseguimos identificar os outros jogadores nos contactos.
              O clube vai avaliar directamente.
            </div>
          )}

          <a
            href={`https://wa.me/?text=${waText}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-green-500 px-4 py-3.5 text-sm font-bold text-white shadow-lg shadow-green-500/30 transition-all hover:scale-[1.02] hover:bg-green-600 active:scale-[0.98]"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448L.057 24zM6.597 20.235c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.881.002-5.459-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.881-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.982zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
            </svg>
            Partilhar no WhatsApp
          </a>
          <button
            onClick={onClose}
            className="block w-full text-center text-sm text-slate-400 underline hover:text-white"
          >
            Fechar
          </button>
        </div>
      </ModalShell>
    );
  }

  // Tela de formulário
  return (
    <ModalShell onClose={onClose} title="Pedido de alteração">
      <div className="mb-4 rounded-xl border border-white/10 bg-white/5 p-3">
        <div className="text-sm font-bold text-white">
          {game.teamA}{" "}
          <span style={{ color: accentColor }}>VS</span> {game.teamB}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
          <span className="inline-flex items-center gap-1">
            <IconCalendar />
            {formatDayLong(game.scheduledAt.slice(0, 10))}
          </span>
          <span className="inline-flex items-center gap-1">
            <IconClock />
            {formatTime(game.scheduledAt)}
          </span>
          <span className="inline-flex items-center gap-1">
            <IconPin />
            {game.field}
          </span>
        </div>
      </div>

      <div
        className="mb-4 rounded-xl border px-3 py-2 text-xs"
        style={{
          background: `${accentColor}20`,
          borderColor: `${accentColor}50`,
          color: "#fff",
        }}
      >
        Identificado como <b>{requesterName}</b>
      </div>

      <form onSubmit={submit} className="space-y-4">
        <Field label="Motivo">
          <textarea
            required
            minLength={5}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Conflito com viagem de trabalho, doença, etc."
            rows={3}
            className={`${inputBaseClass} px-3 py-2.5 text-sm`}
          />
        </Field>

        <div>
          <div className="mb-2 flex items-baseline justify-between">
            <span className="block text-xs font-bold uppercase tracking-wider text-slate-300">
              Disponibilidade para reagendar
            </span>
            <span className="text-[10px] text-slate-500">opcional</span>
          </div>

          {slots.map((slot, idx) => (
            <div
              key={idx}
              className="mb-2 rounded-xl border border-white/10 bg-white/5 p-3"
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Opção {idx + 1}
                </span>
                {slots.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeSlot(idx)}
                    className="text-[11px] text-red-300 underline hover:text-red-200"
                  >
                    Remover
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto_auto]">
                <select
                  value={slot.day}
                  onChange={(e) => updateSlot(idx, { day: e.target.value })}
                  className={`${inputBaseClass} px-2.5 py-2 text-sm`}
                >
                  {dayOptions.map((d) => (
                    <option key={d} value={d}>
                      {formatDayLong(d)}
                      {d === gameDay ? " (mesmo dia)" : " (dia seguinte)"}
                    </option>
                  ))}
                </select>
                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                  <span>das</span>
                  <input
                    type="time"
                    value={slot.from}
                    onChange={(e) => updateSlot(idx, { from: e.target.value })}
                    step={900}
                    className={`${inputBaseClass} px-2 py-1.5 text-sm`}
                  />
                </div>
                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                  <span>às</span>
                  <input
                    type="time"
                    value={slot.to}
                    onChange={(e) => updateSlot(idx, { to: e.target.value })}
                    step={900}
                    className={`${inputBaseClass} px-2 py-1.5 text-sm`}
                  />
                </div>
              </div>
            </div>
          ))}

          <button
            type="button"
            onClick={addSlot}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-white/20 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-300 transition-all hover:border-emerald-400/50 hover:bg-emerald-500/10 hover:text-emerald-200"
          >
            <IconPlus />
            Adicionar outro horário disponível
          </button>
        </div>

        {error && (
          <div className="rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
            {error}
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="flex-1 rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-200 transition-all hover:bg-white/10 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="flex-[2] rounded-xl px-4 py-3 text-sm font-bold text-white shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
            style={{
              background: `linear-gradient(135deg, ${accentColor}, ${accentColor}dd)`,
              boxShadow: `0 8px 24px -8px ${accentColor}`,
            }}
          >
            <span className="inline-flex items-center justify-center gap-2">
              {submitting ? "A enviar..." : "Submeter pedido"}
              {!submitting && <IconArrowRight />}
            </span>
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

// =============================================================================
// MODAL SHELL (também com glassmorphism dark)
// =============================================================================
function ModalShell({
  children,
  onClose,
  title,
}: {
  children: React.ReactNode;
  onClose: () => void;
  title: string;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/80 backdrop-blur-md sm:items-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-t-3xl border border-white/10 bg-slate-900/95 shadow-2xl shadow-black/80 backdrop-blur-xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <h2 className="text-base font-bold text-white">{title}</h2>
          <button
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-lg text-2xl leading-none text-slate-400 transition hover:bg-white/10 hover:text-white"
            aria-label="Fechar"
          >
            ×
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-300">
        {label}
      </span>
      {children}
    </label>
  );
}

// =============================================================================
// HELPERS
// =============================================================================
function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function formatDayShort(iso: string): string {
  const d = new Date(iso);
  const w = d.toLocaleDateString("pt-PT", { weekday: "short" });
  const dd = String(d.getDate()).padStart(2, "0");
  return `${w.toUpperCase().slice(0, 3)} ${dd}`;
}

function formatDayLong(day: string): string {
  const d = new Date(`${day}T12:00:00`);
  const weekday = d.toLocaleDateString("pt-PT", { weekday: "long" });
  const dd = d.toLocaleDateString("pt-PT", { day: "2-digit", month: "long" });
  return `${weekday[0].toUpperCase()}${weekday.slice(1)}, ${dd}`;
}
