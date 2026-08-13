'use client';

import { useEffect, useRef, useState } from 'react';
import { Search, Users, UserPlus, UserMinus, Wallet, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

const formatRupiah = (n: number) => `Rp ${Math.round(n).toLocaleString('id-ID')}`;

type CustomerRow = {
  id: string;
  full_name: string | null;
  phone: string | null;
  effective_balance: number;
  family_id: string | null;
};

type Group = { head: CustomerRow | null; members: CustomerRow[] };

function useCustomerSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CustomerRow[]>([]);
  const [searching, setSearching] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    debounce.current = setTimeout(async () => {
      setSearching(true);
      const supabase = createClient();
      const { data } = await supabase
        .from('customer_effective_wallet')
        .select('id, full_name, phone, effective_balance, family_id')
        .eq('role', 'customer')
        .or(`full_name.ilike.%${q}%,phone.ilike.%${q}%`)
        .limit(6);
      setResults((data as CustomerRow[] | null) ?? []);
      setSearching(false);
    }, 300);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [query]);

  return { query, setQuery, results, setResults, searching };
}

export default function FamiliesClient() {
  const head = useCustomerSearch();
  const member = useCustomerSearch();

  const [headId, setHeadId] = useState<string | null>(null);
  const [group, setGroup] = useState<Group>({ head: null, members: [] });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadGroup = async (id: string) => {
    const supabase = createClient();
    const { data } = await supabase
      .from('customer_effective_wallet')
      .select('id, full_name, phone, effective_balance, family_id')
      .or(`id.eq.${id},family_id.eq.${id}`);
    const rows = (data as CustomerRow[] | null) ?? [];
    setGroup({
      head: rows.find((r) => r.id === id) ?? null,
      members: rows.filter((r) => r.family_id === id),
    });
  };

  const selectCustomer = async (c: CustomerRow) => {
    setError(null);
    setNotice(null);
    const resolvedHead = c.family_id ?? c.id;
    setHeadId(resolvedHead);
    head.setQuery('');
    head.setResults([]);
    await loadGroup(resolvedHead);
  };

  const addMember = async (c: CustomerRow) => {
    if (!headId) return;
    setError(null);
    setNotice(null);
    if (c.id === headId) {
      setError('Tidak bisa menambahkan kepala keluarga sebagai anggotanya sendiri.');
      return;
    }
    setBusy(true);
    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc('admin_link_family_member', {
      member_id: c.id,
      head_id: headId,
    });
    setBusy(false);
    member.setQuery('');
    member.setResults([]);
    if (rpcError) {
      setError(`Gagal menambah anggota: ${rpcError.message}`);
      return;
    }
    setNotice(`${c.full_name ?? 'Pelanggan'} ditambahkan ke keluarga. Saldonya digabung ke dompet keluarga.`);
    await loadGroup(headId);
  };

  const removeMember = async (c: CustomerRow) => {
    if (!headId) return;
    setError(null);
    setNotice(null);
    setBusy(true);
    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc('admin_unlink_family_member', { member_id: c.id });
    setBusy(false);
    if (rpcError) {
      setError(`Gagal mengeluarkan anggota: ${rpcError.message}`);
      return;
    }
    setNotice(`${c.full_name ?? 'Pelanggan'} dikeluarkan dari keluarga.`);
    await loadGroup(headId);
  };

  return (
    <div className="space-y-8">
      {/* Cari keluarga */}
      <div className="glass-panel p-6 rounded-2xl">
        <div className="flex items-center gap-2 mb-4">
          <Search className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Cari Pelanggan / Keluarga</h2>
        </div>
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
          <input
            type="text"
            value={head.query}
            onChange={(e) => head.setQuery(e.target.value)}
            placeholder="Cari nama / no. HP pelanggan..."
            className="w-full bg-white/5 border border-[var(--border)] rounded-xl py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:border-primary"
          />
          {head.query.trim().length >= 2 && (head.searching || head.results.length > 0) && (
            <div className="absolute z-10 mt-1 w-full bg-slate-800 border border-[var(--border)] rounded-xl overflow-hidden max-h-56 overflow-y-auto">
              {head.searching && <p className="px-3 py-2 text-xs text-gray-500">Mencari...</p>}
              {!head.searching &&
                head.results.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => selectCustomer(c)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-white/10 transition-colors"
                  >
                    <p className="font-medium">
                      {c.full_name ?? 'Tanpa nama'}
                      {c.family_id && <span className="text-xs text-gray-500"> · anggota keluarga</span>}
                    </p>
                    <p className="text-xs text-gray-400">
                      {c.phone ?? '-'} · Saldo dompet {formatRupiah(c.effective_balance)}
                    </p>
                  </button>
                ))}
            </div>
          )}
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Pilih pelanggan mana pun — kalau dia sudah bagian dari keluarga, seluruh keluarganya langsung tampil.
        </p>
      </div>

      {error && (
        <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">{error}</div>
      )}
      {notice && (
        <div className="flex items-start justify-between gap-3 text-sm text-green-400 bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-3">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice(null)} className="shrink-0 hover:text-green-300">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Grup keluarga */}
      {headId && group.head && (
        <div className="glass-panel p-6 rounded-2xl">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold">Keluarga {group.head.full_name ?? 'Tanpa nama'}</h2>
            </div>
            <div className="flex items-center gap-2 bg-primary/10 border border-primary/30 rounded-xl px-4 py-2">
              <Wallet className="h-4 w-4 text-primary" />
              <div className="text-right">
                <p className="text-[11px] uppercase tracking-wider text-gray-400">Saldo Dompet Bersama</p>
                <p className="text-lg font-bold text-primary tabular-nums">{formatRupiah(group.head.effective_balance)}</p>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-[var(--border)] mb-5">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 bg-white/5">
                  <th className="px-4 py-2.5 font-medium">Nama</th>
                  <th className="px-4 py-2.5 font-medium">No. HP</th>
                  <th className="px-4 py-2.5 font-medium">Peran</th>
                  <th className="px-4 py-2.5 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-[var(--border)]">
                  <td className="px-4 py-2.5 font-medium">{group.head.full_name ?? 'Tanpa nama'}</td>
                  <td className="px-4 py-2.5 text-gray-400">{group.head.phone ?? '-'}</td>
                  <td className="px-4 py-2.5">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary">Kepala Keluarga</span>
                  </td>
                  <td className="px-4 py-2.5"></td>
                </tr>
                {group.members.map((m) => (
                  <tr key={m.id} className="border-t border-[var(--border)]">
                    <td className="px-4 py-2.5 font-medium">{m.full_name ?? 'Tanpa nama'}</td>
                    <td className="px-4 py-2.5 text-gray-400">{m.phone ?? '-'}</td>
                    <td className="px-4 py-2.5">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-gray-300">Anggota</span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <button
                        type="button"
                        onClick={() => removeMember(m)}
                        disabled={busy}
                        className="inline-flex items-center gap-1 text-xs text-red-400 hover:text-red-300 disabled:opacity-50"
                      >
                        <UserMinus className="h-3.5 w-3.5" /> Keluarkan
                      </button>
                    </td>
                  </tr>
                ))}
                {group.members.length === 0 && (
                  <tr className="border-t border-[var(--border)]">
                    <td colSpan={4} className="px-4 py-3 text-center text-gray-500 text-xs">
                      Belum ada anggota lain. Tambahkan di bawah.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Tambah anggota */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <UserPlus className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">Tambah Anggota Keluarga</h3>
            </div>
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
              <input
                type="text"
                value={member.query}
                onChange={(e) => member.setQuery(e.target.value)}
                placeholder="Cari pelanggan untuk digabung ke keluarga ini..."
                className="w-full bg-white/5 border border-[var(--border)] rounded-xl py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:border-primary"
              />
              {member.query.trim().length >= 2 && (member.searching || member.results.length > 0) && (
                <div className="absolute z-10 mt-1 w-full bg-slate-800 border border-[var(--border)] rounded-xl overflow-hidden max-h-56 overflow-y-auto">
                  {member.searching && <p className="px-3 py-2 text-xs text-gray-500">Mencari...</p>}
                  {!member.searching &&
                    member.results
                      .filter((c) => c.id !== headId && c.family_id !== headId)
                      .map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => addMember(c)}
                          disabled={busy}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-white/10 transition-colors disabled:opacity-50"
                        >
                          <p className="font-medium">
                            {c.full_name ?? 'Tanpa nama'}
                            {c.family_id && <span className="text-xs text-amber-400"> · sudah di keluarga lain</span>}
                          </p>
                          <p className="text-xs text-gray-400">
                            {c.phone ?? '-'} · Saldo {formatRupiah(c.effective_balance)}
                          </p>
                        </button>
                      ))}
                </div>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Saat digabung, saldo pelanggan itu langsung menyatu ke dompet keluarga. Mengeluarkan anggota tidak
              mengembalikan saldo (uang tetap di dompet keluarga).
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
