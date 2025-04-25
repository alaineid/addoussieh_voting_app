import { create } from 'zustand';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Increase timeout for auth loading
const AUTH_LOADING_TIMEOUT = 15000; // 15 seconds

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
    console.log('Auth session set:', session ? 'session present' : 'no session');
    set({ session, user: session?.user ?? null });
  },
  setProfile: (profile: UserProfile | null) => {
    console.log('Profile set:', profile ? `role: ${profile.role}` : 'no profile');
    set({ profile, profileLoading: false });
  },
  fetchProfile: async (userId: string) => {
    const session = get().session;
    const accessToken = session?.access_token;
    console.log('Fetching profile for user:', userId);
    
    // Set profile loading state
    set({ profileLoading: true });

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('[AuthStore] Missing Supabase URL or Anon Key');
      set({ profile: null, loading: false, profileLoading: false });
      return;
    }

    if (!accessToken) {
      console.error('[AuthStore] Missing access token');
      set({ profile: null, loading: false, profileLoading: false });
      return;
    }

    try {
      // Use the supabase client directly with proper timeout handling
      const fetchPromise = supabase
        .from('avp_profiles')
        .select('*')
        .eq('id', userId)
        .single();
      
      // Create a timeout promise
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Profile fetch timeout')), 8000);
      });
      
      // Race the fetch against a timeout
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
        console.warn('[AuthStore] No profile found for user:', userId);
        set({ profile: null, loading: false, profileLoading: false });
      } else {
        console.log('[AuthStore] Profile loaded successfully:', profile.role);
        set({ profile, loading: false, profileLoading: false });
      }
    } catch (error) {
      console.error('[AuthStore] Error fetching profile:', error);
      set({ profile: null, loading: false, profileLoading: false });
      
      // Handle auth errors
      if (typeof error === 'object' && error !== null && 'status' in error) {
        if ((error as any).status === 401) {
          console.log('[AuthStore] Status 401 - Attempting to refresh session');
          // Attempt to refresh session
          try {
            const { data, error: refreshError } = await supabase.auth.refreshSession();
            if (refreshError) {
              console.error('[AuthStore] Failed to refresh session:', refreshError);
              get().clearAuth();
            } else if (data.session) {
              get().setSession(data.session);
              // Don't await this to prevent blocking
              get().fetchProfile(data.session.user.id);
            } else {
              console.error('[AuthStore] No session after refresh');
              get().clearAuth();
            }
          } catch (refreshError) {
            console.error('[AuthStore] Exception during session refresh:', refreshError);
            get().clearAuth();
          }
        }
      }
    }
  },
  clearAuth: () => {
    console.log('[AuthStore] Clearing auth state');
    set({ session: null, user: null, profile: null, loading: false, profileLoading: false });
  },
}));

export function initializeAuthListener() {
    console.log('[AuthStore] Initializing auth listener');
    useAuthStore.setState({ loading: true });
    
    // Safety timeout to prevent indefinite loading
    const timeoutId = setTimeout(() => {
        console.warn('[AuthStore] Authentication initialization timed out after', AUTH_LOADING_TIMEOUT, 'ms');
        useAuthStore.setState({ loading: false });
    }, AUTH_LOADING_TIMEOUT);

    // First, check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
        console.log('[AuthStore] Initial session check:', session ? 'session found' : 'no session');
        const { setSession, fetchProfile } = useAuthStore.getState();
        
        if (session) {
            setSession(session);
            // Don't await this to prevent blocking
            fetchProfile(session.user.id).catch(error => {
                console.error('[AuthStore] Error fetching initial profile:', error);
                useAuthStore.setState({ loading: false, profileLoading: false });
            });
        } else {
            useAuthStore.setState({ loading: false, profileLoading: false });
        }
        
        // Clear the timeout only after setting loading to false
        setTimeout(() => clearTimeout(timeoutId), 1000);
    }).catch(error => {
        console.error('[AuthStore] Error getting initial session:', error);
        useAuthStore.setState({ loading: false, profileLoading: false });
        clearTimeout(timeoutId);
    });

    // Then set up listener for auth state changes
    const { data: authListener } = supabase.auth.onAuthStateChange(
        async (event, session) => {
            console.log('[AuthStore] Auth state change event:', event);
            const { setSession, fetchProfile, clearAuth } = useAuthStore.getState();

            try {
                useAuthStore.setState({ loading: true });
                
                if (session?.user) {
                    setSession(session);
                    // Don't await this to prevent blocking
                    fetchProfile(session.user.id).catch(err => {
                        console.error('[AuthStore] Error fetching profile in auth change handler:', err);
                    });
                } else {
                    clearAuth();
                }
            } catch (error) {
                console.error('[AuthStore] Error in auth state change handler:', error);
                useAuthStore.setState({ loading: false });
            }
        }
    );

    return () => {
        authListener?.subscription.unsubscribe();
    };
}