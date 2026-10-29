"use client";
import { formatDate, formatNumber } from "../lib/localization";
import { useI18n } from "../lib/i18n";
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
  const { t, locale } = useI18n();

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
          <h2>{t("AI providers & API keys / AI 服务与密钥")}</h2>
          <p>{t("Tenant-private credentials. Usage-aware key rotation.")}</p>
        </div>
        <Button
          onClick={() => {
            setType("OPENAI");
            setEditing({});
            setError("");
          }}
          disabled={!settings.data?.encryptionReady}
        >
          <Plus size={15} /> {t("Add provider")}{" "}
        </Button>
      </div>
      <div className="notice">
        <ShieldCheck size={16} />
        <p>
          {" "}
          {t(
            "Keys are encrypted on the server and never shown again. Rotation stays within the selected provider. Usage is observed by MetalFlow, not your provider's account balance. A request may cross a configured token threshold before its final usage is known.",
          )}{" "}
        </p>
      </div>
      {!settings.isPending && !settings.data?.encryptionReady && (
        <p className="error">
          {" "}
          {t(
            "Secret storage is not ready. The server operator must configure AI_KEY_ENCRYPTION_KEY.",
          )}{" "}
        </p>
      )}
      {error && (
        <p role="alert" className="error">
          {t(error)}
        </p>
      )}
      {message && (
        <p role="status" className="notice">
          {t(message)}
        </p>
      )}
      {settings.isPending ? (
        <p className="muted">{t("Loading providers…")}</p>
      ) : settings.isError ? (
        <p className="error">{t(settings.error.message)}</p>
      ) : !settings.data.providers.length ? (
        <Empty
          title={t("Connect your AI provider")}
          description={t(
            "Add OpenAI or an OpenAI-compatible endpoint, choose models, then add one or more API keys.",
          )}
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
                    ? t("Chat Completions")
                    : t("Responses API")}{" "}
                  {t("· Priority")} {provider.priority}
                </p>
              </div>
              <div className="actions wrap">
                <Button
                  onClick={() => {
                    setType(provider.type);
                    setEditing(provider);
                  }}
                >
                  {" "}
                  {t("Edit provider")}{" "}
                </Button>
                <Button
                  onClick={() => {
                    setKeyProvider(provider);
                    setError("");
                  }}
                >
                  <KeyRound size={14} /> {t("Add API key")}{" "}
                </Button>
              </div>
            </div>
            <p className="muted">
              {" "}
              {t("Text:")} {provider.textModel || t("Not configured")}{" "}
              {t("· Images:")} {provider.imageModel || t("Not configured")}
            </p>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>{t("Key")}</th>
                    <th>{t("Status")}</th>
                    <th>{t("Today · UTC")}</th>
                    <th>{t("Limits / day")}</th>
                    <th>{t("Last response")}</th>
                    <th>{t("Actions")}</th>
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
                              {" "}
                              {t("Until")}{" "}
                              {formatDate(key.cooldownUntil, locale, "time")}
                            </small>
                          )}
                      </td>
                      <td>
                        {key.dailyRequests} {t("requests")} <br />
                        {formatNumber(key.dailyTokens, locale)}{" "}
                        {t("tokens")}{" "}
                      </td>
                      <td>
                        {key.dailyRequestLimit || "∞"} {t("requests")} <br />
                        {key.dailyTokenLimit
                          ? formatNumber(key.dailyTokenLimit, locale)
                          : "∞"}{" "}
                        {t("tokens")}{" "}
                      </td>
                      <td>
                        {(key.lastErrorCode ? t(key.lastErrorCode) : null) ||
                          t(
                            key.lastHttpStatus === 200 ? "Success" : "Not used",
                          )}
                        <small className="key-suffix">
                          {" "}
                          {t("Lifetime:")} {key.totalRequests} {t("requests ·")}{" "}
                          {formatNumber(BigInt(key.totalTokens), locale)}{" "}
                          {t("tokens")}{" "}
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
                            {" "}
                            {t("Edit limits")}{" "}
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
                            {key.enabled ? t("Disable") : t("Enable")}
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
                            title={t(
                              "Clear cooldown or failure after fixing the provider account; daily usage is preserved",
                            )}
                          >
                            <RefreshCw size={13} /> {t("Reset health")}{" "}
                          </Button>
                          <Button
                            aria-label={t("Delete key {name}", {
                              name: key.label,
                            })}
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
                {" "}
                {t("No API keys. Add a key to enable AI requests.")}{" "}
              </p>
            )}
            <div className="provider-footer">
              <span className="muted">
                {" "}
                {t(
                  "Lowest usage ratio first, then least recently used. Up to 20 keys per job; four-minute retry window.",
                )}{" "}
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
                <Play size={13} /> {t("Run test request")}{" "}
              </Button>
            </div>
          </article>
        ))
      )}
      <details className="mt">
        <summary>{t("Recent key attempts / 自动切换记录")}</summary>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>{t("Time")}</th>
                <th>{t("Provider / key")}</th>
                <th>{t("Result")}</th>
                <th>{t("Tokens")}</th>
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
                    <td>{formatDate(attempt.createdAt, locale, "datetime")}</td>
                    <td>
                      {p?.name || t("Removed provider")} /{" "}
                      {k?.label || t("Deleted key")}
                    </td>
                    <td>
                      <Badge value={attempt.status} />{" "}
                      {t(attempt.errorCode || "")}
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
        title={editing?.id ? t("Edit AI provider") : t("Add AI provider")}
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
              {" "}
              {t("Provider name")}{" "}
              <input
                name="name"
                defaultValue={editing.name || ""}
                required
                maxLength={100}
                placeholder={t("e.g. Primary DeepSeek Model")}
              />
            </label>
            {!editing.id && (
              <>
                <label>
                  {" "}
                  {t("Provider type")}{" "}
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                  >
                    <option value="OPENAI">{t("OpenAI")}</option>
                    <option value="COMPATIBLE">
                      {t("OpenAI-compatible API")}
                    </option>
                  </select>
                </label>
                {type === "COMPATIBLE" && (
                  <>
                    <label>
                      {" "}
                      {t("Base URL")}{" "}
                      <input
                        name="baseUrl"
                        type="url"
                        placeholder={t("https://provider.example/v1")}
                        required
                      />
                    </label>
                    <label>
                      {" "}
                      {t("API protocol")}{" "}
                      <select name="protocol">
                        <option value="CHAT">{t("Chat Completions")}</option>
                        <option value="RESPONSES">{t("Responses API")}</option>
                      </select>
                    </label>
                  </>
                )}
              </>
            )}
            <div className="form-grid">
              <label>
                {" "}
                {t("Text model ID")}{" "}
                <input
                  name="textModel"
                  defaultValue={editing.textModel || ""}
                  placeholder={t("Model supported by your provider")}
                />
              </label>
              <label>
                {" "}
                {t("Image model ID (optional)")}{" "}
                <input
                  name="imageModel"
                  defaultValue={editing.imageModel || ""}
                  placeholder={t("Images API model, if supported")}
                />
              </label>
              <label>
                {" "}
                {t("Priority (lower first)")}{" "}
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
                />{" "}
                {t("Enabled")}{" "}
              </label>
            </div>
            <p className="notice">
              {" "}
              {t(
                "Models must be enabled on your provider account. Provider endpoint and protocol are immutable: create a separate provider to change them. Only enter keys issued for that endpoint.",
              )}{" "}
            </p>
            {error && <p className="error">{t(error)}</p>}
            <Button className="primary mt" disabled={busy}>
              {" "}
              {t("Save provider")}{" "}
            </Button>
          </form>
        )}
      </Modal>
      <Modal
        open={keyProvider !== null}
        onClose={() => setKeyProvider(null)}
        title={t("Add API key · {name}", { name: keyProvider?.name || "" })}
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
              {" "}
              {t("Key label")}{" "}
              <input
                name="label"
                required
                maxLength={80}
                placeholder={t("Primary · project A")}
              />
            </label>
            <label>
              {" "}
              {t("API key")}{" "}
              <input
                name="apiKey"
                type="password"
                autoComplete="new-password"
                required
                minLength={16}
                maxLength={4096}
                placeholder={t("sk-your-key-here")}
              />
            </label>
            <p className="muted mt">
              {" "}
              {t("Stored encrypted. The full key cannot be read back.")}{" "}
            </p>
            <div className="form-grid">
              <label>
                {" "}
                {t("Daily request limit (optional)")}{" "}
                <input
                  name="dailyRequestLimit"
                  type="number"
                  min={1}
                  max={1000000}
                  placeholder="1000"
                />
              </label>
              <label>
                {" "}
                {t("Daily token threshold (optional)")}{" "}
                <input
                  name="dailyTokenLimit"
                  type="number"
                  min={1}
                  max={1000000000}
                  placeholder="1000000"
                />
              </label>
            </div>
            <p className="notice">
              {" "}
              {t(
                "Counters reset at 00:00 UTC. Exhausted/invalid keys require account repair and Reset health. A timeout does not retry automatically because the provider may already have processed it.",
              )}{" "}
            </p>
            {error && <p className="error">{t(error)}</p>}
            <Button className="primary mt" disabled={busy}>
              {" "}
              {t("Save API key")}{" "}
            </Button>
          </form>
        )}
      </Modal>
      <Modal
        open={editingKey !== null}
        onClose={() => setEditingKey(null)}
        title={t("Edit key limits")}
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
              {" "}
              {t("Key label")}{" "}
              <input
                name="label"
                defaultValue={editingKey.key.label}
                required
              />
            </label>
            <label>
              {" "}
              {t("Daily request limit")}{" "}
              <input
                type="number"
                name="dailyRequestLimit"
                min={1}
                max={1000000}
                defaultValue={editingKey.key.dailyRequestLimit || ""}
              />
            </label>
            <label>
              {" "}
              {t("Daily token threshold")}{" "}
              <input
                type="number"
                name="dailyTokenLimit"
                min={1}
                max={1000000000}
                defaultValue={editingKey.key.dailyTokenLimit || ""}
              />
            </label>
            <p className="notice">
              {" "}
              {t(
                "Changing limits does not reset recorded usage. Leave a limit blank for no application-level threshold.",
              )}{" "}
            </p>
            {error && <p className="error">{t(error)}</p>}
            <Button className="primary mt" disabled={busy}>
              {" "}
              {t("Save limits")}{" "}
            </Button>
          </form>
        )}
      </Modal>
      <Modal
        open={remove !== null}
        onClose={() => setRemove(null)}
        title={t("Delete API key?")}
      >
        <p>
          {" "}
          {t("Remove")} {remove?.key.label}{" "}
          {t(
            "from this organization's key pool? This removes the stored credential; it does not revoke the key at the provider.",
          )}{" "}
        </p>
        <div className="actions mt">
          <Button onClick={() => setRemove(null)}>{t("Cancel")}</Button>
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
            {" "}
            {t("Delete stored key")}{" "}
          </Button>
        </div>
        {error && <p className="error">{t(error)}</p>}
      </Modal>
    </section>
  );
}
