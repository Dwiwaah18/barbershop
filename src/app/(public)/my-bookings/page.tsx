import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentProfile } from '@/lib/supabase/current-profile';
import MyBookingsClient from './my-bookings-client';

export type BookingWithDetails = {
  id: string;
  status: 'pending' | 'approved' | 'confirmed' | 'completed' | 'cancelled';
  scheduled_at: string;
  completed_at: string | null;
  total_price: number;
  branches: { name: string } | null;
  booking_items: { service_name: string; price: number }[];
};

export default async function MyBookingsPage() {
  const current = await getCurrentProfile();
  if (!current) redirect('/auth');

  const supabase = await createClient();

  const [{ data: upcomingData }, { data: historyData }] = await Promise.all([
    supabase
      .from('bookings')
      .select('id, status, scheduled_at, completed_at, total_price, branches(name), booking_items(service_name, price)')
      .eq('customer_id', current.userId)
      .in('status', ['pending', 'approved', 'confirmed'])
      .order('scheduled_at', { ascending: true }),
    supabase
      .from('bookings')
      .select('id, status, scheduled_at, completed_at, total_price, branches(name), booking_items(service_name, price)')
      .eq('customer_id', current.userId)
      .in('status', ['completed', 'cancelled'])
      .order('scheduled_at', { ascending: false })
      .limit(20),
  ]);

  const upcoming = (upcomingData as unknown as BookingWithDetails[] | null) ?? [];
  const history = (historyData as unknown as BookingWithDetails[] | null) ?? [];

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 w-full">
      <h1 className="text-4xl font-bold mb-2">My Bookings</h1>
      <p className="text-gray-400 mb-8">Jadwal booking kamu yang akan datang dan riwayatnya.</p>

      <MyBookingsClient upcoming={upcoming} history={history} />
    </div>
  );
}
