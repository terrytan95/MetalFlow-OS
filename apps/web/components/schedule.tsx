"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useI18n } from "../lib/i18n";
import { Button, Badge, Empty } from "./ui";
import type { API } from "./forms";
import type { RecordData } from "./data";
export function Schedule({
  api,
  organizationId,
  onSelect,
}: {
  api: API;
  organizationId: string;
  onSelect: (row: RecordData) => void;
}) {
  const { t, locale } = useI18n();
  const [month, setMonth] = useState(() =>
      new Date().toISOString().slice(0, 7),
    ),
    [timeline, setTimeline] = useState(false);
  const start = new Date(month + "-01T00:00:00Z"),
    end = new Date(
      Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0, 23, 59, 59),
    );
  const query = useQuery({
    queryKey: ["schedule", organizationId, month],
    queryFn: () =>
      api(`schedule?from=${start.toISOString()}&to=${end.toISOString()}`),
  });
  const groups = new Map<number, RecordData[]>();
  for (const row of query.data?.items || []) {
    const day = new Date(row.dueDate).getUTCDate();
    const list = groups.get(day) || [];
    list.push(row);
    groups.set(day, list);
  }
  const shift = (n: number) =>
    setMonth(
      new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + n, 1))
        .toISOString()
        .slice(0, 7),
    );
  return (
    <section className="panel schedule">
      <div className="panel-title">
        <h2>{t("Project schedule")}</h2>
        <div className="actions">
          <Button aria-label={t("Previous month")} onClick={() => shift(-1)}>
            <ChevronLeft size={16} />
          </Button>
          <input
            aria-label={t("This month")}
            type="month"
            value={month}
            onChange={(e) => e.target.value && setMonth(e.target.value)}
          />
          <Button aria-label={t("Next month")} onClick={() => shift(1)}>
            <ChevronRight size={16} />
          </Button>
          <Button onClick={() => setTimeline(!timeline)}>
            {t(timeline ? "Calendar view" : "Timeline view")}
          </Button>
        </div>
      </div>
      {query.isError ? (
        <p className="error">{t(query.error.message)}</p>
      ) : timeline ? (
        <div>
          {query.data?.items?.length ? (
            query.data.items.map((r: RecordData) => (
              <button
                className="schedule-task"
                key={r.id}
                onClick={() => onSelect(r)}
              >
                <time>{new Date(r.dueDate).toLocaleDateString(locale)}</time>
                <strong>{r.name}</strong>
                <Badge value={r.status} />
              </button>
            ))
          ) : (
            <Empty title={t("No scheduled tasks")} />
          )}
        </div>
      ) : (
        <div className="calendar-grid">
          {Array.from({ length: start.getUTCDay() }, (_, i) => (
            <div key={"blank" + i} className="calendar-day blank" />
          ))}
          {Array.from({ length: end.getUTCDate() }, (_, i) => (
            <div key={i} className="calendar-day">
              <time>{i + 1}</time>
              {groups.get(i + 1)?.map((r) => (
                <button key={r.id} onClick={() => onSelect(r)}>
                  <span>{r.name}</span>
                  <Badge value={r.status} />
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
