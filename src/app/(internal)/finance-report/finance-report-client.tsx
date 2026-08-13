'use client';

import { useState } from 'react';
import { Calculator, TrendingUp, ClipboardCheck, PiggyBank } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { Branch } from '@/lib/supabase/types';
import { reconcileShift } from '@/lib/shift-reconciliation';

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

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
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

const paymentMethodLabel: Record<string, string> = {
  cash: 'Cash',
  qris: 'QRIS',
  deposit: 'Deposit',
};

type ShiftRow = {
  id: string;
  opened_at: string;
  closed_at: string | null;
  opening_cash: number;
  closing_cash: number | null;
  status: 'open' | 'closed';
  profiles: { full_name: string | null } | null;
};

type PettyCashRow = {
  id: string;
  shift_id: string;
  type: 'cash_in' | 'expense';
  amount: number;
  description: string | null;
  created_at: string;
};

type TxRow = {
  total: number;
  payment_method: 'cash' | 'qris' | 'deposit';
  created_at: string;
};

type PayrollRow = {
  id: string;
  net_pay: number;
  paid_at: string;
  profiles: { full_name: string | null } | null;
};

export default function FinanceReportClient({ branches }: { branches: Branch[] }) {
  const [branchId, setBranchId] = useState(branches[0].id);
  const [periodStart, setPeriodStart] = useState(defaultPeriodStart);
  const [periodEnd, setPeriodEnd] = useState(defaultPeriodEnd);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasCalculated, setHasCalculated] = useState(false);

  const [revenueByMethod, setRevenueByMethod] = useState<Record<string, number>>({});
  const [transactionCount, setTransactionCount] = useState(0);
  const [transactions, setTransactions] = useState<TxRow[]>([]);
  const [shifts, setShifts] = useState<ShiftRow[]>([]);
  const [pettyCash, setPettyCash] = useState<PettyCashRow[]>([]);
  const [payroll, setPayroll] = useState<PayrollRow[]>([]);

  const totalRevenue = Object.values(revenueByMethod).reduce((sum, v) => sum + v, 0);
  const pettyCashExpense = pettyCash.filter((p) => p.type === 'expense').reduce((sum, p) => sum + Number(p.amount), 0);
  const pettyCashIn = pettyCash.filter((p) => p.type === 'cash_in').reduce((sum, p) => sum + Number(p.amount), 0);
  const totalPayroll = payroll.reduce((sum, p) => sum + Number(p.net_pay), 0);
  const netProfit = totalRevenue - pettyCashExpense - totalPayroll;

  const handleCalculate = async () => {
    if (!periodStart || !periodEnd || periodStart > periodEnd) {
      setError('Rentang tanggal tidak valid.');
      return;
    }
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const start = startOfDayISO(periodStart);
    const end = nextDayStartISO(periodEnd);

    const [txRes, shiftsRes, pettyCashRes, payrollRes] = await Promise.all([
      supabase
        .from('transactions')
        .select('total, payment_method, created_at')
        .eq('branch_id', branchId)
        .eq('status', 'paid')
        .gte('created_at', start)
        .lt('created_at', end),
      supabase
        .from('shifts')
        .select('id, opened_at, closed_at, opening_cash, closing_cash, status, profiles:cashier_id(full_name)')
        .eq('branch_id', branchId)
        .gte('opened_at', start)
        .lt('opened_at', end)
        .order('opened_at', { ascending: false }),
      supabase
        .from('petty_cash_entries')
        .select('id, shift_id, type, amount, description, created_at, shifts!inner(branch_id, opened_at)')
        .eq('shifts.branch_id', branchId)
        .gte('shifts.opened_at', start)
        .lt('shifts.opened_at', end)
        .order('created_at', { ascending: false }),
      supabase
        .from('payroll_payments')
        .select('id, net_pay, paid_at, profiles:profile_id(full_name)')
        .eq('branch_id', branchId)
        .gte('paid_at', start)
        .lt('paid_at', end)
        .order('paid_at', { ascending: false }),
    ]);

    if (txRes.error || shiftsRes.error || pettyCashRes.error || payrollRes.error) {
      setError('Gagal memuat laporan keuangan. Coba lagi.');
      setLoading(false);
      return;
    }

    const byMethod: Record<string, number> = {};
    const txRows = (txRes.data ?? []) as TxRow[];
    for (const row of txRows) {
      byMethod[row.payment_method] = (byMethod[row.payment_method] ?? 0) + Number(row.total);
    }

    setRevenueByMethod(byMethod);
    setTransactionCount(txRows.length);
    setTransactions(txRows);
    setShifts((shiftsRes.data as unknown as ShiftRow[] | null) ?? []);
    setPettyCash((pettyCashRes.data as unknown as PettyCashRow[] | null) ?? []);
    setPayroll((payrollRes.data as unknown as PayrollRow[] | null) ?? []);
    setHasCalculated(true);
    setLoading(false);
  };

  return (
    <div>
      {branches.length > 1 && (
        <div className="flex items-center gap-1.5 p-1 bg-white/5 rounded-xl border border-[var(--border)] w-fit mb-6">
          {branches.map((b) => (
            <button
              key={b.id}
              onClick={() => setBranchId(b.id)}
              className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                branchId === b.id ? 'bg-primary text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              {b.name}
            </button>
          ))}
        </div>
      )}

      <div className="glass-panel p-6 rounded-2xl mb-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Calculator className="h-5 w-5 text-primary" />
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
            onClick={handleCalculate}
            disabled={loading}
            className="inline-flex items-center justify-center gap-1.5 bg-primary hover:bg-amber-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            <Calculator className="h-4 w-4" />
            {loading ? 'Menghitung...' : 'Hitung'}
          </button>
        </div>
        {error && <p className="text-xs text-red-400 mt-3">{error}</p>}
      </div>

      {hasCalculated && (
        <div className="space-y-6">
          {/* Pendapatan */}
          <div className="glass-panel p-6 rounded-2xl">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Pendapatan
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div className="bg-white/5 border border-[var(--border)] rounded-xl p-4">
                <p className="text-xs text-gray-400 mb-1">Total Pendapatan</p>
                <p className="text-2xl font-bold text-primary">{formatRupiah(totalRevenue)}</p>
              </div>
              <div className="bg-white/5 border border-[var(--border)] rounded-xl p-4">
                <p className="text-xs text-gray-400 mb-1">Jumlah Transaksi</p>
                <p className="text-2xl font-bold">{transactionCount}</p>
              </div>
            </div>
            {Object.keys(revenueByMethod).length > 0 && (
              <div className="space-y-1.5">
                {Object.entries(revenueByMethod).map(([method, amount]) => (
                  <div key={method} className="flex justify-between text-sm text-gray-400">
                    <span>{paymentMethodLabel[method] ?? method}</span>
                    <span className="text-gray-300 tabular-nums">{formatRupiah(amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Operasional */}
          <div className="glass-panel p-6 rounded-2xl">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5 text-primary" />
              Operasional (Shift & Petty Cash)
            </h2>

            <p className="text-sm font-medium text-gray-300 mb-2">
              Shift Kasir ({shifts.length}) — Rekonsiliasi Kas
            </p>
            {shifts.length === 0 ? (
              <p className="text-sm text-gray-400 mb-4">Tidak ada shift di periode ini.</p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-[var(--border)] mb-4">
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
                    {shifts.map((s) => {
                      const r = reconcileShift(s, transactions, pettyCash);
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
                            {s.closing_cash !== null ? formatRupiah(s.closing_cash) : '-'}
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

            <p className="text-sm font-medium text-gray-300 mb-2">Petty Cash ({pettyCash.length})</p>
            {pettyCash.length === 0 ? (
              <p className="text-sm text-gray-400">Tidak ada entri petty cash di periode ini.</p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 bg-white/5">
                      <th className="px-4 py-2.5 font-medium">Tanggal</th>
                      <th className="px-4 py-2.5 font-medium">Tipe</th>
                      <th className="px-4 py-2.5 font-medium">Keterangan</th>
                      <th className="px-4 py-2.5 font-medium text-right">Jumlah</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pettyCash.map((p) => (
                      <tr key={p.id} className="border-t border-[var(--border)]">
                        <td className="px-4 py-2.5 text-gray-400 whitespace-nowrap">{formatDateTime(p.created_at)}</td>
                        <td className="px-4 py-2.5">
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full ${
                              p.type === 'expense' ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'
                            }`}
                          >
                            {p.type === 'expense' ? 'Pengeluaran' : 'Kas Masuk'}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-gray-400">{p.description ?? '-'}</td>
                        <td
                          className={`px-4 py-2.5 text-right tabular-nums font-medium ${
                            p.type === 'expense' ? 'text-red-400' : 'text-green-400'
                          }`}
                        >
                          {p.type === 'expense' ? '-' : '+'}
                          {formatRupiah(p.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="flex justify-between text-sm text-gray-400 mt-3 pt-3 border-t border-[var(--border)]">
              <span>Total Kas Masuk (petty cash)</span>
              <span className="text-green-400 tabular-nums">{formatRupiah(pettyCashIn)}</span>
            </div>
            <div className="flex justify-between text-sm text-gray-400 mt-1">
              <span>Total Pengeluaran (petty cash)</span>
              <span className="text-red-400 tabular-nums">-{formatRupiah(pettyCashExpense)}</span>
            </div>
          </div>

          {/* Laba Bersih */}
          <div className="glass-panel p-6 rounded-2xl">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <PiggyBank className="h-5 w-5 text-primary" />
              Laba Bersih
            </h2>
            <p className="text-xs text-gray-500 mb-4">
              Dihitung dari Pendapatan dikurangi Biaya Operasional (petty cash pengeluaran) dan Gaji Kapster
              (payroll yang sudah dibayarkan) di periode {formatDate(startOfDayISO(periodStart))} - {formatDate(startOfDayISO(periodEnd))}.
            </p>
            <div className="bg-white/5 border border-[var(--border)] rounded-xl p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Total Pendapatan</span>
                <span className="text-gray-200 tabular-nums">{formatRupiah(totalRevenue)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Biaya Operasional (Petty Cash)</span>
                <span className="text-red-400 tabular-nums">-{formatRupiah(pettyCashExpense)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Gaji Kapster (Payroll Dibayar)</span>
                <span className="text-red-400 tabular-nums">-{formatRupiah(totalPayroll)}</span>
              </div>
              <div className="flex justify-between font-bold text-xl pt-3 border-t border-[var(--border)]">
                <span>Laba Bersih</span>
                <span className={netProfit < 0 ? 'text-red-400' : 'text-primary'}>{formatRupiah(netProfit)}</span>
              </div>
            </div>
            {payroll.length > 0 && (
              <div className="mt-4">
                <p className="text-sm font-medium text-gray-300 mb-2">Rincian Payroll Dibayar</p>
                <div className="space-y-1.5">
                  {payroll.map((p) => (
                    <div key={p.id} className="flex justify-between text-xs text-gray-400">
                      <span>
                        {p.profiles?.full_name ?? 'Tanpa nama'} — {formatDate(p.paid_at)}
                      </span>
                      <span className="text-gray-300 tabular-nums">{formatRupiah(p.net_pay)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
