'use client';

import { useState } from 'react';
import { ArrowDownRight, ArrowUpRight, Search, UserMinus } from 'lucide-react';
import {
  DAY_LABELS,
  HOUR_LABELS,
  type BarberPerformance,
  type BranchBreakdown,
  type BranchOption,
  type Churned,
} from './data';

const GOOD = '#0ca30c';
const CRITICAL = '#e66767';
const HEAT_RGB = '57, 135, 229'; // dark-mode categorical blue (slot 1), used as the sequential hue
const PRIMARY = '#d97706'; // app brand amber — single-series revenue line

export function formatRupiah(value: number) {
  return `Rp ${Math.round(value).toLocaleString('id-ID')}`;
}

function formatCompactRupiah(value: number) {
  if (Math.abs(value) >= 1_000_000) {
    const millions = value / 1_000_000;
    return `${millions.toFixed(millions < 10 ? 1 : 0)}jt`;
  }
  if (Math.abs(value) >= 1_000) {
    return `${Math.round(value / 1_000)}rb`;
  }
  return `${value}`;
}

function Delta({ pct }: { pct: number }) {
  const isUp = pct >= 0;
  const color = isUp ? GOOD : CRITICAL;
  const Icon = isUp ? ArrowUpRight : ArrowDownRight;
  return (
    <span className="inline-flex items-center gap-1 text-sm font-medium" style={{ color }}>
      <Icon className="h-4 w-4" aria-hidden="true" />
      {Math.abs(pct)}%
    </span>
  );
}

export function StatCard({
  icon: Icon,
  label,
  value,
  deltaPct,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  deltaPct: number;
}) {
  return (
    <div className="glass-panel p-6 rounded-2xl">
      <div className="flex items-center justify-between mb-4">
        <div className="p-2 bg-primary/10 rounded-lg">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <Delta pct={deltaPct} />
      </div>
      <p className="text-sm text-gray-400 mb-1">{label}</p>
      <p className="text-3xl font-bold tracking-tight">{value}</p>
    </div>
  );
}

