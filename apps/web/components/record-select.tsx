"use client";
import { useState, useId } from "react";
import { useQuery } from "@tanstack/react-query";
import { useI18n } from "../lib/i18n";
import { useDebounced } from "../lib/hooks";
import type { API } from "./forms";
import type { RecordData } from "./data";
export function RecordSelect({
  resource,
  api,
  value,
  onChange,
  options = [],
  name,
  required = false,
  label,
}: {
  resource: string;
  api: API;
  value?: string;
  onChange?: (value: string, record?: RecordData) => void;
  options?: RecordData[];
  name?: string;
  required?: boolean;
  label?: string;
}) {
  const { t } = useI18n();
  const selectId = useId();
  const [search, setSearch] = useState(""),
    [local, setLocal] = useState(value || ""),
    [selected, setSelected] = useState<RecordData | null>(null);
  const q = useDebounced(search);
  const id = value === undefined ? local : value;
  const results = useQuery({
    queryKey: [
      "record-options",
      typeof window === "undefined"
        ? ""
        : localStorage.getItem("metalflow.org"),
      resource,
      q,
    ],
    enabled: q.length > 0,
    queryFn: () => api(`${resource}?search=${encodeURIComponent(q)}&limit=50`),
    staleTime: 30000,
  });
  const rows = q ? results.data?.items || [] : options;
  const current =
    rows.find((r: RecordData) => r.id === id) ||
    selected ||
    options.find((r) => r.id === id);
  const merged =
    current && !rows.some((r: RecordData) => r.id === id)
      ? [current, ...rows]
      : rows;
  return (
    <span className="record-select">
      <input
        aria-label={t("Search options…")}
        aria-controls={selectId}
        placeholder={t("Search options…")}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <select
        aria-label={label}
        id={selectId}
        name={name}
        required={required}
        value={id}
        onChange={(e) => {
          const row = merged.find((r: RecordData) => r.id === e.target.value);
          setLocal(e.target.value);
          setSelected(row || null);
          onChange?.(e.target.value, row);
        }}
      >
        <option value="">
          {results.isFetching ? t("Loading…") : t("Select…")}
        </option>
        {merged.map((row: RecordData) => (
          <option key={row.id} value={row.id}>
            {row.sku ? `${row.sku} · ` : ""}
            {resource === "warehouses" && row.name === "Main warehouse"
              ? t("Main warehouse")
              : row.name || row.subject}
          </option>
        ))}
      </select>
    </span>
  );
}
