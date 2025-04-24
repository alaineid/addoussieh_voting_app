import { create } from 'zustand';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export interface UserProfile {
  id: string;
  role: 'admin' | 'user';
  voters_list_access: 'none' | 'view' | 'edit';
  family_situation_access: 'none' | 'view' | 'edit';
  statistics_access: 'none' | 'view';
}

interface AuthState {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  setSession: (session: Session | null) => void;
  setProfile: (profile: UserProfile | null) => void;
  fetchProfile: (userId: string) => Promise<void>;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  user: null,
  profile: null,
  loading: true,
  setSession: (session: Session | null) => {
    set({ session, user: session?.user ?? null });
  },
  setProfile: (profile: UserProfile | null) => {
    set({ profile });
  },
  fetchProfile: async (userId: string) => {
    const session = get().session;
    const accessToken = session?.access_token;

    if (!supabaseUrl || !supabaseAnonKey || !accessToken) {
      console.error('[AuthStore Workaround] MANUAL fetch failed: Missing URL, Key, or Token.');
      set({ profile: null, loading: false });
      return;
    }

    const manualUrl = `${supabaseUrl}/rest/v1/avp_profiles?select=*&id=eq.${userId}&limit=1`;
    const manualHeaders = {
      'apikey': supabaseAnonKey,
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json',
      'X-Client-Info': 'supabase-js-manual-fetch-workaround'
    };

    try {
      const response = await fetch(manualUrl, { headers: manualHeaders });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[AuthStore Workaround] MANUAL fetch HTTP error ${response.status}:`, errorText);
        throw new Error(`HTTP error ${response.status}: ${errorText}`);
      }

      const responseData = await response.json() as UserProfile[];

      if (!responseData || responseData.length === 0) {
        set({ profile: null, loading: false });
      } else {
        set({ profile: responseData[0], loading: false });
      }

    } catch (manualError) {
      console.error('[AuthStore Workaround] MANUAL fetch failed:', manualError);
      set({ profile: null, loading: false });
    }
  },
  clearAuth: () => {
    set({ session: null, user: null, profile: null, loading: false });
  },
}));

export function initializeAuthListener() {
    useAuthStore.setState({ loading: true });

    const { data: authListener } = supabase.auth.onAuthStateChange(
        async (_event, session) => {
            const { setSession, fetchProfile, clearAuth } = useAuthStore.getState();

            useAuthStore.setState({ loading: true });

            setSession(session);

            if (session?.user) {
                await fetchProfile(session.user.id);
            } else {
                clearAuth();
            }
        }
    );

    return () => {
        authListener?.subscription.unsubscribe();
    };
}