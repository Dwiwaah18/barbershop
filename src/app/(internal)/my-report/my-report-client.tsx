'use client';

import { Calculator, Scissors } from 'lucide-react';
import { commissionTypeLabel } from '@/lib/commission-calc';
import { useMyCommissionReport } from '@/lib/use-my-commission-report';
import type { Branch } from '@/lib/supabase/types';

const formatRupiah = (n: number) => `Rp ${Math.round(n).toLocaleString('id-ID')}`;

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function MyReportClient({ branches, userId }: { branches: Branch[]; userId: string }) {
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

      {hasCalculated && (
        <div className="glass-panel p-6 rounded-2xl">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Scissors className="h-5 w-5 text-primary" />
            Transaksi {formatDate(periodStart)} - {formatDate(periodEnd)}
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div className="bg-white/5 border border-[var(--border)] rounded-xl p-4">
              <p className="text-xs text-gray-400 mb-1">Jumlah Layanan Selesai</p>
              <p className="text-2xl font-bold">{result.servicesCount}</p>
            </div>
            <div className="bg-white/5 border border-[var(--border)] rounded-xl p-4">
              <p className="text-xs text-gray-400 mb-1">Estimasi Komisi</p>
              <p className="text-2xl font-bold text-primary">{formatRupiah(result.grossCommission)}</p>
            </div>
          </div>

          {result.items.length > 0 ? (
            <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 bg-white/5">
                    <th className="px-4 py-3 font-medium">Qty</th>
                    <th className="px-4 py-3 font-medium">Layanan</th>
                    <th className="px-4 py-3 font-medium">Rincian</th>
                    <th className="px-4 py-3 font-medium text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {result.items.map((item, i) => (
                    <tr key={i} className="border-t border-[var(--border)]">
                      <td className="px-4 py-3 text-gray-400">{item.qty}x</td>
                      <td className="px-4 py-3 font-medium">{item.serviceName}</td>
                      <td className="px-4 py-3 text-gray-400">{item.detail}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-primary">{formatRupiah(item.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-gray-400">
              {selectedBranch.commission_type === 'salary'
                ? 'Skema gaji tetap bulanan tidak dihitung per layanan.'
                : 'Tidak ada layanan selesai di periode ini.'}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
