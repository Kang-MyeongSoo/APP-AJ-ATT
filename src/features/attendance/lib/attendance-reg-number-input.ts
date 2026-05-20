import { cn } from "@/lib/utils";

/** Chromium/Electron: `type=password` + `inputMode=numeric` 조합 시 숫자가 그대로 보임 → CSS 마스킹 사용 */
export function regNumberMaskedInputClass(
  baseClass: string,
  masked = true,
): string {
  return cn(baseClass, masked && "[-webkit-text-security:disc]");
}
