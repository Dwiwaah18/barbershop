'use client';

import { useMemo, useState } from 'react';
import { CalendarDays, ClipboardList } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { Branch } from '@/lib/supabase/types';
import { reconcileShift, type ReconciliationPettyCashRow, type ReconciliationTxRow } from '@/lib/shift-reconciliation';

const formatRupiah = (n: number) => `Rp ${Math.round(n).toLocaleString('id-ID')}`;

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

function dateInputValue(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function defaultPeriodStart() {
  const d = new Date();
  d.setDate(1);
  return dateInputValue(d);
}

function defaultPeriodEnd() {
  return dateInputValue(new Date());
}

function startOfDayISO(dateStr: string) {
  return new Date(`${dateStr}T00:00:00`).toISOString();
}

function nextDayStartISO(dateStr: string) {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + 1);
  return d.toISOString();
}

function formatDateTime(iso: string | null) {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('id-ID', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Jakarta',
  });
}

type ShiftRow = {
  id: string;
  branch_id: string;
  opened_at: string;
  closed_at: string | null;
  opening_cash: number;
  closing_cash: number | null;
  status: 'open' | 'closed';
  profiles: { full_name: string | null } | null;
};

type TxRow = ReconciliationTxRow & { branch_id: string };
type PettyCashRow = ReconciliationPettyCashRow & { description: string | null; created_at: string };

