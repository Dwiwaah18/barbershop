const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
async function run() {
  const { data, error } = await supabase.from('branches').select('id, name, tenant_id, tenant:tenant_id(id, name)');
  console.log(JSON.stringify(data, null, 2));
}
run();
