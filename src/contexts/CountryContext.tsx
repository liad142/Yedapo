"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";

// Country code to name mapping — derived from APPLE_PODCAST_COUNTRIES (uppercase codes)
export const COUNTRY_OPTIONS: { code: string; name: string; flag: string }[] = [
  { code: "DZ", name: "Algeria", flag: "🇩🇿" },
  { code: "AO", name: "Angola", flag: "🇦🇴" },
  { code: "AI", name: "Anguilla", flag: "🇦🇮" },
  { code: "AG", name: "Antigua and Barbuda", flag: "🇦🇬" },
  { code: "AR", name: "Argentina", flag: "🇦🇷" },
  { code: "AM", name: "Armenia", flag: "🇦🇲" },
  { code: "AU", name: "Australia", flag: "🇦🇺" },
  { code: "AT", name: "Austria", flag: "🇦🇹" },
  { code: "AZ", name: "Azerbaijan", flag: "🇦🇿" },
  { code: "BS", name: "Bahamas", flag: "🇧🇸" },
  { code: "BH", name: "Bahrain", flag: "🇧🇭" },
  { code: "BB", name: "Barbados", flag: "🇧🇧" },
  { code: "BE", name: "Belgium", flag: "🇧🇪" },
  { code: "BZ", name: "Belize", flag: "🇧🇿" },
  { code: "BM", name: "Bermuda", flag: "🇧🇲" },
  { code: "BO", name: "Bolivia", flag: "🇧🇴" },
  { code: "BW", name: "Botswana", flag: "🇧🇼" },
  { code: "BR", name: "Brazil", flag: "🇧🇷" },
  { code: "BN", name: "Brunei", flag: "🇧🇳" },
  { code: "BG", name: "Bulgaria", flag: "🇧🇬" },
  { code: "CA", name: "Canada", flag: "🇨🇦" },
  { code: "KY", name: "Cayman Islands", flag: "🇰🇾" },
  { code: "CL", name: "Chile", flag: "🇨🇱" },
  { code: "CO", name: "Colombia", flag: "🇨🇴" },
  { code: "CR", name: "Costa Rica", flag: "🇨🇷" },
  { code: "HR", name: "Croatia", flag: "🇭🇷" },
  { code: "CY", name: "Cyprus", flag: "🇨🇾" },
  { code: "CZ", name: "Czech Republic", flag: "🇨🇿" },
  { code: "DK", name: "Denmark", flag: "🇩🇰" },
  { code: "DM", name: "Dominica", flag: "🇩🇲" },
  { code: "DO", name: "Dominican Republic", flag: "🇩🇴" },
  { code: "EC", name: "Ecuador", flag: "🇪🇨" },
  { code: "EG", name: "Egypt", flag: "🇪🇬" },
  { code: "SV", name: "El Salvador", flag: "🇸🇻" },
  { code: "EE", name: "Estonia", flag: "🇪🇪" },
  { code: "FI", name: "Finland", flag: "🇫🇮" },
  { code: "FR", name: "France", flag: "🇫🇷" },
  { code: "DE", name: "Germany", flag: "🇩🇪" },
  { code: "GH", name: "Ghana", flag: "🇬🇭" },
  { code: "GR", name: "Greece", flag: "🇬🇷" },
  { code: "GD", name: "Grenada", flag: "🇬🇩" },
  { code: "GT", name: "Guatemala", flag: "🇬🇹" },
  { code: "GY", name: "Guyana", flag: "🇬🇾" },
  { code: "HN", name: "Honduras", flag: "🇭🇳" },
  { code: "HK", name: "Hong Kong", flag: "🇭🇰" },
  { code: "HU", name: "Hungary", flag: "🇭🇺" },
  { code: "IS", name: "Iceland", flag: "🇮🇸" },
  { code: "IN", name: "India", flag: "🇮🇳" },
  { code: "ID", name: "Indonesia", flag: "🇮🇩" },
  { code: "IE", name: "Ireland", flag: "🇮🇪" },
  { code: "IL", name: "Israel", flag: "🇮🇱" },
  { code: "IT", name: "Italy", flag: "🇮🇹" },
  { code: "JM", name: "Jamaica", flag: "🇯🇲" },
  { code: "JP", name: "Japan", flag: "🇯🇵" },
  { code: "JO", name: "Jordan", flag: "🇯🇴" },
  { code: "KZ", name: "Kazakhstan", flag: "🇰🇿" },
  { code: "KE", name: "Kenya", flag: "🇰🇪" },
  { code: "KR", name: "South Korea", flag: "🇰🇷" },
  { code: "KW", name: "Kuwait", flag: "🇰🇼" },
  { code: "KG", name: "Kyrgyzstan", flag: "🇰🇬" },
  { code: "LA", name: "Laos", flag: "🇱🇦" },
  { code: "LV", name: "Latvia", flag: "🇱🇻" },
  { code: "LB", name: "Lebanon", flag: "🇱🇧" },
  { code: "LT", name: "Lithuania", flag: "🇱🇹" },
  { code: "LU", name: "Luxembourg", flag: "🇱🇺" },
  { code: "MO", name: "Macau", flag: "🇲🇴" },
  { code: "MY", name: "Malaysia", flag: "🇲🇾" },
  { code: "MV", name: "Maldives", flag: "🇲🇻" },
  { code: "MT", name: "Malta", flag: "🇲🇹" },
  { code: "MU", name: "Mauritius", flag: "🇲🇺" },
  { code: "MX", name: "Mexico", flag: "🇲🇽" },
  { code: "MD", name: "Moldova", flag: "🇲🇩" },
  { code: "MN", name: "Mongolia", flag: "🇲🇳" },
  { code: "MS", name: "Montserrat", flag: "🇲🇸" },
  { code: "MZ", name: "Mozambique", flag: "🇲🇿" },
  { code: "MM", name: "Myanmar", flag: "🇲🇲" },
  { code: "NA", name: "Namibia", flag: "🇳🇦" },
  { code: "NP", name: "Nepal", flag: "🇳🇵" },
  { code: "NL", name: "Netherlands", flag: "🇳🇱" },
  { code: "NZ", name: "New Zealand", flag: "🇳🇿" },
  { code: "NI", name: "Nicaragua", flag: "🇳🇮" },
  { code: "NG", name: "Nigeria", flag: "🇳🇬" },
  { code: "MK", name: "North Macedonia", flag: "🇲🇰" },
  { code: "NO", name: "Norway", flag: "🇳🇴" },
  { code: "OM", name: "Oman", flag: "🇴🇲" },
  { code: "PK", name: "Pakistan", flag: "🇵🇰" },
  { code: "PA", name: "Panama", flag: "🇵🇦" },
  { code: "PG", name: "Papua New Guinea", flag: "🇵🇬" },
  { code: "PY", name: "Paraguay", flag: "🇵🇾" },
  { code: "PE", name: "Peru", flag: "🇵🇪" },
  { code: "PH", name: "Philippines", flag: "🇵🇭" },
  { code: "PL", name: "Poland", flag: "🇵🇱" },
  { code: "PT", name: "Portugal", flag: "🇵🇹" },
  { code: "QA", name: "Qatar", flag: "🇶🇦" },
  { code: "RO", name: "Romania", flag: "🇷🇴" },
  { code: "SA", name: "Saudi Arabia", flag: "🇸🇦" },
  { code: "SN", name: "Senegal", flag: "🇸🇳" },
  { code: "SG", name: "Singapore", flag: "🇸🇬" },
  { code: "SK", name: "Slovakia", flag: "🇸🇰" },
  { code: "SI", name: "Slovenia", flag: "🇸🇮" },
  { code: "ZA", name: "South Africa", flag: "🇿🇦" },
  { code: "ES", name: "Spain", flag: "🇪🇸" },
  { code: "LK", name: "Sri Lanka", flag: "🇱🇰" },
  { code: "KN", name: "St. Kitts and Nevis", flag: "🇰🇳" },
  { code: "LC", name: "St. Lucia", flag: "🇱🇨" },
  { code: "VC", name: "St. Vincent and the Grenadines", flag: "🇻🇨" },
  { code: "SR", name: "Suriname", flag: "🇸🇷" },
  { code: "SE", name: "Sweden", flag: "🇸🇪" },
  { code: "CH", name: "Switzerland", flag: "🇨🇭" },
  { code: "TW", name: "Taiwan", flag: "🇹🇼" },
  { code: "TZ", name: "Tanzania", flag: "🇹🇿" },
  { code: "TH", name: "Thailand", flag: "🇹🇭" },
  { code: "TT", name: "Trinidad and Tobago", flag: "🇹🇹" },
  { code: "TN", name: "Tunisia", flag: "🇹🇳" },
  { code: "TR", name: "Turkey", flag: "🇹🇷" },
  { code: "TC", name: "Turks and Caicos Islands", flag: "🇹🇨" },
  { code: "UG", name: "Uganda", flag: "🇺🇬" },
  { code: "UA", name: "Ukraine", flag: "🇺🇦" },
  { code: "AE", name: "United Arab Emirates", flag: "🇦🇪" },
  { code: "GB", name: "United Kingdom", flag: "🇬🇧" },
  { code: "US", name: "United States", flag: "🇺🇸" },
  { code: "UY", name: "Uruguay", flag: "🇺🇾" },
  { code: "UZ", name: "Uzbekistan", flag: "🇺🇿" },
  { code: "VE", name: "Venezuela", flag: "🇻🇪" },
  { code: "VN", name: "Vietnam", flag: "🇻🇳" },
  { code: "VG", name: "British Virgin Islands", flag: "🇻🇬" },
  { code: "YE", name: "Yemen", flag: "🇾🇪" },
  { code: "ZW", name: "Zimbabwe", flag: "🇿🇼" },
];

