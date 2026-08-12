import { createClient } from '@/lib/supabase/server';
import { getCurrentProfile } from '@/lib/supabase/current-profile';
import { getMyStaffBranches } from '@/lib/supabase/staff-branches';
import type { Booking } from '@/lib/supabase/types';
import WalkinCheckin from './walkin-checkin';
import QueueBoard from './queue-board';
import BranchPicker from './branch-picker';

export type BookingWithItems = Booking & { booking_items: { service_name: string }[] };
export type UpcomingBooking = BookingWithItems & { barber: { full_name: string | null } | null };
export type BarberOption = { id: string; full_name: string | null };
export type ServiceOption = { id: string; name: string; price: number };

export default async function QueueManagementPage({
  searchParams,
}: {
  searchParams: Promise<{ branch?: string }>;
}) {
  const current = await getCurrentProfile();
  const staffBranches = current ? await getMyStaffBranches() : [];

  if (!current || staffBranches.length === 0) {
    return (
      <div>
        <h1 className="text-3xl font-bold mb-8">Queue Management</h1>
        <div className="glass-panel p-6 rounded-2xl text-gray-400">
          Akun ini belum terhubung ke cabang manapun. Hubungi owner untuk mengatur cabang Anda.
        </div>
      </div>
    );
  }

  const { branch: branchParam } = await searchParams;
  const branchId =
    branchParam && staffBranches.some((b) => b.id === branchParam)
      ? branchParam
      : staffBranches[0].id;

  const supabase = await createClient();

  const now = new Date();
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [branchRes, waitingRes, upcomingRes, inProgressRes, completedRes, barbersRes, servicesRes] = await Promise.all([
    supabase.from('branches').select('name').eq('id', branchId).single(),
    supabase
      .from('bookings')
      .select('*, booking_items(service_name)')
      .eq('branch_id', branchId)
      .in('status', ['pending', 'approved'])
      // Online bookings can now be scheduled ahead — only show ones whose time has arrived,
      // so a booking for next week doesn't show as "waiting" in today's live queue.
      .lte('scheduled_at', now.toISOString())
      .order('scheduled_at', { ascending: true }),
    supabase
      .from('bookings')
      .select('*, booking_items(service_name), barber:barber_id(full_name)')
      .eq('branch_id', branchId)
      .in('status', ['pending', 'approved'])
      .gt('scheduled_at', now.toISOString())
      .order('scheduled_at', { ascending: true })
      .limit(20),
    supabase
      .from('bookings')
      .select('*, booking_items(service_name)')
      .eq('branch_id', branchId)
      .eq('status', 'confirmed')
      .order('started_at', { ascending: true }),
    supabase
      .from('bookings')
      .select('*, booking_items(service_name)')
      .eq('branch_id', branchId)
      .eq('status', 'completed')
      .gte('completed_at', startOfToday.toISOString())
      .order('completed_at', { ascending: false }),
    supabase
      .from('profiles')
      .select('id, full_name')
      .eq('branch_id', branchId)
      .eq('role', 'barber')
      .order('full_name', { ascending: true }),
    supabase
      .from('services')
      .select('id, name, price')
      .eq('branch_id', branchId)
      .eq('is_addon', false)
      .order('name', { ascending: true }),
  ]);

  const branchName = branchRes.data?.name ?? 'Cabang';
  const waiting = (waitingRes.data ?? []) as BookingWithItems[];
  const upcoming = (upcomingRes.data ?? []) as unknown as UpcomingBooking[];
  const inProgress = (inProgressRes.data ?? []) as BookingWithItems[];
  const completedAll = (completedRes.data ?? []) as BookingWithItems[];
  const barbers = (barbersRes.data ?? []) as BarberOption[];
  const services = (servicesRes.data ?? []) as ServiceOption[];

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">Queue Management</h1>
          <p className="text-gray-400">{branchName} Branch - Live Sync</p>
        </div>
        <WalkinCheckin branchId={branchId} services={services} />
      </div>

      <BranchPicker branches={staffBranches} selectedBranchId={branchId} />

      <QueueBoard
        waiting={waiting}
        upcoming={upcoming}
        inProgress={inProgress}
        completed={completedAll.slice(0, 10)}
        completedCount={completedAll.length}
        barbers={barbers}
      />
    </div>
  );
}
