'use client';

import { useCallback, useEffect, useState } from 'react';
import { HandCoins, Check, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { Branch } from '@/lib/supabase/types';

const formatRupiah = (n: number) => `Rp ${Math.round(n).toLocaleString('id-ID')}`;

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

type PendingKasbon = {
  id: string;
  profile_id: string;
  branch_id: string;
  amount: number;
  reason: string | null;
  created_at: string;
  profile: { full_name: string | null } | null;
};

// Persetujuan kasbon untuk owner/superadmin: menampilkan semua kasbon 'pending' di cabang yang
// dikelola, dengan aksi Setujui / Tolak. Kasbon yang disetujui akan otomatis muncul sebagai
// potongan saat menghitung payroll kapster tersebut.
export default function KasbonApprovals({ branches, approverId }: { branches: Branch[]; approverId: string }) {
  const branchName = (id: string) => branches.find((b) => b.id === id)?.name ?? 'Cabang';
  // Key string yang stabil dari daftar cabang — dipakai sebagai dependency effect (array cabang
  // baru dibuat tiap render, jadi tidak bisa langsung jadi dependency).
  const branchIdsKey = branches.map((b) => b.id).join(',');

  const [pending, setPending] = useState<PendingKasbon[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const ids = branchIdsKey ? branchIdsKey.split(',') : [];
    if (ids.length === 0) {
      setPending([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const { data, error: loadError } = await supabase
      .from('cash_advances')
      .select('id, profile_id, branch_id, amount, reason, created_at, profile:profile_id(full_name)')
      .in('branch_id', ids)
      .eq('status', 'pending')
      .order('created_at', { ascending: true });
    if (loadError) setError('Gagal memuat kasbon.');
    setPending((data as unknown as PendingKasbon[] | null) ?? []);
    setLoading(false);
  }, [branchIdsKey]);

  useEffect(() => {
    load();
  }, [load]);

  const decide = async (id: string, status: 'approved' | 'rejected') => {
    setError(null);
    setBusyId(id);
    const supabase = createClient();
    const { error: updateError } = await supabase
      .from('cash_advances')
      .update({ status, approved_by: approverId })
      .eq('id', id);
    setBusyId(null);
    if (updateError) {
      setError(`Gagal memproses kasbon: ${updateError.message}`);
      return;
    }
    load();
  };

  return (
    <div className="glass-panel p-6 rounded-2xl mb-6">
      <h2 className="text-lg font-semibold mb-1 flex items-center gap-2">
        <HandCoins className="h-5 w-5 text-primary" />
        Persetujuan Kasbon
      </h2>
      <p className="text-xs text-gray-500 mb-4">
        Kasbon yang diajukan kapster. Yang disetujui otomatis jadi potongan saat menghitung payroll.
      </p>

      {error && <p className="text-xs text-red-400 mb-3">{error}</p>}

      {loading ? (
        <p className="text-sm text-gray-500">Memuat...</p>
      ) : pending.length === 0 ? (
        <p className="text-sm text-gray-400">Tidak ada kasbon yang menunggu persetujuan.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 bg-white/5">
                <th className="px-3 py-2 font-medium">Tanggal</th>
                <th className="px-3 py-2 font-medium">Kapster</th>
                <th className="px-3 py-2 font-medium">Cabang</th>
                <th className="px-3 py-2 font-medium">Nominal</th>
                <th className="px-3 py-2 font-medium">Keterangan</th>
                <th className="px-3 py-2 font-medium text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {pending.map((k) => (
                <tr key={k.id} className="border-t border-[var(--border)]">
                  <td className="px-3 py-2 text-gray-400 whitespace-nowrap">{formatDate(k.created_at)}</td>
                  <td className="px-3 py-2 font-medium">{k.profile?.full_name ?? 'Kapster'}</td>
                  <td className="px-3 py-2 text-gray-400">{branchName(k.branch_id)}</td>
                  <td className="px-3 py-2 font-medium tabular-nums">{formatRupiah(k.amount)}</td>
                  <td className="px-3 py-2 text-gray-400">{k.reason ?? '-'}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => decide(k.id, 'approved')}
                        disabled={busyId === k.id}
                        className="inline-flex items-center gap-1 bg-green-600/20 hover:bg-green-600/30 text-green-400 disabled:opacity-50 text-xs font-medium px-2.5 py-1 rounded-lg transition-colors"
                      >
                        <Check className="h-3.5 w-3.5" /> Setujui
                      </button>
                      <button
                        type="button"
                        onClick={() => decide(k.id, 'rejected')}
                        disabled={busyId === k.id}
                        className="inline-flex items-center gap-1 bg-red-600/20 hover:bg-red-600/30 text-red-400 disabled:opacity-50 text-xs font-medium px-2.5 py-1 rounded-lg transition-colors"
                      >
                        <X className="h-3.5 w-3.5" /> Tolak
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
