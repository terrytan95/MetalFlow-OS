"use client";
import { useI18n } from "../lib/i18n";
import { useMemo } from "react";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
} from "@tanstack/react-table";
import { Badge, Empty, Button } from "./ui";
import { titleCase, type RecordData } from "./data";
export function RecordsTable({
  items,
  columns,
  onSelect,
  lookups,
}: {
  items: RecordData[];
  columns: string[];
  onSelect?: (record: RecordData) => void;
  lookups: Record<string, RecordData[]>;
}) {
  const { t, locale } = useI18n();
  const lookupById = useMemo(
    () =>
      new Map(
        Object.values(lookups)
          .flat()
          .map((row) => [row.id, row.name || row.subject]),
      ),
    [lookups],
  );

  const defs = useMemo(
    () =>
      columns.map((key) => ({
        accessorKey: key,
        header: t(key) === key ? titleCase(key).replace("Id", "") : t(key),
        cell: ({ getValue }: any) => {
          const v = getValue();
          if (v == null) return <span className="muted">—</span>;
          if (key === "status") return <Badge value={String(v)} />;
          if (/At$|Date$/.test(key))
            return new Date(v).toLocaleDateString(locale);
          if (key.endsWith("Id"))
            return lookupById.get(v) || String(v).slice(0, 8);
          if (typeof v === "object") return v.name || JSON.stringify(v);
          return [
            "type",
            "unit",
            "profile",
            "source",
            "method",
            "kind",
            "category",
            "role",
          ].includes(key)
            ? t(String(v))
            : String(v);
        },
      })),
    [columns, lookupById, t, locale],
  );
  const table = useReactTable({
    data: items,
    columns: defs,
    getCoreRowModel: getCoreRowModel(),
  });
  if (!items.length) return <Empty />;
  return (
    <div className="table-scroll">
      <table>
        <thead>
          {table.getHeaderGroups().map((h) => (
            <tr key={h.id}>
              {h.headers.map((c) => (
                <th key={c.id}>
                  {flexRender(c.column.columnDef.header, c.getContext())}
                </th>
              ))}
              {onSelect && (
                <th>
                  <span className="sr-only">{t("Actions")}</span>
                </th>
              )}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((r) => (
            <tr key={r.id}>
              {r.getVisibleCells().map((c) => (
                <td key={c.id}>
                  {flexRender(c.column.columnDef.cell, c.getContext())}
                </td>
              ))}
              {onSelect && (
                <td>
                  <Button
                    className="table-action"
                    onClick={() => onSelect(r.original)}
                  >
                    {" "}
                    {t("Open →")}{" "}
                  </Button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
