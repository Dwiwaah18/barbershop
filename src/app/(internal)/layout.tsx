import Link from 'next/link';
import { LayoutDashboard, Users, ShoppingCart, Clock, ClipboardCheck, Scissors, Wallet, UserCog, Scroll, DollarSign, ArrowLeft, FileBarChart, PiggyBank, ClipboardList, Building2, MapPin } from 'lucide-react';
import { getCurrentProfile } from '@/lib/supabase/current-profile';
import { createClient } from '@/lib/supabase/server';

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
  const isBarber = role === 'barber';
  const isSuperadmin = role === 'superadmin';
  const homeHref = isOwner ? '/dashboard' : isCashier ? '/queue' : isBarber ? '/attendance' : '/';

  let tenantName: string | null = null;
  if (current) {
    const supabase = await createClient();
    const { data: tenantId } = await supabase.rpc('current_tenant_id');
    if (tenantId) {
      const { data: tenant } = await supabase
        .from('tenants')
        .select('name')
        .eq('id', tenantId)
        .single();
      tenantName = tenant?.name ?? null;
    }
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-950 text-slate-50">
      {/* Sidebar */}
      <aside className="w-64 glass border-r border-[var(--border)] flex flex-col print:hidden">
        <Link href={homeHref} className="h-16 flex items-center px-6 border-b border-[var(--border)] shrink-0 hover:bg-white/5 transition-colors">
          <Scissors className="h-6 w-6 text-primary mr-2" />
          <span className="font-bold text-lg">System<span className="text-primary">POS</span></span>
        </Link>

        <div className="px-6 py-2.5 border-b border-[var(--border)] shrink-0 bg-white/5">
          <p className="text-[10px] text-gray-500 uppercase tracking-wider">Barbershop Aktif</p>
          <p className="text-sm font-semibold text-primary truncate">
            {tenantName ?? (isSuperadmin ? 'Superadmin (tanpa tenant)' : 'Belum terdaftar di tenant')}
          </p>
        </div>

        <nav className="flex-1 py-6 px-3 space-y-2 overflow-y-auto">
          {isBarber && (
            <>
              <div className="pb-2">
                <p className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Kapster Dashboard</p>
              </div>
              <Link href="/attendance" className="flex items-center px-3 py-3 rounded-lg hover:bg-primary/10 hover:text-primary transition-colors text-gray-400">
                <Clock className="h-5 w-5 mr-3" />
                Staff Attendance
              </Link>
              <Link href="/queue" className="flex items-center px-3 py-3 rounded-lg hover:bg-primary/10 hover:text-primary transition-colors text-gray-400">
                <Users className="h-5 w-5 mr-3" />
                Queue Management
              </Link>
              <Link href="/my-report" className="flex items-center px-3 py-3 rounded-lg hover:bg-primary/10 hover:text-primary transition-colors text-gray-400">
                <FileBarChart className="h-5 w-5 mr-3" />
                Laporan Saya
              </Link>
              <Link href="/my-payroll" className="flex items-center px-3 py-3 rounded-lg hover:bg-primary/10 hover:text-primary transition-colors text-gray-400">
                <DollarSign className="h-5 w-5 mr-3" />
                Payroll
              </Link>
            </>
          )}

          {isCashier && (
            <>
              <Link href="/queue" className="flex items-center px-3 py-3 rounded-lg hover:bg-primary/10 hover:text-primary transition-colors text-gray-400">
                <Users className="h-5 w-5 mr-3" />
                Queue Management
              </Link>
              <Link href="/pos" className="flex items-center px-3 py-3 rounded-lg hover:bg-primary/10 hover:text-primary transition-colors text-gray-400">
                <ShoppingCart className="h-5 w-5 mr-3" />
                Point of Sales
              </Link>
              <Link href="/shift" className="flex items-center px-3 py-3 rounded-lg hover:bg-primary/10 hover:text-primary transition-colors text-gray-400">
                <ClipboardCheck className="h-5 w-5 mr-3" />
                Shift & Petty Cash
              </Link>
              <Link href="/attendance" className="flex items-center px-3 py-3 rounded-lg hover:bg-primary/10 hover:text-primary transition-colors text-gray-400">
                <Clock className="h-5 w-5 mr-3" />
                Staff Attendance
              </Link>
              <Link href="/topups" className="flex items-center px-3 py-3 rounded-lg hover:bg-primary/10 hover:text-primary transition-colors text-gray-400">
                <Wallet className="h-5 w-5 mr-3" />
                Verifikasi Top-up
              </Link>
            </>
          )}

          {isOwner && (
            <>
              <div className="pt-8 pb-2">
                <p className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Owner Dashboard</p>
              </div>
              <Link href="/dashboard" className="flex items-center px-3 py-3 rounded-lg hover:bg-primary/10 hover:text-primary transition-colors text-gray-400">
                <LayoutDashboard className="h-5 w-5 mr-3" />
                Analytics
              </Link>
              <Link href="/outlets" className="flex items-center px-3 py-3 rounded-lg hover:bg-primary/10 hover:text-primary transition-colors text-gray-400">
                <MapPin className="h-5 w-5 mr-3" />
                Kelola Cabang
              </Link>
              <Link href="/payroll" className="flex items-center px-3 py-3 rounded-lg hover:bg-primary/10 hover:text-primary transition-colors text-gray-400">
                <DollarSign className="h-5 w-5 mr-3" />
                Payroll
              </Link>
              <Link href="/staff" className="flex items-center px-3 py-3 rounded-lg hover:bg-primary/10 hover:text-primary transition-colors text-gray-400">
                <UserCog className="h-5 w-5 mr-3" />
                Staff Management
              </Link>
              <Link href="/services" className="flex items-center px-3 py-3 rounded-lg hover:bg-primary/10 hover:text-primary transition-colors text-gray-400">
                <Scroll className="h-5 w-5 mr-3" />
                Kelola Layanan
              </Link>
              <Link href="/finance-report" className="flex items-center px-3 py-3 rounded-lg hover:bg-primary/10 hover:text-primary transition-colors text-gray-400">
                <PiggyBank className="h-5 w-5 mr-3" />
                Laporan Keuangan
              </Link>
              <Link href="/shift-report" className="flex items-center px-3 py-3 rounded-lg hover:bg-primary/10 hover:text-primary transition-colors text-gray-400">
                <ClipboardCheck className="h-5 w-5 mr-3" />
                Laporan Tutup Shift
              </Link>
              <Link href="/attendance-report" className="flex items-center px-3 py-3 rounded-lg hover:bg-primary/10 hover:text-primary transition-colors text-gray-400">
                <ClipboardList className="h-5 w-5 mr-3" />
                Laporan Absensi
              </Link>
              <Link href="/wallet-report" className="flex items-center px-3 py-3 rounded-lg hover:bg-primary/10 hover:text-primary transition-colors text-gray-400">
                <Wallet className="h-5 w-5 mr-3" />
                Laporan Share Wallet
              </Link>
            </>
          )}

          {isSuperadmin && (
            <>
              <div className="pt-8 pb-2">
                <p className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Superadmin</p>
              </div>
              <Link href="/tenants" className="flex items-center px-3 py-3 rounded-lg hover:bg-primary/10 hover:text-primary transition-colors text-gray-400">
                <Building2 className="h-5 w-5 mr-3" />
                Kelola Barbershop
              </Link>
            </>
          )}
        </nav>

        <div className="px-3 pb-3 shrink-0">
          <Link
            href="/"
            className="flex items-center px-3 py-2.5 rounded-lg hover:bg-white/5 transition-colors text-gray-500 hover:text-gray-300 text-sm"
          >
            <ArrowLeft className="h-4 w-4 mr-2.5" />
            Kembali ke Situs
          </Link>
        </div>

        <div className="p-4 border-t border-[var(--border)] shrink-0">
          <div className="flex items-center">
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center font-bold text-primary mr-3">{initial}</div>
            <div className="text-sm">
              <p className="font-medium text-white">{displayName}</p>
              <p className="text-xs text-gray-400">{roleText}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto bg-slate-900/50">
        <div className="p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
