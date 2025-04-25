import { create } from 'zustand';
import { supabase } from '../lib/supabaseClient';

export interface UserProfileWithEmail {
  id: string;
  email: string;
  full_name: string;
  role: string;
  voters_list_access: string;
  family_situation_access: string;
  statistics_access: string;
}

interface UsersState {
  users: UserProfileWithEmail[];
  loading: boolean;
  error: string | null;
  initialized: boolean;
  fetchUsers: (token: string, force?: boolean) => Promise<void>;
  setupRealtimeListeners: () => void;
  cleanupRealtimeListeners: () => void;
  // New methods to handle individual user updates
  updateUserInStore: (user: UserProfileWithEmail) => void;
  removeUserFromStore: (id: string) => void;
}

// Create a consistent channel name
const REALTIME_CHANNEL_NAME = 'avp_profiles_changes';

export const useUsersStore = create<UsersState>((set, get) => ({
  users: [],
  loading: true,
  error: null,
  initialized: false,

  fetchUsers: async (token: string, force = false) => {
    console.log(`[usersStore] fetchUsers called with force=${force}, initialized=${get().initialized}`);
    
    if (get().initialized && !force) {
      console.log('[usersStore] Skipping fetch because data is already initialized');
      return; // Don't fetch if already initialized unless forced
    }

    set({ loading: true, error: null });
    console.log('[usersStore] Fetching users data...');
    
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      if (!supabaseUrl) {
        throw new Error('Configuration error: Supabase URL not found.');
      }
      
      const functionUrl = `${supabaseUrl}/functions/v1/list_users_as_admin`;
      
      const response = await fetch(functionUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || `HTTP error! status: ${response.status}`);
      }
      
      console.log(`[usersStore] Users data fetched successfully: ${result.users.length} users`);
      set({ users: result.users, initialized: true });
    } catch (error: any) {
      console.error('[usersStore] Error fetching users:', error);
      set({ error: error.message || 'Failed to fetch users' });
    } finally {
      set({ loading: false });
    }
  },
  
  // New method to update a single user in the store
  updateUserInStore: (updatedUser: UserProfileWithEmail) => {
    console.log('[usersStore] Updating user in store:', updatedUser);
    
    set(state => {
      // Check if the user already exists in our state
      const userIndex = state.users.findIndex(user => user.id === updatedUser.id);
      
      if (userIndex >= 0) {
        // Update existing user
        const updatedUsers = [...state.users];
        updatedUsers[userIndex] = updatedUser;
        console.log('[usersStore] User updated in store');
        return { users: updatedUsers };
      } else {
        // Add as a new user
        console.log('[usersStore] New user added to store');
        return { users: [...state.users, updatedUser] };
      }
    });
  },
  
  // New method to remove a user from the store
  removeUserFromStore: (id: string) => {
    console.log('[usersStore] Removing user from store:', id);
    
    set(state => {
      const updatedUsers = state.users.filter(user => user.id !== id);
      return { users: updatedUsers };
    });
  },

  setupRealtimeListeners: () => {
    // Clean up any existing subscription first to avoid duplicates
    get().cleanupRealtimeListeners();
    
    console.log('[usersStore] Setting up realtime listeners for user profiles');
    
    // Get current auth session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        console.error('[usersStore] No active session for realtime setup');
        return;
      }
      
      // Subscribe to all changes on avp_profiles table
      const channel = supabase
        .channel(REALTIME_CHANNEL_NAME)
        .on(
          'postgres_changes', 
          {
            event: 'INSERT',
            schema: 'public',
            table: 'avp_profiles'
          }, 
          async (payload) => {
            console.log('[usersStore] Received INSERT realtime update:', payload);
            
            // We need to fetch the complete user data since real-time payload might not include email
            if (session?.access_token && payload.new?.id) {
              try {
                const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
                if (!supabaseUrl) {
                  throw new Error('Configuration error: Supabase URL not found.');
                }
                
                // Use the existing list_users_as_admin function with userId parameter
                const functionUrl = `${supabaseUrl}/functions/v1/list_users_as_admin`;
                
                const response = await fetch(`${functionUrl}?userId=${payload.new.id}`, {
                  method: 'GET',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`,
                  },
                });
                
                const result = await response.json();
                
                if (response.ok && result.user) {
                  // Add the new user to our store
                  get().updateUserInStore(result.user);
                }
              } catch (error) {
                console.error('[usersStore] Error fetching inserted user data:', error);
              }
            }
          }
        )
        .on(
          'postgres_changes', 
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'avp_profiles'
          }, 
          async (payload) => {
            console.log('[usersStore] Received UPDATE realtime update:', payload);
            
            // We need to fetch the complete user data since real-time payload might not include email
            if (session?.access_token && payload.new?.id) {
              try {
                const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
                if (!supabaseUrl) {
                  throw new Error('Configuration error: Supabase URL not found.');
                }
                
                // Use the existing list_users_as_admin function with userId parameter
                const functionUrl = `${supabaseUrl}/functions/v1/list_users_as_admin`;
                
                const response = await fetch(`${functionUrl}?userId=${payload.new.id}`, {
                  method: 'GET',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`,
                  },
                });
                
                const result = await response.json();
                
                if (response.ok && result.user) {
                  // Update the user in our store
                  get().updateUserInStore(result.user);
                }
              } catch (error) {
                console.error('[usersStore] Error fetching updated user data:', error);
              }
            }
          }
        )
        .on(
          'postgres_changes', 
          {
            event: 'DELETE',
            schema: 'public',
            table: 'avp_profiles'
          }, 
          (payload) => {
            console.log('[usersStore] Received DELETE realtime update:', payload);
            
            // Remove the deleted user from our store
            if (payload.old?.id) {
              get().removeUserFromStore(payload.old.id);
            }
          }
        )
        .subscribe((status) => {
          console.log(`[usersStore] Realtime subscription status: ${status}`);
        });
        
      console.log('[usersStore] Channel subscription complete:', channel);
    });
  },

  cleanupRealtimeListeners: () => {
    console.log('[usersStore] Cleaning up realtime listeners');
    supabase.channel(REALTIME_CHANNEL_NAME).unsubscribe();
  }
}));