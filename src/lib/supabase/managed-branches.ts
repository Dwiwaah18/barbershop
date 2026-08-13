import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { getCurrentProfile } from '@/lib/supabase/current-profile';
import { MANAGE_TENANT_COOKIE } from '@/lib/manage-tenant';
import type { Branch, Profile } from '@/lib/supabase/types';

export type ManagedContext = {
  current: { userId: string; profile: Profile } | null;
  branches: Branch[];
  managedTenantId: string | null;
  isSuperadmin: boolean;
  // true kalau superadmin belum memilih barbershop mana yang mau dikelola (semua halaman owner
  // menampilkan prompt "pilih barbershop dulu" alih-alih "belum punya cabang").
  needsTenantSelection: boolean;
};

// Resolusi cabang yang boleh DIKELOLA user saat ini:
//  - owner  → cabang miliknya sendiri (owner_id = dia).
//  - superadmin → cabang milik tenant yang dipilih lewat switcher (cookie); kalau belum memilih,
//    needsTenantSelection = true.
export async function getManagedContext(): Promise<ManagedContext> {
  const current = await getCurrentProfile();
  if (!current) {
    return { current: null, branches: [], managedTenantId: null, isSuperadmin: false, needsTenantSelection: false };
  }

  const supabase = await createClient();
  const isSuperadmin = current.profile.role === 'superadmin';

  if (isSuperadmin) {
    const cookieStore = await cookies();
    const selected = cookieStore.get(MANAGE_TENANT_COOKIE)?.value ?? null;
    if (!selected) {
      return { current, branches: [], managedTenantId: null, isSuperadmin: true, needsTenantSelection: true };
    }
    const { data } = await supabase
      .from('branches')
      .select('*')
      .eq('tenant_id', selected)
      .order('name', { ascending: true });
    return {
      current,
      branches: (data as Branch[] | null) ?? [],
      managedTenantId: selected,
      isSuperadmin: true,
      needsTenantSelection: false,
    };
  }

  const { data } = await supabase
    .from('branches')
    .select('*')
    .eq('owner_id', current.userId)
    .order('name', { ascending: true });
  return {
    current,
    branches: (data as Branch[] | null) ?? [],
    managedTenantId: current.profile.tenant_id ?? null,
    isSuperadmin: false,
    needsTenantSelection: false,
  };
}
