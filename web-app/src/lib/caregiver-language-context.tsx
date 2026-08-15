import React, { createContext, useContext, useState, useEffect } from 'react';

const STORAGE_KEY = 'alaga_caregiver_language';

export type CaregiverLanguage = 'en' | 'fil';

interface CaregiverLanguageContextValue {
  language: CaregiverLanguage;
  setLanguage: (lang: CaregiverLanguage) => void;
  t: (en: string, fil: string) => string;
}

const CaregiverLanguageContext = createContext<CaregiverLanguageContextValue | null>(null);

export function CaregiverLanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<CaregiverLanguage>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return (stored === 'fil' || stored === 'en') ? stored : 'en';
    } catch {
      return 'en';
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, language);
    } catch {}
  }, [language]);

  const setLanguage = (lang: CaregiverLanguage) => setLanguageState(lang);
  const t = (en: string, fil: string) => (language === 'fil' ? fil : en);

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
