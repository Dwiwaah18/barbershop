import { createClient } from '@/lib/supabase/server';
import type { Branch, Service } from '@/lib/supabase/types';
import BookingForm, { type BarberOption } from './booking-form';
import BranchPicker from './branch-picker';

// Shared by the bare /booking route (default tenant, kept for backward-compat URLs) and
// /toko/{slug}/booking (any other tenant) — same rendering, only which tenant's branches are in
// scope differs.
export async function BookingPageContent({
  tenantId,
  branchParam,
  basePath,
}: {
  tenantId: string;
  branchParam?: string;
  basePath: string;
}) {
  const supabase = await createClient();

  let branch: Branch | null = null;

  if (branchParam) {
    const { data } = await supabase
      .from('branches')
      .select('*')
      .eq('id', branchParam)
      .eq('tenant_id', tenantId)
      .maybeSingle();
    branch = data as Branch | null;
  }

  if (!branch) {
    const { data } = await supabase
      .from('branches')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('name')
      .limit(1)
      .maybeSingle();
    branch = data as Branch | null;
  }

  if (!branch) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 w-full">
        <h1 className="text-4xl font-bold mb-2">Book Appointment</h1>
        <p className="text-gray-400 mb-8">Walk-ins and Reservations</p>
        <div className="glass-panel rounded-2xl py-16 px-6 text-center text-gray-400">
          Belum ada cabang terdaftar.
        </div>
      </div>
    );
  }

  const [{ data: servicesData }, { data: barbersData }, { data: allBranchesData }] = await Promise.all([
    supabase.from('services').select('*').eq('branch_id', branch.id).order('name'),
    // Roster tetap kapster cabang ini (bukan cuma yang lagi clock-in) — lihat public_branch_barbers
    // di supabase_schema.sql. is_clocked_in menandai siapa yang aktif sekarang untuk badge status.
    supabase
      .from('public_branch_barbers')
      .select('id, full_name, barber_status, is_clocked_in')
      .eq('branch_id', branch.id)
      .order('full_name'),
    supabase.from('branches').select('id, name').eq('tenant_id', tenantId).order('name'),
  ]);

  const services = (servicesData ?? []) as Service[];
  const mainServices = services.filter((s) => !s.is_addon);
  const addons = services.filter((s) => s.is_addon);
  const barbers = (barbersData ?? []) as BarberOption[];
  const allBranches = (allBranchesData ?? []) as { id: string; name: string }[];

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 w-full">
      <h1 className="text-4xl font-bold mb-2">Book Appointment</h1>
      <p className="text-gray-400 mb-6">{branch.name} Branch &bull; Walk-ins and Reservations</p>

      <BranchPicker branches={allBranches} selectedBranchId={branch.id} basePath={basePath} />

      <BookingForm
        branchId={branch.id}
        mainServices={mainServices}
        addons={addons}
        barbers={barbers}
        basePath={basePath}
      />
    </div>
  );
}
