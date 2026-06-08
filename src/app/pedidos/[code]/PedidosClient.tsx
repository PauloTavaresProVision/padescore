"use client";

import { useState } from "react";

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
}

interface LookupResponse {
  players: PlayerOption[];
  selectedPlayer: PlayerOption | null;
  games: GameForUI[];
  error?: string;
}

interface Props {
  competitionCode: string;
}

/**
 * Fluxo:
 *   1. Tela inicial: pede telemóvel
 *   2. POST /api/pedidos/{code}/lookup
 *      - Se 1 jogador → mostra logo os jogos dele
 *      - Se vários (casal partilha número) → mostra dropdown para escolher
 *      - Se nenhum → mensagem de erro
 *   3. Mostra jogos do jogador identificado, com botão "Pedir alteração"
 *   4. Modal para preencher motivo + sugestão
 */
export function PedidosClient({ competitionCode }: Props) {
  const [phone, setPhone] = useState("");
  const [lookingUp, setLookingUp] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);

  // Estado após lookup
  const [players, setPlayers] = useState<PlayerOption[] | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerOption | null>(null);
  const [games, setGames] = useState<GameForUI[]>([]);

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
        body: JSON.stringify({ phone, selectedName }),
      });
      const data: LookupResponse = await res.json();
      if (!res.ok) {
        setLookupError(data.error || `Erro ${res.status}`);
        return;
      }
      setPlayers(data.players);
      setSelectedPlayer(data.selectedPlayer);
      setGames(data.games);
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

  // Tela 1: pede telemóvel
  if (!players) {
    return (
      <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <h2 className="mb-1 text-lg font-extrabold text-slate-900">
          Identifica-te
        </h2>
        <p className="mb-4 text-sm text-slate-600">
          Indica o teu telemóvel para vermos os teus jogos.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void doLookup();
          }}
          className="space-y-3"
        >
          <input
            type="tel"
            inputMode="tel"
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+244 923 456 789"
            disabled={lookingUp}
            className="w-full rounded-xl border border-slate-300 px-4 py-3 text-base shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:bg-slate-100"
            autoFocus
          />
          {lookupError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {lookupError}
            </div>
          )}
          <button
            type="submit"
            disabled={lookingUp || !phone.trim()}
            className="w-full rounded-xl bg-emerald-500 px-4 py-3 text-base font-bold text-white shadow-sm transition hover:bg-emerald-600 disabled:opacity-50"
          >
            {lookingUp ? "A procurar..." : "Ver os meus jogos"}
          </button>
          <p className="text-center text-[11px] text-slate-400">
            O teu número é usado apenas para validar a identidade e contactar-te
            sobre a alteração.
          </p>
        </form>
      </div>
    );
  }

  // Tela 2 (só se há +1 jogador com mesmo número): pede para escolher
  if (!selectedPlayer && players.length > 1) {
    return (
      <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <h2 className="mb-1 text-lg font-extrabold text-slate-900">
          Quem és?
        </h2>
        <p className="mb-4 text-sm text-slate-600">
          Este número está associado a mais de uma inscrição. Escolhe a tua.
        </p>
        <div className="space-y-2">
          {players.map((p) => (
            <button
              key={p.name}
              onClick={() => void doLookup(p.name)}
              disabled={lookingUp}
              className="flex w-full items-center justify-between rounded-xl border-2 border-slate-200 bg-white p-4 text-left transition hover:border-emerald-300 hover:bg-emerald-50 disabled:opacity-50"
            >
              <div>
                <div className="font-semibold text-slate-900">{p.name}</div>
                {p.category && (
                  <div className="mt-0.5 text-xs text-slate-500">
                    Categoria {p.category}
                  </div>
                )}
              </div>
              <span className="text-slate-400">→</span>
            </button>
          ))}
        </div>
        <button
          onClick={reset}
          className="mt-4 w-full text-center text-xs text-slate-400 underline hover:text-slate-600"
        >
          ← Voltar (mudar telemóvel)
        </button>
      </div>
    );
  }

  // Tela 3: lista de jogos do jogador
  return (
    <div>
      <div className="mb-4 rounded-xl bg-emerald-50 px-4 py-3 ring-1 ring-emerald-200">
        <div className="text-xs font-semibold text-emerald-700">
          Identificado como
        </div>
        <div className="mt-0.5 text-base font-extrabold text-slate-900">
          {selectedPlayer!.name}
          {selectedPlayer!.category && (
            <span className="ml-2 inline-flex items-center rounded-full bg-emerald-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-900">
              {selectedPlayer!.category}
            </span>
          )}
        </div>
        <button
          onClick={reset}
          className="mt-1 text-[11px] text-emerald-700 underline hover:text-emerald-900"
        >
          Não sou eu, mudar
        </button>
      </div>

      {games.length === 0 ? (
        <div className="rounded-2xl bg-white p-6 text-center shadow-sm ring-1 ring-slate-200">
          <div className="text-3xl">🎾</div>
          <h2 className="mt-2 text-lg font-bold text-slate-900">
            Sem jogos definidos ainda
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            O organizador ainda não publicou os teus jogos no PadelTeams. Volta
            mais tarde.
          </p>
        </div>
      ) : (
        <>
          <h2 className="mb-2 px-1 text-xs font-bold uppercase tracking-wider text-slate-500">
            Os teus jogos ({games.length})
          </h2>
          <div className="space-y-2">
            {games.map((g) => (
              <article
                key={g.id}
                className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200"
              >
                <div className="flex items-start gap-3">
                  <div className="shrink-0 rounded-lg bg-slate-100 px-3 py-2 text-center">
                    <div className="text-xs font-bold uppercase text-slate-500">
                      {formatDayShort(g.scheduledAt)}
                    </div>
                    <div className="text-xl font-extrabold leading-none text-slate-900">
                      {formatTime(g.scheduledAt)}
                    </div>
                    <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                      {g.field}
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-slate-900">
                      {g.teamA}
                    </div>
                    <div className="my-1 text-xs font-bold text-emerald-600">
                      VS
                    </div>
                    <div className="text-sm font-semibold text-slate-900">
                      {g.teamB}
                    </div>
                    <button
                      onClick={() => {
                        setSelectedGame(g);
                        setSubmittedId(null);
                      }}
                      className="mt-3 w-full rounded-lg bg-emerald-500 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-600"
                    >
                      ✎ Pedir alteração de horário
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </>
      )}

      {selectedGame && selectedPlayer && (
        <RequestModal
          competitionCode={competitionCode}
          game={selectedGame}
          requesterName={selectedPlayer.name}
          requesterPhone={phone}
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

function RequestModal({
  competitionCode,
  game,
  requesterName,
  requesterPhone,
  onClose,
  onSubmitted,
  submittedId,
}: {
  competitionCode: string;
  game: GameForUI;
  requesterName: string;
  requesterPhone: string;
  onClose: () => void;
  onSubmitted: (id: string) => void;
  submittedId: string | null;
}) {
  const [reason, setReason] = useState("");
  const [preferred, setPreferred] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/reschedule-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          competitionCode,
          padelteamsGameId: game.id,
          requesterName,
          requesterPhone,
          reason,
          preferredSlot: preferred || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || `Erro ${res.status}`);
        setSubmitting(false);
        return;
      }
      onSubmitted(data.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro de rede");
    } finally {
      setSubmitting(false);
    }
  }

  if (submittedId) {
    const waText = encodeURIComponent(
      `Olá! Pedi alteração de horário para o nosso jogo:\n\n` +
        `📅 ${formatDayLong(game.scheduledAt.slice(0, 10))} às ${formatTime(game.scheduledAt)}\n` +
        `🎾 ${game.teamA} vs ${game.teamB}\n` +
        `🏟 ${game.field}\n\n` +
        `${preferred ? `Sugeri: ${preferred}\n\n` : ""}` +
        `Aguardamos resposta do clube. 🙏`,
    );
    return (
      <ModalShell onClose={onClose} title="✓ Pedido enviado">
        <div className="space-y-4 text-center">
          <div className="text-5xl">✅</div>
          <p className="text-sm text-slate-700">
            O teu pedido foi registado. O clube vai avaliar e responder em
            breve.
          </p>
          <div className="rounded-lg bg-slate-50 p-3 text-left text-xs text-slate-600">
            <b>Próximo passo:</b> Avisa a tua parceira e os adversários no
            grupo WhatsApp:
          </div>
          <a
            href={`https://wa.me/?text=${waText}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-green-500 px-4 py-3 text-sm font-bold text-white transition hover:bg-green-600"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448L.057 24zM6.597 20.235c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.881.002-5.459-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.881-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.982zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
            </svg>
            Partilhar no WhatsApp
          </a>
          <button
            onClick={onClose}
            className="text-sm text-slate-500 underline hover:text-slate-700"
          >
            Fechar
          </button>
        </div>
      </ModalShell>
    );
  }

  return (
    <ModalShell onClose={onClose} title="Pedido de alteração">
      <div className="mb-4 rounded-lg bg-slate-50 p-3 text-sm">
        <div className="font-semibold text-slate-900">
          {game.teamA} <span className="text-emerald-600">VS</span> {game.teamB}
        </div>
        <div className="mt-1 text-xs text-slate-600">
          📅 {formatDayLong(game.scheduledAt.slice(0, 10))} às{" "}
          {formatTime(game.scheduledAt)} · 🏟 {game.field}
        </div>
      </div>

      <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
        Identificado como <b>{requesterName}</b>{" "}
        <span className="font-mono text-emerald-700">({requesterPhone})</span>
      </div>

      <form onSubmit={submit} className="space-y-3">
        <Field label="Motivo">
          <textarea
            required
            minLength={5}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Conflito com viagem de trabalho, doença, etc."
            rows={3}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          />
        </Field>
        <Field label="Sugestão de novo horário (opcional)">
          <input
            value={preferred}
            onChange={(e) => setPreferred(e.target.value)}
            placeholder="Sábado tarde ou domingo manhã"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          />
        </Field>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {error}
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="flex-[2] rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-600 disabled:opacity-50"
          >
            {submitting ? "A enviar..." : "Submeter pedido"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

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
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-2xl bg-white p-5 shadow-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">{title}</h2>
          <button
            onClick={onClose}
            className="text-2xl leading-none text-slate-400 hover:text-slate-700"
            aria-label="Fechar"
          >
            ×
          </button>
        </div>
        {children}
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
      <span className="mb-1 block text-xs font-semibold text-slate-700">
        {label}
      </span>
      {children}
    </label>
  );
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function formatDayShort(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("pt-PT", { weekday: "short", day: "2-digit" });
}

function formatDayLong(day: string): string {
  const d = new Date(`${day}T12:00:00`);
  const weekday = d.toLocaleDateString("pt-PT", { weekday: "long" });
  const dd = d.toLocaleDateString("pt-PT", { day: "2-digit", month: "long" });
  return `${weekday[0].toUpperCase()}${weekday.slice(1)}, ${dd}`;
}
