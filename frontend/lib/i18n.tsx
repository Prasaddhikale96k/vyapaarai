"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

export type Lang = "en" | "hi";
const KEY = "vyapaarai-lang";

const STRINGS: Record<Lang, Record<string, string>> = {
  en: {
    nav_dashboard: "Dashboard",
    nav_copilot: "Copilot",
    nav_data: "Data & Sync",
    nav_actions: "Actions",
    tagline: "AI suggests. Owner decides.",
    login_title: "VyapaarAI Login",
    login_sub: "Get OTP on your registered WhatsApp number.",
    empty_pending: "Nothing pending — press Generate",
    empty_generic: "Nothing here yet",
    live: "Live",
    polling: "Polling",
    search_placeholder: "Type a command or search…",
  },
  hi: {
    nav_dashboard: "डैशबोर्ड",
    nav_copilot: "सहायक",
    nav_data: "डेटा व सिंक",
    nav_actions: "एक्शन",
    tagline: "AI सुझाए, मालिक तय करे।",
    login_title: "VyapaarAI लॉगिन",
    login_sub: "रजिस्टर्ड WhatsApp नंबर पर OTP लें।",
    empty_pending: "कुछ बाकी नहीं — Generate दबाओ",
    empty_generic: "अभी कुछ नहीं है",
    live: "लाइव",
    polling: "पोलिंग",
    search_placeholder: "कमांड लिखो या खोजो…",
  },
};

const Ctx = createContext<{ lang: Lang; t: (k: string) => string; toggle: () => void }>({
  lang: "en",
  t: (k) => k,
  toggle: () => {},
});

export function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState<Lang>("en");
  useEffect(() => {
    try {
      const s = window.localStorage.getItem(KEY);
      if (s === "en" || s === "hi") setLang(s);
    } catch {
      /* ignore */
    }
  }, []);
  const toggle = useCallback(() => {
    setLang((l) => {
      const n = l === "en" ? "hi" : "en";
      try {
        window.localStorage.setItem(KEY, n);
      } catch {
        /* ignore */
      }
      return n;
    });
  }, []);
  const t = useCallback((k: string) => STRINGS[lang][k] ?? k, [lang]);
  return <Ctx.Provider value={{ lang, t, toggle }}>{children}</Ctx.Provider>;
}

export function useLang() {
  return useContext(Ctx);
}
