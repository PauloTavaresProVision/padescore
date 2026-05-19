/**
 * "Paulo Tavares" → "Paulo T"
 * "Maria Sofia Almeida Costa" → "Maria C"  (último apelido)
 * "John" → "John"
 * "" → ""
 *
 * Não escreve à força — só sugere. O operador pode override em qualquer altura.
 */
export function deriveShortName(full: string): string {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0];
  const first = parts[0];
  const lastInitial = parts[parts.length - 1].slice(0, 1).toUpperCase();
  return `${first} ${lastInitial}`;
}
