"use client";
import { useState, useRef } from "react";
import { Scissors, Sparkles, Plus } from "lucide-react";
import { Button, Badge, Empty } from "./ui";
import type { API } from "./forms";
import type { RecordData } from "./data";
export function Cutting({ api }: { api: API }) {
  const [result, setResult] = useState<RecordData | null>(null),
    [error, setError] = useState("");
  return (
    <div className="split-workspace">
      <section className="panel">
        <h3>Cut requirements</h3>
        <p className="muted">One-dimensional stock. All lengths in mm.</p>
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
                {label}
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
            Length × quantity, one requirement per line
            <textarea
              name="cuts"
              rows={5}
              defaultValue={"1500 x 4\n2200 x 3\n800 x 6"}
              required
            />
          </label>
          <p className="notice">
            First-fit decreasing heuristic. Each piece includes one kerf;
            results are not guaranteed optimal.
          </p>
          <Button className="primary">
            <Scissors size={16} />
            Calculate cut plan
          </Button>
        </form>
        {error && <p className="error">{error}</p>}
      </section>
      <section className="panel">
        {result ? (
          <>
            <div className="panel-title">
              <h3>Cutting instructions</h3>
              <Button onClick={() => window.print()}>Print</Button>
            </div>
            <div className="mini-metrics">
              <div>
                <small>Stock pieces</small>
                <strong>{result.stockPieces}</strong>
              </div>
              <div>
                <small>Utilization</small>
                <strong>{result.utilization.toFixed(1)}%</strong>
              </div>
              <div>
                <small>Non-product material</small>
                <strong>{result.waste} mm</strong>
              </div>
            </div>
            {result.patterns.map((p: any, i: number) => (
              <div className="cut-pattern" key={i}>
                <small>
                  Stock {i + 1} · remaining {p.remaining} mm
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
              Reusable offcuts: {result.offcuts.join(", ") || "None"} mm
            </p>
            <Button
              onClick={async () => {
                await api("fabrication", "POST", {
                  name: `Cut plan ${new Date().toLocaleDateString()}`,
                  cutPlan: result,
                });
                setResult({ ...result, saved: true });
              }}
              disabled={result.saved}
            >
              {result.saved
                ? "Saved to fabrication"
                : "Save as fabrication job"}
            </Button>
          </>
        ) : (
          <Empty
            title="A clearer plan, less waste"
            description="Enter your requirements to calculate cutting patterns."
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
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <div className="split-workspace">
      <section className="panel">
        <h3>
          {mode === "design"
            ? "Create an interior concept"
            : "Ask your business assistant"}
        </h3>
        <p className="muted">
          {mode === "design"
            ? "Concept images support a design discussion. They are not construction drawings."
            : "Draft, extract and explain. AI cannot send messages or modify financial records."}
        </p>
        {!enabled && (
          <div className="notice">
            <strong>Configuration required</strong>
            <p>
              Ask an organization administrator to configure an AI provider,
              model and API key in Settings. AI generation is disabled until
              configured.
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
            Brief
            <textarea
              name="prompt"
              rows={7}
              required
              placeholder={
                mode === "design"
                  ? "Modern retail interior, brushed stainless steel shelving, warm neutral tones…"
                  : "Paste the quotation or project context you want to review…"
              }
            />
          </label>
          <label>
            Reference image or document
            <input
              name="file"
              type="file"
              accept="image/png,image/jpeg,image/webp,application/pdf"
              disabled={!enabled}
            />
          </label>
          <Button className="primary mt" disabled={!enabled || busy}>
            <Sparkles size={16} />
            {busy ? "Submitting…" : "Create AI job"}
          </Button>
        </form>
        {error && <p className="error">{error}</p>}
      </section>
      <section className="panel">
        <div className="panel-title">
          <h3>Your recent jobs</h3>
          <Button onClick={refresh}>Refresh</Button>
        </div>
        {jobs.length ? (
          jobs.map((j) => (
            <article className="job" key={j.id}>
              <div className="panel-title">
                <strong>{j.kind}</strong>
                <Badge value={j.status} />
              </div>
              <p className="muted">
                {new Date(j.createdAt).toLocaleString()} · {j.model}
              </p>
              {j.result && <pre>{JSON.stringify(j.result, null, 2)}</pre>}
              {j.result?.fileId && (
                <SecureImage api={api} id={j.result.fileId} />
              )}
              {j.error && <p className="error">{j.error}</p>}
            </article>
          ))
        ) : (
          <Empty
            title="No AI jobs yet"
            description="Submitted work and its status will appear here."
          />
        )}
      </section>
    </div>
  );
}
function SecureImage({ api, id }: { api: API; id: string }) {
  const [url, setUrl] = useState("");
  return url ? (
    <img src={url} alt="AI concept" className="concept" />
  ) : (
    <Button
      onClick={async () => {
        const blob = await api(`files/${id}`);
        setUrl(URL.createObjectURL(blob));
      }}
    >
      View concept
    </Button>
  );
}
export function Takeoff({
  api,
  items,
  refresh,
}: {
  api: API;
  items: RecordData[];
  refresh: () => void;
}) {
  const [name, setName] = useState(""),
    [fileId, setFile] = useState(""),
    [url, setUrl] = useState(""),
    [mime, setMime] = useState(""),
    [scale, setScale] = useState("1"),
    [zoom, setZoom] = useState(1),
    [points, setPoints] = useState<{ x: number; y: number }[]>([]),
    [measurements, setMeasures] = useState<RecordData[]>([]),
    [error, setError] = useState("");
  const imageRef = useRef<HTMLImageElement>(null);
  return (
    <div className="takeoff-grid">
      <section className="panel">
        <h3>Drawing & calibration</h3>
        <p className="muted">
          PDF, PNG, JPEG and WebP. Native DWG/DXF is not supported.
        </p>
        <label>
          Takeoff name
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label>
          Drawing
          <input
            type="file"
            accept="application/pdf,image/png,image/jpeg,image/webp"
            onChange={async (e) => {
              try {
                const f = e.target.files?.[0];
                if (!f) return;
                const form = new FormData();
                form.set("file", f);
                setPoints([]);
                setMeasures([]);
                setFile("");
                const uploaded = await api("files", "POST", form);
                setFile(uploaded.id);
                if (url) URL.revokeObjectURL(url);
                setUrl(URL.createObjectURL(f));
                setMime(f.type);
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          />
        </label>
        <label>
          Real length per image pixel (mm)
          <input
            type="number"
            min="0.000001"
            step="any"
            value={scale}
            onChange={(e) => setScale(e.target.value)}
          />
        </label>
        <p className="notice">
          Calibrate against a known drawing dimension. Scale-derived lengths
          require your verification. Click two points on an image to measure.
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
            Manual item
            <input name="label" required placeholder="SS304 handrail" />
          </label>
          <div className="form-grid">
            <label>
              Quantity
              <input
                name="quantity"
                type="number"
                min="0.0001"
                step="any"
                required
              />
            </label>
            <label>
              Unit
              <input name="unit" defaultValue="m" required />
            </label>
          </div>
          <Button className="mt">
            <Plus size={15} />
            Add measurement
          </Button>
        </form>
      </section>
      <section className="panel drawing">
        <div className="panel-title">
          <h3>Drawing workspace</h3>
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
              <iframe src={url} title="Drawing PDF" />
            ) : (
              <img
                ref={imageRef}
                src={url}
                alt="Drawing; select two endpoints to measure"
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
              title="Bring your drawing into focus"
              description="Upload a drawing to start measuring."
            />
          )}
        </div>
        <p className="muted">
          {points.length
            ? "Select the second endpoint."
            : "Images: click endpoints. PDF: use manual measurements from verified dimension labels."}
        </p>
        <table>
          <thead>
            <tr>
              <th>Item</th>
              <th>Quantity</th>
              <th>Source</th>
              <th>Verified</th>
            </tr>
          </thead>
          <tbody>
            {measurements.map((m, i) => (
              <tr key={i}>
                <td>{m.label}</td>
                <td>
                  {m.quantity} {m.unit}
                </td>
                <td>{m.source}</td>
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
          disabled={!name || !fileId || !measurements.length}
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
          Save takeoff
        </Button>
        {error && <p className="error">{error}</p>}
      </section>
      <section className="panel span-2">
        <h3>Saved takeoffs</h3>
        {items.length ? (
          items.map((t) => (
            <div className="record-row" key={t.id}>
              <strong>{t.name}</strong>
              <span>{t.measurements.length} measurements</span>
              <Button
                onClick={() => {
                  const rows = [
                    "Item,Quantity,Unit,Source,Verified",
                    ...t.measurements.map((m: any) =>
                      [m.label, m.quantity, m.unit, m.source, m.verified]
                        .map((v) => '"' + String(v).replaceAll('"', '""') + '"')
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
                Export BOM
              </Button>
            </div>
          ))
        ) : (
          <Empty title="No saved takeoffs" />
        )}
      </section>
    </div>
  );
}