// Language to country code mapping
const LANGUAGE_TO_COUNTRY: Record<string, string> = {
  "he": "IL",
  "he-IL": "IL",
  "en-US": "US",
  "en-GB": "GB",
  "en-AU": "AU",
  "en-CA": "CA",
  "en": "US",
  "de": "DE",
  "de-DE": "DE",
  "de-AT": "DE",
  "de-CH": "DE",
  "fr": "FR",
  "fr-FR": "FR",
  "fr-CA": "CA",
  "es": "ES",
  "es-ES": "ES",
  "es-MX": "MX",
  "it": "IT",
  "it-IT": "IT",
  "ja": "JP",
  "ja-JP": "JP",
  "pt": "BR",
  "pt-BR": "BR",
  "pt-PT": "BR",
  "nl": "NL",
  "nl-NL": "NL",
  "sv": "SE",
  "sv-SE": "SE",
};

const STORAGE_KEY = "yedapo-country";
const LEGACY_STORAGE_KEY = "podcatch-country";

interface CountryContextValue {
  country: string;
  setCountry: (country: string) => void;
  countryInfo: { code: string; name: string; flag: string } | undefined;
}

const CountryContext = createContext<CountryContextValue | undefined>(undefined);

function detectCountryFromLanguage(): string {
  if (typeof navigator === "undefined") return "US";

  const language = navigator.language;

  // Try exact match first
  if (LANGUAGE_TO_COUNTRY[language]) {
    return LANGUAGE_TO_COUNTRY[language];
  }

  // Try base language (e.g., "en" from "en-US")
  const baseLanguage = language.split("-")[0];
  if (LANGUAGE_TO_COUNTRY[baseLanguage]) {
    return LANGUAGE_TO_COUNTRY[baseLanguage];
  }

  return "US";
}

