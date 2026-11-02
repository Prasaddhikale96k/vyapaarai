"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark";
const KEY = "vyapaarai-theme";

const Ctx = createContext<{ theme: Theme; toggle: () => void }>({ theme: "light", toggle: () => {} });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Cream-light ONLY theme (dark removed): hamesha light, purani saved dark bhi light.
  const [theme] = useState<Theme>("light");

  useEffect(() => {
    try {
      document.documentElement.dataset.theme = "light";
      document.documentElement.style.colorScheme = "light";
      document.documentElement.classList.remove("dark");
      window.localStorage.setItem(KEY, "light");
    } catch {
      /* ignore */
    }
  }, []);

  const toggle = useCallback(() => {}, []);
  return <Ctx.Provider value={{ theme, toggle }}>{children}</Ctx.Provider>;
}

export function useTheme() {
  return useContext(Ctx);
}
