"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

async function ensureOwner(tournamentId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data } = await supabase
    .from("tournaments")
    .select("owner_id")
    .eq("id", tournamentId)
    .single();
  if (!data || data.owner_id !== user.id) redirect("/admin");
  return user;
}

/**
 * Normaliza telemóvel para formato E.164.
 *
 * Aceita inputs comuns em Angola e Portugal:
 *   "923 456 789", "923456789"           → "+244923456789"
 *   "00244923456789"                      → "+244923456789"
 *   "+244923456789"                       → "+244923456789"
 *   "912 345 678" (sem 244)               → "+244912345678" (assume Angola)
 *   "+33 6 38 78 76 05" (internacional)   → "+33638787605"
 *   "923759754‬" (com Unicode invisible)  → "+244923759754"
 *
 * Recusa formatos que perderam dígitos (ex: "3.51912E+11" do Excel — não
 * dá para recuperar com certeza).
 */
function normalizePhone(raw: string, defaultCountry = "244"): string | null {
  if (!raw) return null;
  // Caso ofensivo: Excel converteu para notação científica (perdemos info)
  if (/[Ee]\+?\d/.test(raw) && /\d\.\d/.test(raw)) return null;
  // Remove TODOS os caracteres não-dígito/+ (inclui Unicode invisíveis tipo U+202C)
  let s = raw.replace(/[^\d+]/g, "");
  if (!s) return null;
  // Já em E.164
  if (s.startsWith("+")) {
    return s.length >= 10 ? s : null;
  }
  // Prefixo 00 → +
  if (s.startsWith("00")) {
    s = "+" + s.slice(2);
    return s.length >= 10 ? s : null;
  }
  // Só dígitos: heurística por comprimento
  if (s.length === 9) return `+${defaultCountry}${s}`;
  if (s.length === 12 && s.startsWith(defaultCountry)) return `+${s}`;
  if (s.length === 11 && s.startsWith("351")) return `+${s}`;
  // Outros formatos: assume tem código de país sem +
  return s.length >= 10 ? `+${s}` : null;
}

interface ParsedRow {
  name: string;
  phone: string;
  email?: string;
  gender?: "M" | "F";
  category?: string;
  raw: string;
}

const CATEGORY_HEADERS = ["F1", "F2", "F3", "M1", "M2", "M3", "M4"];

/**
 * Parse de CSV/TSV. Suporta 2 formatos:
 *
 *   A) Mínimo (2 colunas): Nome, Telemóvel
 *   B) Standard Bank full (12 colunas):
 *      Name, Gender, Phone, Email, Status, F1, F2, F3, M1, M2, M3, M4
 *      A categoria do jogador é a coluna F* ou M* que tem "Aceite".
 *
 * Aceita separador vírgula, ponto-e-vírgula ou tab. Cabeçalho detectado
 * automaticamente.
 */
