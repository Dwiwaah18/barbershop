'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

type Props = {
  shiftId: string;
};

export function PettyCashForm({ shiftId }: Props) {
  const router = useRouter();
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    const parsedAmount = Number(amount);
    if (!amount || Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('Masukkan jumlah yang valid.');
      return;
    }
    if (!reason.trim()) {
      setError('Isi alasan / item pengeluaran.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const supabase = createClient();
    const { error: insertError } = await supabase.from('petty_cash_entries').insert({
      shift_id: shiftId,
      type: 'expense',
      amount: parsedAmount,
      description: reason.trim(),
    });

    setIsSubmitting(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    setAmount('');
    setReason('');
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 mb-8">
      <div>
        <label className="block text-sm font-medium text-gray-400 mb-1">Amount</label>
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Rp 0"
          className="w-full bg-white/5 border border-[var(--border)] rounded-xl py-2 px-4 focus:outline-none focus:border-primary transition-colors"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-400 mb-1">Reason / Item</label>
        <input
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. Beli air galon"
          className="w-full bg-white/5 border border-[var(--border)] rounded-xl py-2 px-4 focus:outline-none focus:border-primary transition-colors"
        />
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full bg-white hover:bg-gray-200 text-gray-900 font-bold py-2 rounded-xl transition-colors disabled:opacity-50"
      >
        {isSubmitting ? 'Menyimpan...' : 'Record Expense'}
      </button>
    </form>
  );
}
