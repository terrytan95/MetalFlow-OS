"use client";
import { useI18n } from "../lib/i18n";
import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { RecordSelect } from "./record-select";
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
  const { t } = useI18n();

  const fields = config[resource].fields.filter(
    (f) => showCost || f.key !== "cost",
  );
  const initial = Object.fromEntries(
    fields.map((f) => [
      f.key,
      record?.[f.key] !== undefined
        ? f.type === "tags"
          ? record[f.key].join(", ")
          : f.type === "json"
            ? JSON.stringify(record[f.key])
            : f.type === "date"
              ? record[f.key]?.slice(0, 10)
              : record[f.key]
        : f.default || f.options?.[0] || "",
    ]),
  );
  const {
    register,
    control,
    handleSubmit,
    formState: { isSubmitting, errors },
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
                f.type === "tags"
                  ? String(v)
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean)
                  : f.type === "date"
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
            {t(f.label)}
            {f.required && <span className="required"> *</span>}
            {f.resource ? (
              <Controller
                name={f.key}
                control={control}
                rules={{ required: f.required }}
                render={({ field }) => (
                  <RecordSelect
                    resource={f.resource!}
                    label={t(f.label)}
                    api={api}
                    value={field.value}
                    onChange={field.onChange}
                    options={lookups[f.resource!] || []}
                    required={f.required}
                  />
                )}
              />
            ) : f.options ? (
              <select {...register(f.key, { required: f.required })}>
                <option value="">{t("Select…")}</option>
                {f.options.map((o) => (
                  <option key={o} value={o}>
                    {t(o)}
                  </option>
                ))}
              </select>
            ) : f.type === "textarea" || f.type === "json" ? (
              <textarea
                rows={4}
                {...register(f.key, { required: f.required })}
              />
            ) : (
              <input
                type={f.type === "tags" ? "text" : f.type || "text"}
                step="0.0001"
                min={f.type === "number" ? "0" : undefined}
                {...register(f.key, { required: f.required })}
              />
            )}
            {errors[f.key] && (
              <small className="field-error" role="alert">
                {t("Required")}
              </small>
            )}
          </label>
        ))}
      </div>
      {error && (
        <p role="alert" className="error">
          {t(error)}
        </p>
      )}
      <div className="form-footer">
        <Button className="primary" disabled={isSubmitting}>
          {isSubmitting ? t("Saving…") : t("Save record")}
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
  const { t } = useI18n();

  const kind = kinds[view],
    purchase = kind === "PURCHASE";
  const [party, setParty] = useState(
    record?.[purchase ? "supplierId" : "customerId"] ||
      source?.customerId ||
      "",
  );
  const [lines, setLines] = useState<QuoteLine[]>(
    record?.lines ||
      source?.bomLines || [
        { description: "", quantity: "1", unit: "piece", unitPrice: "0" },
      ],
  );
  const [discount, setDiscount] = useState(record?.discount || "0"),
    [tax, setTax] = useState(record?.taxRate || "0"),
    [notes, setNotes] = useState(record?.notes || source?.notes || ""),
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
              ...(source?.subject ? { inquiryId: source.id } : {}),
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
          {purchase ? t("Supplier") : t("Customer")}
          <RecordSelect
            resource={purchase ? "suppliers" : "customers"}
            label={t(purchase ? "Supplier" : "Customer")}
            api={api}
            value={party}
            onChange={setParty}
            options={lookups[purchase ? "suppliers" : "customers"] || []}
            required
          />
        </label>
        <label>
          {kind === "QUOTATION" ? t("Valid until") : t("Due date")}
          <input
            type="date"
            value={valid}
            onChange={(e) => setValid(e.target.value)}
          />
        </label>
      </div>
      <h3 className="section-title">{t("Materials & services")}</h3>
      <div className="quote-lines">
        {lines.map((l, i) => (
          <div key={i} className="quote-line">
            <label>
              {" "}
              {t("Catalog product")}{" "}
              <RecordSelect
                resource="products"
                label={t("Catalog product")}
                api={api}
                value={l.productId || ""}
                options={lookups.products || []}
                onChange={(id, p) =>
                  update(
                    i,
                    p
                      ? {
                          productId: id,
                          description: p.name,
                          unit: p.unit,
                          unitPrice: purchase ? p.cost || "0" : p.price,
                        }
                      : { productId: undefined },
                  )
                }
              />
            </label>
            <label>
              {" "}
              {t("Description")}{" "}
              <input
                required
                value={l.description}
                onChange={(e) => update(i, { description: e.target.value })}
              />
            </label>
            <div className="line-numbers">
              <label>
                {" "}
                {t("Quantity")}{" "}
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
                {" "}
                {t("Unit")}{" "}
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
                    <option key={v} value={v}>
                      {t(v)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {" "}
                {t("Unit price")}{" "}
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
                aria-label={t("Remove line")}
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
        <Plus size={15} /> {t("Add line")}{" "}
      </Button>
      <label>
        {t("Tax rates")}
        <select
          defaultValue=""
          onChange={(e) => {
            if (e.target.value) setTax(e.target.value);
          }}
        >
          <option value="">{t("Select…")}</option>
          {(lookups["tax-rates"] || [])
            .filter((r) => r.active)
            .map((r) => (
              <option value={r.rate} key={r.id}>
                {r.name} · {r.rate}%
              </option>
            ))}
        </select>
      </label>
      <div className="form-grid mt">
        <label>
          {" "}
          {t("Discount amount")}{" "}
          <input
            type="number"
            min="0"
            step="0.01"
            value={discount}
            onChange={(e) => setDiscount(e.target.value)}
          />
        </label>
        <label>
          {" "}
          {t("Tax rate (%)")}{" "}
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
          {" "}
          {t("Terms & notes")}{" "}
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
      </div>
      <div className="totals">
        <span>
          {t("Subtotal")} {subtotal.toFixed(2)}
        </span>
        <strong>
          {t("Total")} {total.toFixed(2)}
        </strong>
      </div>
      {error && (
        <p className="error" role="alert">
          {t(error)}
        </p>
      )}
      <div className="form-footer">
        <Button className="primary" disabled={busy}>
          {busy ? t("Saving…") : t("Save draft")}
        </Button>
      </div>
    </form>
  );
}
