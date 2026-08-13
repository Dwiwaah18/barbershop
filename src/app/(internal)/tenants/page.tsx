import { createClient } from '@/lib/supabase/server';
import { getCurrentProfile } from '@/lib/supabase/current-profile';
import TenantsClient from './tenants-client';

export type TenantRow = {
  id: string;
  slug: string;
  name: string;
  status: 'active' | 'suspended';
  created_at: string;
  owner_id: string;
  owner: { full_name: string | null; phone: string | null } | null;
  branches: { id: string; name: string }[];
  app_name: string | null;
  branding_name: string | null;
  logo_url: string | null;
};

export default async function TenantsPage() {
  const current = await getCurrentProfile();

  if (!current || current.profile.role !== 'superadmin') {
    return (
      <div>
        <h1 className="text-3xl font-bold mb-8">Kelola Barbershop</h1>
        <div className="glass-panel p-6 rounded-2xl text-gray-400">
          Halaman ini khusus superadmin.
        </div>
      </div>
    );
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from('tenants')
    .select('id, slug, name, status, created_at, owner_id, owner:owner_id(full_name, phone), branches(id, name), app_name, branding_name, logo_url')
    .order('created_at', { ascending: false });

  const tenants = (data as unknown as TenantRow[] | null) ?? [];

  return (
    <div>
      <h1 className="text-3xl font-bold mb-2">Kelola Barbershop</h1>
      <p className="text-gray-400 mb-8">
        Daftarkan barbershop (tenant) baru dan lihat semua klien yang sudah pakai sistem ini.
      </p>
      <TenantsClient tenants={tenants} />
    </div>
  );
}