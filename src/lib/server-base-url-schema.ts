import { z } from "zod";

export const serverBaseUrlSchema = z
  .string()
  .trim()
  .pipe(z.union([z.literal(""), z.string().url()]));

export function parseServerBaseUrl(value: string) {
  return serverBaseUrlSchema.safeParse(value);
}
