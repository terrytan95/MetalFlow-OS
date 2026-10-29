"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Plus, Trash2 } from "lucide-react";
import { Decimal } from "decimal.js";
import { config, type RecordData, kinds } from "./data";
import { Button } from "./ui";
export type API = (
  path: string,
  method?: string,
  body?: unknown,
) => Promise<any>;
export function ResourceForm({
  resource,
  record,
  lookups,
  api,
  done,
  showCost = true,
}: {
  resource: string;
  record?: RecordData;
  showCost?: boolean;
  lookups: Record<string, RecordData[]>;
  api: API;
  done: () => void;
}) {
  const fields = config[resource].fields.filter(
    (f) => showCost || f.key !== "cost",
  );
  const initial = Object.fromEntries(
    fields.map((f) => [
      f.key,
      record?.[f.key] !== undefined
        ? f.type === "json"
          ? JSON.stringify(record[f.key])
          : f.type === "date"
            ? record[f.key]?.slice(0, 10)
            : record[f.key]
        : f.default || f.options?.[0] || "",
    ]),
  );
  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm({ defaultValues: initial });
  const [error, setError] = useState("");
  return (
    <form
      onSubmit={handleSubmit(async (values) => {
        try {
          const data: RecordData = {};
          for (const f of fields) {
            const v = values[f.key];
            if (v !== "") {
              data[f.key] =
                f.type === "date"
                  ? new Date(v + "T12:00:00Z").toISOString()
                  : f.type === "json"
                    ? JSON.parse(v)
                    : v;
            }
          }
          await api(
            record ? `${resource}/${record.id}` : resource,
            record ? "PATCH" : "POST",
            data,
          );
          done();
        } catch (e) {
          setError((e as Error).message);
        }
      })}
    >
      <div className="form-grid">
        {fields.map((f) => (
          <label
            key={f.key}
            className={
              f.type === "textarea" || f.type === "json" ? "span-2" : ""
            }
          >
            {f.label}
            {f.required && <span className="required"> *</span>}
            {f.options || f.resource ? (
              <select {...register(f.key, { required: f.required })}>
                <option value="">Select…</option>
                {(f.resource ? lookups[f.resource] || [] : f.options || []).map(
                  (o: any) => (
                    <option key={o.id || o} value={o.id || o}>
                      {o.name || o.subject || o}
                    </option>
                  ),
                )}
              </select>
            ) : f.type === "textarea" || f.type === "json" ? (
              <textarea
                rows={4}
                {...register(f.key, { required: f.required })}
              />
            ) : (
              <input
                type={f.type || "text"}
                step="0.0001"
                min={f.type === "number" ? "0" : undefined}
                {...register(f.key, { required: f.required })}
              />
            )}
          </label>
        ))}
      </div>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <div className="form-footer">
        <Button className="primary" disabled={isSubmitting}>
          {isSubmitting ? "Saving…" : "Save record"}
        </Button>
      </div>
    </form>
  );
}
type QuoteLine = {
  productId?: string;
  description: string;
  quantity: string;
  unit: string;
  unitPrice: string;
};
export function DocumentForm({
  view,
  lookups,
  api,
  done,
  source,
  record,
}: {
  view: string;
  lookups: Record<string, RecordData[]>;
  api: API;
  done: () => void;
  source?: RecordData;
  record?: RecordData;
}) {
  const kind = kinds[view],
    purchase = kind === "PURCHASE";
  const [party, setParty] = useState(
    record?.[purchase ? "supplierId" : "customerId"] ||
      source?.customerId ||
      "",
  );
  const [lines, setLines] = useState<QuoteLine[]>(
    record?.lines || [
      { description: "", quantity: "1", unit: "piece", unitPrice: "0" },
    ],
  );
  const [discount, setDiscount] = useState(record?.discount || "0"),
    [tax, setTax] = useState(record?.taxRate || "0"),
    [notes, setNotes] = useState(record?.notes || ""),
    [valid, setValid] = useState(
      (record?.validUntil || record?.dueDate || "").slice(0, 10),
    ),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const update = (i: number, patch: Partial<QuoteLine>) =>
    setLines((old) => old.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  let subtotal = new Decimal(0),
    total = new Decimal(0);
  try {
    subtotal = lines.reduce(
      (s, l) =>
        s.plus(
          new Decimal(l.quantity || 0).mul(l.unitPrice || 0).toDecimalPlaces(2),
        ),
      new Decimal(0),
    );
    total = subtotal
      .minus(new Decimal(discount || 0).toDecimalPlaces(2))
      .mul(new Decimal(1).plus(new Decimal(tax || 0).div(100)))
      .toDecimalPlaces(2);
  } catch {}
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          await api(
            record ? `documents/${record.id}` : "documents",
            record ? "PATCH" : "POST",
            {
              kind,
              [purchase ? "supplierId" : "customerId"]: party,
              ...(source ? { inquiryId: source.id } : {}),
              lines,
              discount,
              taxRate: tax,
              notes,
              ...(valid
                ? {
                    [kind === "QUOTATION" ? "validUntil" : "dueDate"]: new Date(
                      valid + "T23:59:59Z",
                    ).toISOString(),
                  }
                : {}),
            },
          );
          done();
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="form-grid">
        <label>
          {purchase ? "Supplier" : "Customer"}
          <select
            required
            value={party}
            onChange={(e) => setParty(e.target.value)}
          >
            <option value="">Select…</option>
            {(lookups[purchase ? "suppliers" : "customers"] || []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          {kind === "QUOTATION" ? "Valid until" : "Due date"}
          <input
            type="date"
            value={valid}
            onChange={(e) => setValid(e.target.value)}
          />
        </label>
      </div>
      <h3 className="section-title">Materials & services</h3>
      <div className="quote-lines">
        {lines.map((l, i) => (
          <div key={i} className="quote-line">
            <label>
              Catalog product
              <select
                value={l.productId || ""}
                onChange={(e) => {
                  const p = lookups.products?.find(
                    (p) => p.id === e.target.value,
                  );
                  update(
                    i,
                    p
                      ? {
                          productId: p.id,
                          description: p.name,
                          unit: p.unit,
                          unitPrice: purchase ? p.cost || "0" : p.price,
                        }
                      : { productId: undefined },
                  );
                }}
              >
                <option value="">Custom line</option>
                {lookups.products?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.sku} · {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Description
              <input
                required
                value={l.description}
                onChange={(e) => update(i, { description: e.target.value })}
              />
            </label>
            <div className="line-numbers">
              <label>
                Quantity
                <input
                  required
                  type="number"
                  min="0.0001"
                  step="0.0001"
                  value={l.quantity}
                  onChange={(e) => update(i, { quantity: e.target.value })}
                />
              </label>
              <label>
                Unit
                <select
                  value={l.unit}
                  disabled={!!l.productId}
                  onChange={(e) => update(i, { unit: e.target.value })}
                >
                  {[
                    "piece",
                    "m",
                    "ft",
                    "kg",
                    "lb",
                    "m2",
                    "ft2",
                    "sheet",
                    "custom",
                  ].map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </label>
              <label>
                Unit price
                <input
                  required
                  type="number"
                  min="0"
                  step="0.0001"
                  value={l.unitPrice}
                  onChange={(e) => update(i, { unitPrice: e.target.value })}
                />
              </label>
              <Button
                type="button"
                aria-label="Remove line"
                disabled={lines.length === 1}
                onClick={() => setLines(lines.filter((_, j) => j !== i))}
              >
                <Trash2 size={15} />
              </Button>
            </div>
          </div>
        ))}
      </div>
      <Button
        type="button"
        onClick={() =>
          setLines([
            ...lines,
            { description: "", quantity: "1", unit: "piece", unitPrice: "0" },
          ])
        }
      >
        <Plus size={15} />
        Add line
      </Button>
      <div className="form-grid mt">
        <label>
          Discount amount
          <input
            type="number"
            min="0"
            step="0.01"
            value={discount}
            onChange={(e) => setDiscount(e.target.value)}
          />
        </label>
        <label>
          Tax rate (%)
          <input
            type="number"
            min="0"
            max="100"
            step="0.01"
            value={tax}
            onChange={(e) => setTax(e.target.value)}
          />
        </label>
        <label className="span-2">
          Terms & notes
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
      </div>
      <div className="totals">
        <span>Subtotal {subtotal.toFixed(2)}</span>
        <strong>Total {total.toFixed(2)}</strong>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="form-footer">
        <Button className="primary" disabled={busy}>
          {busy ? "Saving…" : "Save draft"}
        </Button>
      </div>
    </form>
  );
}
