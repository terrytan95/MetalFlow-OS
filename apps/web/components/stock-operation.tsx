"use client";
import { useState } from "react";
import { Decimal } from "decimal.js";
import { useI18n } from "../lib/i18n";
import { enumLabel } from "../lib/localization";
import type { RecordData } from "./data";
import type { API } from "./forms";
import { Button } from "./ui";

export function StockOperation({
  document: d,
  api,
  done,
}: {
  document: RecordData;
  api: API;
  done: () => void;
}) {
  const { t, locale } = useI18n();
  const [warehouse, setWarehouse] = useState(d.warehouses[0]?.id || "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const reserving = d.kind === "ORDER" && d.status === "CONFIRMED";
  const lines = d.stockProgress.filter(
    (l: RecordData) =>
      new Decimal(l.remaining).gt(0) &&
      (!l.warehouseId || l.warehouseId === warehouse),
  );
  return (
    <form
      className="inline-operation"
      onSubmit={async (event) => {
        event.preventDefault();
        if (busy) return;
        const form = new FormData(event.currentTarget);
        setBusy(true);
        setError("");
        try {
          const quantities = (reserving ? [] : lines)
            .map((l: RecordData, i: number) => ({
              productId: l.productId,
              quantity: String(form.get(`qty${i}`)),
            }))
            .filter((l: RecordData) => new Decimal(l.quantity).gt(0));
          await api(
            `${d.kind === "ORDER" ? "orders" : "purchases"}/${d.id}/${reserving ? "reserve" : d.kind === "ORDER" ? "fulfill" : "receive"}`,
            "POST",
            reserving
              ? { warehouseId: warehouse }
              : {
                  warehouseId: warehouse,
                  lines: quantities,
                  idempotencyKey: crypto.randomUUID(),
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
      <h3>
        {d.kind === "PURCHASE"
          ? t("Receive materials")
          : reserving
            ? t("Reserve stock")
            : t("Fulfill order")}
      </h3>
      <p className="muted">
        {t(
          "Catalog lines move stock. Non-stock lines complete with the final delivery or receipt.",
        )}
      </p>
      <label>
        {t("Warehouse")}
        <select
          name="warehouseId"
          required
          value={warehouse}
          onChange={(e) => setWarehouse(e.target.value)}
        >
          {d.warehouses.map((w: RecordData) => (
            <option key={w.id} value={w.id}>
              {w.name === "Main warehouse" ? t("Main warehouse") : w.name}
            </option>
          ))}
        </select>
      </label>
      {!reserving && (
        <div key={warehouse}>
          {lines.map((l: RecordData, i: number) => (
            <label key={l.productId}>
              {l.description} · {enumLabel("unit", l.unit, locale)}
              <small className="muted">
                {t(
                  "Ordered / reserved: {ordered} · Completed: {completed} · Remaining: {remaining}",
                  l,
                )}
              </small>
              <input
                type="number"
                aria-label={l.description}
                name={`qty${i}`}
                defaultValue={l.remaining}
                max={l.remaining}
                min="0"
                step="0.0001"
                required
              />
            </label>
          ))}
        </div>
      )}
      {error && (
        <p className="error" role="alert">
          {t(error)}
        </p>
      )}
      <Button
        className="primary mt"
        disabled={busy || !warehouse || !lines.length}
      >
        {t("Confirm stock operation")}
      </Button>
    </form>
  );
}
