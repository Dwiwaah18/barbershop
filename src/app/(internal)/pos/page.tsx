import { createClient } from '@/lib/supabase/server';
import { getCurrentProfile } from '@/lib/supabase/current-profile';
import { getMyStaffBranches } from '@/lib/supabase/staff-branches';
import type { Service } from '@/lib/supabase/types';
import PosClient from './pos-client';
import BranchPicker from './branch-picker';

export default async function POSPage({
  searchParams,
}: {
  searchParams: Promise<{ branch?: string }>;
}) {
  const current = await getCurrentProfile();

  if (!current) {
    return (
      <div>
        <h1 className="text-3xl font-bold mb-8">Point of Sales</h1>
        <div className="glass-panel p-6 rounded-2xl text-gray-400">
          Akun ini belum terhubung ke cabang manapun. Hubungi owner untuk mengatur cabang Anda.
        </div>
      </div>
    );
  }

  const { userId } = current;
  const myBranches = await getMyStaffBranches();

  if (myBranches.length === 0) {
    return (
      <div>
        <h1 className="text-3xl font-bold mb-8">Point of Sales</h1>
        <div className="glass-panel p-6 rounded-2xl text-gray-400">
          Akun ini belum terhubung ke cabang manapun. Hubungi owner untuk mengatur cabang Anda.
        </div>
      </div>
    );
  }

  const { branch: branchParam } = await searchParams;
  const branchId =
    (branchParam && myBranches.some((b) => b.id === branchParam) ? branchParam : undefined) ??
    myBranches[0].id;

  const supabase = await createClient();

  const { data } = await supabase
    .from('services')
    .select('*')
    .eq('branch_id', branchId)
    .order('name', { ascending: true });

  const services = (data ?? []) as Service[];

  const branchName = myBranches.find((b) => b.id === branchId)?.name ?? 'Cabang';

  return (
    <div>
      <h1 className="text-3xl font-bold mb-8 print:hidden">Point of Sales</h1>
      <div className="print:hidden">
        <BranchPicker branches={myBranches} selectedBranchId={branchId} />
      </div>
      <PosClient
        services={services}
        branchId={branchId}
        cashierId={userId}
        cashierName={current.profile.full_name ?? 'Staff'}
        branchName={branchName}
      />
    </div>
  );
}
