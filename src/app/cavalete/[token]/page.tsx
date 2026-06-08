import { notFound } from "next/navigation";
import { CavaleteView } from "./CavaleteView";

export const dynamic = "force-dynamic";

export default async function CavaletePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  if (!token || token.length < 8) notFound();
  return <CavaleteView token={token} />;
}
