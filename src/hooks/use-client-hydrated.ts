"use client";

import { useEffect, useState } from "react";

/** SSR·첫 hydration과 동일한 초기 UI를 유지한 뒤, 마운트 후에만 localStorage 등을 반영 */
export function useClientHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  return hydrated;
}
