import Link from 'next/link';
import { LayoutDashboard, Users, Users2, ShoppingCart, Clock, ClipboardCheck, Scissors, Wallet, UserCog, Scroll, DollarSign, ArrowLeft, FileBarChart, PiggyBank, ClipboardList, Building2, MapPin } from 'lucide-react';
import { cookies } from 'next/headers';
import { getCurrentProfile } from '@/lib/supabase/current-profile';
import { createClient } from '@/lib/supabase/server';
import { MANAGE_TENANT_COOKIE } from '@/lib/manage-tenant';
import SuperadminTenantSwitcher from './superadmin-tenant-switcher';
import InternalLayoutClient from './internal-layout-client';

const roleLabel: Record<string, string> = {
  cashier: 'Cashier Role',
  barber: 'Barber Role',
  owner: 'Owner',
  superadmin: 'Super Admin',
  customer: 'Customer',
};

export default async function InternalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const current = await getCurrentProfile();
  const role = current?.profile.role;
  const displayName = current?.profile.full_name ?? 'Staff';
  const initial = displayName.charAt(0).toUpperCase();
  const roleText = role ? roleLabel[role] ?? role : '';

  const isOwner = role === 'owner' || role === 'superadmin';
  const isCashier = role === 'cashier' || isOwner;
  const isBarber = role === 'barber' || current?.profile.is_working_barber === true;
  const isSuperadmin = role === 'superadmin';
  const homeHref = isOwner ? '/dashboard' : isCashier ? '/queue' : isBarber ? '/attendance' : '/';

  let tenantName: string | null = null;
  let brandName: string | null = null;
  let brandLogoUrl: string | null = null;
  let superadminTenants: { id: string; name: string }[] = [];
  let managedTenantId: string | null = null;

  if (current) {
    const supabase = await createClient();
    if (isSuperadmin) {
      // Superadmin memilih barbershop yang dikelola lewat switcher (cookie), bukan tenant miliknya.
      const cookieStore = await cookies();
      managedTenantId = cookieStore.get(MANAGE_TENANT_COOKIE)?.value ?? null;

      const { data: tenantsData } = await supabase
        .from('tenants')
        .select('id, name')
        .order('name', { ascending: true });

      superadminTenants = (tenantsData as { id: string; name: string }[] | null) ?? [];
      tenantName = superadminTenants.find((t) => t.id === managedTenantId)?.name ?? null;

      if (managedTenantId) {
        // PERBAIKAN: Ubah app_name menjadi branding_name agar sesuai dengan schema Supabase
        const { data: brandTenant } = await supabase
          .from('tenants')
          .select('branding_name, logo_url')
          .eq('id', managedTenantId)
          .single();

        const bt = brandTenant as { branding_name: string | null; logo_url: string | null } | null;
        brandName = bt?.branding_name ?? tenantName;
        brandLogoUrl = bt?.logo_url ?? null;
      }
    } else {
      const { data: tenantId } = await supabase.rpc('current_tenant_id');
      if (tenantId) {
        // PERBAIKAN: Ubah app_name menjadi branding_name agar sesuai dengan schema Supabase
        const { data: tenant } = await supabase
          .from('tenants')
          .select('name, branding_name, logo_url')
          .eq('id', tenantId)
          .single();

        const t = tenant as { name: string; branding_name: string | null; logo_url: string | null } | null;
        tenantName = t?.name ?? null;
        brandName = t?.branding_name ?? tenantName;
        brandLogoUrl = t?.logo_url ?? null;
      }
    }
  }

  return (
    <InternalLayoutClient
      role={role}
      displayName={displayName}
      initial={initial}
      isOwner={isOwner}
      isCashier={isCashier}
      isBarber={isBarber}
      isSuperadmin={isSuperadmin}
      homeHref={homeHref}
      tenantName={tenantName}
      superadminTenants={superadminTenants}
      managedTenantId={managedTenantId}
      brandName={brandName}
      brandLogoUrl={brandLogoUrl}
    >
      {children}
    </InternalLayoutClient>
  );
}