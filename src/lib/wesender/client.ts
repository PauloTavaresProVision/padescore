/**
 * Cliente HTTP para o Wesender — SMS gateway em Angola.
 *
 * Docs: https://www.wesender.co.ao/devs.html
 *
 *   POST https://api.wesender.co.ao/envio/apikey
 *   {
 *     "ApiKey": "<key>",
 *     "Destino": ["929000000", "920000000"],
 *     "Mensagem": "texto",
 *     "CEspeciais": "false"   // false → substitui ç/ã/é por c/a/e (evita SMS multi-part)
 *   }
 *
 * Response:
 *   { "Exito": true, "Mensagem": "Foram enviados 2 de 2 mensagens", "Objeto": {...} }
 */

const API_URL = "https://api.wesender.co.ao/envio/apikey";
const FETCH_TIMEOUT_MS = 15_000;

export interface WesenderResponse {
  Exito: boolean;
  Mensagem: string;
  Objeto?: unknown;
}

/**
 * Normaliza telemóvel para formato Wesender: 9 dígitos sem código de país
 * para Angola. Recusa se não der para inferir formato angolano.
 *
 * Exemplos:
 *   "+244923456789" → "923456789"
 *   "923456789"     → "923456789"
 *   "00244923456789" → "923456789"
 *   "+351912345678" → null (não-angolano, Wesender é só AO)
 */
export function phoneForWesender(phone: string): string | null {
  if (!phone) return null;
  const digits = phone.replace(/[^\d]/g, "");

  // Remove código de país 244 (Angola) se presente
  if (digits.startsWith("244") && digits.length === 12) {
    return digits.slice(3);
  }
  if (digits.startsWith("00244") && digits.length === 14) {
    return digits.slice(5);
  }
  // Já em formato local de 9 dígitos
  if (digits.length === 9) return digits;

  // Outros (PT, FR, etc) — Wesender pode não suportar; melhor não enviar
  return null;
}

/**
 * Envia SMS para uma lista de números. Retorna o objecto de resposta do
 * Wesender. Throws em caso de erro de rede ou Exito=false.
 *
 * `message` deve estar normalizado (sem caracteres especiais se quiseres
 * SMS único — usamos CEspeciais=false que faz isso automaticamente).
 */
export async function sendSms(
  destinations: string[],
  message: string,
  options: { allowSpecialChars?: boolean } = {},
): Promise<WesenderResponse> {
  const apiKey = process.env.WESENDER_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Falta env var WESENDER_API_KEY — configura no .env.local",
    );
  }
  // Normalizar e filtrar números
  const validDests = destinations
    .map((d) => phoneForWesender(d))
    .filter((d): d is string => d !== null);
  if (validDests.length === 0) {
    throw new Error("Nenhum destino válido (esperado +244 ou 9 dígitos)");
  }

  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ApiKey: apiKey,
        Destino: validDests,
        Mensagem: message,
        CEspeciais: options.allowSpecialChars ? "true" : "false",
      }),
      signal: ac.signal,
    });
    const json = (await res.json().catch(() => null)) as WesenderResponse | null;
    if (!res.ok || !json) {
      throw new Error(`Wesender HTTP ${res.status}: ${JSON.stringify(json)}`);
    }
    if (!json.Exito) {
      throw new Error(`Wesender Exito=false: ${json.Mensagem}`);
    }
    return json;
  } finally {
    clearTimeout(t);
  }
}

/**
 * Envia SMS para 1 destinatário. Wrapper conveniente.
 */
export async function sendSmsOne(
  destination: string,
  message: string,
  options?: { allowSpecialChars?: boolean },
): Promise<WesenderResponse> {
  return sendSms([destination], message, options);
}