export default function ShiftReportClient({ branches }: { branches: Branch[] }) {
  const [periodStart, setPeriodStart] = useState(defaultPeriodStart);
  const [periodEnd, setPeriodEnd] = useState(defaultPeriodEnd);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);

  const [shifts, setShifts] = useState<ShiftRow[]>([]);
  const [transactions, setTransactions] = useState<TxRow[]>([]);
  const [pettyCash, setPettyCash] = useState<PettyCashRow[]>([]);

  const shiftsByBranch = useMemo(() => {
    const map: Record<string, ShiftRow[]> = {};
    for (const s of shifts) {
      if (!map[s.branch_id]) map[s.branch_id] = [];
      map[s.branch_id].push(s);
    }
    return map;
  }, [shifts]);

  const handleShow = async () => {
    if (loading) return;
    if (!periodStart || !periodEnd || periodStart > periodEnd) {
      setError('Rentang tanggal tidak valid.');
      return;
    }
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const start = startOfDayISO(periodStart);
    const end = nextDayStartISO(periodEnd);
    const branchIds = branches.map((b) => b.id);

    const [shiftsRes, txRes, pettyCashRes] = await Promise.all([
      supabase
        .from('shifts')
        .select('id, branch_id, opened_at, closed_at, opening_cash, closing_cash, status, profiles:cashier_id(full_name)')
        .in('branch_id', branchIds)
        .gte('opened_at', start)
        .lt('opened_at', end)
        .order('opened_at', { ascending: false }),
      supabase
        .from('transactions')
        .select('total, payment_method, created_at, branch_id')
        .in('branch_id', branchIds)
        .eq('status', 'paid')
        .gte('created_at', start)
        .lt('created_at', end),
      supabase
        .from('petty_cash_entries')
        .select('shift_id, type, amount, description, created_at, shifts!inner(branch_id, opened_at)')
        .in('shifts.branch_id', branchIds)
        .gte('shifts.opened_at', start)
        .lt('shifts.opened_at', end),
    ]);

    if (shiftsRes.error || txRes.error || pettyCashRes.error) {
      setError('Gagal memuat laporan tutup shift. Coba lagi.');
      setLoading(false);
      return;
    }

    setShifts((shiftsRes.data as unknown as ShiftRow[] | null) ?? []);
    setTransactions((txRes.data as unknown as TxRow[] | null) ?? []);
    setPettyCash((pettyCashRes.data as unknown as PettyCashRow[] | null) ?? []);
    setHasLoaded(true);
    setLoading(false);
  };

  return (
    <div>
      <div className="glass-panel p-6 rounded-2xl mb-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-primary" />
          Filter Periode
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Dari</label>
            <input
              type="date"
              value={periodStart}
              onChange={(e) => setPeriodStart(e.target.value)}
              className="w-full bg-white/5 border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Sampai</label>
            <input
              type="date"
              value={periodEnd}
              onChange={(e) => setPeriodEnd(e.target.value)}
              className="w-full bg-white/5 border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
            />
          </div>
          <button
            onClick={handleShow}
            disabled={loading}
            className="inline-flex items-center justify-center gap-1.5 bg-primary hover:bg-amber-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            <ClipboardList className="h-4 w-4" />
            {loading ? 'Memuat...' : 'Tampilkan'}
          </button>
        </div>
        {error && <p className="text-xs text-red-400 mt-3">{error}</p>}
      </div>

      {hasLoaded && (
        <div className="space-y-6">
          {branches.map((branch) => {
            const branchShifts = shiftsByBranch[branch.id] ?? [];
            const branchTx = transactions.filter((t) => t.branch_id === branch.id);
            const totalSelisih = branchShifts.reduce((sum, s) => {
              const r = reconcileShift(s, branchTx, pettyCash);
              return sum + (r.selisih ?? 0);
            }, 0);

            return (
              <div key={branch.id} className="glass-panel p-6 rounded-2xl">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold">
                    {branch.name} <span className="text-sm font-normal text-gray-500">({branchShifts.length} shift)</span>
                  </h2>
                  {branchShifts.some((s) => s.closing_cash !== null) && (
                    <span className={`text-sm font-medium ${totalSelisih === 0 ? 'text-green-400' : totalSelisih > 0 ? 'text-green-400' : 'text-red-400'}`}>
                      Total Selisih: {totalSelisih === 0 ? 'Rp 0' : `${totalSelisih > 0 ? '+' : ''}${formatRupiah(totalSelisih)}`}
                    </span>
                  )}
                </div>

                {branchShifts.length === 0 ? (
                  <p className="text-sm text-gray-400">Belum ada shift di periode ini.</p>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-gray-500 bg-white/5">
                          <th className="px-4 py-2.5 font-medium">Kasir</th>
                          <th className="px-4 py-2.5 font-medium">Buka</th>
                          <th className="px-4 py-2.5 font-medium">Tutup</th>
                          <th className="px-4 py-2.5 font-medium text-right">Kas Awal</th>
                          <th className="px-4 py-2.5 font-medium text-right">Penjualan Cash</th>
                          <th className="px-4 py-2.5 font-medium text-right">QRIS</th>
                          <th className="px-4 py-2.5 font-medium text-right">Deposit</th>
                          <th className="px-4 py-2.5 font-medium text-right">Estimasi Kas</th>
                          <th className="px-4 py-2.5 font-medium text-right">Kas Aktual</th>
                          <th className="px-4 py-2.5 font-medium text-right">Selisih</th>
                        </tr>
                      </thead>
                      <tbody>
                        {branchShifts.map((s) => {
                          const r = reconcileShift(s, branchTx, pettyCash);
                          return (
                            <tr key={s.id} className="border-t border-[var(--border)]">
                              <td className="px-4 py-2.5 font-medium whitespace-nowrap">{s.profiles?.full_name ?? 'Tanpa nama'}</td>
                              <td className="px-4 py-2.5 text-gray-400 whitespace-nowrap">{formatDateTime(s.opened_at)}</td>
                              <td className="px-4 py-2.5 text-gray-400 whitespace-nowrap">{formatDateTime(s.closed_at)}</td>
                              <td className="px-4 py-2.5 text-right tabular-nums">{formatRupiah(s.opening_cash)}</td>
                              <td className="px-4 py-2.5 text-right tabular-nums">{formatRupiah(r.cashSales)}</td>
                              <td className="px-4 py-2.5 text-right tabular-nums text-gray-400">{formatRupiah(r.qrisSales)}</td>
                              <td className="px-4 py-2.5 text-right tabular-nums text-gray-400">{formatRupiah(r.depositSales)}</td>
                              <td className="px-4 py-2.5 text-right tabular-nums font-medium">{formatRupiah(r.expectedCash)}</td>
                              <td className="px-4 py-2.5 text-right tabular-nums">
                                {s.closing_cash !== null ? (
                                  formatRupiah(s.closing_cash)
                                ) : (
                                  <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400">Masih Buka</span>
                                )}
                              </td>
                              <td className="px-4 py-2.5 text-right tabular-nums font-medium">
                                {r.selisih === null ? (
                                  <span className="text-gray-500">-</span>
                                ) : r.selisih === 0 ? (
                                  <span className="text-green-400">Rp 0</span>
                                ) : (
                                  <span className={r.selisih > 0 ? 'text-green-400' : 'text-red-400'}>
                                    {r.selisih > 0 ? '+' : ''}
                                    {formatRupiah(r.selisih)}
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
