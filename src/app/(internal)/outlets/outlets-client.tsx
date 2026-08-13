'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MapPin, Plus } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { Branch } from '@/lib/supabase/types';

export default function OutletsClient({ branches }: { branches: Branch[] }) {
  const router = useRouter();

  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    setError(null);
    if (!name.trim()) {
      setError('Nama cabang wajib diisi.');
      return;
    }

    setSubmitting(true);
    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc('owner_create_branch', {
      branch_name: name.trim(),
      branch_address: address.trim() || null,
    });
    setSubmitting(false);

    if (rpcError) {
      setError(`Gagal menambah cabang: ${rpcError.message}`);
      return;
    }

    setName('');
    setAddress('');
    router.refresh();
  };

  return (
    <div className="space-y-8">
      <div className="glass-panel p-6 rounded-2xl">
        <div className="flex items-center gap-2 mb-4">
          <Plus className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Tambah Cabang Baru</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Nama Cabang</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="mis. Cabang Pringsewu"
              className="w-full bg-white/5 border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Alamat (opsional)</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Alamat lengkap"
              className="w-full bg-white/5 border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
            />
          </div>
        </div>
        {error && <p className="text-xs text-red-400 mb-3">{error}</p>}
        <button
          onClick={handleCreate}
          disabled={submitting}
          className="inline-flex items-center gap-1.5 bg-primary hover:bg-amber-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <Plus className="h-4 w-4" />
          {submitting ? 'Menambah...' : 'Tambah Cabang'}
        </button>
      </div>

      <div className="glass-panel p-6 rounded-2xl">
        <div className="flex items-center gap-2 mb-4">
          <MapPin className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Cabang Anda ({branches.length})</h2>
        </div>
        {branches.length === 0 ? (
          <p className="text-sm text-gray-400">Belum ada cabang. Tambahkan yang pertama di atas.</p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-[var(--border)]">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 bg-white/5">
                  <th className="px-4 py-3 font-medium">Nama</th>
                  <th className="px-4 py-3 font-medium">Alamat</th>
                  <th className="px-4 py-3 font-medium">Skema Komisi</th>
                </tr>
              </thead>
              <tbody>
                {branches.map((b) => (
                  <tr key={b.id} className="border-t border-[var(--border)]">
                    <td className="px-4 py-3 font-medium">{b.name}</td>
                    <td className="px-4 py-3 text-gray-400">{b.address ?? '-'}</td>
                    <td className="px-4 py-3 text-gray-400">{b.commission_type}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-xs text-gray-500 mt-3">
          Atur skema komisi & layanan tiap cabang di halaman{' '}
          <a href="/services" className="text-primary hover:underline">
            Kelola Layanan
          </a>
          .
        </p>
      </div>
    </div>
  );
}
