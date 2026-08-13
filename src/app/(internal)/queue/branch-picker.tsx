'use client';

import { useRouter } from 'next/navigation';
import { MapPin } from 'lucide-react';

export default function BranchPicker({
  branches,
  selectedBranchId,
}: {
  branches: { id: string; name: string }[];
  selectedBranchId: string;
}) {
  const router = useRouter();

  if (branches.length <= 1) return null;

  return (
    <div className="flex items-center gap-2 mb-6 flex-wrap">
      <MapPin className="h-4 w-4 text-gray-500 shrink-0" />
      <div className="flex items-center gap-1.5 p-1 bg-white/5 rounded-xl border border-[var(--border)] w-fit">
        {branches.map((b) => (
          <button
            key={b.id}
            type="button"
            onClick={() => router.push(`/queue?branch=${b.id}`)}
            className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              b.id === selectedBranchId ? 'bg-primary text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            {b.name}
          </button>
        ))}
      </div>
    </div>
  );
}
