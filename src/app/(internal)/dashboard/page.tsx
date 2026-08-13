'use client';

import { useEffect, useState } from 'react';
import { Banknote, Flame, Receipt, Scissors, TrendingUp, Users, Wallet } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import {
  fetchDashboardData,
  fetchOwnedBranches,
  type BranchOption,
  type DashboardData,
  type DashboardView,
} from './data';
import {
  BarberPerformanceTable,
  BranchBreakdownChart,
  PeakHourHeatmap,
  RetentionReport,
  RevenueTrendChart,
  StatCard,
  formatRupiah,
} from './charts';

export default function DashboardPage() {
  const [branches, setBranches] = useState<BranchOption[] | null>(null);
  const [view, setView] = useState<DashboardView>('all');
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  // Branch list is fetched once — the switcher itself never changes mid-session.
  useEffect(() => {
    const supabase = createClient();
    fetchOwnedBranches(supabase)
      .then(setBranches)
      .catch(() => setBranches([]));
  }, []);

  // Re-fetch the dashboard numbers whenever the selected view (or the branch list) changes.
  useEffect(() => {
    if (branches === null) return;
    let cancelled = false;
    setLoading(true);
    setLoadError(false);

    const supabase = createClient();
    fetchDashboardData(supabase, view, branches)
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [view, branches]);

  const views: { id: DashboardView; label: string }[] = [
    { id: 'all', label: 'Semua Cabang' },
    ...(branches ?? []).map((b) => ({ id: b.id, label: b.name })),
  ];

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold">Owner Dashboard</h1>
          <p className="text-gray-400">Peak hour, retensi, dan performa keuangan cabang.</p>
        </div>
        <div className="flex items-center gap-1.5 p-1 bg-white/5 rounded-xl border border-[var(--border)] w-fit">
          {views.map((v) => (
            <button
              key={v.id}
              onClick={() => setView(v.id)}
              disabled={loading}
              className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${
                view === v.id ? 'bg-primary text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {loadError && (
        <div className="glass-panel p-4 rounded-2xl mb-6 text-sm text-red-400">
          Gagal memuat data terbaru. Menampilkan data terakhir yang berhasil dimuat.
        </div>
      )}

      {!data ? (
        <div className="glass-panel p-6 rounded-2xl text-gray-400">Memuat data dashboard...</div>
      ) : (
        <div className={loading ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
            <StatCard icon={Wallet} label="Omzet Hari Ini" value={formatRupiah(data.kpis.revenueToday)} deltaPct={data.kpis.revenueDeltaPct} />
            <StatCard icon={Receipt} label="Transaksi Hari Ini" value={String(data.kpis.transactionsToday)} deltaPct={data.kpis.transactionsDeltaPct} />
            <StatCard icon={Banknote} label="Rata-rata Ticket" value={formatRupiah(data.kpis.avgTicket)} deltaPct={data.kpis.avgTicketDeltaPct} />
            <StatCard icon={Users} label="Pelanggan Aktif" value={String(data.kpis.activeCustomers)} deltaPct={data.kpis.activeCustomersDeltaPct} />
          </div>

          <div className="glass-panel p-6 rounded-2xl mb-6">
            <div className="flex items-center gap-2 mb-6">
              <Flame className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-semibold">Peak Hour Analytics</h2>
            </div>
            <PeakHourHeatmap grid={data.peakHours} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-6">
            <div className="lg:col-span-3 glass-panel p-6 rounded-2xl">
              <div className="flex items-center gap-2 mb-6">
                <TrendingUp className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-semibold">Tren Omzet (14 Hari)</h2>
              </div>
              <RevenueTrendChart values={data.revenueTrend} dates={data.trendDates} />
            </div>

            <div className="lg:col-span-2 glass-panel p-6 rounded-2xl">
              <div className="flex items-center gap-2 mb-6">
                <Wallet className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-semibold">Perbandingan Cabang</h2>
              </div>
              {data.branchBreakdown ? (
                <BranchBreakdownChart rows={data.branchBreakdown} branches={branches ?? []} />
              ) : (
                <p className="text-sm text-gray-500">
                  Pilih &ldquo;Semua Cabang&rdquo; untuk melihat perbandingan omzet antar cabang.
                </p>
              )}
            </div>
          </div>

          <div className="glass-panel p-6 rounded-2xl mb-6">
            <div className="flex items-center gap-2 mb-6">
              <Scissors className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-semibold">Kinerja Kapster (14 Hari)</h2>
            </div>
            <BarberPerformanceTable rows={data.barberPerformance} />
          </div>

          <div className="glass-panel p-6 rounded-2xl">
            <div className="flex items-center gap-2 mb-6">
              <Users className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-semibold">Customer Retention & Churned Report</h2>
            </div>
            <RetentionReport
              repeatRatePct={data.retention.repeatRatePct}
              repeatRateDeltaPct={data.retention.repeatRateDeltaPct}
              churned={data.retention.churned}
            />
          </div>
        </div>
      )}
    </div>
  );
}
