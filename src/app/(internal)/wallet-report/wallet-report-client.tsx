'use client';

import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import type { CustomerWalletRow } from './page';

const formatRupiah = (n: number) => `Rp ${Math.round(n).toLocaleString('id-ID')}`;

export default function WalletReportClient({ customers }: { customers: CustomerWalletRow[] }) {
  const [query, setQuery] = useState('');

  const totalBalance = useMemo(
    () => customers.reduce((sum, c) => sum + c.wallet_balance, 0),
    [customers]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (c) => (c.full_name ?? '').toLowerCase().includes(q) || (c.phone ?? '').toLowerCase().includes(q)
    );
  }, [customers, query]);

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <div className="glass-panel p-6 rounded-2xl">
          <p className="text-sm text-gray-400 mb-1">Total Saldo Wallet Semua Pelanggan</p>
          <p className="text-3xl font-bold text-primary tabular-nums">{formatRupiah(totalBalance)}</p>
        </div>
        <div className="glass-panel p-6 rounded-2xl">
          <p className="text-sm text-gray-400 mb-1">Jumlah Pelanggan</p>
          <p className="text-3xl font-bold tabular-nums">{customers.length}</p>
        </div>
      </div>

      <div className="relative mb-6 max-w-sm">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cari nama atau nomor telepon..."
          className="w-full bg-white/5 border border-[var(--border)] rounded-xl py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:border-primary transition-colors"
        />
      </div>

      <div className="glass-panel p-6 rounded-2xl">
        <div className="overflow-x-auto rounded-2xl border border-[var(--border)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 bg-white/5">
                <th className="px-4 py-3 font-medium">Nama</th>
                <th className="px-4 py-3 font-medium">Telepon</th>
                <th className="px-4 py-3 font-medium text-right">Saldo Wallet</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-gray-500">
                    Tidak ada yang cocok dengan pencarian.
                  </td>
                </tr>
              )}
              {filtered.map((c) => (
                <tr key={c.id} className="border-t border-[var(--border)]">
                  <td className="px-4 py-3 font-medium text-white">{c.full_name ?? 'Tanpa nama'}</td>
                  <td className="px-4 py-3 text-gray-300">{c.phone ?? '-'}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-primary font-semibold">
                    {formatRupiah(c.wallet_balance)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
