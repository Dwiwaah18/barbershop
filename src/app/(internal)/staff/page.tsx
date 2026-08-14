import { createClient } from '@/lib/supabase/server';
import { getCurrentProfile } from '@/lib/supabase/current-profile';
import type { Profile } from '@/lib/supabase/types';
import StaffTable from './staff-table';
import TenantPicker from './tenant-picker';

export type BranchOption = { id: string; name: string; tenantId?: string; tenantName?: string };
export type TenantOption = { id: string; name: string };

export default async function StaffPage({
  searchParams,
}: {
  searchParams: Promise<{ tenant?: string }>;
}) {
  const current = await getCurrentProfile();

  if (!current) {
    return (
      <div>
        <h1 className="text-3xl font-bold mb-8">Staff Management</h1>
        <div className="glass-panel p-6 rounded-2xl text-gray-400">
          Anda harus login untuk mengakses halaman ini.
        </div>
      </div>
    );
  }

  const isSuperadmin = current.profile.role === 'superadmin';
  const supabase = await createClient();

  let tenants: TenantOption[] = [];
  let tenantId: string | null = null;

  if (isSuperadmin) {
    const { data: tenantRows } = await supabase.from('tenants').select('id, name').order('name', { ascending: true });
    tenants = (tenantRows as TenantOption[] | null) ?? [];
    const { tenant: tenantParam } = await searchParams;
    tenantId = tenantParam && tenants.some((t) => t.id === tenantParam) ? tenantParam : null;
  }

  // Staff Management sekarang cuma nampilin profile yang BUKAN customer.
  // Pencarian & promosi pelanggan (jadi kapster/kasir) pindah ke halaman /customers.
  let profileQuery = supabase
    .from('profiles')
    .select('*')
    .neq('role', 'customer')
    .order('created_at', { ascending: false });
  if (isSuperadmin && tenantId) {
    profileQuery = profileQuery.eq('tenant_id', tenantId);
  }

  const branchQuery = isSuperadmin
    ? tenantId
      ? supabase.from('branches').select('id, name').eq('tenant_id', tenantId).order('name', { ascending: true })
      : supabase.from('branches').select('id, name, tenant:tenant_id(id, name)').order('name', { ascending: true })
    : supabase.from('branches').select('id, name').eq('owner_id', current.userId).order('name', { ascending: true });

  const [{ data: profileRows }, { data: branchRows }, { data: assignmentRows }] = await Promise.all([
    profileQuery,
    branchQuery,
    supabase.from('staff_branch_assignments').select('profile_id, branch_id'),
  ]);

  const profiles = (profileRows as Profile[] | null) ?? [];
  const branches = (
    (branchRows as unknown as { id: string; name: string; tenant?: { id: string; name: string } | null }[] | null) ??
    []
  ).map((b) => ({ id: b.id, name: b.name, tenantId: b.tenant?.id, tenantName: b.tenant?.name }));

  const extraBranchesByProfile: Record<string, string[]> = {};
  for (const row of (assignmentRows as { profile_id: string; branch_id: string }[] | null) ?? []) {
    (extraBranchesByProfile[row.profile_id] ??= []).push(row.branch_id);
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-2">Staff Management</h1>
      <p className="text-gray-400 mb-8">
        Kelola staff yang sudah aktif: atur role, cabang utama, cabang tambahan, status kapster, dan gaji
        bulanan. Untuk mencari pelanggan dan menjadikannya kapster/kasir, buka halaman{' '}
        <span className="text-primary">Pelanggan</span>.
      </p>
      <TenantPicker tenants={tenants} selectedTenantId={tenantId} />
      <StaffTable
        profiles={profiles}
        branches={branches}
        currentUserId={current.userId}
        extraBranchesByProfile={extraBranchesByProfile}
      />
    </div>
  );
}