import { create } from 'zustand';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient'; // Adjust path as needed

// Define the structure of the user profile based on your avp_profiles table
export interface UserProfile {
  id: string;
  role: 'admin' | 'user';
  voters_list_access: 'none' | 'view' | 'edit';
  family_situation_access: 'none' | 'view' | 'edit';
  statistics_access: 'none' | 'view';
  // Add other profile fields if necessary
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
  loading: true, // Start loading until initial auth state is checked
  setSession: (session) => {
    set({ session, user: session?.user ?? null, loading: false });
    // Clear profile if session is null (logged out)
    if (!session) {
        get().clearAuth();
    }
  },
  setProfile: (profile) => set({ profile }),
  fetchProfile: async (userId) => {
    set({ loading: true });
    try {
      const { data, error, status } = await supabase
        .from('avp_profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error && status !== 406) { // 406 means no rows found, which might be okay initially
        console.error('Error fetching profile:', error);
        set({ profile: null, loading: false });
        return;
      }

      if (data) {
        set({ profile: data as UserProfile, loading: false });
      } else {
        set({ profile: null, loading: false }); // No profile found
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
      set({ profile: null, loading: false });
    }
  },
  clearAuth: () => set({ session: null, user: null, profile: null, loading: false }),
}));

// Function to initialize auth state listener
export function initializeAuthListener() {
    const { setSession, fetchProfile, clearAuth } = useAuthStore.getState();

    // Set initial loading state
    setSession(null); // Assume logged out initially
    useAuthStore.setState({ loading: true });


    supabase.auth.getSession().then(({ data: { session } }) => {
        setSession(session);
        if (session?.user) {
            fetchProfile(session.user.id);
        } else {
            useAuthStore.setState({ loading: false }); // No session, stop loading
        }
    });

    const { data: authListener } = supabase.auth.onAuthStateChange(
        async (_event, session) => {
            setSession(session);
            if (session?.user) {
                // Fetch profile when auth state changes and user exists
                await fetchProfile(session.user.id);
            } else {
                // Clear profile if user logs out
                clearAuth();
            }
             useAuthStore.setState({ loading: false }); // Update loading state after handling change
        }
    );

    // Return unsubscribe function
    return () => {
        authListener?.subscription.unsubscribe();
    };
}