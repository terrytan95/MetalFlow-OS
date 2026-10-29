"use client";
import { enumLabel, formatNumber, fieldLabel } from "../lib/localization";
import { useI18n } from "../lib/i18n";
import { useState, useRef } from "react";
import { useForm, Controller } from "react-hook-form";
import { RecordSelect } from "./record-select";
import { Plus, Trash2, Camera, CheckCircle2 } from "lucide-react";
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
  const { t, locale } = useI18n();

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
              ? record[f.key]?.slice(0, 10) || ""
              : (record[f.key] ?? "")
        : f.default || f.options?.[0] || "",
    ]),
  );
  const {
    register,
    control,
    handleSubmit,
    setValue,
    formState: { isSubmitting, errors },
  } = useForm({ defaultValues: initial });
  const [error, setError] = useState("");
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrNotice, setOcrNotice] = useState("");
  const ocrInputRef = useRef<HTMLInputElement>(null);

  const handleOcr = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setOcrLoading(true);
    setOcrNotice("");
    setError("");
    try {
      const form = new FormData();
      form.set("file", f);
      form.set("target", resource);
      const res = await api("ai/extract", "POST", form);
      const data = res.data;
      if (data && typeof data === "object") {
        for (const field of fields) {
          const val =
            data[field.key] ??
            (field.key === "name"
              ? data.customerName || data.supplierName || data.companyName
              : field.key === "phone"
                ? data.telephone || data.mobile
                : field.key === "contact"
                  ? data.contactPerson || data.person
                  : field.key === "address"
                    ? data.location || data.companyAddress
                    : field.key === "notes"
                      ? data.instructions || data.remark
                      : undefined);
          if (val !== undefined && val !== null) {
            setValue(field.key, String(val), { shouldDirty: true });
          } 
        }
        setOcrNotice(
          t(
            "Recognized data filled below. Please review and edit fields before saving.",
          ),
        );
      }
    } catch (err: any) {
      setError((err as Error).message);
    } finally {
      setOcrLoading(false);
      if (ocrInputRef.current) ocrInputRef.current.value = "";
    }
  };
  return (
    <form
      onSubmit={handleSubmit(async (values) => {
        try {
          const data: RecordData = {};
          for (const f of fields) {
            const v = values[f.key];
            if (v === "" && record && !f.required) {
              data[f.key] =
                f.type === "date" ||
                f.resource ||
                f.key.endsWith("Id") ||
                f.key === "assignedTo"
                  ? null
                  : f.type === "tags"
                    ? []
                    : "";
            } else if (v !== "") {
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
      <div className="ocr-bar">
        <label className="ocr-btn">
          <Camera size={14} />
          <span>
            {ocrLoading ? t("Recognizing document…") : t("OCR photo import")}
          </span>
          <input
            ref={ocrInputRef}
            type="file"
            className="sr-only"
            accept="image/png,image/jpeg,image/webp,application/pdf"
            disabled={ocrLoading}
            onChange={handleOcr}
          />
        </label>
        {ocrLoading && (
          <span className="muted spinner">{t("Recognizing with AI…")}</span>
        )}
        {ocrNotice && (
          <div className="ocr-notice" role="status">
            <CheckCircle2 size={15} />
            <span>{ocrNotice}</span>
          </div>
        )}
      </div>
      <div className="form-grid">
        {fields.map((f) => (
          <label
            key={f.key}
            className={
              f.type === "textarea" || f.type === "json" ? "span-2" : ""
            }
          >
            {f.key === "profile" ? fieldLabel("profile", locale) : t(f.label)}
            {f.required && <span className="required"> *</span>}
            {f.resource ? (
              <Controller
                name={f.key}
                control={control}
                rules={{ required: f.required }}
                render={({ field }) => (
                  <RecordSelect
                    resource={f.resource!}
                    label={
                      f.key === "profile"
                        ? fieldLabel("profile", locale)
                        : t(f.label)
                    }
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
                    {enumLabel(f.key, o, locale)}
                  </option>
                ))}
              </select>
            ) : f.type === "textarea" || f.type === "json" ? (
              <textarea
                rows={4}
                placeholder={t("Fill {field}…", {
                  field: fieldLabel(f.key, locale),
                })}
                {...register(f.key, { required: f.required })}
              />
            ) : (
              <input
                type={f.type === "tags" ? "text" : f.type || "text"}
                step="0.0001"
                min={f.type === "number" ? "0" : undefined}
                placeholder={
                  f.type === "number"
                    ? "0.00"
                    : t("Enter {field}…", {
                        field: fieldLabel(f.key, locale),
                      })
                }
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
  const { t, locale } = useI18n();

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
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrNotice, setOcrNotice] = useState("");
  const ocrInputRef = useRef<HTMLInputElement>(null);

  const handleOcr = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setOcrLoading(true);
    setOcrNotice("");
    setError("");
    try {
      const form = new FormData();
      form.set("file", f);
      form.set("target", purchase ? "purchases" : "orders");
      const res = await api("ai/extract", "POST", form);
      const data = res.data;
      if (data && typeof data === "object") {
        if (Array.isArray(data.lines) && data.lines.length) {
          setLines(
            data.lines.map((l: any) => ({
              description: String(l.description || l.name || ""),
              quantity: String(l.quantity || 1),
              unit: [
                "piece",
                "m",
                "ft",
                "kg",
                "lb",
                "m2",
                "ft2",
                "sheet",
                "custom",
              ].includes(l.unit)
                ? l.unit
                : "piece",
              unitPrice: String(l.unitPrice || l.price || 0),
            })),
          );
        }
        if (data.dueDate || data.date) {
          setValid(String(data.dueDate || data.date).slice(0, 10));
        }
        if (data.discount !== undefined && data.discount !== null) {
          setDiscount(String(data.discount));
        }
        if (data.tax !== undefined && data.tax !== null) {
          setTax(String(data.tax));
        }
        if (data.notes) {
          setNotes(String(data.notes));
        }
        if (data.customerName || data.supplierName) {
          const targetName = String(data.customerName || data.supplierName).toLowerCase();
          const list = lookups[purchase ? "suppliers" : "customers"] || [];
          const matched = list.find((item) =>
            item.name?.toLowerCase().includes(targetName) ||
            targetName.includes(item.name?.toLowerCase() || ""),
          );
          if (matched) setParty(matched.id);
        }
        setOcrNotice(
          t(
            "Recognized document items filled below. Please review lines, prices and quantities before saving.",
          ),
        );
      }
    } catch (err: any) {
      setError((err as Error).message);
    } finally {
      setOcrLoading(false);
      if (ocrInputRef.current) ocrInputRef.current.value = "";
    }
  };
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
                : record
                  ? { [kind === "QUOTATION" ? "validUntil" : "dueDate"]: null }
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
      <div className="ocr-bar">
        <label className="ocr-btn">
          <Camera size={14} />
          <span>
            {ocrLoading ? t("Recognizing document…") : t("OCR photo import")}
          </span>
          <input
            ref={ocrInputRef}
            type="file"
            className="sr-only"
            accept="image/png,image/jpeg,image/webp,application/pdf"
            disabled={ocrLoading}
            onChange={handleOcr}
          />
        </label>
        {ocrLoading && (
          <span className="muted spinner">{t("Recognizing with AI…")}</span>
        )}
        {ocrNotice && (
          <div className="ocr-notice" role="status">
            <CheckCircle2 size={15} />
            <span>{ocrNotice}</span>
          </div>
        )}
      </div>
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
      <p className="notice">
        {t(
          "Catalog lines move stock. Non-stock lines complete with the final delivery or receipt.",
        )}
      </p>
      <div className="quote-lines">
        {lines.map((l, i) => (
          <div key={i} className="quote-line">
            <span className="muted">
              {l.productId ? t("Stock item") : t("Non-stock item / service")}
            </span>
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
                placeholder={t("Item description or service…")}
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
                  placeholder="1.0000"
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
                      {enumLabel("unit", v, locale)}
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
                  placeholder="0.00"
                  value={l.unitPrice}
                  onChange={(e) => update(i, { unitPrice: e.target.value })}
                />
              </label>
              <Button
                type="button"
                data-draft-change
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
        data-draft-change
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
            placeholder="0.00"
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
            placeholder="0.00"
            value={tax}
            onChange={(e) => setTax(e.target.value)}
          />
        </label>
        <label className="span-2">
          {" "}
          {t("Terms & notes")}{" "}
          <textarea
            placeholder={t("Delivery terms, payment terms or special notes…")}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </label>
      </div>
      <div className="totals">
        <span>
          {t("Subtotal")}{" "}
          {formatNumber(subtotal.toFixed(2), locale, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </span>
        <strong>
          {t("Total")}{" "}
          {formatNumber(total.toFixed(2), locale, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
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
