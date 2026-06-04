"use client";

import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/toaster";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { parseServerBaseUrl } from "@/lib/server-base-url-schema";
import { writeServerBaseUrl } from "@/lib/server-connection-storage";
import { Server } from "lucide-react";
import { useState } from "react";

type ServerBaseUrlSetupScreenProps = {
  onSaved: (url: string) => void;
};

export function ServerBaseUrlSetupScreen({
  onSaved,
}: ServerBaseUrlSetupScreenProps) {
  const { toast } = useToast();
  const [serverBaseUrl, setServerBaseUrl] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = () => {
    const parsed = parseServerBaseUrl(serverBaseUrl);
    if (!parsed.success) {
      toast({
        variant: "destructive",
        description: "올바른 URL 형식을 입력해 주세요. (예: https://example.com)",
      });
      return;
    }

    if (parsed.data === "") {
      toast({
        variant: "destructive",
        description: "서버 Base URL을 입력해 주세요.",
      });
      return;
    }

    setSaving(true);
    try {
      writeServerBaseUrl(parsed.data);
      onSaved(parsed.data);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
    <div className="flex h-screen min-h-0 flex-col items-center justify-center bg-zinc-50 px-4">
      <div className="w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm md:p-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="rounded-full bg-zinc-100 p-2.5 text-zinc-700">
            <Server className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-zinc-900">서버 연결</h1>
            <p className="mt-0.5 text-sm text-zinc-600">
              앱을 사용하려면 먼저 서버 주소를 등록해 주세요.
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="setup-server-base-url">Base URL</Label>
          <Input
            id="setup-server-base-url"
            type="url"
            placeholder="http://133.186.251.89:14283/AJCC/Mobile"
            value={serverBaseUrl}
            onChange={(event) => setServerBaseUrl(event.target.value)}
            className="font-mono text-sm"
            autoComplete="off"
            autoFocus
            disabled={saving}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                handleSave();
              }
            }}
          />
          <p className="text-xs text-zinc-500">
            API 경로까지 포함한 주소입니다. 보통 …/Mobile 까지 입력합니다.
          </p>
        </div>

        <Button
          type="button"
          className="mt-6 w-full"
          size="lg"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? "저장 중…" : "저장하고 시작"}
        </Button>
      </div>
    </div>
    <Toaster />
    </>
  );
}
