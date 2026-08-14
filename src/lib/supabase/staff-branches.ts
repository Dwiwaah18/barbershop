import { createClient } from '@/lib/supabase/server';

export type StaffBranchOption = { id: string; name: string };

/**
 * Branches the current staff member (cashier/barber/owner) is authorized to operate at —
 * their primary branch (profiles.branch_id) plus any additional branches assigned via
 * Staff Management. Relies on RLS ("Branches viewable by everyone") for the actual read;
 * `my_staff_branch_ids()` just narrows down which ids to look up.
 */
export async function getMyStaffBranches(): Promise<StaffBranchOption[]> {
  const supabase = await createClient();
  const { data: idRows } = await supabase.rpc('my_staff_branch_ids');
  // PostgREST serializes a `SETOF uuid` RPC as an array of either raw scalars or
  // `{ my_staff_branch_ids: uuid }` objects depending on version — handle both.
  const ids = ((idRows ?? []) as unknown[])
    .map((row) => (typeof row === 'string' ? row : (row as Record<string, string>)?.my_staff_branch_ids))
    .filter((id): id is string => Boolean(id));

  if (ids.length === 0) return [];

  const { data } = await supabase.from('branches').select('id, name').in('id', ids).order('name', { ascending: true });
  return (data as StaffBranchOption[] | null) ?? [];
}
import { cookies } from 'next/headers';
import { getCurrentProfile } from './current-profile';
import { MANAGE_TENANT_COOKIE } from '@/lib/manage-tenant';

export type BranchesForUserResult =
  | { status: 'ok'; branches: StaffBranchOption[] }
  | { status: 'no_tenant_selected' }
  | { status: 'no_branches' };

/**
 * Cabang yang boleh diakses user saat ini di halaman operasional (POS, Queue).
 * Staff biasa: dari assignment staff-ke-cabang (getMyStaffBranches).
 * Superadmin: dari tenant aktif yang dia pilih lewat switcher (cookie manage_tenant),
 * bukan dari staff assignment — karena superadmin memang tidak di-assign ke cabang manapun.
 */
export async function getBranchesForCurrentUser(): Promise<BranchesForUserResult> {
  const current = await getCurrentProfile();
  if (!current) return { status: 'no_branches' };

  if (current.profile.role === 'superadmin') {
    const cookieStore = await cookies();
    const managedTenantId = cookieStore.get(MANAGE_TENANT_COOKIE)?.value ?? null;

    if (!managedTenantId) return { status: 'no_tenant_selected' };

    const supabase = await createClient();
    const { data } = await supabase
      .from('branches')
      .select('id, name')
      .eq('tenant_id', managedTenantId)
      .order('name', { ascending: true });

    const branches = (data as StaffBranchOption[] | null) ?? [];
    return branches.length === 0 ? { status: 'no_branches' } : { status: 'ok', branches };
  }

  const branches = await getMyStaffBranches();
  return branches.length === 0 ? { status: 'no_branches' } : { status: 'ok', branches };
}