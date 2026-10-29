"use client";
import { useI18n } from "../lib/i18n";
import { useState } from "react";
import { parseCSV } from "../../../packages/shared/src/csv";
import { Button } from "./ui";
import type { API } from "./forms";
import type { RecordData } from "./data";
export function Importer({
  resource,
  warehouses,
  api,
  done,
}: {
  resource: string;
  warehouses: RecordData[];
  api: API;
  done: () => void;
}) {
  const { t } = useI18n();

  const [rows, setRows] = useState<Record<string, string>[]>([]),
    [error, setError] = useState(""),
    [warehouseId, setWarehouse] = useState(warehouses[0]?.id || ""),
    [key] = useState(() => crypto.randomUUID()),
    [busy, setBusy] = useState(false);
  const examples: Record<string, string> = {
    customers:
      "name,email,phone,type\nFictional customer,example@example.invalid,,BUSINESS",
    products:
      "sku,name,material,profile,unit,price,cost\nEXAMPLE-001,Example tube,Stainless steel,square-tube,piece,48,30",
    inventory: "sku,quantity\nEXAMPLE-001,100",
  };
  return (
    <>
      <p className="notice">
        {" "}
        {t(
          "Maximum 500 rows / 1 MiB. The whole import is transactional. Duplicate customers are rejected, never silently merged. Inventory imports add opening or received quantities.",
        )}{" "}
      </p>
      <details>
        <summary>{t("CSV format")}</summary>
        <pre>{examples[resource]}</pre>
      </details>
      <label>
        {" "}
        {t("CSV file")}{" "}
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={async (e) => {
            try {
              const f = e.target.files?.[0];
              if (!f) return;
              if (f.size > 1024 * 1024) throw Error("CSV exceeds 1 MiB");
              setRows(parseCSV(await f.text()));
              setError("");
            } catch (e) {
              setRows([]);
              setError((e as Error).message);
            }
          }}
        />
      </label>
      {resource === "inventory" && (
        <label>
          {" "}
          {t("Warehouse")}{" "}
          <select
            value={warehouseId}
            onChange={(e) => setWarehouse(e.target.value)}
          >
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </label>
      )}
      {!!rows.length && (
        <>
          <h3 className="mt">
            {t("Review")} {rows.length} {t("rows")}
          </h3>
          <pre>{JSON.stringify(rows.slice(0, 5), null, 2)}</pre>
          <p className="muted">{t("Preview shows the first 5 rows.")}</p>
        </>
      )}
      {error && <p className="error">{t(error)}</p>}
      <Button
        className="primary mt"
        disabled={!rows.length || busy}
        onClick={async () => {
          setBusy(true);
          try {
            const fingerprint = Array.from(
              new Uint8Array(
                await crypto.subtle.digest(
                  "SHA-256",
                  new TextEncoder().encode(
                    JSON.stringify({ resource, warehouseId, rows }),
                  ),
                ),
              ),
            )
              .map((b) => b.toString(16).padStart(2, "0"))
              .join("");
            const pendingKey = `metalflow.import.${localStorage.getItem("metalflow.org")}.${fingerprint}`;
            const retryKey = sessionStorage.getItem(pendingKey) || key;
            sessionStorage.setItem(pendingKey, retryKey);
            await api(`imports/${resource}`, "POST", {
              rows,
              warehouseId: resource === "inventory" ? warehouseId : undefined,
              idempotencyKey: retryKey,
            });
            sessionStorage.removeItem(pendingKey);
            done();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? t("Importing…") : t(`Confirm import (${rows.length})`)}
      </Button>
    </>
  );
}
