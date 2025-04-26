import { create } from 'zustand';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const AUTH_LOADING_TIMEOUT = 15000;

export interface UserProfile {
  id: string;
  name?: string;
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
  profileLoading: boolean;
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
  profileLoading: false,
  setSession: (session: Session | null) => {
    set({ session, user: session?.user ?? null });
  },
  setProfile: (profile: UserProfile | null) => {
    set({ profile, profileLoading: false });
  },
  fetchProfile: async (userId: string) => {
    const session = get().session;
    const accessToken = session?.access_token;
    
    set({ profileLoading: true });

    if (!supabaseUrl || !supabaseAnonKey) {
      set({ profile: null, loading: false, profileLoading: false });
      return;
    }

    if (!accessToken) {
      set({ profile: null, loading: false, profileLoading: false });
      return;
    }

    try {
      const fetchPromise = supabase
        .from('avp_profiles')
        .select('*')
        .eq('id', userId)
        .single();
      
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Profile fetch timeout')), 8000);
      });
      
      const { data: profile, error } = await Promise.race([
        fetchPromise,
        timeoutPromise.then(() => { 
          throw new Error('Profile fetch timed out');
        })
      ]) as any;

      if (error) {
        throw error;
      }

      if (!profile) {
        set({ profile: null, loading: false, profileLoading: false });
      } else {
        set({ profile, loading: false, profileLoading: false });
      }
    } catch (error) {
      set({ profile: null, loading: false, profileLoading: false });
      
      if (typeof error === 'object' && error !== null && 'status' in error) {
        if ((error as any).status === 401) {
          try {
            const { data, error: refreshError } = await supabase.auth.refreshSession();
            if (refreshError) {
              get().clearAuth();
            } else if (data.session) {
              get().setSession(data.session);
              get().fetchProfile(data.session.user.id);
            } else {
              get().clearAuth();
            }
          } catch (refreshError) {
            get().clearAuth();
          }
        }
      }
    }
  },
  clearAuth: () => {
    set({ session: null, user: null, profile: null, loading: false, profileLoading: false });
  },
}));

export function initializeAuthListener() {
    useAuthStore.setState({ loading: true });

    const timeoutId = setTimeout(() => {
        useAuthStore.setState({ loading: false });
    }, AUTH_LOADING_TIMEOUT);

    supabase.auth.getSession().then(({ data: { session } }) => {
        const { setSession, fetchProfile } = useAuthStore.getState();

        if (session) {
            setSession(session);
            fetchProfile(session.user.id).catch(() => {
                useAuthStore.setState({ loading: false, profileLoading: false });
            });
        } else {
            useAuthStore.setState({ loading: false, profileLoading: false });
        }

        setTimeout(() => clearTimeout(timeoutId), 1000);
    }).catch(() => {
        useAuthStore.setState({ loading: false, profileLoading: false });
        clearTimeout(timeoutId);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange(
        async (event, session) => {
            const { setSession, fetchProfile, clearAuth } = useAuthStore.getState();

            try {
                // Only update state if the session has actually changed
                const currentSession = useAuthStore.getState().session;
                if (currentSession?.user?.id === session?.user?.id) {
                    return;
                }

                useAuthStore.setState({ loading: true });

                if (session?.user) {
                    setSession(session);
                    fetchProfile(session.user.id).catch(() => {
                        useAuthStore.setState({ loading: false });
                    });
                } else {
                    clearAuth();
                }
            } catch {
                useAuthStore.setState({ loading: false });
            }
        }
    );

    return () => {
        authListener?.subscription.unsubscribe();
    };
}