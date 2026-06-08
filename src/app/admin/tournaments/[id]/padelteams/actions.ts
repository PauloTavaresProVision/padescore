"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  getCompetition,
  invalidatePadelTeamsCache,
} from "@/lib/padelteams/client";

/** Garante que o utilizador autenticado é dono do torneio. */
async function ensureOwner(tournamentId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: t } = await supabase
    .from("tournaments")
    .select("id, owner_id")
    .eq("id", tournamentId)
    .single();
  if (!t || t.owner_id !== user.id) redirect("/admin");
  return supabase;
}

function redirectWithError(tournamentId: string, message: string): never {
  redirect(
    `/admin/tournaments/${tournamentId}/padelteams?error=${encodeURIComponent(message)}`,
  );
}

/**
 * Grava o competition_code do PadelTeams no torneio. Antes de gravar,
 * valida que o código existe na API deles (evita gravar typos).
 */
export async function setCompetitionCode(
  tournamentId: string,
  formData: FormData,
) {
  const supabase = await ensureOwner(tournamentId);
  const code = String(formData.get("competition_code") ?? "").trim();

  if (!code) {
    redirectWithError(tournamentId, "Indica o código da competição.");
  }

  // Validar contra a API real antes de gravar
  try {
    await getCompetition(code);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro desconhecido";
    redirectWithError(
      tournamentId,
      `Código '${code}' não encontrado no PadelTeams: ${msg.slice(0, 100)}`,
    );
  }

  const { error } = await supabase
    .from("tournaments")
    .update({ padelteams_competition_code: code })
    .eq("id", tournamentId);

  if (error) {
    redirectWithError(tournamentId, error.message);
  }

  invalidatePadelTeamsCache();
  revalidatePath(`/admin/tournaments/${tournamentId}/padelteams`);
  redirect(`/admin/tournaments/${tournamentId}/padelteams`);
}

/**
 * Associa um court nosso a um padelteams_field_id. Aceita null para
 * desassociar.
 */
export async function setCourtFieldId(
  tournamentId: string,
  courtId: string,
  padelteamsFieldId: number | null,
) {
  const supabase = await ensureOwner(tournamentId);

  const { error } = await supabase
    .from("courts")
    .update({ padelteams_field_id: padelteamsFieldId })
    .eq("id", courtId)
    .eq("tournament_id", tournamentId);

  if (error) {
    throw new Error(error.message);
  }

  invalidatePadelTeamsCache();
  revalidatePath(`/admin/tournaments/${tournamentId}/padelteams`);
}

/**
 * Auto-match: para cada court sem padelteams_field_id, tenta encontrar
 * um field do PadelTeams com nome igual (normalizado).
 */
export async function autoMatchFields(tournamentId: string) {
  const supabase = await ensureOwner(tournamentId);

  // Buscar code do torneio
  const { data: t } = await supabase
    .from("tournaments")
    .select("padelteams_competition_code")
    .eq("id", tournamentId)
    .single();
  if (!t?.padelteams_competition_code) {
    redirectWithError(
      tournamentId,
      "Configura primeiro o código da competição.",
    );
  }

  // Buscar courts sem mapping
  const { data: courts } = await supabase
    .from("courts")
    .select("id, name, padelteams_field_id")
    .eq("tournament_id", tournamentId);

  // Buscar fields do PadelTeams (via snapshot completo)
  const { getCompetitionSnapshot } = await import("@/lib/padelteams/client");
  const snapshot = await getCompetitionSnapshot(t.padelteams_competition_code);

  // Unique fields
  const fieldsMap = new Map<number, { name: string; description: string }>();
  for (const g of snapshot.games) {
    if (g.field) fieldsMap.set(g.field.id, g.field);
  }

  const normalize = (s: string) =>
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .trim();

  let updated = 0;
  for (const c of courts ?? []) {
    if (c.padelteams_field_id) continue; // já mapeado, ignora
    const target = normalize(c.name);
    for (const [fid, f] of fieldsMap) {
      if (normalize(f.name) === target) {
        await supabase
          .from("courts")
          .update({ padelteams_field_id: fid })
          .eq("id", c.id);
        updated++;
        break;
      }
    }
  }

  invalidatePadelTeamsCache();
  revalidatePath(`/admin/tournaments/${tournamentId}/padelteams`);
  redirect(
    `/admin/tournaments/${tournamentId}/padelteams?ok=${updated}+campos+associados+automaticamente`,
  );
}
