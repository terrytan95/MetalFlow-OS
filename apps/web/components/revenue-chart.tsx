"use client";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { formatDate, formatNumber } from "../lib/localization";
import { useI18n } from "../lib/i18n";
export default function RevenueChart({
  data,
}: {
  data: { date: string; revenue: number }[];
}) {
  const { t, locale } = useI18n();
  return (
    <div className="chart">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis
            dataKey="date"
            tickFormatter={(v) => formatDate(v, locale).replace(/^\d{4}\//, "")}
            tick={{ fontSize: 11 }}
            axisLine={false}
          />
          <YAxis tick={{ fontSize: 11 }} axisLine={false} />
          <Tooltip
            labelFormatter={(v) => formatDate(String(v), locale)}
            formatter={(v) => [
              formatNumber(Number(v), locale, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              }),
              t("Revenue"),
            ]}
          />
          <Area
            isAnimationActive={false}
            name={t("Revenue")}
            type="monotone"
            dataKey="revenue"
            stroke="var(--accent)"
            fill="var(--soft)"
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
