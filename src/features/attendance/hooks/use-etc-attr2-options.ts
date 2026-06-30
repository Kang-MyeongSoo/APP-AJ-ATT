"use client";

import { fetchMstCodeOptions } from "@/features/attendance/lib/attendance-mst-code";
import {
  parseCidMstParam,
  parseEtcAttr2Options,
} from "@/features/attendance/lib/etc-form-input-kind";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

export type EtcAttr2Option = {
  label: string;
  value: string;
};

export function useEtcAttr2Options(c_attr2: string, serverBaseUrl: string) {
  const cidParam = parseCidMstParam(c_attr2);
  const trimmedBase = serverBaseUrl.trim();
  const staticOpts = useMemo(
    () => parseEtcAttr2Options(c_attr2),
    [c_attr2],
  );

  const query = useQuery({
    queryKey: ["etcAttr2Options", trimmedBase, cidParam],
    queryFn: () => fetchMstCodeOptions(trimmedBase, cidParam!),
    enabled: Boolean(cidParam && trimmedBase),
    staleTime: 5 * 60 * 1000,
  });

  const opts: EtcAttr2Option[] = useMemo(() => {
    if (!cidParam) return staticOpts;
    return (query.data ?? []).map((row) => ({
      label: row.c_name,
      value: row.c_code,
    }));
  }, [cidParam, query.data, staticOpts]);

  return {
    opts,
    isCidReference: cidParam !== null,
    isPending: Boolean(cidParam && trimmedBase && query.isPending),
    isError: Boolean(cidParam && trimmedBase && query.isError),
    error: query.error,
  };
}
