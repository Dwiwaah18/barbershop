import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getTenantBySlug } from '@/lib/supabase/tenant';

export default async function TenantLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();
  const tenant = await getTenantBySlug(supabase, slug);

  if (!tenant) notFound();

  return children;
}
