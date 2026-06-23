"use client";

import { createContext, useContext } from "react";

// Публичные настройки сайта, нужные клиентским компонентам (ссылки на документы
// для чекбокса согласия и т.п.). Заполняются в корневом layout из БД.
export type SiteConfig = {
  privacyPolicyUrl: string;
  personalDataUrl: string;
};

const DEFAULT_CONFIG: SiteConfig = {
  privacyPolicyUrl: "",
  personalDataUrl: "",
};

const SiteConfigContext = createContext<SiteConfig>(DEFAULT_CONFIG);

export function SiteConfigProvider({
  value,
  children,
}: {
  value: SiteConfig;
  children: React.ReactNode;
}) {
  return <SiteConfigContext.Provider value={value}>{children}</SiteConfigContext.Provider>;
}

export function useSiteConfig(): SiteConfig {
  return useContext(SiteConfigContext);
}
