import { createClient } from '@supabase/supabase-js';
import { SERVER_ENV } from './env';

// Create a single supabase client for interacting with your database
// strictly on the server-side with the service role key.
// NEVER expose this client to the client-side.
export const supabaseAdmin = createClient(
  SERVER_ENV.SUPABASE_URL,
  SERVER_ENV.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);
