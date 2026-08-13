'use client';

import { useRouter } from 'next/navigation';
import { Building2 } from 'lucide-react';

export default function TenantPicker({
  tenants,
  selectedTenantId,
}: {
  tenants: { id: string; name: string }[];
  selectedTenantId: string | null;
}) {
  const router = useRouter();

  if (tenants.length <= 1) return null;

  return (
    <div className="flex items-center gap-2 mb-6 flex-wrap">
      <Building2 className="h-4 w-4 text-gray-500 shrink-0" />
      <div className="flex items-center gap-1.5 p-1 bg-white/5 rounded-xl border border-[var(--border)] w-fit">
        <button
          type="button"
          onClick={() => router.push('/staff')}
          className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            selectedTenantId === null ? 'bg-primary text-white' : 'text-gray-400 hover:text-white'
          }`}
        >
          Semua Barbershop
        </button>
        {tenants.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => router.push(`/staff?tenant=${t.id}`)}
            className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              selectedTenantId === t.id ? 'bg-primary text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            {t.name}
          </button>
        ))}
      </div>
    </div>
  );
}
