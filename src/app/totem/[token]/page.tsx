import { notFound } from "next/navigation";
import { TotemView } from "./TotemView";

export const dynamic = "force-dynamic";

export default async function TotemPreviewPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  if (!token || token.length < 20) notFound();
  return <TotemView token={token} />;
}
