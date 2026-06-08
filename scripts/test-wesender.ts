import { sendSmsOne, phoneForWesender } from "../src/lib/wesender/client";

async function main() {
  // 1. Validar normalização
  console.log("Normalização:");
  console.log("  +244923456789  →", phoneForWesender("+244923456789"));
  console.log("  923456789       →", phoneForWesender("923456789"));
  console.log("  00244923456789  →", phoneForWesender("00244923456789"));
  console.log("  +351912345678   →", phoneForWesender("+351912345678"));
  console.log();

  // 2. Dry-run? Não — o user pediu para integrar e testar.
  // Vou usar o número do próprio Paulo Tavares (924364986) — ele está
  // na lista e provavelmente quer ver o SMS chegar.
  const target = process.argv[2] || "924364986";
  console.log(`A enviar SMS de teste para ${target}...`);

  try {
    const result = await sendSmsOne(
      target,
      `[TESTE Padescore] Esta e uma mensagem de teste do sistema de pedidos. Ignora. Link: https://padescore.ao/c/test123`,
    );
    console.log("✅ Resultado:", result);
  } catch (err) {
    console.error("❌ Erro:", err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

main();
