import { createClient } from '@supabase/supabase-js';
import type { RealtimeChannel } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Supabase URL and Anon Key must be provided in environment variables.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    storage: localStorage,
  },
  realtime: {
    params: {
      eventsPerSecond: 40, // Increased from 10 to 40 for faster updates
      fastlaneOnly: false // Allow all events to use the fast lane
    }
  }
});

const setupGlobalRealtimeSubscription = (): RealtimeChannel => {
  const systemChannel = supabase.channel('system');
  
  systemChannel
    .on('broadcast', { event: 'system_event' }, (payload: { type: string; [key: string]: any }) => {
    });

  systemChannel.subscribe((status) => {
    if (status === 'SUBSCRIBED') {
    }
  });

  return systemChannel;
};

export const realtimeSystem = setupGlobalRealtimeSubscription();