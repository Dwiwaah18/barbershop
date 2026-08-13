import { createClient } from '@/lib/supabase/client';

const BUCKET = 'uploads';

export async function uploadUserFile(userId: string, folder: string, file: File): Promise<string> {
  const supabase = createClient();
  const ext = file.name.split('.').pop() || 'jpg';
  const path = `${userId}/${folder}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false });
  if (error) throw error;
  return path;
}
