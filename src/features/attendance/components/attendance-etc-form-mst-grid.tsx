"use client";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  type EtcFormMstRow,
  fetchEtcFormMstRows,
} from "@/features/attendance/lib/attendance-etc-form-mst-api";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, Loader2, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { match } from "ts-pattern";

export function AttendanceEtcFormMstGrid({
  serverBaseUrl,
}: {
  serverBaseUrl: string;
}) {
  const trimmedBase = serverBaseUrl.trim();

  const { data, isPending, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["attEtcFormMst", trimmedBase],
    queryFn: () => fetchEtcFormMstRows(trimmedBase),
    enabled: trimmedBase.length > 0,
  });

  const [rows, setRows] = useState<EtcFormMstRow[]>([]);

  const serverRows = useMemo(() => data ?? [], [data]);

  useEffect(() => {
    setRows(serverRows.map((r) => ({ ...r })));
  }, [serverRows]);

  const updateRow = (index: number, patch: Partial<EtcFormMstRow>) => {
    setRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );
  };

  if (!trimmedBase) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-12 text-center text-sm text-amber-900">
        <AlertCircle className="h-10 w-10 text-amber-600" aria-hidden />
        <p>
          서버 Base URL이 설정되어 있어야 목록을 불러올 수 있습니다.
          <br />
          왼쪽 메뉴에서 <strong className="font-medium">서버 연결</strong>을
          열고 주소를 저장한 뒤 다시 시도해 주세요.
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-zinc-600">
          서버 마스터(usp_mobile_get_mst_code2 / ATT_ETC_FORM)에서 불러온
          목록입니다.
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0 gap-2"
          onClick={() => void refetch()}
          disabled={isFetching}
        >
          {isFetching ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <RefreshCw className="h-4 w-4" aria-hidden />
          )}
          다시 불러오기
        </Button>
      </div>

      {match({ isPending, isError })
        .with({ isPending: true }, () => (
          <div className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 py-16 text-sm text-zinc-600">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
            불러오는 중입니다…
          </div>
        ))
        .with({ isError: true }, () => (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-xl border border-red-200 bg-red-50/80 px-4 py-12 text-center text-sm text-red-900">
            <AlertCircle className="h-10 w-10 text-red-600" aria-hidden />
            <p>{error instanceof Error ? error.message : "요청에 실패했습니다."}</p>
            <Button type="button" variant="outline" size="sm" onClick={() => void refetch()}>
              다시 시도
            </Button>
          </div>
        ))
        .otherwise(() => (
          <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-zinc-200 bg-white">
            <table className="w-full min-w-[56rem] border-collapse text-left text-sm">
              <thead className="text-zinc-800">
                <tr>
                  <th className="sticky top-0 z-20 border-b border-zinc-200 bg-zinc-100 px-3 py-2 font-semibold">
                    코드
                  </th>
                  <th className="sticky top-0 z-20 border-b border-zinc-200 bg-zinc-100 px-3 py-2 font-semibold">
                    코드명
                  </th>
                  <th className="sticky top-0 z-20 border-b border-zinc-200 bg-zinc-100 px-3 py-2 font-semibold whitespace-nowrap">
                    사용구분
                  </th>
                  <th className="sticky top-0 z-20 border-b border-zinc-200 bg-zinc-100 px-3 py-2 font-semibold">
                    입력종류
                  </th>
                  <th className="sticky top-0 z-20 border-b border-zinc-200 bg-zinc-100 px-3 py-2 font-semibold">
                    구성값
                  </th>
                  <th className="sticky top-0 z-20 border-b border-zinc-200 bg-zinc-100 px-3 py-2 font-semibold">
                    초기값
                  </th>
                  <th className="sticky top-0 z-20 border-b border-zinc-200 bg-zinc-100 px-3 py-2 font-semibold">
                    비고내용
                  </th>
                </tr>
              </thead>
              <tbody className="text-zinc-800">
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-10 text-center text-zinc-500">
                      표시할 행이 없습니다.
                    </td>
                  </tr>
                ) : (
                  rows.map((row, index) => {
                    const rf = `r${index}_${row.c_code.replace(/[^a-zA-Z0-9_-]/g, "_") || "row"}`;
                    return (
                      <tr
                        key={`etc-grid-row-${index}`}
                        className="border-b border-zinc-100 last:border-b-0"
                      >
                        <td className="align-middle px-3 py-1.5">
                          <Input
                            value={row.c_code}
                            disabled
                            title="코드는 필수 식별값이라 변경할 수 없습니다."
                            aria-label={`코드 ${row.c_code} (읽기 전용)`}
                            className="h-8 min-w-[4rem] font-mono text-xs"
                          />
                        </td>
                        <td className="align-middle px-3 py-1.5">
                          <Input
                            value={row.c_name}
                            onChange={(e) =>
                              updateRow(index, { c_name: e.target.value })
                            }
                            aria-label={`${row.c_code} 코드명`}
                            className="h-8 min-w-[6rem]"
                          />
                        </td>
                        <td className="align-middle whitespace-nowrap px-3 py-1.5">
                          <div className="flex items-center gap-2">
                            <Checkbox
                              id={`etc-use-${rf}`}
                              checked={row.use_flag === "Y"}
                              onCheckedChange={(state) =>
                                updateRow(index, {
                                  use_flag:
                                    state === true ? "Y" : "N",
                                })
                              }
                              aria-label={`${row.c_code} 사용구분`}
                            />
                            <Label
                              htmlFor={`etc-use-${rf}`}
                              className="cursor-pointer text-sm font-normal text-zinc-700"
                            >
                              {row.use_flag === "Y" ? "Y" : "N"}
                            </Label>
                          </div>
                        </td>
                        <td className="align-middle px-3 py-1.5">
                          <Input
                            value={row.c_attr1}
                            onChange={(e) =>
                              updateRow(index, { c_attr1: e.target.value })
                            }
                            aria-label={`${row.c_code} 입력종류`}
                            className="h-8 min-w-[5rem]"
                          />
                        </td>
                        <td className="align-middle px-3 py-1.5">
                          <Input
                            value={row.c_attr2}
                            onChange={(e) =>
                              updateRow(index, { c_attr2: e.target.value })
                            }
                            aria-label={`${row.c_code} 구성값`}
                            className="h-8 min-w-[12rem] font-mono text-xs"
                          />
                        </td>
                        <td className="align-middle px-3 py-1.5">
                          <Input
                            value={row.c_attr3}
                            onChange={(e) =>
                              updateRow(index, { c_attr3: e.target.value })
                            }
                            aria-label={`${row.c_code} 초기값`}
                            className="h-8 min-w-[6rem]"
                          />
                        </td>
                        <td className="align-middle px-3 py-1.5">
                          <Input
                            value={row.c_attr4}
                            onChange={(e) =>
                              updateRow(index, { c_attr4: e.target.value })
                            }
                            aria-label={`${row.c_code} 비고내용`}
                            className="h-8 min-w-[12rem]"
                          />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        ))}
    </div>
  );
}
