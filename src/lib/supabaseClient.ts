import { createClient } from '@supabase/supabase-js';
import type { RealtimeChannel } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Supabase URL and Anon Key must be provided in environment variables.");
}

// Create the Supabase client with explicit auth and realtime configuration
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    storage: localStorage,
  },
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
});

// Enable realtime globally for the application
const setupGlobalRealtimeSubscription = (): RealtimeChannel => {
  // Create a system channel for keeping the realtime connection alive
  const systemChannel = supabase.channel('system');
  
  // Use broadcast for general custom events
  systemChannel
    .on('broadcast', { event: 'system_event' }, (payload: { type: string; [key: string]: any }) => {
      console.log('Supabase system event:', payload);
    });

  // Track channel status
  systemChannel.subscribe((status) => {
    console.log(`Supabase realtime system channel status: ${status}`);
    
    if (status === 'SUBSCRIBED') {
      console.log('Supabase realtime connected');
    }
  });

  return systemChannel;
};

// Initialize the global realtime subscription
export const realtimeSystem = setupGlobalRealtimeSubscription();