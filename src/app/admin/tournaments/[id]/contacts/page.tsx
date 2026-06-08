import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ChevronLeftIcon, TrashIcon } from "@/components/icons";
import {
  importContacts,
  deleteContact,
  deleteAllContacts,
} from "./actions";

export const dynamic = "force-dynamic";

/**
 * Admin: importar Excel/CSV de contactos dos jogadores.
 *
 * O PadelTeams não expõe telemóveis dos jogadores (privacidade), por isso
 * o clube tem que fornecer essa lista manualmente. Usada para:
 *   - SMS OTP no submit de pedidos de alteração (F2)
 *   - WhatsApp notify após aprovação (F2)
 */
export default async function ContactsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const { id: tournamentId } = await params;
  const sp = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: tournament } = await supabase
    .from("tournaments")
    .select("id, name, owner_id")
    .eq("id", tournamentId)
    .single();
  if (!tournament) notFound();
  if (tournament.owner_id !== user.id) redirect("/admin");

  const { data: contacts } = await supabase
    .from("players_contacts")
    .select(
      "id, name, phone, email, gender, category, padelteams_player_id, created_at",
    )
    .eq("tournament_id", tournamentId)
    .order("category", { ascending: true, nullsFirst: false })
    .order("name", { ascending: true });

  // Agrupar contagem por categoria
  const byCategory: Record<string, number> = {};
  for (const c of contacts ?? []) {
    const key = c.category ?? "—";
    byCategory[key] = (byCategory[key] ?? 0) + 1;
  }

  return (
    <div>
      <Link
        href={`/admin/tournaments/${tournamentId}`}
        className="inline-flex items-center gap-1 text-sm text-slate-500 transition hover:text-slate-900"
      >
        <ChevronLeftIcon className="h-4 w-4" />
        Voltar ao torneio
      </Link>
      <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900">
        Contactos dos jogadores
      </h1>
      <p className="mt-1 mb-6 max-w-2xl text-sm text-slate-500">
        Lista de telemóveis usada para SMS OTP (validar identidade nos pedidos
        de alteração) e WhatsApp (notificar parceira/adversários após
        aprovação). O PadelTeams não expõe contactos — temos de importar.
      </p>

      {sp.error && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {sp.error}
        </div>
      )}
      {sp.ok && (
        <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          ✓ {sp.ok.replace(/\+/g, " ")}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_auto]">
        <section className="rounded-2xl bg-white p-5 ring-1 ring-slate-200/80 shadow-[0_1px_3px_rgba(16,24,40,0.06)]">
          <h2 className="mb-1 text-base font-bold text-slate-900">
            Importar lista
          </h2>
          <p className="mb-4 text-xs text-slate-500">
            Cola directamente do Excel (Ctrl+A → Ctrl+C nas 2 colunas) ou
            faz upload de CSV. Formato: <b>Nome, Telemóvel</b>. Primeira linha
            pode ser cabeçalho (detectado automaticamente). Telemóveis sem
            código de país (9 dígitos) assumem-se Angola (+244).
          </p>

          <form action={importContacts.bind(null, tournamentId)} className="space-y-4">
            <div>
              <label
                htmlFor="csv_text"
                className="mb-1.5 block text-sm font-medium text-slate-700"
              >
                Colar do Excel
              </label>
              <textarea
                id="csv_text"
                name="csv_text"
                rows={10}
                placeholder={`Maria João Santos\t923 456 789\nPedro Costa\t+351 912 345 678\nAna Lima\t934567890`}
                className="block w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>
            <div className="text-center text-xs text-slate-400">— ou —</div>
            <div>
              <label
                htmlFor="csv_file"
                className="mb-1.5 block text-sm font-medium text-slate-700"
              >
                Upload CSV
              </label>
              <input
                id="csv_file"
                name="csv_file"
                type="file"
                accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values,text/plain"
                className="block w-full cursor-pointer rounded-lg border border-slate-300 bg-white text-sm text-slate-500 file:mr-4 file:cursor-pointer file:border-0 file:bg-slate-100 file:px-4 file:py-3 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200"
              />
              <p className="mt-1.5 text-xs text-slate-500">
                Aceita CSV (vírgula ou ponto-e-vírgula) ou TSV (tab).
              </p>
            </div>
            <button
              type="submit"
              className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-600"
            >
              Importar contactos
            </button>
          </form>
        </section>

        <aside className="lg:w-[320px]">
          <div className="rounded-2xl bg-slate-50 p-4 text-xs text-slate-600 ring-1 ring-slate-200">
            <div className="mb-2 font-bold text-slate-700">Como funciona</div>
            <ol className="ml-4 list-decimal space-y-1.5">
              <li>Excel do clube tem 2 colunas: Nome | Telemóvel</li>
              <li>Selecciona ambas, copia (Ctrl+C), cola na caixa</li>
              <li>Submete. Cada linha vira 1 contacto</li>
              <li>
                Re-importar actualiza contactos existentes (match por
                telemóvel)
              </li>
              <li>
                Pedidos no jogador validam telemóvel contra esta lista (F2 —
                SMS OTP)
              </li>
            </ol>
          </div>
        </aside>
      </div>

      <section className="mt-8 rounded-2xl bg-white ring-1 ring-slate-200/80 shadow-[0_1px_3px_rgba(16,24,40,0.06)]">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Contactos importados
            </h2>
            <p className="text-xs text-slate-500">
              {contacts?.length ?? 0} contactos
              {Object.entries(byCategory).length > 0 && (
                <>
                  {" — "}
                  {Object.entries(byCategory)
                    .sort()
                    .map(([cat, n]) => (
                      <span
                        key={cat}
                        className="ml-1 inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700"
                      >
                        {cat}: {n}
                      </span>
                    ))}
                </>
              )}
            </p>
          </div>
          {contacts && contacts.length > 0 && (
            <form action={deleteAllContacts.bind(null, tournamentId)}>
              <button
                type="submit"
                className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:border-red-300 hover:bg-red-50"
                title="Apagar TODOS os contactos deste torneio"
              >
                Apagar tudo
              </button>
            </form>
          )}
        </div>
        {!contacts || contacts.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            Nenhum contacto importado ainda. Cola o Excel acima.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-5 py-3 w-16">Cat.</th>
                <th className="px-5 py-3">Nome</th>
                <th className="px-5 py-3">Telemóvel</th>
                <th className="px-5 py-3">Email</th>
                <th className="px-5 py-3 w-12"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {contacts.map((c) => (
                <tr key={c.id}>
                  <td className="px-5 py-3">
                    {c.category ? (
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          c.category.startsWith("F")
                            ? "bg-pink-100 text-pink-900"
                            : "bg-blue-100 text-blue-900"
                        }`}
                      >
                        {c.category}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-300">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-sm">
                    {c.name}
                    {c.gender && (
                      <span className="ml-1 text-[10px] text-slate-400">
                        ({c.gender})
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3 font-mono text-xs text-slate-600">
                    {c.phone}
                  </td>
                  <td className="px-5 py-3 text-xs text-slate-500">
                    {c.email ?? <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-5 py-3">
                    <form
                      action={deleteContact.bind(null, tournamentId, c.id)}
                    >
                      <button
                        type="submit"
                        className="text-slate-300 transition hover:text-red-600"
                        title="Apagar contacto"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
