'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { StaffBranchOption } from '@/lib/supabase/staff-branches';

type Props = {
  userId: string;
  branches: StaffBranchOption[];
};

export function OpenRegisterForm({ userId, branches }: Props) {
  const router = useRouter();
  const [branchId, setBranchId] = useState(branches[0]?.id ?? '');
  const [openingCash, setOpeningCash] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    if (!branchId) {
      setError('Tidak ada cabang yang ditetapkan untuk akun ini.');
      return;
    }

    const amount = Number(openingCash);
    if (!openingCash || Number.isNaN(amount) || amount < 0) {
      setError('Masukkan jumlah kas awal yang valid.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const supabase = createClient();
    const { error: insertError } = await supabase.from('shifts').insert({
      branch_id: branchId,
      cashier_id: userId,
      opening_cash: amount,
      status: 'open',
      opened_at: new Date().toISOString(),
    });

    setIsSubmitting(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex justify-between items-center p-4 bg-white/5 border border-[var(--border)] rounded-xl">
        <span className="text-gray-400">Status</span>
        <span className="px-3 py-1 rounded-full text-xs font-medium bg-gray-500/20 text-gray-400">CLOSED</span>
      </div>

      {branches.length > 1 && (
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-1">Cabang (Branch)</label>
          <select
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
            className="w-full bg-white/5 border border-[var(--border)] rounded-xl py-2 px-4 focus:outline-none focus:border-primary transition-colors"
          >
            {branches.map((b) => (
              <option key={b.id} value={b.id} className="bg-gray-900">
                {b.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-400 mb-1">Kas Awal (Opening Cash)</label>
        <input
          type="number"
          value={openingCash}
          onChange={(e) => setOpeningCash(e.target.value)}
          placeholder="Rp 0"
          className="w-full bg-white/5 border border-[var(--border)] rounded-xl py-2 px-4 focus:outline-none focus:border-primary transition-colors"
        />
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full bg-primary hover:bg-amber-700 text-white font-bold py-3 rounded-xl transition-colors disabled:opacity-50"
      >
        {isSubmitting ? 'Membuka...' : 'Open Register'}
      </button>
    </form>
  );
}
