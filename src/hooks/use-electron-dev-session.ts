"use client";

import { useClientHydrated } from "@/hooks/use-client-hydrated";
import { useMemo } from "react";

/** `npm run electron:dev` (ELECTRON_DEV_SESSION=1) 여부 */
export function readElectronDevSession(): boolean {
  if (typeof window === "undefined") return false;
  return window.electronAPI?.isDevSession === true;
}

export function useElectronDevSession(): boolean {
  const hydrated = useClientHydrated();
  return useMemo(
    () => (hydrated ? readElectronDevSession() : false),
    [hydrated],
  );
}
