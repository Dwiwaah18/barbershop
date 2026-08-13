'use client';

import { useCallback, useEffect, useState } from 'react';
import { Calculator, History, Scissors, HandCoins, Plus } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { commissionTypeLabel } from '@/lib/commission-calc';
import { useMyCommissionReport } from '@/lib/use-my-commission-report';
import type { Branch, CashAdvance, PayrollPayment } from '@/lib/supabase/types';

const formatRupiah = (n: number) => `Rp ${Math.round(n).toLocaleString('id-ID')}`;

const kasbonStatusBadge: Record<string, string> = {
  pending: 'bg-amber-500/20 text-amber-400',
  approved: 'bg-blue-500/20 text-blue-400',
  rejected: 'bg-red-500/20 text-red-400',
  paid: 'bg-green-500/20 text-green-400',
};

const kasbonStatusLabel: Record<string, string> = {
  pending: 'Menunggu',
  approved: 'Disetujui',
  rejected: 'Ditolak',
  paid: 'Sudah dipotong',
};

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

export default function MyPayrollClient({ branches, userId, fullName }: { branches: Branch[]; userId: string; fullName: string }) {
  const {
    branchId,
    setBranchId,
    selectedBranch,
    periodStart,
    setPeriodStart,
    periodEnd,
    setPeriodEnd,
    calculating,
    calcError,
    hasCalculated,
    result,
    handleCalculate,
  } = useMyCommissionReport(branches, userId);

  const [history, setHistory] = useState<PayrollPayment[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const loadHistory = useCallback(async (forBranchId: string) => {
    setHistoryLoading(true);
    setHistoryError(null);
    const supabase = createClient();
    const { data, error } = await supabase
      .from('payroll_payments')
      .select('*')
      .eq('profile_id', userId)
      .eq('branch_id', forBranchId)
      .order('paid_at', { ascending: false })
      .limit(10);
    if (error) setHistoryError('Gagal memuat riwayat gaji.');
    setHistory((data as PayrollPayment[] | null) ?? []);
    setHistoryLoading(false);
  }, [userId]);

  useEffect(() => {
    loadHistory(branchId);
  }, [branchId, loadHistory]);

  // Kasbon: kapster mengajukan, owner menyetujui, lalu dipotong saat payroll.
  const [kasbonList, setKasbonList] = useState<CashAdvance[]>([]);
  const [kasbonLoading, setKasbonLoading] = useState(true);
  const [kasbonAmount, setKasbonAmount] = useState('');
  const [kasbonReason, setKasbonReason] = useState('');
  const [kasbonSubmitting, setKasbonSubmitting] = useState(false);
  const [kasbonError, setKasbonError] = useState<string | null>(null);

  const loadMyKasbon = useCallback(
    async (forBranchId: string) => {
      setKasbonLoading(true);
      const supabase = createClient();
      const { data } = await supabase
        .from('cash_advances')
        .select('*')
        .eq('profile_id', userId)
        .eq('branch_id', forBranchId)
        .order('created_at', { ascending: false })
        .limit(20);
      setKasbonList((data as CashAdvance[] | null) ?? []);
      setKasbonLoading(false);
    },
    [userId]
  );

  useEffect(() => {
    loadMyKasbon(branchId);
  }, [branchId, loadMyKasbon]);

  const submitKasbon = async () => {
    setKasbonError(null);
    const amount = Number(kasbonAmount);
    if (!kasbonAmount.trim() || Number.isNaN(amount) || amount <= 0) {
      setKasbonError('Nominal kasbon tidak valid.');
      return;
    }
    setKasbonSubmitting(true);
    const supabase = createClient();
    const { error } = await supabase.from('cash_advances').insert({
      profile_id: userId,
      branch_id: branchId,
      amount,
      reason: kasbonReason.trim() || null,
      status: 'pending',
    });
    setKasbonSubmitting(false);
    if (error) {
      setKasbonError(`Gagal mengajukan kasbon: ${error.message}`);
      return;
    }
    setKasbonAmount('');
    setKasbonReason('');
    loadMyKasbon(branchId);
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
        Skema komisi cabang ini: <span className="text-primary font-medium">{commissionTypeLabel[selectedBranch.commission_type]}</span>
      </p>

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
            disabled={calculating}
            className="inline-flex items-center justify-center gap-1.5 bg-primary hover:bg-amber-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            <Calculator className="h-4 w-4" />
            {calculating ? 'Menghitung...' : 'Hitung'}
          </button>
        </div>

        {calcError && <p className="text-xs text-red-400 mt-3">{calcError}</p>}
      </div>

      {/* Kasbon */}
      <div className="glass-panel p-6 rounded-2xl mb-6">
        <h2 className="text-lg font-semibold mb-1 flex items-center gap-2">
          <HandCoins className="h-5 w-5 text-primary" />
          Kasbon
        </h2>
        <p className="text-xs text-gray-500 mb-4">
          Ajukan kasbon (kas bon / pinjaman). Setelah disetujui owner, nominalnya otomatis dipotong dari gaji Anda.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-[160px_1fr_auto] gap-3 items-end mb-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Nominal (Rp)</label>
            <input
              type="number"
              value={kasbonAmount}
              onChange={(e) => setKasbonAmount(e.target.value)}
              placeholder="0"
              className="w-full bg-white/5 border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Keterangan (opsional)</label>
            <input
              type="text"
              value={kasbonReason}
              onChange={(e) => setKasbonReason(e.target.value)}
              placeholder="mis. keperluan keluarga"
              className="w-full bg-white/5 border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
            />
          </div>
          <button
            onClick={submitKasbon}
            disabled={kasbonSubmitting}
            className="inline-flex items-center justify-center gap-1.5 bg-primary hover:bg-amber-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            <Plus className="h-4 w-4" />
            {kasbonSubmitting ? 'Mengajukan...' : 'Ajukan'}
          </button>
        </div>
        {kasbonError && <p className="text-xs text-red-400 mb-3">{kasbonError}</p>}

        {kasbonLoading ? (
          <p className="text-sm text-gray-500">Memuat kasbon...</p>
        ) : kasbonList.length === 0 ? (
          <p className="text-sm text-gray-400">Belum ada kasbon di cabang ini.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 bg-white/5">
                  <th className="px-3 py-2 font-medium">Tanggal</th>
                  <th className="px-3 py-2 font-medium">Nominal</th>
                  <th className="px-3 py-2 font-medium">Keterangan</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {kasbonList.map((k) => (
                  <tr key={k.id} className="border-t border-[var(--border)]">
                    <td className="px-3 py-2 text-gray-400 whitespace-nowrap">{formatDate(k.created_at)}</td>
                    <td className="px-3 py-2 font-medium tabular-nums">{formatRupiah(k.amount)}</td>
                    <td className="px-3 py-2 text-gray-400">{k.reason ?? '-'}</td>
                    <td className="px-3 py-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${kasbonStatusBadge[k.status]}`}>
                        {kasbonStatusLabel[k.status]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {hasCalculated && (
        <div className="glass-panel rounded-2xl mb-6 overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-dashed border-[var(--border)]">
            <div>
              <h2 className="text-lg font-semibold">Slip Gaji</h2>
              <p className="text-xs text-gray-500">{selectedBranch.name}</p>
            </div>
            <Scissors className="h-6 w-6 text-primary" />
          </div>

          <div className="px-6 py-4 border-b border-dashed border-[var(--border)]">
            <dl className="grid grid-cols-2 gap-y-2 text-sm">
              <dt className="text-gray-400">Nama</dt>
              <dd className="text-right font-medium">{fullName}</dd>
              <dt className="text-gray-400">Tipe Komisi</dt>
              <dd className="text-right font-medium text-primary">{commissionTypeLabel[selectedBranch.commission_type]}</dd>
              <dt className="text-gray-400">Periode</dt>
              <dd className="text-right">
                {formatDate(periodStart)} - {formatDate(periodEnd)}
              </dd>
              <dt className="text-gray-400">Jumlah Layanan Selesai</dt>
              <dd className="text-right">{result.servicesCount}</dd>
            </dl>
          </div>

          <div className="px-6 py-4 border-b border-dashed border-[var(--border)] space-y-1.5">
            {result.breakdown.map((line, i) => (
              <div key={i} className="flex justify-between text-xs text-gray-400">
                <span>{line.label}</span>
                {line.amount !== null && <span className="text-gray-300 tabular-nums">{formatRupiah(line.amount)}</span>}
              </div>
            ))}
          </div>

          {result.items.length > 0 && (
            <div className="px-6 py-4 border-b border-dashed border-[var(--border)]">
              <p className="text-xs text-gray-500 mb-2">Rincian layanan</p>
              <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
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
                    {result.items.map((item, i) => (
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
          {result.items.length === 0 && selectedBranch.commission_type === 'salary' && (
            <p className="px-6 py-4 border-b border-dashed border-[var(--border)] text-xs text-gray-500">
              Skema gaji tetap bulanan tidak dihitung per layanan.
            </p>
          )}

          <div className="px-6 py-4 flex items-center justify-between">
            <span className="font-semibold">Jumlah</span>
            <span className="text-2xl font-bold text-primary tabular-nums">{formatRupiah(result.grossCommission)}</span>
          </div>

          <p className="px-6 pb-4 text-xs text-gray-500">
            Estimasi ini belum tentu sama dengan yang dibayarkan owner — bisa berbeda kalau ada potongan kasbon.
          </p>
        </div>
      )}

      <div className="glass-panel p-6 rounded-2xl">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <History className="h-5 w-5 text-primary" />
          Riwayat Gaji Saya
        </h2>
        {historyLoading ? (
          <p className="text-gray-500 text-sm">Memuat riwayat...</p>
        ) : historyError ? (
          <p className="text-sm text-red-400">{historyError}</p>
        ) : history.length === 0 ? (
          <p className="text-sm text-gray-400">Belum ada riwayat gaji yang dibayarkan.</p>
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
    </div>
  );
}
