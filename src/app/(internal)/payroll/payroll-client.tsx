'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Calculator, Wallet, History, CheckCircle2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import {
  calculateCommission,
  commissionTypeLabel,
  type CommissionBooking,
  type CommissionBreakdownLine,
  type CommissionLineItem,
} from '@/lib/commission-calc';
import type { Branch, CashAdvance, CommissionTier, PayrollPayment } from '@/lib/supabase/types';

const formatRupiah = (n: number) => `Rp ${Math.round(n).toLocaleString('id-ID')}`;

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

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

// `dateStr` is a plain 'YYYY-MM-DD' from a date input — these interpret it in the
// browser's local timezone so the picked calendar day lines up with what the owner sees.
function startOfDayISO(dateStr: string) {
  return new Date(`${dateStr}T00:00:00`).toISOString();
}

function endOfDayISO(dateStr: string) {
  return new Date(`${dateStr}T23:59:59.999`).toISOString();
}

function nextDayStartISO(dateStr: string) {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + 1);
  return d.toISOString();
}

function periodDaysBetween(startStr: string, endStr: string) {
  const start = new Date(`${startStr}T00:00:00`);
  const end = new Date(`${endStr}T00:00:00`);
  return Math.max(1, Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1);
}

type BarberOption = { id: string; full_name: string | null; monthly_salary: number | null };

