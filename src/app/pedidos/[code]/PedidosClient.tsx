"use client";

import { useState, useMemo } from "react";

export interface GameForUI {
  id: number;
  scheduledAt: string; // ISO
  field: string;
  teamA: string;
  teamB: string;
  status: "open" | "closed";
}

interface Props {
  competitionCode: string;
  games: GameForUI[];
}

/**
 * Lista os jogos com filtro por dia + busca por jogador.
 * Cada jogo tem botão "Pedir alteração" que abre modal com form.
 */
export function PedidosClient({ competitionCode, games }: Props) {
  const [query, setQuery] = useState("");
  const [dayFilter, setDayFilter] = useState<string>("all");
  const [selected, setSelected] = useState<GameForUI | null>(null);
  const [submittedId, setSubmittedId] = useState<string | null>(null);

  // Agrupar jogos por dia (YYYY-MM-DD)
  const games_filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return games.filter((g) => {
      if (g.status === "closed") return false; // só jogos abertos
      if (q) {
        if (
          !g.teamA.toLowerCase().includes(q) &&
          !g.teamB.toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      if (dayFilter !== "all") {
        const day = g.scheduledAt.slice(0, 10);
        if (day !== dayFilter) return false;
      }
      return true;
    });
  }, [games, query, dayFilter]);

  const days = useMemo(() => {
    const set = new Set<string>();
    games
      .filter((g) => g.status === "open")
      .forEach((g) => set.add(g.scheduledAt.slice(0, 10)));
    return [...set].sort();
  }, [games]);

  const byDay = useMemo(() => {
    const groups: Record<string, GameForUI[]> = {};
    for (const g of games_filtered) {
      const day = g.scheduledAt.slice(0, 10);
      (groups[day] ||= []).push(g);
    }
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [games_filtered]);

  return (
    <>
      {/* Filtros */}
      <div className="mb-4 grid gap-2 sm:grid-cols-[1fr_auto]">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="🔍 Procurar pelo teu nome…"
          className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
        />
        <select
          value={dayFilter}
          onChange={(e) => setDayFilter(e.target.value)}
          className="rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
        >
          <option value="all">Todos os dias</option>
          {days.map((d) => (
            <option key={d} value={d}>
              {formatDayLong(d)}
            </option>
          ))}
        </select>
      </div>

      {/* Lista de jogos por dia */}
      {byDay.length === 0 ? (
        <div className="rounded-xl bg-white p-6 text-center text-sm text-slate-500 shadow-sm ring-1 ring-slate-200">
          Sem jogos correspondentes ao filtro.
        </div>
      ) : (
        byDay.map(([day, items]) => (
          <section key={day} className="mb-5">
            <h2 className="mb-2 px-1 text-xs font-bold uppercase tracking-wider text-slate-500">
              {formatDayLong(day)} · {items.length} jogos
            </h2>
            <div className="space-y-2">
              {items.map((g) => (
                <article
                  key={g.id}
                  className="rounded-xl bg-white p-3 shadow-sm ring-1 ring-slate-200 sm:p-4"
                >
                  <div className="flex items-start gap-3">
                    <div className="shrink-0 rounded-lg bg-slate-100 px-3 py-2 text-center">
                      <div className="text-lg font-extrabold leading-none text-slate-900">
                        {formatTime(g.scheduledAt)}
                      </div>
                      <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                        {g.field}
                      </div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-sm">
                        <div className="truncate text-right font-semibold text-slate-900">
                          {g.teamA}
                        </div>
                        <div className="text-xs font-bold text-emerald-600">
                          VS
                        </div>
                        <div className="truncate font-semibold text-slate-900">
                          {g.teamB}
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setSelected(g);
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
          </section>
        ))
      )}

      {selected && (
        <RequestModal
          competitionCode={competitionCode}
          game={selected}
          onClose={() => {
            setSelected(null);
            setSubmittedId(null);
          }}
          onSubmitted={(id) => setSubmittedId(id)}
          submittedId={submittedId}
        />
      )}
    </>
  );
}

function RequestModal({
  competitionCode,
  game,
  onClose,
  onSubmitted,
  submittedId,
}: {
  competitionCode: string;
  game: GameForUI;
  onClose: () => void;
  onSubmitted: (id: string) => void;
  submittedId: string | null;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
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
          requesterName: name,
          requesterPhone: phone,
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
        `Aguardamos resposta do clube. Combinem entre nós? 🙏`,
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
            <b>Próximo passo:</b> Avisa a tua parceira e os adversários. Podes
            partilhar a info no grupo WhatsApp:
          </div>
          <a
            href={`https://wa.me/?text=${waText}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-green-500 px-4 py-3 text-sm font-bold text-white transition hover:bg-green-600"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448L.057 24zM6.597 20.235c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.881.002-5.459-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.881-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.982zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/>
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

      <form onSubmit={submit} className="space-y-3">
        <Field label="O teu nome">
          <input
            required
            minLength={2}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Maria João Santos"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          />
        </Field>
        <Field label="O teu telemóvel (com indicativo)">
          <input
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+244 923 456 789"
            inputMode="tel"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          />
          <p className="mt-1 text-xs text-slate-500">
            Usado para te contactarmos com a resposta. Não é partilhado.
          </p>
        </Field>
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

function formatDayLong(day: string): string {
  // day = YYYY-MM-DD
  const d = new Date(`${day}T12:00:00`);
  const weekday = d.toLocaleDateString("pt-PT", { weekday: "long" });
  const dd = d.toLocaleDateString("pt-PT", { day: "2-digit", month: "long" });
  return `${weekday[0].toUpperCase()}${weekday.slice(1)}, ${dd}`;
}
