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
