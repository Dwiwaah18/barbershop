import { createClient } from '@/lib/supabase/server';
import { DEFAULT_TENANT_SLUG, getTenantBySlug } from '@/lib/supabase/tenant';
import { BookingPageContent } from './booking-page-content';

export default async function BookingPage({
  searchParams,
}: {
  searchParams: Promise<{ branch?: string }>;
}) {
  const { branch: branchParam } = await searchParams;
  const supabase = await createClient();
  const tenant = await getTenantBySlug(supabase, DEFAULT_TENANT_SLUG);

  if (!tenant) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 w-full">
        <h1 className="text-4xl font-bold mb-2">Book Appointment</h1>
        <div className="glass-panel rounded-2xl py-16 px-6 text-center text-gray-400">
          Belum ada cabang terdaftar.
        </div>
      </div>
    );
  }

  return <BookingPageContent tenantId={tenant.id} branchParam={branchParam} basePath="/booking" />;
}
