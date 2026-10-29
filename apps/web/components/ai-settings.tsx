"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  KeyRound,
  Plus,
  ShieldCheck,
  RefreshCw,
  Trash2,
  Play,
} from "lucide-react";
import { Button, Badge, Modal, Empty } from "./ui";
import type { API } from "./forms";
import type { RecordData } from "./data";
export function AIProviderSettings({
  api,
  organizationId,
  onChanged,
}: {
  api: API;
  organizationId: string;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState<RecordData | null>(null),
    [editingKey, setEditingKey] = useState<{
      providerId: string;
      key: RecordData;
    } | null>(null),
    [keyProvider, setKeyProvider] = useState<RecordData | null>(null),
    [remove, setRemove] = useState<{
      providerId: string;
      key: RecordData;
    } | null>(null),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [type, setType] = useState("OPENAI");
  const settings = useQuery({
    queryKey: ["ai-provider-settings", organizationId],
    queryFn: () => api("ai/providers"),
    refetchInterval: 15000,
  });
  async function mutate(route: string, method: string, body?: unknown) {
    setBusy(true);
    setError("");
    try {
      const result = await api(route, method, body);
      await settings.refetch();
      onChanged();
      return result;
    } catch (e) {
      setError((e as Error).message);
      throw e;
    } finally {
      setBusy(false);
    }
  }
  const save = () => {
    setEditing(null);
    setEditingKey(null);
    setKeyProvider(null);
    setRemove(null);
    setMessage("AI configuration saved");
  };
  return (
    <section className="ai-settings">
      <div className="panel-title section-title">
        <div>
          <h2>AI providers & API keys / AI 服务与密钥</h2>
          <p>Tenant-private credentials. Usage-aware key rotation.</p>
        </div>
        <Button
          onClick={() => {
            setType("OPENAI");
            setEditing({});
            setError("");
          }}
          disabled={!settings.data?.encryptionReady}
        >
          <Plus size={15} />
          Add provider
        </Button>
      </div>
      <div className="notice">
        <ShieldCheck size={16} />
        <p>
          Keys are encrypted on the server and never shown again. Rotation stays
          within the selected provider. Usage is observed by MetalFlow, not your
          provider's account balance. A request may cross a configured token
          threshold before its final usage is known.
        </p>
      </div>
      {!settings.isPending && !settings.data?.encryptionReady && (
        <p className="error">
          Secret storage is not ready. The server operator must configure
          AI_KEY_ENCRYPTION_KEY.
        </p>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="notice">
          {message}
        </p>
      )}
      {settings.isPending ? (
        <p className="muted">Loading providers…</p>
      ) : settings.isError ? (
        <p className="error">{settings.error.message}</p>
      ) : !settings.data.providers.length ? (
        <Empty
          title="Connect your AI provider"
          description="Add OpenAI or an OpenAI-compatible endpoint, choose models, then add one or more API keys."
        />
      ) : (
        settings.data.providers.map((provider: RecordData) => (
          <article key={provider.id} className="provider-card">
            <div className="panel-title">
              <div>
                <h3>
                  {provider.name}{" "}
                  <Badge value={provider.enabled ? "ENABLED" : "DISABLED"} />
                </h3>
                <p>
                  {provider.baseUrl} ·{" "}
                  {provider.protocol === "CHAT"
                    ? "Chat Completions"
                    : "Responses API"}{" "}
                  · Priority {provider.priority}
                </p>
              </div>
              <div className="actions wrap">
                <Button
                  onClick={() => {
                    setType(provider.type);
                    setEditing(provider);
                  }}
                >
                  Edit provider
                </Button>
                <Button
                  onClick={() => {
                    setKeyProvider(provider);
                    setError("");
                  }}
                >
                  <KeyRound size={14} />
                  Add API key
                </Button>
              </div>
            </div>
            <p className="muted">
              Text: {provider.textModel || "Not configured"} · Images:{" "}
              {provider.imageModel || "Not configured"}
            </p>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Key</th>
                    <th>Status</th>
                    <th>Today · UTC</th>
                    <th>Limits / day</th>
                    <th>Last response</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {provider.keys.map((key: RecordData) => (
                    <tr key={key.id}>
                      <td>
                        <strong>{key.label}</strong>
                        <small className="key-suffix">•••• {key.suffix}</small>
                      </td>
                      <td>
                        <Badge value={key.state} />
                        {key.cooldownUntil &&
                          new Date(key.cooldownUntil) > new Date() && (
                            <small className="key-suffix">
                              Until{" "}
                              {new Date(key.cooldownUntil).toLocaleTimeString()}
                            </small>
                          )}
                      </td>
                      <td>
                        {key.dailyRequests} requests
                        <br />
                        {key.dailyTokens.toLocaleString()} tokens
                      </td>
                      <td>
                        {key.dailyRequestLimit || "∞"} requests
                        <br />
                        {key.dailyTokenLimit?.toLocaleString() || "∞"} tokens
                      </td>
                      <td>
                        {key.lastErrorCode ||
                          (key.lastHttpStatus === 200 ? "Success" : "Not used")}
                        <small className="key-suffix">
                          Lifetime: {key.totalRequests} requests ·{" "}
                          {key.totalTokens} tokens
                        </small>
                      </td>
                      <td>
                        <div className="actions wrap">
                          <Button
                            onClick={() => {
                              setError("");
                              setEditingKey({ providerId: provider.id, key });
                            }}
                          >
                            Edit limits
                          </Button>
                          <Button
                            disabled={busy}
                            onClick={() =>
                              mutate(
                                `ai/providers/${provider.id}/keys/${key.id}`,
                                "PATCH",
                                { enabled: !key.enabled },
                              ).catch(() => {})
                            }
                          >
                            {key.enabled ? "Disable" : "Enable"}
                          </Button>
                          <Button
                            disabled={busy}
                            onClick={() =>
                              mutate(
                                `ai/providers/${provider.id}/keys/${key.id}`,
                                "PATCH",
                                { resetHealth: true },
                              ).catch(() => {})
                            }
                            title="Clear cooldown or failure after fixing the provider account; daily usage is preserved"
                          >
                            <RefreshCw size={13} />
                            Reset health
                          </Button>
                          <Button
                            aria-label={`Delete key ${key.label}`}
                            onClick={() =>
                              setRemove({ providerId: provider.id, key })
                            }
                          >
                            <Trash2 size={13} />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!provider.keys.length && (
              <p className="muted mt">
                No API keys. Add a key to enable AI requests.
              </p>
            )}
            <div className="provider-footer">
              <span className="muted">
                Lowest usage ratio first, then least recently used. Up to 20
                keys per job; four-minute retry window.
              </span>
              <Button
                disabled={
                  busy ||
                  !provider.enabled ||
                  !provider.textModel ||
                  !provider.keys.some((k: RecordData) => k.enabled)
                }
                onClick={async () => {
                  try {
                    await mutate("ai/jobs", "POST", {
                      kind: "ASSISTANT",
                      providerId: provider.id,
                      text: "Reply with OK only. This is a connection test.",
                    });
                    setMessage(
                      "Test job submitted. Check AI Assistant → recent jobs and the attempt log below. Provider charges may apply.",
                    );
                  } catch {}
                }}
              >
                <Play size={13} />
                Run test request
              </Button>
            </div>
          </article>
        ))
      )}
      <details className="mt">
        <summary>Recent key attempts / 自动切换记录</summary>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Provider / key</th>
                <th>Result</th>
                <th>Tokens</th>
              </tr>
            </thead>
            <tbody>
              {settings.data?.attempts?.map((attempt: RecordData) => {
                const p = settings.data.providers.find(
                    (p: RecordData) => p.id === attempt.providerId,
                  ),
                  k = p?.keys.find((k: RecordData) => k.id === attempt.keyId);
                return (
                  <tr key={attempt.id}>
                    <td>{new Date(attempt.createdAt).toLocaleString()}</td>
                    <td>
                      {p?.name || "Removed provider"} /{" "}
                      {k?.label || "Deleted key"}
                    </td>
                    <td>
                      <Badge value={attempt.status} /> {attempt.errorCode || ""}
                    </td>
                    <td>{attempt.totalTokens}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </details>
      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing?.id ? "Edit AI provider" : "Add AI provider"}
      >
        {editing && (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              const body = {
                name: f.get("name"),
                textModel: String(f.get("textModel") || "") || null,
                imageModel: String(f.get("imageModel") || "") || null,
                priority: Number(f.get("priority")),
                enabled: f.get("enabled") === "on",
                ...(!editing.id
                  ? {
                      type,
                      protocol:
                        type === "OPENAI" ? "RESPONSES" : f.get("protocol"),
                      baseUrl:
                        type === "OPENAI"
                          ? "https://api.openai.com/v1"
                          : f.get("baseUrl"),
                    }
                  : {}),
              };
              try {
                await mutate(
                  `ai/providers${editing.id ? "/" + editing.id : ""}`,
                  editing.id ? "PATCH" : "POST",
                  body,
                );
                save();
              } catch {}
            }}
          >
            <label>
              Provider name
              <input
                name="name"
                defaultValue={editing.name || ""}
                required
                maxLength={100}
              />
            </label>
            {!editing.id && (
              <>
                <label>
                  Provider type
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                  >
                    <option value="OPENAI">OpenAI</option>
                    <option value="COMPATIBLE">OpenAI-compatible API</option>
                  </select>
                </label>
                {type === "COMPATIBLE" && (
                  <>
                    <label>
                      Base URL
                      <input
                        name="baseUrl"
                        type="url"
                        placeholder="https://provider.example/v1"
                        required
                      />
                    </label>
                    <label>
                      API protocol
                      <select name="protocol">
                        <option value="CHAT">Chat Completions</option>
                        <option value="RESPONSES">Responses API</option>
                      </select>
                    </label>
                  </>
                )}
              </>
            )}
            <div className="form-grid">
              <label>
                Text model ID
                <input
                  name="textModel"
                  defaultValue={editing.textModel || ""}
                  placeholder="Model supported by your provider"
                />
              </label>
              <label>
                Image model ID (optional)
                <input
                  name="imageModel"
                  defaultValue={editing.imageModel || ""}
                  placeholder="Images API model, if supported"
                />
              </label>
              <label>
                Priority (lower first)
                <input
                  name="priority"
                  type="number"
                  min={0}
                  max={100}
                  defaultValue={editing.priority || 0}
                />
              </label>
              <label className="checkbox-field">
                <input
                  name="enabled"
                  type="checkbox"
                  defaultChecked={editing.enabled ?? true}
                />
                Enabled
              </label>
            </div>
            <p className="notice">
              Models must be enabled on your provider account. Provider endpoint
              and protocol are immutable: create a separate provider to change
              them. Only enter keys issued for that endpoint.
            </p>
            {error && <p className="error">{error}</p>}
            <Button className="primary mt" disabled={busy}>
              Save provider
            </Button>
          </form>
        )}
      </Modal>
      <Modal
        open={keyProvider !== null}
        onClose={() => setKeyProvider(null)}
        title={`Add API key · ${keyProvider?.name || ""}`}
      >
        {keyProvider && (
          <form
            autoComplete="off"
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              try {
                await mutate(`ai/providers/${keyProvider.id}/keys`, "POST", {
                  label: f.get("label"),
                  apiKey: f.get("apiKey"),
                  dailyRequestLimit: f.get("dailyRequestLimit")
                    ? Number(f.get("dailyRequestLimit"))
                    : null,
                  dailyTokenLimit: f.get("dailyTokenLimit")
                    ? Number(f.get("dailyTokenLimit"))
                    : null,
                });
                save();
              } catch {}
            }}
          >
            <label>
              Key label
              <input
                name="label"
                required
                maxLength={80}
                placeholder="Primary · project A"
              />
            </label>
            <label>
              API key
              <input
                name="apiKey"
                type="password"
                autoComplete="new-password"
                required
                minLength={16}
                maxLength={4096}
              />
            </label>
            <p className="muted mt">
              Stored encrypted. The full key cannot be read back.
            </p>
            <div className="form-grid">
              <label>
                Daily request limit (optional)
                <input
                  name="dailyRequestLimit"
                  type="number"
                  min={1}
                  max={1000000}
                />
              </label>
              <label>
                Daily token threshold (optional)
                <input
                  name="dailyTokenLimit"
                  type="number"
                  min={1}
                  max={1000000000}
                />
              </label>
            </div>
            <p className="notice">
              Counters reset at 00:00 UTC. Exhausted/invalid keys require
              account repair and Reset health. A timeout does not retry
              automatically because the provider may already have processed it.
            </p>
            {error && <p className="error">{error}</p>}
            <Button className="primary mt" disabled={busy}>
              Save API key
            </Button>
          </form>
        )}
      </Modal>
      <Modal
        open={editingKey !== null}
        onClose={() => setEditingKey(null)}
        title="Edit key limits"
      >
        {editingKey && (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              try {
                await mutate(
                  `ai/providers/${editingKey.providerId}/keys/${editingKey.key.id}`,
                  "PATCH",
                  {
                    label: f.get("label"),
                    dailyRequestLimit: f.get("dailyRequestLimit")
                      ? Number(f.get("dailyRequestLimit"))
                      : null,
                    dailyTokenLimit: f.get("dailyTokenLimit")
                      ? Number(f.get("dailyTokenLimit"))
                      : null,
                  },
                );
                save();
              } catch {}
            }}
          >
            <label>
              Key label
              <input
                name="label"
                defaultValue={editingKey.key.label}
                required
              />
            </label>
            <label>
              Daily request limit
              <input
                type="number"
                name="dailyRequestLimit"
                min={1}
                max={1000000}
                defaultValue={editingKey.key.dailyRequestLimit || ""}
              />
            </label>
            <label>
              Daily token threshold
              <input
                type="number"
                name="dailyTokenLimit"
                min={1}
                max={1000000000}
                defaultValue={editingKey.key.dailyTokenLimit || ""}
              />
            </label>
            <p className="notice">
              Changing limits does not reset recorded usage. Leave a limit blank
              for no application-level threshold.
            </p>
            {error && <p className="error">{error}</p>}
            <Button className="primary mt" disabled={busy}>
              Save limits
            </Button>
          </form>
        )}
      </Modal>
      <Modal
        open={remove !== null}
        onClose={() => setRemove(null)}
        title="Delete API key?"
      >
        <p>
          Remove {remove?.key.label} from this organization's key pool? This
          removes the stored credential; it does not revoke the key at the
          provider.
        </p>
        <div className="actions mt">
          <Button onClick={() => setRemove(null)}>Cancel</Button>
          <Button
            className="primary"
            disabled={busy}
            onClick={async () => {
              if (remove)
                try {
                  await mutate(
                    `ai/providers/${remove.providerId}/keys/${remove.key.id}`,
                    "DELETE",
                  );
                  save();
                } catch {}
            }}
          >
            Delete stored key
          </Button>
        </div>
        {error && <p className="error">{error}</p>}
      </Modal>
    </section>
  );
}
