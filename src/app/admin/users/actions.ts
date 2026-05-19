"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/** Garante sessão. Não há sistema de papéis — qualquer admin autenticado
 *  pode gerir utilizadores (consistente com o resto do backoffice). */
async function ensureAuthed() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return user;
}

function fail(msg: string): never {
  redirect("/admin/users?error=" + encodeURIComponent(msg));
}

export async function createUser(formData: FormData) {
  await ensureAuthed();

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const name = String(formData.get("name") ?? "").trim();

  if (!email || !password) fail("Email e password são obrigatórios.");
  if (password.length < 6) fail("Password tem de ter pelo menos 6 caracteres.");

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // sem fluxo de confirmação por email
    user_metadata: name ? { name } : {},
  });

  if (error) fail(error.message);

  revalidatePath("/admin/users");
  redirect("/admin/users?info=" + encodeURIComponent("Utilizador criado."));
}

export async function renameUser(userId: string, formData: FormData) {
  await ensureAuthed();
  const name = String(formData.get("name") ?? "").trim();

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(userId, {
    user_metadata: { name },
  });
  if (error) fail(error.message);

  revalidatePath("/admin/users");
  redirect("/admin/users?info=" + encodeURIComponent("Nome actualizado."));
}

export async function deleteUser(userId: string) {
  const me = await ensureAuthed();
  if (me.id === userId) fail("Não te podes apagar a ti próprio.");

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) fail(error.message);

  revalidatePath("/admin/users");
  redirect("/admin/users?info=" + encodeURIComponent("Utilizador removido."));
}

export async function resetUserPassword(userId: string, formData: FormData) {
  await ensureAuthed();
  const password = String(formData.get("password") ?? "");
  if (password.length < 6) fail("Password tem de ter pelo menos 6 caracteres.");

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(userId, { password });
  if (error) fail(error.message);

  revalidatePath("/admin/users");
  redirect("/admin/users?info=" + encodeURIComponent("Password redefinida."));
}
