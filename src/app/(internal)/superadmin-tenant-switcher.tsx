'use client';

import { useRouter } from 'next/navigation';
import { setManagedTenantIdClient } from '@/lib/manage-tenant';

// Switcher untuk superadmin: memilih barbershop mana yang sedang dikelola. Menyimpan pilihan ke
// cookie lalu refresh — semua halaman owner (Kelola Cabang/Layanan, Payroll, laporan, Dashboard)
// otomatis menampilkan data barbershop yang dipilih.
export default function SuperadminTenantSwitcher({
  tenants,
  selectedId,
}: {
  tenants: { id: string; name: string }[];
  selectedId: string | null;
}) {
  const router = useRouter();

  return (
    <select
      value={selectedId ?? ''}
      onChange={(e) => {
        setManagedTenantIdClient(e.target.value || null);
        router.refresh();
      }}
      aria-label="Pilih barbershop yang dikelola"
      className="w-full bg-white/5 border border-primary/40 rounded-lg px-2 py-1.5 text-sm text-primary font-semibold focus:outline-none focus:border-primary"
    >
      <option value="">— Pilih barbershop —</option>
      {tenants.map((t) => (
        <option key={t.id} value={t.id} className="text-slate-900">
          {t.name}
        </option>
      ))}
    </select>
  );
}
