import type { AttEtcDailySaveBody } from "@/features/attendance/lib/attendance-etc-daily-save-api";
import {
  aspJsonRequestContentType,
  serializeJsonBodyForAsp,
} from "@/lib/legacy-asp-json-body";
import { NextRequest, NextResponse } from "next/server";

const SAVE_ASP_NAME = "R2JsonProc_att_etc_daily_save.asp";

function isAllowedSaveTarget(url: URL): boolean {
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return false;
  }
  return url.pathname.toLowerCase().endsWith(`/${SAVE_ASP_NAME.toLowerCase()}`);
}

function buildSaveUrl(serverBaseUrl: string): string {
  const base = serverBaseUrl.trim().replace(/\/+$/, "");
  return `${base}/${SAVE_ASP_NAME}`;
}

function isAttEtcDailySaveBody(value: unknown): value is AttEtcDailySaveBody {
  if (typeof value !== "object" || value === null) return false;
  const keys: Array<keyof AttEtcDailySaveBody> = [
    "p_att_date",
    "p_etc_idno",
    "p_att_corp_code",
    "p_etc_name",
    "p_cel_no",
    "p_gender",
    "p_att_dn_flag",
    "p_work_start",
    "p_work_end",
    "p_over_time",
    "p_dinner_yn",
    "p_dpt_work",
    "p_user_id",
  ];
  if (!keys.every((key) => typeof (value as AttEtcDailySaveBody)[key] === "string")) {
    return false;
  }

  const optionalKeys: Array<"p_file_name" | "p_file_path"> = [
    "p_file_name",
    "p_file_path",
  ];
  return optionalKeys.every((key) => {
    const field = (value as AttEtcDailySaveBody)[key];
    return field === undefined || typeof field === "string";
  });
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "유효한 JSON 본문이 필요합니다." },
      { status: 400 },
    );
  }

  const base =
    typeof body === "object" &&
    body !== null &&
    "base" in body &&
    typeof (body as { base: unknown }).base === "string"
      ? (body as { base: string }).base
      : null;

  const payload =
    typeof body === "object" &&
    body !== null &&
    "payload" in body
      ? (body as { payload: unknown }).payload
      : null;

  if (!base?.trim()) {
    return NextResponse.json(
      { error: "base(서버 URL)가 필요합니다." },
      { status: 400 },
    );
  }

  if (!isAttEtcDailySaveBody(payload)) {
    return NextResponse.json(
      { error: "payload 형식이 올바르지 않습니다." },
      { status: 400 },
    );
  }

  let target: URL;
  try {
    target = new URL(buildSaveUrl(base));
  } catch {
    return NextResponse.json({ error: "잘못된 서버 URL입니다." }, { status: 400 });
  }

  if (!isAllowedSaveTarget(target)) {
    return NextResponse.json(
      { error: "허용되지 않는 요청입니다." },
      { status: 400 },
    );
  }

  const requestBody = serializeJsonBodyForAsp(payload);
  console.log("[att-etc-daily-save] POST →", target.toString());
  console.log("[att-etc-daily-save] body:", JSON.stringify(payload));

  let remoteResponse: Response;
  try {
    remoteResponse = await fetch(target.toString(), {
      method: "POST",
      headers: { "Content-Type": aspJsonRequestContentType() },
      body: new Uint8Array(requestBody),
      cache: "no-store",
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "원격 호출 실패";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const text = await remoteResponse.text();
  let data: unknown;
  try {
    data = JSON.parse(text) as unknown;
  } catch {
    data = { raw: text };
  }

  return NextResponse.json({
    ok: remoteResponse.ok,
    status: remoteResponse.status,
    data,
  });
}
