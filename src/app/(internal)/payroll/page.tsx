import { getManagedContext } from '@/lib/supabase/managed-branches';
import { ManagedBranchEmpty } from '../managed-branch-empty';
import PayrollClient from './payroll-client';
import KasbonApprovals from './kasbon-approvals';

export default async function PayrollPage() {
  const { current, branches, needsTenantSelection } = await getManagedContext();

  if (!current) {
    return (
      <div>
        <h1 className="text-3xl font-bold mb-8">Payroll Kapster</h1>
        <div className="glass-panel p-6 rounded-2xl text-gray-400">
          Anda harus login untuk mengakses halaman ini.
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-2">Payroll Kapster</h1>
      <p className="text-gray-400 mb-8">
        Hitung komisi kapster per periode, potong kasbon yang sudah disetujui, lalu catat pembayarannya.
      </p>
      {branches.length === 0 ? (
        <ManagedBranchEmpty needsTenantSelection={needsTenantSelection} />
      ) : (
        <>
          <KasbonApprovals branches={branches} approverId={current.userId} />
          <PayrollClient branches={branches} ownerId={current.userId} />
        </>
      )}
    </div>
  );
}
