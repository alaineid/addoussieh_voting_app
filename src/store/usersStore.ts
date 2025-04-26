import { create } from 'zustand';
import { supabase } from '../lib/supabaseClient';

export interface UserProfileWithEmail {
  id: string;
  email?: string;
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
  fetchUsers: (force?: boolean) => Promise<void>;
  setupRealtimeListeners: () => void;
  cleanupRealtimeListeners: () => void;
  updateUserInStore: (user: Partial<UserProfileWithEmail> & { id: string }) => void;
  removeUserFromStore: (id: string) => void;
}

const REALTIME_CHANNEL_NAME = 'avp_profiles_changes';

export const useUsersStore = create<UsersState>((set, get) => ({
  users: [],
  loading: true,
  error: null,
  initialized: false,

  fetchUsers: async (force = false) => {

    if (get().initialized && !force) {
      return;
    }

    set({ loading: true, error: null });

    try {
      const { data: usersData, error: fetchError } = await supabase
        .from('avp_profiles')
        .select('*');

      if (fetchError) {
        throw fetchError;
      }

      set({ users: usersData || [], initialized: true });

    } catch (error: any) {
      const errorMessage = error.message || 'Failed to fetch users';
      set({ error: errorMessage });
    } finally {
      set({ loading: false });
    }
  },

  updateUserInStore: (updatedUserData: Partial<UserProfileWithEmail> & { id: string }) => {

    set(state => {
      const userIndex = state.users.findIndex(user => user.id === updatedUserData.id);

      if (userIndex >= 0) {
        const updatedUsers = [...state.users];
        updatedUsers[userIndex] = { ...state.users[userIndex], ...updatedUserData };
        return { users: updatedUsers };
      } else {
        return { users: [...state.users, updatedUserData as UserProfileWithEmail] };
      }
    });
  },

  removeUserFromStore: (id: string) => {

    set(state => {
      const updatedUsers = state.users.filter(user => user.id !== id);
      return { users: updatedUsers };
    });
  },

  setupRealtimeListeners: () => {
    get().cleanupRealtimeListeners();

    const channel = supabase
      .channel(REALTIME_CHANNEL_NAME)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'avp_profiles'
        },
        (payload) => {
          if (payload.new && payload.new.id) {
            get().updateUserInStore(payload.new as Partial<UserProfileWithEmail> & { id: string });
          } else {
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
        (payload) => {
          if (payload.new && payload.new.id) {
            get().updateUserInStore(payload.new as Partial<UserProfileWithEmail> & { id: string });
          } else {
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
          if (payload.old?.id) {
            get().removeUserFromStore(payload.old.id as string);
          } else {
          }
        }
      )
      .subscribe((status, err) => {
        if (err) {
          set({ error: `Realtime subscription failed: ${err.message}` });
        }
      });

  },

  cleanupRealtimeListeners: () => {
    supabase.removeChannel(supabase.channel(REALTIME_CHANNEL_NAME))
      .then(status => {})
      .catch(error => {});
  }
}));