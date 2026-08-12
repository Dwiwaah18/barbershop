import { Camera, Clock } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getCurrentProfile } from '@/lib/supabase/current-profile';
import { getMyStaffBranches } from '@/lib/supabase/staff-branches';
import type { Attendance, Branch } from '@/lib/supabase/types';
import { AttendanceActions } from './attendance-actions';
import { BarberStatusToggle } from './barber-status-toggle';

function formatTimeWIB(iso: string) {
  return new Date(iso).toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Jakarta',
  }) + ' WIB';
}

export default async function AttendancePage() {
  const current = await getCurrentProfile();
  const supabase = await createClient();

  let todaysAttendance: Attendance[] = [];
  let branchName: string | null = null;
  let branches: { id: string; name: string }[] = [];

  if (current) {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const { data } = await supabase
      .from('attendances')
      .select('*')
      .eq('profile_id', current.userId)
      .gte('clock_in_at', startOfToday.toISOString())
      .order('clock_in_at', { ascending: false });

    todaysAttendance = (data as Attendance[]) ?? [];
    branches = await getMyStaffBranches();
  }

  const latest = todaysAttendance[0] ?? null;
  const isClockedIn = latest?.status === 'clocked_in';

  if (isClockedIn && latest) {
    const { data: branch } = await supabase
      .from('branches')
      .select('*')
      .eq('id', latest.branch_id)
      .single();

    branchName = (branch as Branch | null)?.name ?? null;
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">Staff Attendance</h1>

      {current?.profile.role === 'barber' && (
        <BarberStatusToggle userId={current.userId} barberStatus={current.profile.barber_status} />
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="glass-panel p-8 rounded-3xl flex flex-col items-center justify-center text-center">
          <div className="w-32 h-32 rounded-full bg-primary/20 flex items-center justify-center mb-6">
            <Clock className="h-12 w-12 text-primary" />
          </div>
          <h2 className="text-2xl font-bold mb-2">
            {current?.profile.full_name ?? 'Staff'}
          </h2>
          {isClockedIn && (
            <p className="text-gray-400 mb-8">
              {branchName ?? 'No branch assigned'}
            </p>
          )}

          {current ? (
            <div className="w-full mt-6">
              <AttendanceActions
                userId={current.userId}
                branches={branches}
                isClockedIn={isClockedIn}
              />
            </div>
          ) : (
            <p className="text-sm text-gray-400">You must be logged in to clock in or out.</p>
          )}
        </div>

        <div className="glass-panel p-8 rounded-3xl">
          <h3 className="text-xl font-semibold mb-6 border-b border-[var(--border)] pb-4">Today's Activity</h3>
          {todaysAttendance.length === 0 ? (
            <p className="text-sm text-gray-400">Belum ada aktivitas absensi hari ini.</p>
          ) : (
            <div className="relative border-l border-[var(--border)] ml-3 space-y-8">
              {[...todaysAttendance].reverse().map((entry) => (
                <div key={entry.id}>
                  <div className="relative pl-6">
                    <div className="absolute left-[-5px] top-1 w-2.5 h-2.5 rounded-full bg-green-500 ring-4 ring-slate-900"></div>
                    <p className="font-bold">Clock In</p>
                    <p className="text-sm text-gray-400">{formatTimeWIB(entry.clock_in_at)}</p>
                    {entry.clock_in_lat !== null && entry.clock_in_lng !== null ? (
                      <p className="text-xs text-gray-500 mt-1">Lokasi tercatat</p>
                    ) : null}
                    {entry.clock_in_photo_url ? (
                      <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                        <Camera className="h-3 w-3" /> Foto tercatat
                      </p>
                    ) : null}
                  </div>
                  {entry.clock_out_at && (
                    <div className="relative pl-6 mt-8">
                      <div className="absolute left-[-5px] top-1 w-2.5 h-2.5 rounded-full bg-blue-500 ring-4 ring-slate-900"></div>
                      <p className="font-bold">Clock Out</p>
                      <p className="text-sm text-gray-400">{formatTimeWIB(entry.clock_out_at)}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
