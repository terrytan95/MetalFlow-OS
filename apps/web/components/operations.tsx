"use client";
import { useI18n } from "../lib/i18n";
import { useState, useRef, useEffect } from "react";
import { Scissors, Sparkles, Plus } from "lucide-react";
import { Button, Badge, Empty } from "./ui";
import type { API } from "./forms";
import type { RecordData } from "./data";
export function Cutting({ api }: { api: API }) {
  const { t } = useI18n();

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
                    name: `Cut plan ${new Date().toLocaleDateString()}`,
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
  const { t } = useI18n();

  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <div className="split-workspace">
      <section className="panel">
        <h3>
          {mode === "design"
            ? t("Create an interior concept")
            : t("Ask your business assistant")}
        </h3>
        <p className="muted">
          {mode === "design"
            ? t(
                "Concept images support a design discussion. They are not construction drawings.",
              )
            : t(
                "Draft, extract and explain. AI cannot send messages or modify financial records.",
              )}
        </p>
        {!enabled && (
          <div className="notice">
            <strong>{t("Configuration required")}</strong>
            <p>
              {" "}
              {t(
                "Ask an organization administrator to configure an AI provider, model and API key in Settings. AI generation is disabled until configured.",
              )}{" "}
            </p>
          </div>
        )}
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              const form = new FormData(e.currentTarget);
              let fileId;
              const f = form.get("file") as File;
              if (f?.size) {
                const upload = new FormData();
                upload.set("file", f);
                fileId = (await api("files", "POST", upload)).id;
              }
              await api("ai/jobs", "POST", {
                kind: mode === "design" ? "DESIGN" : "ASSISTANT",
                text: String(form.get("prompt")),
                fileId,
              });
              refresh();
              setError("");
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            {" "}
            {t("Brief")}{" "}
            <textarea
              name="prompt"
              rows={7}
              required
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
          </label>
          <label>
            {" "}
            {t("Reference image or document")}{" "}
            <input
              name="file"
              type="file"
              accept="image/png,image/jpeg,image/webp,application/pdf"
              disabled={!enabled}
            />
          </label>
          <Button className="primary mt" disabled={!enabled || busy}>
            <Sparkles size={16} />
            {busy ? t("Submitting…") : t("Create AI job")}
          </Button>
        </form>
        {error && <p className="error">{t(error)}</p>}
      </section>
      <section className="panel">
        <div className="panel-title">
          <h3>{t("Your recent jobs")}</h3>
          <Button onClick={refresh}>{t("Refresh")}</Button>
        </div>
        {jobs.length ? (
          jobs.map((j) => (
            <article className="job" key={j.id}>
              <div className="panel-title">
                <strong>{t(j.kind)}</strong>
                <Badge value={j.status} />
              </div>
              <p className="muted">
                {new Date(j.createdAt).toLocaleString()} · {j.model}
              </p>
              {j.result && <pre>{JSON.stringify(j.result, null, 2)}</pre>}
              {j.result?.fileId && (
                <SecureImage api={api} id={j.result.fileId} />
              )}
              {j.error && <p className="error">{t(j.error)}</p>}
            </article>
          ))
        ) : (
          <Empty
            title={t("No AI jobs yet")}
            description={t("Submitted work and its status will appear here.")}
          />
        )}
      </section>
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
  const { t } = useI18n();

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
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label>
          {" "}
          {t("Drawing")}{" "}
          <input
            type="file"
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
              />
            </label>
            <label>
              {" "}
              {t("Unit")} <input name="unit" defaultValue="m" required />
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
                        label: `Measurement ${measurements.length + 1}`,
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
                  {m.quantity} {m.unit}
                </td>
                <td>{t(m.source)}</td>
                <td>
                  <input
                    type="checkbox"
                    aria-label={`Verify ${m.label}`}
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
                    "Item,Quantity,Unit,Source,Verified",
                    ...takeoff.measurements.map((m: any) =>
                      [m.label, m.quantity, m.unit, m.source, m.verified]
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
                    new Blob([rows.join("\n")], { type: "text/csv" }),
                  );
                  a.download = "takeoff-bom.csv";
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
