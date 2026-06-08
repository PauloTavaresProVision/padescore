/**
 * Alias curto de /confirmar/{token} para usar em SMS (caber em 160 chars).
 *
 * O SMS dispara este URL: https://site.ao/c/{token}
 * Internamente reusa o mesmo componente da página /confirmar.
 */
export { default } from "../../confirmar/[token]/page";
export { dynamic } from "../../confirmar/[token]/page";