export function PeakHourHeatmap({ grid }: { grid: number[][] }) {
  let peak = { row: 0, col: 0, value: -1 };
  grid.forEach((row, r) =>
    row.forEach((value, c) => {
      if (value > peak.value) peak = { row: r, col: c, value };
    })
  );
  const hasData = peak.value > 0;
  const maxValue = Math.max(1, ...grid.flat());

  return (
    <div>
      <div className="overflow-x-auto">
        <div className="min-w-[560px]">
          <div className="grid grid-cols-[64px_repeat(7,1fr)] gap-1.5 mb-1.5">
            <div />
            {DAY_LABELS.map((day) => (
              <div key={day} className="text-xs text-gray-500 text-center font-medium">
                {day}
              </div>
            ))}
          </div>
          {grid.map((row, r) => (
            <div key={HOUR_LABELS[r]} className="grid grid-cols-[64px_repeat(7,1fr)] gap-1.5 mb-1.5">
              <div className="text-xs text-gray-500 flex items-center">{HOUR_LABELS[r]}</div>
              {row.map((value, c) => {
                const isPeak = hasData && r === peak.row && c === peak.col;
                return (
                  <div key={c} className="group relative">
                    <div
                      tabIndex={0}
                      className="aspect-square rounded-md outline-none focus-visible:ring-2 focus-visible:ring-primary cursor-default"
                      style={{ backgroundColor: `rgba(${HEAT_RGB}, ${(0.08 + (value / maxValue) * 0.82).toFixed(2)})` }}
                    />
                    {isPeak && (
                      <span className="absolute -top-1.5 -right-1.5 text-[9px] font-bold bg-primary text-white rounded-full px-1 leading-tight">
                        Peak
                      </span>
                    )}
                    <div
                      role="tooltip"
                      className="pointer-events-none absolute z-10 bottom-full left-1/2 -translate-x-1/2 mb-2 whitespace-nowrap rounded-lg bg-slate-800 border border-[var(--border)] px-2.5 py-1.5 text-xs opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity"
                    >
                      <span className="font-semibold text-white">{DAY_LABELS[c]} {HOUR_LABELS[r]}</span>
                      <span className="text-gray-400"> · {value} booking</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <details className="mt-4 text-sm">
        <summary className="cursor-pointer text-gray-400 hover:text-primary transition-colors w-fit">
          Lihat sebagai tabel
        </summary>
        <div className="mt-3 max-h-56 overflow-y-auto rounded-xl border border-[var(--border)]">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-slate-900">
              <tr className="text-left text-gray-500">
                <th className="px-3 py-2 font-medium">Jam</th>
                <th className="px-3 py-2 font-medium">Hari</th>
                <th className="px-3 py-2 font-medium text-right">Booking Selesai</th>
              </tr>
            </thead>
            <tbody>
              {grid.flatMap((row, r) =>
                row.map((value, c) => (
                  <tr key={`${r}-${c}`} className="border-t border-[var(--border)]">
                    <td className="px-3 py-1.5 text-gray-300">{HOUR_LABELS[r]}</td>
                    <td className="px-3 py-1.5 text-gray-300">{DAY_LABELS[c]}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-gray-300">{value}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

export function RevenueTrendChart({ values, dates }: { values: number[]; dates: string[] }) {
  const width = 600;
  const height = 200;
  const padding = { top: 12, right: 12, bottom: 24, left: 44 };
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;

  const max = Math.max(...values);
  const min = 0;
  const range = max - min || 1; // avoid divide-by-zero when every value in the window is 0
  const x = (i: number) => padding.left + (i / (values.length - 1)) * innerW;
  const y = (v: number) => padding.top + innerH - ((v - min) / range) * innerH;

  const linePath = values.map((v, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(v)}`).join(' ');
  const areaPath = `${linePath} L ${x(values.length - 1)} ${padding.top + innerH} L ${x(0)} ${padding.top + innerH} Z`;

  const ticks = max > 0 ? [0, max * 0.5, max] : [0];

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto overflow-visible">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padding.left} x2={width - padding.right} y1={y(t)} y2={y(t)} stroke="#2c2c2a" strokeWidth={1} />
            <text x={padding.left - 8} y={y(t)} textAnchor="end" dominantBaseline="middle" className="fill-gray-500" fontSize={10}>
              {formatCompactRupiah(t)}
            </text>
          </g>
        ))}
        <path d={areaPath} fill={PRIMARY} opacity={0.1} />
        <path d={linePath} fill="none" stroke={PRIMARY} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {values.map((v, i) => (
          <g key={i} className="group">
            <circle cx={x(i)} cy={y(v)} r={12} fill="transparent" tabIndex={0} className="outline-none cursor-default" />
            <circle cx={x(i)} cy={y(v)} r={4} fill={PRIMARY} stroke="#0f172a" strokeWidth={2} className="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity pointer-events-none" />
            <foreignObject
              x={Math.min(Math.max(x(i) - 60, 0), width - 120)}
              y={Math.max(y(v) - 52, 0)}
              width={120}
              height={40}
              className="pointer-events-none opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity"
            >
              <div className="rounded-lg bg-slate-800 border border-[var(--border)] px-2.5 py-1.5 text-center">
                <p className="text-[10px] text-gray-400 leading-tight">{dates[i]}</p>
                <p className="text-xs font-semibold text-white leading-tight">{formatRupiah(v)}</p>
              </div>
            </foreignObject>
          </g>
        ))}
        {(['x0', 'xlast'] as const).map((key) => {
          const i = key === 'x0' ? 0 : values.length - 1;
          return (
            <text key={key} x={x(i)} y={height - 4} textAnchor={i === 0 ? 'start' : 'end'} className="fill-gray-500" fontSize={10}>
              {dates[i]}
            </text>
          );
        })}
      </svg>
      <details className="mt-2 text-sm">
        <summary className="cursor-pointer text-gray-400 hover:text-primary transition-colors w-fit">
          Lihat sebagai tabel
        </summary>
        <div className="mt-3 max-h-56 overflow-y-auto rounded-xl border border-[var(--border)]">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-slate-900">
              <tr className="text-left text-gray-500">
                <th className="px-3 py-2 font-medium">Tanggal</th>
                <th className="px-3 py-2 font-medium text-right">Omzet</th>
              </tr>
            </thead>
            <tbody>
              {values.map((v, i) => (
                <tr key={i} className="border-t border-[var(--border)]">
                  <td className="px-3 py-1.5 text-gray-300">{dates[i]}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-gray-300">{formatRupiah(v)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

export function BranchBreakdownChart({ rows, branches }: { rows: BranchBreakdown[]; branches: BranchOption[] }) {
  const max = Math.max(1, ...rows.map((r) => r.revenue));

  return (
    <div>
      <div className="space-y-3 mb-6">
        {rows.map((row) => {
          const color = branches.find((b) => b.id === row.branchId)?.color ?? PRIMARY;
          const widthPct = (row.revenue / max) * 100;
          return (
            <div key={row.branchId} className="group relative">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-gray-300 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                  {row.branchName}
                </span>
                <span className="text-sm font-semibold tabular-nums">{formatRupiah(row.revenue)}</span>
              </div>
              <div tabIndex={0} className="h-2.5 rounded-full bg-white/5 overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-primary">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${widthPct}%`, backgroundColor: color }}
                />
              </div>
            </div>
          );
        })}
      </div>
      <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 bg-white/5">
              <th className="px-4 py-2.5 font-medium">Cabang</th>
              <th className="px-4 py-2.5 font-medium text-right">Omzet (14 hari)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.branchId} className="border-t border-[var(--border)]">
                <td className="px-4 py-2.5 text-gray-300">{row.branchName}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{formatRupiah(row.revenue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function RetentionReport({
  repeatRatePct,
  repeatRateDeltaPct,
  churned,
}: {
  repeatRatePct: number;
  repeatRateDeltaPct: number;
  churned: Churned[];
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-5 gap-8">
      <div className="md:col-span-2 flex flex-col justify-center">
        <p className="text-sm text-gray-400 mb-2">Repeat Customer Rate</p>
        <p className="font-extrabold tracking-tighter" style={{ fontSize: 56, lineHeight: 1 }}>
          {repeatRatePct}%
        </p>
        <div className="mt-3">
          <Delta pct={repeatRateDeltaPct} />
          <span className="text-sm text-gray-500 ml-1.5">vs bulan lalu</span>
        </div>
      </div>
      <div className="md:col-span-3">
        <p className="text-sm text-gray-400 mb-3">Pelanggan Pasif (Churned)</p>
        <div className="space-y-2">
          {churned.map((c) => (
            <div key={c.id} className="flex items-center justify-between p-3 rounded-xl bg-white/5">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center shrink-0">
                  <UserMinus className="h-4 w-4 text-red-400" />
                </div>
                <div>
                  <p className="text-sm font-medium">{c.name}</p>
                  <p className="text-xs text-gray-500">Terakhir: {c.lastVisit}</p>
                </div>
              </div>
              <span className="text-xs text-red-400 font-medium whitespace-nowrap">{c.daysSince} hari lalu</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Kinerja Kapster — 14 hari sama seperti Tren Omzet, dengan filter nama biar gampang cari 1 barber
// spesifik kalau daftarnya panjang. Superadmin/owner lain tetap kelihatan semua barber tenant
// sendiri saja (Phase 2 isolation di RLS), superadmin lain lihat lintas tenant sesuai kebutuhan.
export function BarberPerformanceTable({ rows }: { rows: BarberPerformance[] }) {
  const [query, setQuery] = useState('');

  const filtered = query.trim()
    ? rows.filter((r) => r.barberName.toLowerCase().includes(query.trim().toLowerCase()))
    : rows;

  return (
    <div>
      <div className="relative mb-4 max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cari nama kapster..."
          className="w-full bg-white/5 border border-[var(--border)] rounded-lg py-2 pl-9 pr-3 text-sm focus:outline-none focus:border-primary transition-colors"
        />
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-gray-500">Belum ada layanan selesai dalam 14 hari terakhir.</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-gray-500">Tidak ada kapster yang cocok dengan pencarian.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 bg-white/5">
                <th className="px-4 py-2.5 font-medium">Kapster</th>
                <th className="px-4 py-2.5 font-medium text-right">Layanan Selesai</th>
                <th className="px-4 py-2.5 font-medium text-right">Omzet</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.barberId} className="border-t border-[var(--border)]">
                  <td className="px-4 py-2.5 font-medium">{r.barberName}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{r.servicesCount}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-primary font-semibold">{formatRupiah(r.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
