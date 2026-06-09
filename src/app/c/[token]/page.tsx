/**
 * Alias curto de /confirmar/{token} para usar em SMS (caber em 160 chars).
 *
 * O SMS dispara este URL: https://site.ao/c/{token}
 * Internamente reusa o mesmo componente da página /confirmar.
 *
 * NOTA: Next.js não permite re-exportar `dynamic` (route segment config),
 * então declaramos directamente. O default export (componente) pode ser
 * re-exportado normalmente.
 */
export const dynamic = "force-dynamic";
export { default } from "../../confirmar/[token]/page";
