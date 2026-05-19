import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Fieldset } from "@/components/ui/Card";
import { createUser } from "./actions";
import { UserRow } from "./UserRow";

export const dynamic = "force-dynamic";

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; info?: string }>;
}) {
  const sp = await searchParams;

  const supabase = await createClient();
  const {
    data: { user: me },
  } = await supabase.auth.getUser();

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.listUsers();
  const users = data?.users ?? [];

  return (
    <div>
      <div className="mb-8">
        <p className="text-sm text-slate-500">Backoffice</p>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-slate-900">Utilizadores</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-500">
          Contas que podem entrar no backoffice. Sem níveis de permissão — todas
          têm acesso total.
        </p>
      </div>

      {sp.error && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {sp.error}
        </div>
      )}
      {sp.info && (
        <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {sp.info}
        </div>
      )}

      <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
        <strong>Nota:</strong> torneios e jogadores são privados de cada conta.
        Um utilizador novo começa com um espaço vazio — não vê os torneios já
        criados por outra conta. Para vários operadores partilharem o mesmo
        evento, usem a <strong>mesma conta</strong> (o link curto do operador
        não precisa de login).
      </div>

      <Fieldset legend="Novo utilizador">
        <form action={createUser} className="grid gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="name" className="mb-1.5 block text-sm font-medium text-slate-700">
              Nome
            </label>
            <Input id="name" name="name" placeholder="Ex: Paulo Tavares" autoComplete="off" />
          </div>
          <div>
            <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-slate-700">
              Email
            </label>
            <Input id="email" name="email" type="email" required placeholder="pessoa@exemplo.com" autoComplete="off" />
          </div>
          <div>
            <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-slate-700">
              Password
            </label>
            <Input id="password" name="password" type="text" required placeholder="mín. 6 caracteres" autoComplete="off" />
          </div>
          <div className="sm:col-span-3">
            <Button type="submit">Criar utilizador</Button>
          </div>
        </form>
      </Fieldset>

      <div className="mt-8">
        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            Falha a listar utilizadores: {error.message}
          </div>
        ) : (
          <ul className="space-y-2">
            {users.map((u) => (
              <UserRow
                key={u.id}
                id={u.id}
                email={u.email ?? "—"}
                name={(u.user_metadata?.name as string | undefined) ?? ""}
                createdAt={u.created_at}
                isSelf={u.id === me?.id}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