function parseCsv(text: string): {
  rows: ParsedRow[];
  errors: { line: number; raw: string; reason: string }[];
} {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const rows: ParsedRow[] = [];
  const errors: { line: number; raw: string; reason: string }[] = [];

  // Detecta separador pela primeira linha com conteúdo
  const firstLine = lines[0] || "";
  let sep = ",";
  if (firstLine.includes(";")) sep = ";";
  else if (firstLine.includes("\t")) sep = "\t";

  // Parse header — detecta pela palavra-chave "Name"/"Nome"/"Telefone"/"Phone"
  // na primeira linha. NÃO usar /\d/.test porque o cabeçalho do Standard
  // Bank tem F1, F2, M1... que têm dígitos mas continuam a ser header.
  const headerCols = firstLine.split(sep).map((c) => c.trim().replace(/^"|"$/g, ""));
  const headerKeywords = ["name", "nome", "phone", "telefone", "telemóvel", "telemovel"];
  const hasHeader =
    headerCols.length > 1 &&
    headerCols.some((h) => headerKeywords.includes(h.trim().toLowerCase()));
  const startIdx = hasHeader ? 1 : 0;

  // Detectar formato Standard Bank (12 colunas com F1..M4 nos índices 5-11)
  const headerLower = headerCols.map((h) => h.toLowerCase());
  const isFullFormat =
    hasHeader &&
    headerCols.length >= 12 &&
    headerLower.includes("name") &&
    headerLower.includes("phone") &&
    CATEGORY_HEADERS.every((c) => headerCols.includes(c));

  // Em formato full: encontrar índices das colunas
  const colIdx = {
    name: hasHeader ? headerLower.indexOf("name") : 0,
    gender: hasHeader ? headerLower.indexOf("gender") : -1,
    phone: hasHeader ? headerLower.indexOf("phone") : 1,
    email: hasHeader ? headerLower.indexOf("email") : -1,
  };
  const categoryColIdx: Record<string, number> = {};
  if (isFullFormat) {
    for (const cat of CATEGORY_HEADERS) {
      categoryColIdx[cat] = headerCols.indexOf(cat);
    }
  }

  for (let i = startIdx; i < lines.length; i++) {
    const line = lines[i]!;
    const cols = line.split(sep).map((c) => c.trim().replace(/^"|"$/g, ""));
    if (cols.length < 2) {
      errors.push({
        line: i + 1,
        raw: line,
        reason: "Esperado pelo menos 2 colunas (nome, telemóvel)",
      });
      continue;
    }

    const name = (cols[colIdx.name] ?? cols[0] ?? "").trim();
    const rawPhone = cols[colIdx.phone] ?? cols[1] ?? "";
    if (!name) {
      errors.push({ line: i + 1, raw: line, reason: "Nome vazio" });
      continue;
    }
    const phone = normalizePhone(rawPhone);
    if (!phone) {
      errors.push({
        line: i + 1,
        raw: line,
        reason: `Telemóvel inválido ou em falta: "${rawPhone}"`,
      });
      continue;
    }

    const row: ParsedRow = { name, phone, raw: line };

    if (isFullFormat) {
      const emailVal = cols[colIdx.email]?.trim();
      if (emailVal) row.email = emailVal;

      const genderVal = cols[colIdx.gender]?.trim().toUpperCase();
      if (genderVal === "M" || genderVal === "F") row.gender = genderVal;

      // Categoria = primeira F*/M* que contém "Aceite"
      for (const cat of CATEGORY_HEADERS) {
        const idx = categoryColIdx[cat];
        if (idx >= 0 && cols[idx]?.trim().toLowerCase() === "aceite") {
          row.category = cat;
          break;
        }
      }
    }

    rows.push(row);
  }
  return { rows, errors };
}

export async function importContacts(
  tournamentId: string,
  formData: FormData,
) {
  await ensureOwner(tournamentId);
  const text = String(formData.get("csv_text") ?? "").trim();
  const file = formData.get("csv_file") as File | null;

  let csvContent = text;
  if (!csvContent && file && file.size > 0) {
    csvContent = await file.text();
  }
  if (!csvContent) {
    redirect(
      `/admin/tournaments/${tournamentId}/contacts?error=` +
        encodeURIComponent("Cola o CSV ou faz upload de um ficheiro"),
    );
  }

  const { rows, errors } = parseCsv(csvContent);
  if (rows.length === 0) {
    redirect(
      `/admin/tournaments/${tournamentId}/contacts?error=` +
        encodeURIComponent(
          `Nenhuma linha válida (${errors.length} erros). Verifica formato.`,
        ),
    );
  }

  // Upsert via admin client (bypass RLS — já validámos owner)
  const admin = createAdminClient();
  const { error } = await admin.from("players_contacts").upsert(
    rows.map((r) => ({
      tournament_id: tournamentId,
      name: r.name,
      phone: r.phone,
      email: r.email ?? null,
      gender: r.gender ?? null,
      category: r.category ?? null,
      updated_at: new Date().toISOString(),
    })),
    { onConflict: "tournament_id,phone" },
  );

  if (error) {
    redirect(
      `/admin/tournaments/${tournamentId}/contacts?error=` +
        encodeURIComponent(error.message),
    );
  }

  revalidatePath(`/admin/tournaments/${tournamentId}/contacts`);
  const msg =
    `${rows.length} contactos importados` +
    (errors.length > 0 ? ` (${errors.length} linhas com erros ignoradas)` : "");
  redirect(
    `/admin/tournaments/${tournamentId}/contacts?ok=` +
      encodeURIComponent(msg),
  );
}

export async function deleteContact(
  tournamentId: string,
  contactId: string,
) {
  await ensureOwner(tournamentId);
  const admin = createAdminClient();
  await admin
    .from("players_contacts")
    .delete()
    .eq("id", contactId)
    .eq("tournament_id", tournamentId);
  revalidatePath(`/admin/tournaments/${tournamentId}/contacts`);
}

export async function deleteAllContacts(tournamentId: string) {
  await ensureOwner(tournamentId);
  const admin = createAdminClient();
  await admin
    .from("players_contacts")
    .delete()
    .eq("tournament_id", tournamentId);
  revalidatePath(`/admin/tournaments/${tournamentId}/contacts`);
}
