'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Users, Users2, ShoppingCart, Clock, ClipboardCheck,
  Scissors, Wallet, UserCog, Scroll, DollarSign, ArrowLeft, FileBarChart,
  PiggyBank, ClipboardList, Building2, MapPin, Menu, X
} from 'lucide-react';
import SuperadminTenantSwitcher from './superadmin-tenant-switcher';

const roleLabel: Record<string, string> = {
  cashier: 'Cashier Role',
  barber: 'Barber Role',
  owner: 'Owner',
  superadmin: 'Super Admin',
  customer: 'Customer',
};

interface InternalLayoutClientProps {
  children: React.ReactNode;
  role: string | undefined;
  displayName: string;
  initial: string;
  isOwner: boolean;
  isCashier: boolean;
  isBarber: boolean;
  isSuperadmin: boolean;
  homeHref: string;
  tenantName: string | null;
  superadminTenants: { id: string; name: string }[];
  managedTenantId: string | null;
  brandName: string | null;
  brandLogoUrl: string | null;
}

export default function InternalLayoutClient({
  children,
  role,
  displayName,
  initial,
  isOwner,
  isCashier,
  isBarber,
  isSuperadmin,
  homeHref,
  tenantName,
  superadminTenants,
  managedTenantId,
  brandName,
  brandLogoUrl,
}: InternalLayoutClientProps) {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const pathname = usePathname();
  const roleText = role ? roleLabel[role] ?? role : '';
  const displayBrandName = brandName ?? 'SystemPOS';

  // Tutup sidebar jika route berubah (saat klik link di mobile)
  useEffect(() => {
    setIsMobileOpen(false);
  }, [pathname]);

  return (
    <div className="flex h-screen overflow-hidden bg-slate-950 text-slate-50 relative">

      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 md:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 glass border-r border-[var(--border)] flex flex-col print:hidden
        transform transition-transform duration-300 ease-in-out
        md:relative md:translate-x-0
        ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="h-16 flex items-center justify-between px-6 border-b border-[var(--border)] shrink-0 bg-black/20">
          <Link href={homeHref} className="flex items-center hover:opacity-80 transition-opacity min-w-0">
            {brandLogoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={brandLogoUrl} alt={displayBrandName} className="h-6 w-6 mr-2 object-contain shrink-0" />
            ) : (
              <Scissors className="h-6 w-6 text-primary mr-2 shrink-0" />
            )}
            <span className="font-bold text-lg truncate">{displayBrandName}</span>
          </Link>
          <button
            className="md:hidden p-1 text-gray-400 hover:text-white"
            onClick={() => setIsMobileOpen(false)}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-6 py-2.5 border-b border-[var(--border)] shrink-0 bg-white/5">
          <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">
            {isSuperadmin ? 'Kelola Barbershop' : 'Barbershop Aktif'}
          </p>
          {isSuperadmin ? (
            <SuperadminTenantSwitcher tenants={superadminTenants} selectedId={managedTenantId} />
          ) : (
            <p className="text-sm font-semibold text-primary truncate">
              {tenantName ?? 'Belum terdaftar di tenant'}
            </p>
          )}
        </div>

        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          {isBarber && (
            <>
              <div className="pt-2 pb-1">
                <p className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Kapster Dashboard</p>
              </div>
              <Link href="/attendance" className={`flex items-center px-3 py-2.5 rounded-lg transition-colors ${pathname === '/attendance' ? 'bg-primary/20 text-primary' : 'hover:bg-primary/10 hover:text-primary text-gray-400'}`}>
                <Clock className="h-5 w-5 mr-3" />
                Staff Attendance
              </Link>
              <Link href="/queue" className={`flex items-center px-3 py-2.5 rounded-lg transition-colors ${pathname === '/queue' ? 'bg-primary/20 text-primary' : 'hover:bg-primary/10 hover:text-primary text-gray-400'}`}>
                <Users className="h-5 w-5 mr-3" />
                Queue Management
              </Link>
              <Link href="/my-report" className={`flex items-center px-3 py-2.5 rounded-lg transition-colors ${pathname === '/my-report' ? 'bg-primary/20 text-primary' : 'hover:bg-primary/10 hover:text-primary text-gray-400'}`}>
                <FileBarChart className="h-5 w-5 mr-3" />
                Laporan Saya
              </Link>
              <Link href="/my-payroll" className={`flex items-center px-3 py-2.5 rounded-lg transition-colors ${pathname === '/my-payroll' ? 'bg-primary/20 text-primary' : 'hover:bg-primary/10 hover:text-primary text-gray-400'}`}>
                <DollarSign className="h-5 w-5 mr-3" />
                Payroll
              </Link>
            </>
          )}

          {isCashier && (
            <>
              <div className="pt-4 pb-1">
                <p className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Cashier Area</p>
              </div>
              <Link href="/queue" className={`flex items-center px-3 py-2.5 rounded-lg transition-colors ${pathname === '/queue' ? 'bg-primary/20 text-primary' : 'hover:bg-primary/10 hover:text-primary text-gray-400'}`}>
                <Users className="h-5 w-5 mr-3" />
                Queue Management
              </Link>
              <Link href="/pos" className={`flex items-center px-3 py-2.5 rounded-lg transition-colors ${pathname === '/pos' ? 'bg-primary/20 text-primary' : 'hover:bg-primary/10 hover:text-primary text-gray-400'}`}>
                <ShoppingCart className="h-5 w-5 mr-3" />
                Point of Sales
              </Link>
              <Link href="/shift" className={`flex items-center px-3 py-2.5 rounded-lg transition-colors ${pathname === '/shift' ? 'bg-primary/20 text-primary' : 'hover:bg-primary/10 hover:text-primary text-gray-400'}`}>
                <ClipboardCheck className="h-5 w-5 mr-3" />
                Shift & Petty Cash
              </Link>
              <Link href="/attendance" className={`flex items-center px-3 py-2.5 rounded-lg transition-colors ${pathname === '/attendance' ? 'bg-primary/20 text-primary' : 'hover:bg-primary/10 hover:text-primary text-gray-400'}`}>
                <Clock className="h-5 w-5 mr-3" />
                Staff Attendance
              </Link>
              <Link href="/topups" className={`flex items-center px-3 py-2.5 rounded-lg transition-colors ${pathname === '/topups' ? 'bg-primary/20 text-primary' : 'hover:bg-primary/10 hover:text-primary text-gray-400'}`}>
                <Wallet className="h-5 w-5 mr-3" />
                Verifikasi Top-up
              </Link>
              <Link href="/families" className={`flex items-center px-3 py-2.5 rounded-lg transition-colors ${pathname === '/families' ? 'bg-primary/20 text-primary' : 'hover:bg-primary/10 hover:text-primary text-gray-400'}`}>
                <Users2 className="h-5 w-5 mr-3" />
                Kelola Keluarga
              </Link>
            </>
          )}

          {isOwner && (
            <>
              <div className="pt-4 pb-1">
                <p className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Owner Dashboard</p>
              </div>
              <Link href="/dashboard" className={`flex items-center px-3 py-2.5 rounded-lg transition-colors ${pathname === '/dashboard' ? 'bg-primary/20 text-primary' : 'hover:bg-primary/10 hover:text-primary text-gray-400'}`}>
                <LayoutDashboard className="h-5 w-5 mr-3" />
                Analytics
              </Link>
              <Link href="/outlets" className={`flex items-center px-3 py-2.5 rounded-lg transition-colors ${pathname === '/outlets' ? 'bg-primary/20 text-primary' : 'hover:bg-primary/10 hover:text-primary text-gray-400'}`}>
                <MapPin className="h-5 w-5 mr-3" />
                Kelola Cabang
              </Link>
              <Link href="/payroll" className={`flex items-center px-3 py-2.5 rounded-lg transition-colors ${pathname === '/payroll' ? 'bg-primary/20 text-primary' : 'hover:bg-primary/10 hover:text-primary text-gray-400'}`}>
                <DollarSign className="h-5 w-5 mr-3" />
                Payroll
              </Link>
              <Link href="/staff" className={`flex items-center px-3 py-2.5 rounded-lg transition-colors ${pathname === '/staff' ? 'bg-primary/20 text-primary' : 'hover:bg-primary/10 hover:text-primary text-gray-400'}`}>
                <UserCog className="h-5 w-5 mr-3" />
                Staff Management
              </Link>
              <Link href="/services" className={`flex items-center px-3 py-2.5 rounded-lg transition-colors ${pathname === '/services' ? 'bg-primary/20 text-primary' : 'hover:bg-primary/10 hover:text-primary text-gray-400'}`}>
                <Scroll className="h-5 w-5 mr-3" />
                Kelola Layanan
              </Link>
              <Link href="/finance-report" className={`flex items-center px-3 py-2.5 rounded-lg transition-colors ${pathname === '/finance-report' ? 'bg-primary/20 text-primary' : 'hover:bg-primary/10 hover:text-primary text-gray-400'}`}>
                <PiggyBank className="h-5 w-5 mr-3" />
                Laporan Keuangan
              </Link>
              <Link href="/shift-report" className={`flex items-center px-3 py-2.5 rounded-lg transition-colors ${pathname === '/shift-report' ? 'bg-primary/20 text-primary' : 'hover:bg-primary/10 hover:text-primary text-gray-400'}`}>
                <ClipboardCheck className="h-5 w-5 mr-3" />
                Laporan Tutup Shift
              </Link>
              <Link href="/attendance-report" className={`flex items-center px-3 py-2.5 rounded-lg transition-colors ${pathname === '/attendance-report' ? 'bg-primary/20 text-primary' : 'hover:bg-primary/10 hover:text-primary text-gray-400'}`}>
                <ClipboardList className="h-5 w-5 mr-3" />
                Laporan Absensi
              </Link>
              <Link href="/wallet-report" className={`flex items-center px-3 py-2.5 rounded-lg transition-colors ${pathname === '/wallet-report' ? 'bg-primary/20 text-primary' : 'hover:bg-primary/10 hover:text-primary text-gray-400'}`}>
                <Wallet className="h-5 w-5 mr-3" />
                Laporan Share Wallet
              </Link>
            </>
          )}

          {isSuperadmin && (
            <>
              <div className="pt-4 pb-1">
                <p className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Superadmin</p>
              </div>
              <Link href="/tenants" className={`flex items-center px-3 py-2.5 rounded-lg transition-colors ${pathname === '/tenants' ? 'bg-primary/20 text-primary' : 'hover:bg-primary/10 hover:text-primary text-gray-400'}`}>
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

        <div className="p-4 border-t border-[var(--border)] shrink-0 bg-black/20">
          <div className="flex items-center">
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center font-bold text-primary mr-3 shrink-0">{initial}</div>
            <div className="text-sm truncate">
              <p className="font-medium text-white truncate">{displayName}</p>
              <p className="text-xs text-gray-400 truncate">{roleText}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-slate-900/50">

        {/* Mobile Header */}
        <header className="md:hidden h-16 border-b border-[var(--border)] bg-slate-950/80 backdrop-blur-md flex items-center justify-between px-4 shrink-0 z-30">
          <div className="flex items-center min-w-0">
            {brandLogoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={brandLogoUrl} alt={displayBrandName} className="h-6 w-6 mr-2 object-contain shrink-0" />
            ) : (
              <Scissors className="h-6 w-6 text-primary mr-2 shrink-0" />
            )}
            <span className="font-bold text-lg truncate">{displayBrandName}</span>
          </div>
          <button
            onClick={() => setIsMobileOpen(true)}
            className="p-2 -mr-2 text-gray-400 hover:text-white transition-colors"
          >
            <Menu className="h-6 w-6" />
          </button>
        </header>

        {/* Scrollable Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-4 md:p-8">
            {children}
          </div>
        </main>
      </div>

    </div>
  );
}