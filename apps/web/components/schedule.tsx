"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { formatDate, formatNumber, localeTag } from "../lib/localization";
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
          <div
            className="month-controls"
            role="group"
            aria-label={t("This month")}
          >
            <input
              aria-label={t("Year")}
              type="number"
              min={1900}
              max={9999}
              value={start.getUTCFullYear()}
              onChange={(e) => {
                const year = Number(e.target.value);
                if (Number.isInteger(year) && year >= 1900 && year <= 9999)
                  setMonth(`${year}-${month.slice(5)}`);
              }}
            />
            <select
              aria-label={t("Month")}
              value={start.getUTCMonth() + 1}
              onChange={(e) =>
                setMonth(
                  `${start.getUTCFullYear()}-${e.target.value.padStart(2, "0")}`,
                )
              }
            >
              {Array.from({ length: 12 }, (_, index) => (
                <option key={index} value={index + 1}>
                  {new Intl.DateTimeFormat(localeTag(locale), {
                    month: "long",
                    timeZone: "UTC",
                  }).format(new Date(Date.UTC(2026, index, 1)))}
                </option>
              ))}
            </select>
          </div>
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
                <time>{formatDate(r.dueDate, locale)}</time>
                <strong>{r.name}</strong>
                <Badge value={r.status} />
              </button>
            ))
          ) : (
            <Empty title={t("No scheduled tasks")} />
          )}
        </div>
      ) : (
        <>
          <div className="calendar-weekdays">
            {Array.from({ length: 7 }, (_, i) => (
              <span key={i}>
                {new Intl.DateTimeFormat(localeTag(locale), {
                  weekday: "short",
                  timeZone: "UTC",
                }).format(new Date(Date.UTC(2026, 0, 4 + i)))}
              </span>
            ))}
          </div>
          <div className="calendar-grid">
            {Array.from({ length: start.getUTCDay() }, (_, i) => (
              <div key={"blank" + i} className="calendar-day blank" />
            ))}
            {Array.from({ length: end.getUTCDate() }, (_, i) => (
              <div key={i} className="calendar-day">
                <time>{formatNumber(i + 1, locale)}</time>
                {groups.get(i + 1)?.map((r) => (
                  <button key={r.id} onClick={() => onSelect(r)}>
                    <span>{r.name}</span>
                    <Badge value={r.status} />
                  </button>
                ))}
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
