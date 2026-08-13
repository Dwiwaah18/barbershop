'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, X, Wallet } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { PendingTopup } from './page';

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

export default function TopupList({ items, verifierId }: { items: PendingTopup[]; verifierId: string }) {
  const router = useRouter();
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [rowError, setRowError] = useState<Record<string, string>>({});

  const setBusy = (id: string, on: boolean) => {
    setPendingIds((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const handleDecision = async (id: string, status: 'verified' | 'rejected') => {
    setBusy(id, true);
    setRowError((prev) => ({ ...prev, [id]: '' }));
    const supabase = createClient();
    const { error } = await supabase
      .from('wallet_transactions')
      .update({ status, verified_by: verifierId })
      .eq('id', id);
    setBusy(id, false);
    if (error) {
      setRowError((prev) => ({ ...prev, [id]: 'Gagal memproses. Coba lagi.' }));
      return;
    }
    router.refresh();
  };

  if (items.length === 0) {
    return (
      <div className="glass-panel p-8 rounded-2xl text-center text-gray-400">
        <Wallet className="h-8 w-8 mx-auto mb-3 text-gray-600" />
        Tidak ada top-up yang menunggu verifikasi.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {items.map((tx) => (
        <div key={tx.id} className="glass-panel p-6 rounded-2xl flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {tx.proofSignedUrl ? (
              <a href={tx.proofSignedUrl} target="_blank" rel="noopener noreferrer" className="shrink-0">
                <img
                  src={tx.proofSignedUrl}
                  alt={`Bukti pembayaran ${tx.customerName}`}
                  className="w-14 h-14 object-cover rounded-lg border border-[var(--border)] hover:opacity-80 transition-opacity"
                />
              </a>
            ) : (
              <div className="w-14 h-14 shrink-0 rounded-lg border border-dashed border-[var(--border)] flex items-center justify-center text-gray-500">
                <Wallet className="h-5 w-5" />
              </div>
            )}
            <div>
              <p className="font-bold text-lg">{tx.customerName}</p>
              <p className="text-sm text-gray-400">{formatDateTime(tx.created_at)}</p>
              {tx.proofSignedUrl ? (
                <a
                  href={tx.proofSignedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline"
                >
                  Lihat bukti
                </a>
              ) : (
                <p className="text-xs text-gray-500 italic">Tidak ada bukti dilampirkan</p>
              )}
              {rowError[tx.id] && <p className="text-xs text-red-400 mt-1">{rowError[tx.id]}</p>}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xl font-bold text-primary whitespace-nowrap">{formatRupiah(tx.amount)}</span>
            <div className="flex gap-2">
              <button
                onClick={() => handleDecision(tx.id, 'verified')}
                disabled={pendingIds.has(tx.id)}
                className="p-2.5 rounded-xl bg-green-500/20 text-green-400 hover:bg-green-500/30 disabled:opacity-50 transition-colors"
                aria-label={`Setujui top-up ${tx.customerName}`}
                title="Setujui"
              >
                <Check className="h-5 w-5" />
              </button>
              <button
                onClick={() => handleDecision(tx.id, 'rejected')}
                disabled={pendingIds.has(tx.id)}
                className="p-2.5 rounded-xl bg-red-500/20 text-red-400 hover:bg-red-500/30 disabled:opacity-50 transition-colors"
                aria-label={`Tolak top-up ${tx.customerName}`}
                title="Tolak"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
