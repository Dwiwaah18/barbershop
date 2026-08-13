import type { SupabaseClient } from '@supabase/supabase-js';

// The original single-tenant deployment lives at the bare paths (/, /booking, /branches) for
// backward compatibility — existing bookmarks/QR codes at physical outlets keep working. New
// tenant clients get their own /toko/{slug} link instead; there is no public tenant directory.
export const DEFAULT_TENANT_SLUG = 'system-barbershop';

export type TenantSummary = { id: string; slug: string; name: string };

export async function getTenantBySlug(supabase: SupabaseClient, slug: string): Promise<TenantSummary | null> {
  const { data } = await supabase
    .from('tenants')
    .select('id, slug, name')
    .eq('slug', slug)
    .eq('status', 'active')
    .maybeSingle();
  return (data as TenantSummary | null) ?? null;
}
