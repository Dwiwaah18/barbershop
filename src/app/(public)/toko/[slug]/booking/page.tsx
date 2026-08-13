import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getTenantBySlug } from '@/lib/supabase/tenant';
import { BookingPageContent } from '../../../booking/booking-page-content';

export default async function TenantBookingPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ branch?: string }>;
}) {
  const { slug } = await params;
  const { branch: branchParam } = await searchParams;
  const supabase = await createClient();
  const tenant = await getTenantBySlug(supabase, slug);
  if (!tenant) notFound();

  return <BookingPageContent tenantId={tenant.id} branchParam={branchParam} basePath={`/toko/${slug}/booking`} />;
}
