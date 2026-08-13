'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { BarberStatus } from '@/lib/supabase/types';

type Props = {
  userId: string;
  barberStatus: BarberStatus | null;
};

const OPTIONS: { id: BarberStatus; label: string; dot: string }[] = [
  { id: 'free', label: 'Free', dot: 'bg-green-500' },
  { id: 'busy', label: 'Busy', dot: 'bg-red-500' },
  { id: 'break', label: 'Break', dot: 'bg-yellow-500' },
];

export function BarberStatusToggle({ userId, barberStatus }: Props) {
  const router = useRouter();
  const [current, setCurrent] = useState<BarberStatus>(barberStatus ?? 'free');
  const [isUpdating, setIsUpdating] = useState(false);

  async function handleSelect(status: BarberStatus) {
    if (status === current || isUpdating) return;

    setIsUpdating(true);
    const previous = current;
    setCurrent(status);

    const supabase = createClient();
    const { error } = await supabase.from('profiles').update({ barber_status: status }).eq('id', userId);

    setIsUpdating(false);

    if (error) {
      setCurrent(previous);
      return;
    }

    router.refresh();
  }

  return (
    <div className="glass-panel p-4 rounded-2xl mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <p className="text-sm text-gray-400">Status Kapster</p>
      <div className="flex items-center gap-1.5 p-1 bg-white/5 rounded-xl border border-[var(--border)] w-fit">
        {OPTIONS.map((opt) => (
          <button
            key={opt.id}
            onClick={() => handleSelect(opt.id)}
            disabled={isUpdating}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${
              current === opt.id ? 'bg-primary text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${opt.dot}`}></span>
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
