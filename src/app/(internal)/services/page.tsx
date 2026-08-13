import { getManagedContext } from '@/lib/supabase/managed-branches';
import { ManagedBranchEmpty } from '../managed-branch-empty';
import type { CommissionType } from '@/lib/supabase/types';
import ServicesManager from './services-manager';

export type BranchOption = {
  id: string;
  name: string;
  commission_type: CommissionType;
  commission_percent: number;
};

export default async function ServicesPage() {
  const { current, branches: managedBranches, needsTenantSelection } = await getManagedContext();

  if (!current) {
    return (
      <div>
        <h1 className="text-3xl font-bold mb-8">Kelola Layanan</h1>
        <div className="glass-panel p-6 rounded-2xl text-gray-400">
          Anda harus login untuk mengakses halaman ini.
        </div>
      </div>
    );
  }

  const branches: BranchOption[] = managedBranches.map((b) => ({
    id: b.id,
    name: b.name,
    commission_type: b.commission_type,
    commission_percent: b.commission_percent,
  }));

  return (
    <div>
      <h1 className="text-3xl font-bold mb-2">Kelola Layanan</h1>
      <p className="text-gray-400 mb-8">
        Tambah, ubah, atau hapus layanan utama dan add-on per cabang.
      </p>
      {branches.length === 0 ? (
        <ManagedBranchEmpty needsTenantSelection={needsTenantSelection} />
      ) : (
        <ServicesManager branches={branches} />
      )}
    </div>
  );
}
