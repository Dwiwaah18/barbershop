import { createClient } from '@/lib/supabase/server';
import type { Profile } from '@/lib/supabase/types';

export async function getCurrentProfile(): Promise<{ userId: string; profile: Profile } | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
  if (!profile) return null;

  return { userId: user.id, profile: profile as Profile };
}
