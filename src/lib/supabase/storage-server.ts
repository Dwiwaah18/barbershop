import { createClient } from '@/lib/supabase/server';

const BUCKET = 'uploads';

export async function getSignedImageUrl(path: string | null, expiresIn = 3600): Promise<string | null> {
  if (!path) return null;
  const supabase = await createClient();
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, expiresIn);
  return data?.signedUrl ?? null;
}