export function CountryProvider({ children }: { children: React.ReactNode }) {
  const [country, setCountryState] = useState<string>("US");
  const [isInitialized, setIsInitialized] = useState(false);
  const { user } = useAuth();
  const profileFetched = useRef(false);

  // Initial load: localStorage or browser language detection
  useEffect(() => {
    let stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (legacy && COUNTRY_OPTIONS.find((c) => c.code === legacy)) {
        stored = legacy;
        localStorage.setItem(STORAGE_KEY, legacy);
      }
    }
    if (stored && COUNTRY_OPTIONS.find((c) => c.code === stored)) {
      setCountryState(stored);
    } else {
      const detected = detectCountryFromLanguage();
      setCountryState(detected);
      localStorage.setItem(STORAGE_KEY, detected);
    }
    setIsInitialized(true);
  }, []);

  // When user logs in, sync country from their profile preferences
  useEffect(() => {
    if (!user) {
      profileFetched.current = false;
      return;
    }
    if (profileFetched.current) return;
    profileFetched.current = true;

    fetch("/api/user/profile")
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        const profileCountry = data?.profile?.preferred_country;
        if (profileCountry) {
          const code = profileCountry.toUpperCase();
          if (COUNTRY_OPTIONS.find((c) => c.code === code)) {
            setCountryState(code);
            localStorage.setItem(STORAGE_KEY, code);
          }
        }
      })
      .catch(() => {/* profile fetch failed, keep current country */});
  }, [user]);

  const setCountry = useCallback((newCountry: string) => {
    setCountryState(newCountry);
    localStorage.setItem(STORAGE_KEY, newCountry);
  }, []);

  const countryInfo = useMemo(() => COUNTRY_OPTIONS.find((c) => c.code === country), [country]);

  const value = useMemo(() => ({ country, setCountry, countryInfo }), [country, setCountry, countryInfo]);

  // Prevent hydration mismatch by not rendering until initialized
  if (!isInitialized) {
    return (
      <CountryContext.Provider value={{ country: "US", setCountry, countryInfo: COUNTRY_OPTIONS[0] }}>
        {children}
      </CountryContext.Provider>
    );
  }

  return (
    <CountryContext.Provider value={value}>
      {children}
    </CountryContext.Provider>
  );
}

export function useCountry() {
  const context = useContext(CountryContext);
  if (context === undefined) {
    throw new Error("useCountry must be used within a CountryProvider");
  }
  return context;
}
