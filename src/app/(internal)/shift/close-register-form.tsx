'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Printer } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { PettyCashEntry } from '@/lib/supabase/types';

const formatRupiah = (n: number) => `Rp ${Math.round(n).toLocaleString('id-ID')}`;

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

type Props = {
  shiftId: string;
  estimatedCash: number;
  branchName: string;
  cashierName: string;
  openedAt: string;
  openingCash: number;
  cashSales: number;
  qrisSales: number;
  depositSales: number;
  pettyCashIn: number;
  pettyCashExpense: number;
  pettyCashEntries: PettyCashEntry[];
};

export function CloseRegisterForm({
  shiftId,
  estimatedCash,
  branchName,
  cashierName,
  openedAt,
  openingCash,
  cashSales,
  qrisSales,
  depositSales,
  pettyCashIn,
  pettyCashExpense,
  pettyCashEntries,
}: Props) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [closingCash, setClosingCash] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [closedReport, setClosedReport] = useState<{ closingCash: number; closedAt: string } | null>(null);

  // Auto-print the closing report as soon as the shift is confirmed closed, same pattern as the
  // POS receipt — the small delay lets the report markup paint before the print dialog opens.
  useEffect(() => {
    if (!closedReport) return;
    const timer = setTimeout(() => window.print(), 150);
    return () => clearTimeout(timer);
  }, [closedReport]);

  async function handleConfirm() {
    const amount = Number(closingCash);
    if (!closingCash || Number.isNaN(amount) || amount < 0) {
      setError('Masukkan jumlah kas fisik yang valid.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const closedAt = new Date().toISOString();
    const supabase = createClient();
    const { error: updateError } = await supabase
      .from('shifts')
      .update({
        status: 'closed',
        closing_cash: amount,
        closed_at: closedAt,
      })
      .eq('id', shiftId);

    setIsSubmitting(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    // Show the closing report instead of refreshing immediately — refreshing now would swap this
    // whole card back to "Open Register" (no more open shift) and the report would vanish before
    // the cashier can see or print it. router.refresh() only happens once they click "Selesai".
    setClosedReport({ closingCash: amount, closedAt });
  }

  function handleDone() {
    router.refresh();
  }

  if (closedReport) {
    const selisih = closedReport.closingCash - estimatedCash;
    const totalSales = cashSales + qrisSales + depositSales;

    return (
      <div>
        <div className="border border-[var(--border)] rounded-2xl p-5 text-sm">
          <div className="text-center mb-3 pb-3 border-b border-dashed border-[var(--border)]">
            <p className="font-bold text-base">{branchName}</p>
            <p className="text-gray-400">Laporan Tutup Shift</p>
          </div>

          <div className="space-y-1 mb-3 pb-3 border-b border-dashed border-[var(--border)] text-gray-300">
            <div className="flex justify-between">
              <span className="text-gray-500">Kasir</span>
              <span>{cashierName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Buka</span>
              <span>{formatDateTime(openedAt)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Tutup</span>
              <span>{formatDateTime(closedReport.closedAt)}</span>
            </div>
          </div>

          <div className="space-y-1.5 mb-3 pb-3 border-b border-dashed border-[var(--border)]">
            <div className="flex justify-between text-gray-400">
              <span>Kas Awal</span>
              <span>{formatRupiah(openingCash)}</span>
            </div>
            <div className="flex justify-between text-gray-400">
              <span>Penjualan Cash</span>
              <span>{formatRupiah(cashSales)}</span>
            </div>
            <div className="flex justify-between text-gray-400">
              <span>Petty Cash Masuk</span>
              <span>+{formatRupiah(pettyCashIn)}</span>
            </div>
            <div className="flex justify-between text-gray-400">
              <span>Petty Cash Keluar</span>
              <span>-{formatRupiah(pettyCashExpense)}</span>
            </div>
            <div className="flex justify-between font-semibold pt-1">
              <span>Estimasi Kas Fisik</span>
              <span>{formatRupiah(estimatedCash)}</span>
            </div>
            <div className="flex justify-between font-semibold">
              <span>Kas Aktual (Dihitung)</span>
              <span>{formatRupiah(closedReport.closingCash)}</span>
            </div>
            <div className="flex justify-between font-bold text-base pt-1">
              <span>Selisih</span>
              <span className={selisih === 0 ? 'text-green-400' : selisih > 0 ? 'text-green-400' : 'text-red-400'}>
                {selisih === 0
                  ? 'PAS'
                  : `${selisih > 0 ? '+' : ''}${formatRupiah(selisih)} (${selisih > 0 ? 'Lebih' : 'Kurang'})`}
              </span>
            </div>
          </div>

          <div className="space-y-1.5 mb-3 pb-3 border-b border-dashed border-[var(--border)] text-gray-400">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Non-Tunai (Info)</p>
            <div className="flex justify-between">
              <span>QRIS</span>
              <span>{formatRupiah(qrisSales)}</span>
            </div>
            <div className="flex justify-between">
              <span>Deposit</span>
              <span>{formatRupiah(depositSales)}</span>
            </div>
            <div className="flex justify-between font-medium text-gray-300 pt-1">
              <span>Total Penjualan</span>
              <span>{formatRupiah(totalSales)}</span>
            </div>
          </div>

          {pettyCashEntries.length > 0 && (
            <div className="space-y-1 text-xs text-gray-500">
              <p className="uppercase tracking-wider mb-1">Rincian Petty Cash</p>
              {pettyCashEntries.map((entry) => (
                <div key={entry.id} className="flex justify-between">
                  <span>{entry.description || (entry.type === 'expense' ? 'Pengeluaran' : 'Kas Masuk')}</span>
                  <span className={entry.type === 'expense' ? 'text-red-400' : 'text-green-400'}>
                    {entry.type === 'expense' ? '-' : '+'}
                    {formatRupiah(Number(entry.amount))}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-3 mt-4 print:hidden">
          <button
            onClick={() => window.print()}
            className="flex-1 inline-flex items-center justify-center gap-1.5 bg-white/5 hover:bg-white/10 text-white font-medium py-2.5 border border-[var(--border)] rounded-xl transition-colors"
          >
            <Printer className="h-4 w-4" />
            Cetak Ulang
          </button>
          <button
            onClick={handleDone}
            className="flex-1 bg-primary hover:bg-amber-700 text-white font-bold py-2.5 rounded-xl transition-colors"
          >
            Selesai
          </button>
        </div>
      </div>
    );
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="w-full bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/50 font-bold py-3 rounded-xl transition-colors print:hidden"
      >
        Close Register (Reconciliation)
      </button>
    );
  }

  return (
    <div className="space-y-3 print:hidden">
      <label className="block text-sm font-medium text-gray-400 mb-1">
        Kas Fisik Terhitung (Estimasi {formatRupiah(estimatedCash)})
      </label>
      <input
        type="number"
        value={closingCash}
        onChange={(e) => setClosingCash(e.target.value)}
        placeholder="Rp 0"
        className="w-full bg-white/5 border border-[var(--border)] rounded-xl py-2 px-4 focus:outline-none focus:border-primary transition-colors"
      />

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="flex gap-3">
        <button
          onClick={() => {
            setIsOpen(false);
            setError(null);
          }}
          disabled={isSubmitting}
          className="flex-1 bg-white/5 hover:bg-white/10 text-white font-bold py-3 border border-[var(--border)] rounded-xl transition-colors disabled:opacity-50"
        >
          Batal
        </button>
        <button
          onClick={handleConfirm}
          disabled={isSubmitting}
          className="flex-1 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/50 font-bold py-3 rounded-xl transition-colors disabled:opacity-50"
        >
          {isSubmitting ? 'Menutup...' : 'Konfirmasi Tutup'}
        </button>
      </div>
    </div>
  );
}
