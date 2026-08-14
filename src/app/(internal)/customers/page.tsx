import { createClient } from '@/lib/supabase/server';
import { getCurrentProfile } from '@/lib/supabase/current-profile';
import type { Profile } from '@/lib/supabase/types';
import StaffTable from '../staff/staff-table';
import TenantPicker from '../staff/tenant-picker';
import type { TenantOption } from '../staff/page';

export default async function CustomersPage({
    searchParams,
}: {
    searchParams: Promise<{ tenant?: string }>;
}) {
    const current = await getCurrentProfile();

    if (!current) {
        return (
            <div>
                <h1 className="text-3xl font-bold mb-8">Pelanggan</h1>
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

    // Halaman ini kebalikan dari Staff Management: cuma nampilin profile dengan role customer.
    // Customer yang belum terikat ke tenant manapun (tenant_id null) tetap kelihatan meski lagi
    // milih tenant tertentu, sama seperti perilaku lama di Staff Management.
    let profileQuery = supabase
        .from('profiles')
        .select('*')
        .eq('role', 'customer')
        .order('created_at', { ascending: false });
    if (isSuperadmin && tenantId) {
        profileQuery = profileQuery.or(`tenant_id.eq.${tenantId},tenant_id.is.null`);
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
            <h1 className="text-3xl font-bold mb-2">Pelanggan</h1>
            <p className="text-gray-400 mb-8">
                Cari pelanggan lalu jadikan kapster/kasir kalau perlu. Daftar ini cuma berisi akun dengan role
                Customer — staff yang sudah aktif ada di halaman Staff Management.
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