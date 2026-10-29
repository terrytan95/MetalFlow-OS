"use client";
import { FileInput } from "./file-input";
import {
  enumLabel,
  formatDate,
  formatNumber,
  fieldLabel,
} from "../lib/localization";
import { RecordDetails } from "./record-details";
import { useI18n } from "../lib/i18n";
import { useState, useRef, useEffect, useMemo } from "react";
import { marked } from "marked";
import {
  Scissors,
  Sparkles,
  Plus,
  ArrowUp,
  Paperclip,
  X,
  RefreshCw,
  Bot,
  User,
  FileText,
  MessageSquare,
  Trash2,
} from "lucide-react";
import { Button, Badge, Empty } from "./ui";
import type { API } from "./forms";
import type { RecordData } from "./data";
export function Cutting({ api }: { api: API }) {
  const { t, locale } = useI18n();

  const [saving, setSaving] = useState(false);
  const saveKey = useRef(crypto.randomUUID());
  const [result, setResult] = useState<RecordData | null>(null),
    [error, setError] = useState("");
  return (
    <div className="split-workspace">
      <section className="panel">
        <h3>{t("Cut requirements")}</h3>
        <p className="muted">
          {t("One-dimensional stock. All lengths in mm.")}
        </p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              const data = new FormData(e.currentTarget);
              const cuts = String(data.get("cuts"))
                .split("\n")
                .filter(Boolean)
                .map((row) => {
                  const [length, quantity] = row.split(/[x×,]/).map(Number);
                  return { length, quantity };
                });
              saveKey.current = crypto.randomUUID();
              setResult(
                await api("cutting-plans", "POST", {
                  stockLength: Number(data.get("stock")),
                  kerf: Number(data.get("kerf")),
                  trim: Number(data.get("trim")),
                  available: Number(data.get("available")),
                  offcutThreshold: Number(data.get("offcut")),
                  cuts,
                }),
              );
              setError("");
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          <div className="form-grid">
            {[
              ["stock", "Stock length", "6000"],
              ["kerf", "Kerf per cut", "3"],
              ["trim", "Trim at each end", "10"],
              ["available", "Available pieces", "10"],
              ["offcut", "Reusable offcut threshold", "300"],
            ].map(([name, label, value]) => (
              <label key={name}>
                {t(label)}
                <input
                  name={name}
                  type="number"
                  min="0"
                  defaultValue={value}
                  required
                />
              </label>
            ))}
          </div>
          <label>
            {" "}
            {t("Length × quantity, one requirement per line")}{" "}
            <textarea
              name="cuts"
              rows={5}
              defaultValue={"1500 x 4\n2200 x 3\n800 x 6"}
              required
            />
          </label>
          <p className="notice">
            {" "}
            {t(
              "First-fit decreasing heuristic. Each piece includes one kerf; results are not guaranteed optimal.",
            )}{" "}
          </p>
          <Button className="primary">
            <Scissors size={16} /> {t("Calculate cut plan")}{" "}
          </Button>
        </form>
        {error && <p className="error">{t(error)}</p>}
      </section>
      <section className="panel">
        {result ? (
          <>
            <div className="panel-title">
              <h3>{t("Cutting instructions")}</h3>
              <Button onClick={() => window.print()}>{t("Print")}</Button>
            </div>
            <div className="mini-metrics">
              <div>
                <small>{t("Stock pieces")}</small>
                <strong>{result.stockPieces}</strong>
              </div>
              <div>
                <small>{t("Utilization")}</small>
                <strong>{result.utilization.toFixed(1)}%</strong>
              </div>
              <div>
                <small>{t("Non-product material")}</small>
                <strong>
                  {result.waste} {t("mm")}
                </strong>
              </div>
            </div>
            {result.patterns.map((p: any, i: number) => (
              <div className="cut-pattern" key={i}>
                <small>
                  {" "}
                  {t("Stock")} {i + 1} {t("· remaining")} {p.remaining}{" "}
                  {t("mm")}{" "}
                </small>
                <div className="cut-bar">
                  {p.cuts.map((v: number, j: number) => (
                    <span key={j} style={{ flex: v }}>
                      {v}
                    </span>
                  ))}
                  <span className="waste" style={{ flex: p.remaining }} />
                </div>
              </div>
            ))}
            <p className="muted">
              {" "}
              {t("Reusable offcuts:")} {result.offcuts.join(", ") || t("None")}{" "}
              {t("mm")}{" "}
            </p>
            <Button
              onClick={async () => {
                if (saving) return;
                setSaving(true);
                try {
                  await api("fabrication", "POST", {
                    idempotencyKey: saveKey.current,
                    name: t("Cut plan {date}", {
                      date: formatDate(new Date(), locale),
                    }),
                    cutPlan: result,
                  });
                  setResult({ ...result, saved: true });
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setSaving(false);
                }
              }}
              disabled={result.saved || saving}
            >
              {result.saved
                ? t("Saved to fabrication")
                : t("Save as fabrication job")}
            </Button>
          </>
        ) : (
          <Empty
            title={t("A clearer plan, less waste")}
            description={t(
              "Enter your requirements to calculate cutting patterns.",
            )}
          />
        )}
      </section>
    </div>
  );
}
function sanitizeHtml(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, "")
    .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, "")
    .replace(/\son\w+="[^"]*"/gi, "")
    .replace(/\son\w+='[^']*'/gi, "")
    .replace(/\son\w+=[^\s>]+/gi, "")
    .replace(/javascript:[^"']*/gi, "");
}
export function MarkdownView({ content }: { content: string }) {
  const html = useMemo(() => {
    if (!content) return "";
    try {
      const parsed = marked.parse(content, {
        async: false,
        gfm: true,
        breaks: true,
      }) as string;
      return sanitizeHtml(parsed);
    } catch {
      return content;
    }
  }, [content]);
  return (
    <div
      className="markdown-body"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
export function AIWorkspace({
  api,
  mode,
  enabled,
  jobs,
  refresh,
}: {
  api: API;
  mode: string;
  enabled: boolean;
  jobs: RecordData[];
  refresh: () => void;
}) {
  const { t, locale } = useI18n();
  const [prompt, setPrompt] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [activeSessionId, setActiveSessionId] = useState<string>("");
  const [showSessionsMobile, setShowSessionsMobile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const sessions = useMemo(() => {
    const map = new Map<
      string,
      {
        sessionId: string;
        title: string;
        kind: string;
        createdAt: string;
        jobs: RecordData[];
      }
    >();
    for (const j of jobs) {
      const k = j.kind;
      if (mode === "design" && k !== "DESIGN") continue;
      if (mode === "assistant" && k !== "ASSISTANT") continue;
      const sid = (j.input as any)?.sessionId || j.id;
      if (!map.has(sid)) {
        const promptText = (j.input as any)?.text || j.text || "";
        const title =
          promptText.length > 22
            ? promptText.slice(0, 22) + "…"
            : promptText || (mode === "design" ? t("AI concept") : t("AI Assistant"));
        map.set(sid, {
          sessionId: sid,
          title,
          kind: k,
          createdAt: j.createdAt,
          jobs: [],
        });
      }
      map.get(sid)!.jobs.push(j);
    }
    return Array.from(map.values());
  }, [jobs, mode, t]);

  const currentSession =
    sessions.find((s) => s.sessionId === activeSessionId) ||
    (activeSessionId && !activeSessionId.startsWith("new_") ? null : sessions[0]);
  const activeId = currentSession?.sessionId || "";
  const activeJobs = currentSession ? [...currentSession.jobs].reverse() : [];

  const handleNewChat = () => {
    setActiveSessionId("new_" + Date.now());
    setPrompt("");
    setFile(null);
    setError("");
    setShowSessionsMobile(false);
  };

  const handleDeleteSession = async (e: React.MouseEvent, sid: string) => {
    e.stopPropagation();
    if (!window.confirm(t("Delete this conversation? This cannot be undone.")))
      return;
    try {
      await api(`ai/sessions/${encodeURIComponent(sid)}`, "DELETE");
      if (activeId === sid) {
        setActiveSessionId("");
      }
      refresh();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!enabled || busy || (!prompt.trim() && !file)) return;
    setBusy(true);
    setError("");
    try {
      let fileId: string | undefined;
      if (file) {
        const upload = new FormData();
        upload.set("file", file);
        fileId = (await api("files", "POST", upload)).id;
      }
      const targetSessionId =
        activeId.startsWith("new_") || !activeId
          ? crypto.randomUUID()
          : activeId;
      await api("ai/jobs", "POST", {
        kind: mode === "design" ? "DESIGN" : "ASSISTANT",
        text: prompt.trim() || (file ? file.name : t("Process attachment")),
        fileId,
        sessionId: targetSessionId,
      });
      setPrompt("");
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setActiveSessionId(targetSessionId);
      refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeJobs.length, busy]);

  return (
    <div className="chat-layout">
      <aside className={`chat-sidebar ${showSessionsMobile ? "open" : ""}`}>
        <div className="chat-sidebar-header">
          <Button
            type="button"
            className="primary chat-new-chat-btn"
            onClick={handleNewChat}
          >
            <Plus size={15} />
            <span>{t("New chat")}</span>
          </Button>
        </div>
        <div className="chat-sessions-list">
          <div className="chat-sessions-heading">{t("Chat history")}</div>
          {sessions.length === 0 ? (
            <p className="muted chat-no-sessions">{t("No saved conversations")}</p>
          ) : (
            sessions.map((s) => (
              <div
                key={s.sessionId}
                className={`chat-session-item ${s.sessionId === activeId ? "active" : ""}`}
                onClick={() => {
                  setActiveSessionId(s.sessionId);
                  setShowSessionsMobile(false);
                }}
              >
                <MessageSquare size={14} className="chat-session-icon" />
                <div className="chat-session-info">
                  <span className="chat-session-title">{s.title}</span>
                  <time className="chat-session-time">
                    {formatDate(s.createdAt, locale, "date")}
                  </time>
                </div>
                <button
                  type="button"
                  className="chat-session-delete"
                  title={t("Delete conversation")}
                  aria-label={t("Delete conversation")}
                  onClick={(e) => handleDeleteSession(e, s.sessionId)}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))
          )}
        </div>
      </aside>
      <div className="chat-container">
      <div className="chat-header">
        <div className="chat-header-info">
          <div className="chat-header-row">
            <Button
              type="button"
              className="btn-icon mobile-only chat-toggle-btn"
              onClick={() => setShowSessionsMobile(!showSessionsMobile)}
              aria-label={t("Chat history")}
            >
              <MessageSquare size={16} />
            </Button>
          <h3>
            {mode === "design"
              ? t("Create an interior concept")
              : t("Ask your business assistant")}
          </h3>
          </div>
          <p className="muted">
            {mode === "design"
              ? t(
                  "Concept images support a design discussion. They are not construction drawings.",
                )
              : t(
                  "Draft, extract and explain. AI cannot send messages or modify financial records.",
                )}
          </p>
        </div>
        <Button onClick={refresh} title={t("Refresh")}>
          <RefreshCw size={14} />
          <span>{t("Refresh")}</span>
        </Button>
      </div>

      {!enabled && (
        <div className="notice chat-notice">
          <strong>{t("Configuration required")}</strong>
          <p>
            {t(
              "Ask an organization administrator to configure an AI provider, model and API key in Settings. AI generation is disabled until configured.",
            )}
          </p>
        </div>
      )}

      <div className="chat-stream">
        {activeJobs.length === 0 ? (
          <div className="chat-welcome-hero">
            <div className="chat-welcome-icon">
              <Sparkles size={24} />
            </div>
            <h4>
              {mode === "design"
                ? t("Explore architectural & interior concepts")
                : t("How can I help with your operations today?")}
            </h4>
            <p className="muted">
              {mode === "design"
                ? t(
                    "Modern retail interior, brushed stainless steel shelving, warm neutral tones…",
                  )
                : t(
                    "Paste the quotation or project context you want to review…",
                  )}
            </p>
            <div className="chat-suggestions-grid">
              {(mode === "design"
                ? [
                    t("Modern retail interior, brushed stainless steel shelving, warm neutral tones…"),
                    t("Industrial metal frame glass partitions"),
                    t("Champagne curved aluminum reception desk"),
                  ]
                : [
                    t("Analyze receivable aging & payment risks"),
                    t("Draft material supply quality & acceptance terms"),
                    t("Paste the quotation or project context you want to review…"),
                  ]
              ).map((s, idx) => (
                <button
                  key={idx}
                  type="button"
                  className="chat-suggestion-chip"
                  onClick={() => setPrompt(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          activeJobs.map((j) => (
            <div key={j.id} className="chat-exchange">
              <div className="chat-msg-row user">
                <div className="chat-bubble user">
                  {j.input?.fileId && (
                    <div className="chat-msg-attachment">
                      <FileText size={14} />
                      <span>{t("Reference image or document")}</span>
                    </div>
                  )}
                  <div className="chat-msg-text">{j.input?.text || j.text}</div>
                  <div className="chat-msg-meta">
                    <time>{formatDate(j.createdAt, locale, "time")}</time>
                  </div>
                </div>
                <div className="chat-avatar user">
                  <User size={15} />
                </div>
              </div>

              <div className="chat-msg-row assistant">
                <div className="chat-avatar assistant">
                  <Bot size={15} />
                </div>
                <div className="chat-bubble assistant">
                  <div className="chat-bubble-header">
                    <span className="chat-model-tag">{j.model || t("AI Assistant")}</span>
                    <Badge value={j.status} />
                    <time>{formatDate(j.createdAt, locale, "time")}</time>
                  </div>
                  {j.status === "QUEUED" && (
                    <p className="muted chat-status-msg">
                      <span>{t("Job queued, please wait…")}</span>
                    </p>
                  )}
                  {j.status === "RUNNING" && (
                    <p className="muted chat-status-msg">
                      <RefreshCw size={14} className="spin" />
                      <span>{t("Generating response…")}</span>
                    </p>
                  )}
                  {j.status === "SUCCEEDED" && (
                    <div className="chat-msg-content">
                      {j.result?.text && (
                        <MarkdownView content={j.result.text} />
                      )}
                      {j.result?.fileId && (
                        <div className="chat-generated-image">
                          <SecureImage api={api} id={j.result.fileId} />
                        </div>
                      )}
                      {!j.result?.text && !j.result?.fileId && j.result && (
                        <RecordDetails data={j.result} />
                      )}
                    </div>
                  )}
                  {j.error && (
                    <p className="error" role="alert">
                      {t(j.error)}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="chat-dock">
        {file && (
          <div className="chat-attachment-pill">
            <Paperclip size={13} />
            <span className="chat-file-name">{file.name}</span>
            <span className="chat-file-size">
              {t("({size} KB)", { size: (file.size / 1024).toFixed(0) })}
            </span>
            <button
              type="button"
              className="chat-file-remove"
              onClick={() => {
                setFile(null);
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
              aria-label={t("Dismiss")}
            >
              <X size={13} />
            </button>
          </div>
        )}

        <form className="chat-input-pill" onSubmit={handleSubmit}>
          <input
            ref={fileInputRef}
            type="file"
            className="sr-only"
            accept="image/png,image/jpeg,image/webp,application/pdf"
            disabled={!enabled}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) setFile(f);
            }}
          />
          <button
            type="button"
            className="chat-btn-plus"
            disabled={!enabled}
            onClick={() => fileInputRef.current?.click()}
            title={t("Reference image or document")}
            aria-label={t("Reference image or document")}
          >
            <Plus size={18} />
          </button>
          <textarea
            rows={1}
            value={prompt}
            disabled={!enabled}
            onChange={(e) => {
              setPrompt(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = Math.min(e.target.scrollHeight, 140) + "px";
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void handleSubmit();
              }
            }}
            className="chat-textarea"
            placeholder={
              mode === "design"
                ? t(
                    "Modern retail interior, brushed stainless steel shelving, warm neutral tones…",
                  )
                : t(
                    "Paste the quotation or project context you want to review…",
                  )
            }
          />
          <button
            type="submit"
            className="chat-btn-send"
            disabled={!enabled || busy || (!prompt.trim() && !file)}
            title={t("Create AI job")}
            aria-label={t("Create AI job")}
          >
            <ArrowUp size={16} />
          </button>
        </form>

        {error && <p className="error chat-error">{t(error)}</p>}

        <p className="chat-disclaimer">
          {mode === "design"
            ? t(
                "Concept images support a design discussion. They are not construction drawings.",
              )
            : t(
                "Draft, extract and explain. AI cannot send messages or modify financial records.",
              )}
        </p>
      </div>
    </div>
    </div>
  );
}
function SecureImage({ api, id }: { api: API; id: string }) {
  const { t } = useI18n();

  const [url, setUrl] = useState(""),
    [error, setError] = useState("");
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(
    () => () => {
      if (url) URL.revokeObjectURL(url);
    },
    [url],
  );
  return url ? (
    <img src={url} alt={t("AI concept")} className="concept" />
  ) : (
    <Button
      onClick={async () => {
        try {
          const blob = await api(`files/${id}`);
          if (mounted.current) setUrl(URL.createObjectURL(blob));
        } catch (e) {
          setError((e as Error).message);
        }
      }}
    >
      {" "}
      {t(error || "View concept")}{" "}
    </Button>
  );
}
export function Takeoff({
  api,
  items,
  refresh,
  onQuote,
}: {
  api: API;
  onQuote?: (takeoff: RecordData) => void;
  items: RecordData[];
  refresh: () => void;
}) {
  const { t, locale } = useI18n();

  const [name, setName] = useState(""),
    [fileId, setFile] = useState(""),
    [url, setUrl] = useState(""),
    [mime, setMime] = useState(""),
    [scale, setScale] = useState("1"),
    [zoom, setZoom] = useState(1),
    [points, setPoints] = useState<{ x: number; y: number }[]>([]),
    [measurements, setMeasures] = useState<RecordData[]>([]),
    [error, setError] = useState("");
  const uploadVersion = useRef(0),
    [uploading, setUploading] = useState(false);
  const imageRef = useRef<HTMLImageElement>(null);
  useEffect(
    () => () => {
      if (url) URL.revokeObjectURL(url);
    },
    [url],
  );
  return (
    <div className="takeoff-grid">
      <section className="panel">
        <h3>{t("Drawing & calibration")}</h3>
        <p className="muted">
          {" "}
          {t("PDF, PNG, JPEG and WebP. Native DWG/DXF is not supported.")}{" "}
        </p>
        <label>
          {" "}
          {t("Takeoff name")}{" "}
          <input
            value={name}
            placeholder={t("e.g. Building 1 Railing Takeoff")}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label>
          {" "}
          {t("Drawing")}{" "}
          <FileInput
            aria-label={t("Drawing")}
            accept="application/pdf,image/png,image/jpeg,image/webp"
            onChange={async (e) => {
              try {
                const f = e.target.files?.[0];
                if (!f) return;
                const form = new FormData();
                form.set("file", f);
                const version = ++uploadVersion.current;
                setUploading(true);
                const uploaded = await api("files", "POST", form);
                if (version !== uploadVersion.current) return;
                setPoints([]);
                setMeasures([]);
                setFile(uploaded.id);
                if (url) URL.revokeObjectURL(url);
                setUrl(URL.createObjectURL(f));
                setMime(f.type);
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setUploading(false);
              }
            }}
          />
        </label>
        <label>
          {" "}
          {t("Real length per image pixel (mm)")}{" "}
          <input
            type="number"
            min="0.000001"
            step="any"
            value={scale}
            onChange={(e) => setScale(e.target.value)}
          />
        </label>
        <p className="notice">
          {" "}
          {t(
            "Calibrate against a known drawing dimension. Scale-derived lengths require your verification. Click two points on an image to measure.",
          )}{" "}
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            setMeasures([
              ...measurements,
              {
                label: String(form.get("label")),
                quantity: String(form.get("quantity")),
                unit: String(form.get("unit")),
                source: "USER",
                verified: true,
              },
            ]);
            e.currentTarget.reset();
          }}
        >
          <label>
            {" "}
            {t("Manual item")}{" "}
            <input name="label" required placeholder={t("SS304 handrail")} />
          </label>
          <div className="form-grid">
            <label>
              {" "}
              {t("Quantity")}{" "}
              <input
                name="quantity"
                type="number"
                min="0.0001"
                step="any"
                required
              placeholder="1.00"
              />
            </label>
            <label>
              {" "}
            {t("Unit")}{" "}
            <input
              name="unit"
              defaultValue="m"
              required
              placeholder={t("m / kg / piece")}
            />
            </label>
          </div>
          <Button className="mt">
            <Plus size={15} /> {t("Add measurement")}{" "}
          </Button>
        </form>
      </section>
      <section className="panel drawing">
        <div className="panel-title">
          <h3>{t("Drawing workspace")}</h3>
          <div className="actions">
            <Button onClick={() => setZoom(Math.max(0.5, zoom - 0.25))}>
              −
            </Button>
            <span>{Math.round(zoom * 100)}%</span>
            <Button onClick={() => setZoom(Math.min(4, zoom + 0.25))}>+</Button>
          </div>
        </div>
        <div className="drawing-scroll">
          {url ? (
            mime === "application/pdf" ? (
              <iframe src={url} title={t("Drawing PDF")} />
            ) : (
              <img
                ref={imageRef}
                src={url}
                alt={t("Drawing; select two endpoints to measure")}
                style={{ width: `${zoom * 100}%`, maxWidth: "none" }}
                onClick={(e) => {
                  const img = e.currentTarget,
                    r = img.getBoundingClientRect(),
                    point = {
                      x: (e.clientX - r.left) / r.width,
                      y: (e.clientY - r.top) / r.height,
                    };
                  if (points.length === 0) setPoints([point]);
                  else {
                    const a = points[0],
                      length =
                        Math.hypot(
                          (point.x - a.x) * img.naturalWidth,
                          (point.y - a.y) * img.naturalHeight,
                        ) * Number(scale);
                    setMeasures([
                      ...measurements,
                      {
                        label: t("Measurement {number}", {
                          number: measurements.length + 1,
                        }),
                        quantity: (length / 1000).toFixed(4),
                        unit: "m",
                        source: "SCALE",
                        verified: false,
                        points: [a, point],
                      },
                    ]);
                    setPoints([]);
                  }
                }}
              />
            )
          ) : (
            <Empty
              title={t("Bring your drawing into focus")}
              description={t("Upload a drawing to start measuring.")}
            />
          )}
        </div>
        <p className="muted">
          {points.length
            ? t("Select the second endpoint.")
            : t(
                "Images: click endpoints. PDF: use manual measurements from verified dimension labels.",
              )}
        </p>
        <table>
          <thead>
            <tr>
              <th>{t("Item")}</th>
              <th>{t("Quantity")}</th>
              <th>{t("Source")}</th>
              <th>{t("Verified")}</th>
            </tr>
          </thead>
          <tbody>
            {measurements.map((m, i) => (
              <tr key={i}>
                <td>{m.label}</td>
                <td>
                  {formatNumber(m.quantity, locale)}{" "}
                  {enumLabel("unit", m.unit, locale)}
                </td>
                <td>{t(m.source)}</td>
                <td>
                  <input
                    type="checkbox"
                    aria-label={t("Verify {name}", { name: m.label })}
                    checked={m.verified}
                    onChange={(e) =>
                      setMeasures(
                        measurements.map((v, j) =>
                          i === j ? { ...v, verified: e.target.checked } : v,
                        ),
                      )
                    }
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <Button
          className="primary mt"
          disabled={uploading || !name || !fileId || !measurements.length}
          onClick={async () => {
            try {
              await api("takeoffs", "POST", {
                name,
                fileId,
                scale,
                measurements,
              });
              refresh();
              setError("");
              setMeasures([]);
              setName("");
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          {" "}
          {t("Save takeoff")}{" "}
        </Button>
        {error && <p className="error">{t(error)}</p>}
      </section>
      <section className="panel span-2">
        <h3>{t("Saved takeoffs")}</h3>
        {items.length ? (
          items.map((takeoff) => (
            <div className="record-row" key={takeoff.id}>
              <strong>{takeoff.name}</strong>
              {onQuote && (
                <Button
                  disabled={
                    !takeoff.measurements.some((m: RecordData) => m.verified)
                  }
                  onClick={() => onQuote(takeoff)}
                >
                  {t("BOM to quotation")}
                </Button>
              )}
              <span>
                {takeoff.measurements.length} {t("measurements")}
              </span>
              <Button
                onClick={() => {
                  const rows = [
                    ["label", "quantity", "unit", "source", "verified"]
                      .map((k) => fieldLabel(k, locale))
                      .join(","),
                    ...takeoff.measurements.map((m: any) =>
                      [
                        m.label,
                        m.quantity,
                        enumLabel("unit", m.unit, locale),
                        enumLabel("source", m.source, locale),
                        enumLabel("verified", m.verified, locale),
                      ]
                        .map(
                          (v) =>
                            '"' +
                            (/^[=+\-@]/.test(String(v))
                              ? "'" + String(v)
                              : String(v)
                            ).replaceAll('"', '""') +
                            '"',
                        )
                        .join(","),
                    ),
                  ];
                  const a = document.createElement("a");
                  a.href = URL.createObjectURL(
                    new Blob(["\ufeff" + rows.join("\r\n")], {
                      type: "text/csv;charset=utf-8",
                    }),
                  );
                  a.download =
                    locale === "zh" ? "算量物料清单.csv" : "takeoff-bom.csv";
                  a.click();
                  URL.revokeObjectURL(a.href);
                }}
              >
                {" "}
                {t("Export BOM")}{" "}
              </Button>
            </div>
          ))
        ) : (
          <Empty title={t("No saved takeoffs")} />
        )}
      </section>
    </div>
  );
}
