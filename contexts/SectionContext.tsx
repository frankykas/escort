"use client";

/**
 * SectionContext — controls which "world" the user is browsing.
 *
 * Two sections coexist in the same app:
 *   • escorts  — classifieds, listings, in-person services  (pink theme)
 *   • creators — content, subscriptions, OF-style media     (violet theme)
 *
 * Any user (client, creator, or escort) can toggle between sections.
 * The choice persists in localStorage.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export type AppSection = "escorts" | "creators";

type SectionContextValue = {
  section: AppSection;
  isEscortSection: boolean;
  isCreatorSection: boolean;
  setSection: (s: AppSection) => void;
  toggle: () => void;
};

const STORAGE_KEY = "cleopatra_section";

const SectionContext = createContext<SectionContextValue>({
  section: "escorts",
  isEscortSection: true,
  isCreatorSection: false,
  setSection: () => {},
  toggle: () => {},
});

export function SectionProvider({ children }: { children: React.ReactNode }) {
  const [section, setSectionState] = useState<AppSection>("escorts");
  const [mounted, setMounted] = useState(false);

  // Hydrate from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "creators" || stored === "escorts") {
      setSectionState(stored);
    }
    setMounted(true);
  }, []);

  // Sync to localStorage + data attribute on <body>
  useEffect(() => {
    if (!mounted) return;
    localStorage.setItem(STORAGE_KEY, section);
    document.body.setAttribute("data-section", section);
  }, [section, mounted]);

  const setSection = useCallback((s: AppSection) => {
    setSectionState(s);
  }, []);

  const toggle = useCallback(() => {
    setSectionState((prev) => (prev === "escorts" ? "creators" : "escorts"));
  }, []);

  const value = useMemo<SectionContextValue>(
    () => ({
      section,
      isEscortSection: section === "escorts",
      isCreatorSection: section === "creators",
      setSection,
      toggle,
    }),
    [section, setSection, toggle],
  );

  return (
    <SectionContext.Provider value={value}>
      {children}
    </SectionContext.Provider>
  );
}

export function useSection(): SectionContextValue {
  return useContext(SectionContext);
}
