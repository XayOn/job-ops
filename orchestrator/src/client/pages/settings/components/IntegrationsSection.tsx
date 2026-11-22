import { updateSettings } from "@client/api";
import { fetchApi } from "@client/api/core";
import { SettingsInput } from "@client/pages/settings/components/SettingsInput";
import { SettingsSectionFrame } from "@client/pages/settings/components/SettingsSectionFrame";
import type React from "react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

type Props = { layoutMode?: "accordion" | "panel" };

const post = <T,>(path: string) => fetchApi<T>(path, { method: "POST" });

export const IntegrationsSection: React.FC<Props> = ({ layoutMode }) => {
  const [form, setForm] = useState({
    tududiUrl: "",
    tududiToken: "",
    tududiProjectId: "",
  });
  const [busy, setBusy] = useState(false);
  const [token, setToken] = useState("");
  const mcpUrl = `${window.location.origin}/mcp`;

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Request failed");
    } finally {
      setBusy(false);
    }
  };

  const field = (name: keyof typeof form) => ({
    value: form[name],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm({ ...form, [name]: e.target.value }),
  });

  return (
    <SettingsSectionFrame
      mode={layoutMode}
      title="Integrations"
      value="integrations"
    >
      <div className="space-y-6">
        <div className="space-y-4">
          <div className="text-sm font-medium">Tududi</div>
          <SettingsInput
            label="URL"
            inputProps={field("tududiUrl")}
            placeholder="https://tududi.example.com"
            disabled={busy}
          />
          <SettingsInput
            label="Token"
            type="password"
            inputProps={field("tududiToken")}
            placeholder="Enter new token"
            disabled={busy}
          />
          <SettingsInput
            label="Project ID (optional)"
            type="number"
            inputProps={field("tududiProjectId")}
            disabled={busy}
          />
          <div className="flex gap-2">
            <Button
              type="button"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  await updateSettings(
                    Object.fromEntries(
                      Object.entries(form).filter(([, v]) => v),
                    ),
                  );
                  toast.success("Saved");
                })
              }
            >
              Save
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  const r = await post<{ created: number; skipped: number }>(
                    "/tududi/sync",
                  );
                  toast.success(`Created ${r.created}, skipped ${r.skipped}`);
                })
              }
            >
              Sync now
            </Button>
          </div>
        </div>

        <Separator />

        <div className="space-y-4">
          <div className="text-sm font-medium">MCP access</div>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() =>
              run(async () => setToken((await post<{ token: string }>("/auth/mcp-token")).token))
            }
          >
            Create MCP token
          </Button>
          {token && (
            <div className="space-y-2">
              <div className="break-all rounded border p-2 font-mono text-xs">
                {token}
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  navigator.clipboard
                    .writeText(token)
                    .then(() => toast.success("Copied"))
                }
              >
                Copy
              </Button>
              <div className="text-xs text-muted-foreground">
                Shown once. Copy it now.
              </div>
            </div>
          )}
          <div className="text-xs text-muted-foreground">
            MCP URL: <span className="font-mono">{mcpUrl}</span>
          </div>
          <div className="break-all font-mono text-xs text-muted-foreground">
            {`claude mcp add --transport http jobops ${mcpUrl} --header "Authorization: Bearer ${token || "<token>"}"`}
          </div>
        </div>
      </div>
    </SettingsSectionFrame>
  );
};
