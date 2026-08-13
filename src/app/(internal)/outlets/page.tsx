import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { getManagedContext } from '@/lib/supabase/managed-branches';
import { ManagedBranchEmpty } from '../managed-branch-empty';
import OutletsClient from './outlets-client';
import QrisSettings from './qris-settings';
import BrandingSettings from '../branding-settings';

export default async function OutletsPage() {
  const { current, branches, isSuperadmin, managedTenantId, needsTenantSelection } = await getManagedContext();

  if (!current) {
    return (
      <div>
        <h1 className="text-3xl font-bold mb-8">Kelola Cabang</h1>
        <div className="glass-panel p-6 rounded-2xl text-gray-400">
          Anda harus login untuk mengakses halaman ini.
        </div>
      </div>
    );
  }

  let qrisImageUrl: string | null = null;
  let tenantName: string | null = null;
  let tenantAppName: string | null = null;
  let tenantLogoUrl: string | null = null;
  if (managedTenantId) {
    const supabase = await createClient();
    const { data: tenant } = await supabase
      .from('tenants')
      .select('name, qris_image_url, app_name, logo_url')
      .eq('id', managedTenantId)
      .single();
    const t = tenant as { name: string; qris_image_url: string | null; app_name: string | null; logo_url: string | null } | null;
    qrisImageUrl = t?.qris_image_url ?? null;
    tenantName = t?.name ?? null;
    tenantAppName = t?.app_name ?? null;
    tenantLogoUrl = t?.logo_url ?? null;
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-2">Kelola Cabang</h1>
      <p className="text-gray-400 mb-8">
        {isSuperadmin
          ? 'Cabang milik barbershop yang sedang Anda kelola. Untuk menambah cabang baru, gunakan menu Kelola Barbershop.'
          : 'Tambah outlet baru untuk barbershop Anda sendiri, tanpa perlu lewat superadmin.'}
      </p>
      {managedTenantId && (
        <BrandingSettings
          tenantId={managedTenantId}
          currentAppName={tenantAppName}
          currentLogoUrl={tenantLogoUrl}
          fallbackName={tenantName ?? 'SystemPOS'}
        />
      )}
      {managedTenantId && <QrisSettings tenantId={managedTenantId} currentImageUrl={qrisImageUrl} />}
      {isSuperadmin && needsTenantSelection ? (
        <ManagedBranchEmpty needsTenantSelection />
      ) : isSuperadmin ? (
        <div className="glass-panel p-6 rounded-2xl">
          <div className="overflow-x-auto rounded-2xl border border-[var(--border)]">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 bg-white/5">
                  <th className="px-4 py-3 font-medium">Nama</th>
                  <th className="px-4 py-3 font-medium">Alamat</th>
                  <th className="px-4 py-3 font-medium">Skema Komisi</th>
                </tr>
              </thead>
              <tbody>
                {branches.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-6 text-center text-gray-500">
                      Barbershop ini belum punya cabang.
                    </td>
                  </tr>
                ) : (
                  branches.map((b) => (
                    <tr key={b.id} className="border-t border-[var(--border)]">
                      <td className="px-4 py-3 font-medium">{b.name}</td>
                      <td className="px-4 py-3 text-gray-400">{b.address ?? '-'}</td>
                      <td className="px-4 py-3 text-gray-400">{b.commission_type}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-500 mt-3">
            Tambah cabang baru di{' '}
            <Link href="/tenants" className="text-primary hover:underline">
              Kelola Barbershop
            </Link>
            .
          </p>
        </div>
      ) : (
        <OutletsClient branches={branches} />
      )}
    </div>
  );
}