import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import {handleClosure} from './handler.mjs';
Deno.serve(req=>handleClosure(req,{createClient,url:Deno.env.get('SUPABASE_URL')!,anonKey:Deno.env.get('SUPABASE_ANON_KEY')!,serviceKey:Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!}));
