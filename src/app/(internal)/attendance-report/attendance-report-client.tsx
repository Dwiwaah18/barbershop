'use client';

import { useMemo, useState } from 'react';
import { CalendarDays, ClipboardList } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { Branch } from '@/lib/supabase/types';

type AttendanceRow = {
  id: string;
  profile_id: string;
  branch_id: string;
  clock_in_at: string;
  clock_out_at: string | null;
  status: 'clocked_in' | 'clocked_out';
  profiles: { full_name: string | null } | null;
};

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

function nextDayStartISO(dateStr: string) {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + 1);
  return d.toISOString();
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Jakarta',
  });
}

function formatDuration(clockInAt: string, clockOutAt: string) {
  const ms = new Date(clockOutAt).getTime() - new Date(clockInAt).getTime();
  const totalMinutes = Math.max(0, Math.round(ms / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours} jam ${minutes} menit`;
}

export default function AttendanceReportClient({ branches }: { branches: Branch[] }) {
  const [periodStart, setPeriodStart] = useState(defaultPeriodStart);
  const [periodEnd, setPeriodEnd] = useState(defaultPeriodEnd);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [rows, setRows] = useState<AttendanceRow[]>([]);

  const rowsByBranch = useMemo(() => {
    const map: Record<string, AttendanceRow[]> = {};
    for (const row of rows) {
      if (!map[row.branch_id]) map[row.branch_id] = [];
      map[row.branch_id].push(row);
    }
    return map;
  }, [rows]);

  const handleShow = async () => {
    if (loading) return;
    setLoading(true);
    setError(null);

    if (!periodStart || !periodEnd || periodStart > periodEnd) {
      setError('Rentang tanggal tidak valid.');
      setLoading(false);
      return;
    }

    const supabase = createClient();
    const { data, error: fetchError } = await supabase
      .from('attendances')
      .select('id, profile_id, branch_id, clock_in_at, clock_out_at, status, profiles(full_name)')
      .in(
        'branch_id',
        branches.map((b) => b.id)
      )
      .gte('clock_in_at', startOfDayISO(periodStart))
      .lt('clock_in_at', nextDayStartISO(periodEnd))
      .order('clock_in_at', { ascending: false });

    if (fetchError) {
      setError('Gagal memuat data absensi. Coba lagi.');
      setLoading(false);
      return;
    }

    setRows((data as unknown as AttendanceRow[] | null) ?? []);
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
            const branchRows = rowsByBranch[branch.id] ?? [];
            return (
              <div key={branch.id} className="glass-panel p-6 rounded-2xl">
                <h2 className="text-lg font-semibold mb-4">
                  {branch.name} <span className="text-sm font-normal text-gray-500">({branchRows.length} catatan)</span>
                </h2>

                {branchRows.length === 0 ? (
                  <p className="text-sm text-gray-400">Belum ada data absensi di periode ini.</p>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-gray-500 bg-white/5">
                          <th className="px-4 py-3 font-medium">Nama Karyawan</th>
                          <th className="px-4 py-3 font-medium">Tanggal</th>
                          <th className="px-4 py-3 font-medium">Clock In</th>
                          <th className="px-4 py-3 font-medium">Clock Out</th>
                          <th className="px-4 py-3 font-medium">Durasi</th>
                          <th className="px-4 py-3 font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {branchRows.map((row) => (
                          <tr key={row.id} className="border-t border-[var(--border)]">
                            <td className="px-4 py-3 font-medium">{row.profiles?.full_name ?? 'Tanpa nama'}</td>
                            <td className="px-4 py-3 text-gray-400 whitespace-nowrap">{formatDate(row.clock_in_at)}</td>
                            <td className="px-4 py-3 whitespace-nowrap">{formatTime(row.clock_in_at)}</td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              {row.clock_out_at ? formatTime(row.clock_out_at) : '-'}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              {row.clock_out_at ? (
                                formatDuration(row.clock_in_at, row.clock_out_at)
                              ) : (
                                <span className="inline-flex items-center text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-full text-xs font-medium">
                                  Masih Clock In
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {row.status === 'clocked_out' ? (
                                <span className="inline-flex items-center text-green-400 bg-green-500/10 px-2.5 py-1 rounded-full text-xs font-medium">
                                  Selesai
                                </span>
                              ) : (
                                <span className="inline-flex items-center text-blue-400 bg-blue-500/10 px-2.5 py-1 rounded-full text-xs font-medium">
                                  Aktif
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
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
