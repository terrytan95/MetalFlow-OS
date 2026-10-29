"use client";
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
        Maximum 500 rows / 1 MiB. The whole import is transactional. Duplicate
        customers are rejected, never silently merged. Inventory imports add
        opening or received quantities.
      </p>
      <details>
        <summary>CSV format</summary>
        <pre>{examples[resource]}</pre>
      </details>
      <label>
        CSV file
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={async (e) => {
            try {
              const f = e.target.files?.[0];
              if (!f) return;
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
          Warehouse
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
          <h3 className="mt">Review {rows.length} rows</h3>
          <pre>{JSON.stringify(rows.slice(0, 5), null, 2)}</pre>
          <p className="muted">Preview shows the first 5 rows.</p>
        </>
      )}
      {error && <p className="error">{error}</p>}
      <Button
        className="primary mt"
        disabled={!rows.length || busy}
        onClick={async () => {
          setBusy(true);
          try {
            await api(`imports/${resource}`, "POST", {
              rows,
              warehouseId: resource === "inventory" ? warehouseId : undefined,
              idempotencyKey: key,
            });
            done();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Importing…" : `Confirm import (${rows.length})`}
      </Button>
    </>
  );
}