export default function PayrollClient({ branches, ownerId }: { branches: Branch[]; ownerId: string }) {
  const [branchId, setBranchId] = useState(branches[0].id);
  const selectedBranch = useMemo(
    () => branches.find((b) => b.id === branchId) ?? branches[0],
    [branches, branchId]
  );

  const [barbers, setBarbers] = useState<BarberOption[]>([]);
  const [barbersLoading, setBarbersLoading] = useState(true);
  const [barbersError, setBarbersError] = useState<string | null>(null);
  const [selectedBarberId, setSelectedBarberId] = useState<string>('');
  const selectedBarber = useMemo(() => barbers.find((b) => b.id === selectedBarberId) ?? null, [barbers, selectedBarberId]);

  const [tiers, setTiers] = useState<CommissionTier[]>([]);

  const [periodStart, setPeriodStart] = useState(defaultPeriodStart);
  const [periodEnd, setPeriodEnd] = useState(defaultPeriodEnd);

  const [calculating, setCalculating] = useState(false);
  const [calcError, setCalcError] = useState<string | null>(null);
  const [hasCalculated, setHasCalculated] = useState(false);
  const [servicesCount, setServicesCount] = useState(0);
  const [grossCommission, setGrossCommission] = useState(0);
  const [breakdown, setBreakdown] = useState<CommissionBreakdownLine[]>([]);
  const [items, setItems] = useState<CommissionLineItem[]>([]);

  const [cashAdvances, setCashAdvances] = useState<CashAdvance[]>([]);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [kasbonLoading, setKasbonLoading] = useState(false);
  const [kasbonError, setKasbonError] = useState<string | null>(null);

  const [history, setHistory] = useState<PayrollPayment[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const resetCalculation = () => {
    setHasCalculated(false);
    setServicesCount(0);
    setGrossCommission(0);
    setBreakdown([]);
    setItems([]);
    setCalcError(null);
    setPayError(null);
    setSuccessMessage(null);
  };

  // Load barbers whose PRIMARY branch is the selected branch whenever branch changes.
  useEffect(() => {
    let cancelled = false;
    setBarbersLoading(true);
    setBarbersError(null);
    setSelectedBarberId('');
    resetCalculation();

    const supabase = createClient();
    supabase
      .from('profiles')
      .select('id, full_name, monthly_salary')
      .or('role.eq.barber,is_working_barber.eq.true')
      .eq('branch_id', branchId)
      .order('full_name', { ascending: true })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) setBarbersError('Gagal memuat daftar kapster.');
        setBarbers((data as BarberOption[] | null) ?? []);
        setBarbersLoading(false);
      });

    const loadTiers = async () => {
      const { data } = await supabase
        .from('commission_tiers')
        .select('*')
        .eq('branch_id', branchId)
        .order('min_services', { ascending: true });
      if (!cancelled) setTiers((data as CommissionTier[] | null) ?? []);
    };
    loadTiers();

    return () => {
      cancelled = true;
    };
  }, [branchId]);

  const loadCashAdvances = useCallback(async (barberId: string, forBranchId: string) => {
    setKasbonLoading(true);
    setKasbonError(null);
    const supabase = createClient();
    const { data, error } = await supabase
      .from('cash_advances')
      .select('*')
      .eq('profile_id', barberId)
      .eq('branch_id', forBranchId)
      .eq('status', 'approved')
      .order('created_at', { ascending: true });
    if (error) {
      setKasbonError('Gagal memuat data kasbon.');
      setCashAdvances([]);
      setCheckedIds(new Set());
    } else {
      const rows = (data as CashAdvance[] | null) ?? [];
      setCashAdvances(rows);
      setCheckedIds(new Set(rows.map((r) => r.id)));
    }
    setKasbonLoading(false);
  }, []);

  const loadHistory = useCallback(async (barberId: string, forBranchId: string) => {
    setHistoryLoading(true);
    setHistoryError(null);
    const supabase = createClient();
    const { data, error } = await supabase
      .from('payroll_payments')
      .select('*')
      .eq('profile_id', barberId)
      .eq('branch_id', forBranchId)
      .order('paid_at', { ascending: false })
      .limit(10);
    if (error) setHistoryError('Gagal memuat riwayat payroll.');
    setHistory((data as PayrollPayment[] | null) ?? []);
    setHistoryLoading(false);
  }, []);

  // Kasbon checklist and payroll history are independent of the date range — reload
  // them as soon as a barber is picked (or the branch changes underneath them).
  useEffect(() => {
    if (!selectedBarberId) {
      setCashAdvances([]);
      setCheckedIds(new Set());
      setHistory([]);
      return;
    }
    loadCashAdvances(selectedBarberId, branchId);
    loadHistory(selectedBarberId, branchId);
  }, [selectedBarberId, branchId, loadCashAdvances, loadHistory]);

  const kasbonDeduction = useMemo(
    () =>
      cashAdvances
        .filter((ca) => checkedIds.has(ca.id))
        .reduce((sum, ca) => sum + Number(ca.amount), 0),
    [cashAdvances, checkedIds]
  );
  const netPay = grossCommission - kasbonDeduction;

  const toggleChecked = (id: string) => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCalculate = async () => {
    if (!selectedBarberId || calculating) return;
    setCalculating(true);
    setCalcError(null);
    setSuccessMessage(null);
    setPayError(null);

    if (!periodStart || !periodEnd || periodStart > periodEnd) {
      setCalcError('Rentang tanggal tidak valid.');
      setCalculating(false);
      return;
    }

    const supabase = createClient();
    const { data, error } = await supabase
      .from('bookings')
      .select(
        'id, total_price, completed_at, booking_items(price, service_name, service_id, services(fixed_commission, cost_price))'
      )
      .eq('barber_id', selectedBarberId)
      .eq('branch_id', branchId)
      .eq('status', 'completed')
      .gte('completed_at', startOfDayISO(periodStart))
      .lt('completed_at', nextDayStartISO(periodEnd));

    if (error) {
      setCalcError('Gagal menghitung komisi. Coba lagi.');
      setCalculating(false);
      return;
    }

    const bookings = (data as unknown as CommissionBooking[] | null) ?? [];
    const result = calculateCommission({
      commissionType: selectedBranch.commission_type,
      commissionPercent: selectedBranch.commission_percent,
      bookings,
      monthlySalary: selectedBarber?.monthly_salary,
      periodDays: periodDaysBetween(periodStart, periodEnd),
      tiers,
    });

    setServicesCount(result.servicesCount);
    setGrossCommission(result.grossCommission);
    setBreakdown(result.breakdown);
    setItems(result.items);
    setHasCalculated(true);
    setCalculating(false);
  };

  const handleMarkPaid = async () => {
    if (!selectedBarberId || paying) return;
    setPaying(true);
    setPayError(null);
    setSuccessMessage(null);

    const supabase = createClient();
    const { error: insertError } = await supabase.from('payroll_payments').insert({
      profile_id: selectedBarberId,
      branch_id: branchId,
      period_start: startOfDayISO(periodStart),
      period_end: endOfDayISO(periodEnd),
      services_count: servicesCount,
      gross_commission: grossCommission,
      kasbon_deduction: kasbonDeduction,
      net_pay: netPay,
      paid_by: ownerId,
    });

    if (insertError) {
      setPayError('Gagal mencatat payroll. Coba lagi.');
      setPaying(false);
      return;
    }

    const checkedIdList = Array.from(checkedIds);
    if (checkedIdList.length > 0) {
      const { error: kasbonUpdateError } = await supabase
        .from('cash_advances')
        .update({ status: 'paid' })
        .in('id', checkedIdList);
      if (kasbonUpdateError) {
        setPayError('Payroll berhasil dicatat, tapi gagal menandai kasbon sebagai lunas. Perbarui manual.');
        setPaying(false);
        loadCashAdvances(selectedBarberId, branchId);
        loadHistory(selectedBarberId, branchId);
        return;
      }
    }

    const barberName = barbers.find((b) => b.id === selectedBarberId)?.full_name ?? 'kapster ini';
    setSuccessMessage(`Payroll ${formatRupiah(netPay)} untuk ${barberName} berhasil dicatat.`);
    setHasCalculated(false);
    setServicesCount(0);
    setGrossCommission(0);
    setBreakdown([]);
    setItems([]);
    setPaying(false);
    loadCashAdvances(selectedBarberId, branchId);
    loadHistory(selectedBarberId, branchId);
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

      <p className="text-xs text-gray-500 mb-4">
        Skema komisi cabang ini: <span className="text-primary font-medium">{commissionTypeLabel[selectedBranch.commission_type]}</span>{' '}
        — ubah di halaman{' '}
        <a href="/services" className="text-primary hover:underline">
          Kelola Layanan
        </a>
        .
      </p>

      {/* Barber + period selection */}
      <div className="glass-panel p-6 rounded-2xl mb-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Calculator className="h-5 w-5 text-primary" />
          Hitung Komisi
        </h2>

        {barbersLoading ? (
          <p className="text-gray-500 text-sm">Memuat kapster...</p>
        ) : barbersError ? (
          <p className="text-sm text-red-400">{barbersError}</p>
        ) : barbers.length === 0 ? (
          <p className="text-sm text-gray-400">Belum ada kapster di cabang ini.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
            <div className="sm:col-span-2">
              <label className="block text-xs text-gray-400 mb-1">Kapster</label>
              <select
                value={selectedBarberId}
                onChange={(e) => {
                  setSelectedBarberId(e.target.value);
                  resetCalculation();
                }}
                className="w-full bg-white/10 border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
              >
                <option value="">Pilih kapster...</option>
                {barbers.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.full_name ?? 'Tanpa nama'}
                  </option>
                ))}
              </select>
            </div>
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
          </div>
        )}

        {barbers.length > 0 && (
          <>
            {calcError && <p className="text-xs text-red-400 mt-3">{calcError}</p>}
            <button
              onClick={handleCalculate}
              disabled={!selectedBarberId || calculating}
              className="mt-4 inline-flex items-center gap-1.5 bg-primary hover:bg-amber-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              <Calculator className="h-4 w-4" />
              {calculating ? 'Menghitung...' : 'Hitung'}
            </button>
          </>
        )}
      </div>

      {selectedBarberId && (
        <>
          {/* Kasbon checklist */}
          <div className="glass-panel p-6 rounded-2xl mb-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Wallet className="h-5 w-5 text-primary" />
              Kasbon Disetujui
            </h2>
            {kasbonLoading ? (
              <p className="text-gray-500 text-sm">Memuat kasbon...</p>
            ) : kasbonError ? (
              <p className="text-sm text-red-400">{kasbonError}</p>
            ) : cashAdvances.length === 0 ? (
              <p className="text-sm text-gray-400">Tidak ada kasbon disetujui yang belum dibayar.</p>
            ) : (
              <div className="space-y-2">
                {cashAdvances.map((ca) => (
                  <label
                    key={ca.id}
                    className="flex items-center justify-between gap-3 bg-white/5 border border-[var(--border)] rounded-lg px-3 py-2.5 cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={checkedIds.has(ca.id)}
                        onChange={() => toggleChecked(ca.id)}
                        className="w-4 h-4 accent-primary"
                      />
                      <div>
                        <p className="text-sm">{ca.reason ?? 'Kasbon'}</p>
                        <p className="text-xs text-gray-500">{formatDate(ca.created_at)}</p>
                      </div>
                    </div>
                    <span className="text-sm font-medium whitespace-nowrap">{formatRupiah(ca.amount)}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Summary */}
          {hasCalculated && (
            <div className="glass-panel p-6 rounded-2xl mb-6">
              <h2 className="text-lg font-semibold mb-4">Ringkasan Payroll</h2>

              {/* Transparent breakdown of how grossCommission was derived */}
              <div className="bg-white/5 border border-[var(--border)] rounded-xl p-4 mb-4 space-y-1.5">
                {breakdown.map((line, i) => (
                  <div key={i} className="flex justify-between text-xs text-gray-400">
                    <span>{line.label}</span>
                    {line.amount !== null && <span className="text-gray-300 tabular-nums">{formatRupiah(line.amount)}</span>}
                  </div>
                ))}
              </div>

              {/* Every service/add-on that contributed to the total — so the barber's slip and this always agree. */}
              {items.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs text-gray-500 mb-2">Rincian layanan</p>
                  <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-gray-500 bg-white/5">
                          <th className="px-3 py-2 font-medium">Qty</th>
                          <th className="px-3 py-2 font-medium">Layanan</th>
                          <th className="px-3 py-2 font-medium">Rincian</th>
                          <th className="px-3 py-2 font-medium text-right">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((item, i) => (
                          <tr key={i} className="border-t border-[var(--border)]">
                            <td className="px-3 py-2 text-gray-400">{item.qty}x</td>
                            <td className="px-3 py-2 font-medium">{item.serviceName}</td>
                            <td className="px-3 py-2 text-gray-400">{item.detail}</td>
                            <td className="px-3 py-2 text-right tabular-nums text-primary">{formatRupiah(item.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              {items.length === 0 && selectedBranch.commission_type === 'salary' && (
                <p className="text-xs text-gray-500 mb-4">Skema gaji tetap bulanan tidak dihitung per layanan.</p>
              )}

              <div className="space-y-2">
                <div className="flex justify-between text-sm text-gray-400">
                  <span>Jumlah Layanan Selesai</span>
                  <span className="text-white font-medium">{servicesCount}</span>
                </div>
                <div className="flex justify-between text-sm text-gray-400">
                  <span>Komisi Kotor</span>
                  <span className="text-white font-medium">{formatRupiah(grossCommission)}</span>
                </div>
                <div className="flex justify-between text-sm text-gray-400">
                  <span>Potongan Kasbon</span>
                  <span className="text-red-400 font-medium">
                    {kasbonDeduction > 0 ? `- ${formatRupiah(kasbonDeduction)}` : formatRupiah(0)}
                  </span>
                </div>
                <div className="flex justify-between font-bold text-xl pt-3 border-t border-[var(--border)]">
                  <span>Net Pay</span>
                  <span className={netPay < 0 ? 'text-red-400' : 'text-primary'}>{formatRupiah(netPay)}</span>
                </div>
              </div>

              {payError && (
                <div className="mt-4 bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-xl p-3">
                  {payError}
                </div>
              )}
              {successMessage && (
                <div className="mt-4 flex items-center gap-2 bg-green-500/10 border border-green-500/30 text-green-400 text-sm rounded-xl p-3">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span>{successMessage}</span>
                </div>
              )}

              <button
                onClick={handleMarkPaid}
                disabled={paying}
                className="w-full mt-4 bg-primary hover:bg-amber-700 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-colors"
              >
                {paying ? 'Menyimpan...' : 'Tandai Sudah Dibayar'}
              </button>
            </div>
          )}

          {/* History */}
          <div className="glass-panel p-6 rounded-2xl">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <History className="h-5 w-5 text-primary" />
              Riwayat Payroll
            </h2>
            {historyLoading ? (
              <p className="text-gray-500 text-sm">Memuat riwayat...</p>
            ) : historyError ? (
              <p className="text-sm text-red-400">{historyError}</p>
            ) : history.length === 0 ? (
              <p className="text-sm text-gray-400">Belum ada riwayat payroll untuk kapster ini.</p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 bg-white/5">
                      <th className="px-4 py-3 font-medium">Periode</th>
                      <th className="px-4 py-3 font-medium">Komisi Kotor</th>
                      <th className="px-4 py-3 font-medium">Kasbon</th>
                      <th className="px-4 py-3 font-medium">Net Pay</th>
                      <th className="px-4 py-3 font-medium">Dibayar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((p) => (
                      <tr key={p.id} className="border-t border-[var(--border)]">
                        <td className="px-4 py-3 whitespace-nowrap">
                          {formatDate(p.period_start)} - {formatDate(p.period_end)}
                        </td>
                        <td className="px-4 py-3 tabular-nums">{formatRupiah(p.gross_commission)}</td>
                        <td className="px-4 py-3 tabular-nums text-red-400">
                          {p.kasbon_deduction > 0 ? `- ${formatRupiah(p.kasbon_deduction)}` : formatRupiah(0)}
                        </td>
                        <td className="px-4 py-3 tabular-nums font-semibold">{formatRupiah(p.net_pay)}</td>
                        <td className="px-4 py-3 text-gray-400 whitespace-nowrap">{formatDateTime(p.paid_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
