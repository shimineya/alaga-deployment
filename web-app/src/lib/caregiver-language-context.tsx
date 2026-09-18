import React, { createContext, useContext, useEffect } from 'react';

const STORAGE_KEY = 'alaga_caregiver_language';

export type CaregiverLanguage = 'en';

interface CaregiverLanguageContextValue {
  language: CaregiverLanguage;
  setLanguage: (lang: CaregiverLanguage) => void;
  t: (en: string, fil?: string) => string;
}

const CaregiverLanguageContext = createContext<CaregiverLanguageContextValue | null>(null);

export function CaregiverLanguageProvider({ children }: { children: React.ReactNode }) {
  // Clear any legacy saved Filipino preference from localStorage to ensure all users are on English
  useEffect(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
  }, []);

  const language: CaregiverLanguage = 'en';
  const setLanguage = () => {};
  const t = (en: string, _fil?: string) => en;

  return (
    <CaregiverLanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </CaregiverLanguageContext.Provider>
  );
}

export function useCaregiverLanguage() {
  const ctx = useContext(CaregiverLanguageContext);
  return ctx ?? { language: 'en' as CaregiverLanguage, setLanguage: () => {}, t: (en: string, _fil?: string) => en };
}

