import React, { useState, useEffect, useMemo } from 'react';
import { useForm, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import zxcvbn from 'zxcvbn';
import { useAuthStore, UserProfile } from '../store/authStore';
import { useUsersStore } from '../store/usersStore';
import { useThemeStore } from '../store/themeStore';
import { Tab } from '@headlessui/react';
import { 
  createColumnHelper, 
  flexRender, 
  getCoreRowModel, 
  useReactTable,
  getPaginationRowModel,
  getSortedRowModel,
  SortingState,
} from '@tanstack/react-table';
import ConfirmationModal from '../components/ConfirmationModal';
import AlertModal from '../components/AlertModal';
import Toast from '../components/Toast'; // Import shared Toast component

// Create User Form Schema
const schema = z.object({
  email: z.string().email({ message: 'Invalid email address' }),
  full_name: z.string().min(1, { message: 'Full name is required' }),
  password: z.string().min(8, { message: 'Password must be at least 8 characters long' }),
  role: z.enum(['admin', 'user']),
  registered_voters_access: z.enum(['none', 'view', 'edit']),
  family_situation_access: z.enum(['none', 'view', 'edit']),
  statistics_access: z.enum(['none', 'view']),
  voting_day_access: z.enum(['none', 'view female', 'view male', 'view both', 'edit female', 'edit male', 'edit both']),
  vote_counting: z.enum(['none', 'count female votes', 'count male votes']),
  live_score_access: z.enum(['none', 'view']),
  candidate_access: z.enum(['none', 'view', 'edit']),
});

type FormValues = z.infer<typeof schema>;

// User Edit Form Schema
const editSchema = z.object({
  id: z.string(),
  full_name: z.string().min(1, { message: 'Full name is required' }),
  role: z.enum(['admin', 'user']),
  registered_voters_access: z.enum(['none', 'view', 'edit']),
  family_situation_access: z.enum(['none', 'view', 'edit']),
  statistics_access: z.enum(['none', 'view']),
  voting_day_access: z.enum(['none', 'view female', 'view male', 'view both', 'edit female', 'edit male', 'edit both']),
  vote_counting: z.enum(['none', 'count female votes', 'count male votes']),
  live_score_access: z.enum(['none', 'view']),
  candidate_access: z.enum(['none', 'view', 'edit']),
});

// User Profile interface for the table data
interface UserProfileWithEmail {
  // Properties from UserProfile (imported from ../store/authStore)
  name?: string;
  role: 'admin' | 'user';
  registered_voters_access: 'none' | 'view' | 'edit';
  family_situation_access: 'none' | 'view' | 'edit';
  statistics_access: 'none' | 'view';
  voting_day_access?: 'none' | 'view female' | 'view male' | 'view both' | 'edit female' | 'edit male' | 'edit both';
  vote_counting?: 'none' | 'count female votes' | 'count male votes';
  live_score_access?: 'none' | 'view';
  candidate_access?: 'none' | 'view' | 'edit';

  // Properties specific to UserProfileWithEmail or overridden
  id: string;
  email: string;
  full_name: string; // Overrides UserProfile's optional full_name to be required
}

interface PasswordStrength {
  score: number;
  feedback: {
    warning: string | null;
    suggestions: string[];
  };
}

// Password strength meter component
const PasswordStrengthMeter: React.FC<{ strength: PasswordStrength | null }> = ({ strength }) => {
  const { isDarkMode } = useThemeStore();
  
  if (!strength) return null;

  const { score, feedback } = strength;
  const strengthLabels = ['Very Weak', 'Weak', 'Fair', 'Good', 'Strong'];
  const strengthColors = [
    'bg-red-500',
    'bg-orange-500',
    'bg-yellow-500',
    'bg-lime-500',
    'bg-green-500',
  ];

  const barWidth = `${(score + 1) * 20}%`;

  return (
    <div className="mt-2 space-y-1">
      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
        <div
          className={`h-2.5 rounded-full transition-all duration-300 ease-in-out ${strengthColors[score]}`}
          style={{ width: barWidth }}
        ></div>
      </div>
      <p className={`text-sm font-medium ${score < 2 ? 'text-red-600 dark:text-red-400' : score < 4 ? 'text-yellow-600 dark:text-yellow-400' : 'text-green-600 dark:text-green-400'}`}>
        Strength: {strengthLabels[score]}
      </p>
      {feedback.warning && (
        <p className="text-xs text-red-600 dark:text-red-400">{feedback.warning}</p>
      )}
      {feedback.suggestions.length > 0 && (
        <ul className="list-disc list-inside text-xs text-gray-600 dark:text-gray-400">
          {feedback.suggestions.map((suggestion, index) => (
            <li key={index}>{suggestion}</li>
          ))}
        </ul>
      )}
    </div>
  );
};

// Create User Tab Component
const CreateUserTab = () => {
  const { isDarkMode } = useThemeStore();
  const { register, handleSubmit, watch, formState: { errors, isSubmitting }, reset } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      role: 'user',
      registered_voters_access: 'view',
      family_situation_access: 'view',
      statistics_access: 'view',
      voting_day_access: 'none',
      vote_counting: 'none',
      live_score_access: 'none',
      candidate_access: 'none',
    },
  });
  const [serverMessage, setServerMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [passwordStrength, setPasswordStrength] = useState<PasswordStrength | null>(null);
  const { session } = useAuthStore();
  
  // Alert modal state for errors only
  const [alertModalOpen, setAlertModalOpen] = useState(false);
  const [alertConfig, setAlertConfig] = useState<{
    title: string;
    message: string;
    type: 'success' | 'error' | 'info' | 'warning';
  }>({
    title: '',
    message: '',
    type: 'info'
  });
  
  // Toast state for success messages
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error' | 'info' | 'warning';
    visible: boolean;
  } | null>(null);

  const passwordValue = watch('password');

  useEffect(() => {
    if (passwordValue) {
      const result = zxcvbn(passwordValue);
      setPasswordStrength({
        score: result.score,
        feedback: {
          warning: result.feedback.warning || null,
          suggestions: result.feedback.suggestions || [],
        },
      });
    } else {
      setPasswordStrength(null);
    }
  }, [passwordValue]);

  const onSubmit: SubmitHandler<FormValues> = async (data) => {
    setServerMessage(null);
    if (!session?.access_token) {
      setAlertConfig({
        title: 'Authentication Error',
        message: 'No access token found. Please log in again.',
        type: 'error'
      });
      setAlertModalOpen(true);
      return;
    }

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    if (!supabaseUrl) {
      setAlertConfig({
        title: 'Configuration Error',
        message: 'Supabase URL not found.',
        type: 'error'
      });
      setAlertModalOpen(true);
      return;
    }
    const functionUrl = `${supabaseUrl}/functions/v1/create_user_as_admin`;

    try {
      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          email: data.email,
          full_name: data.full_name,
          password: data.password,
          role: data.role,
          registered_voters_access: data.registered_voters_access,
          family_situation_access: data.family_situation_access,
          statistics_access: data.statistics_access,
          voting_day_access: data.voting_day_access,
          vote_counting: data.vote_counting,
          live_score_access: data.live_score_access,
          candidate_access: data.candidate_access,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || `HTTP error! status: ${response.status}`);
      }

      // Show success message using toast instead of modal
      setToast({
        message: `User ${data.email} created successfully!`,
        type: 'success',
        visible: true
      });
      
      reset(); // Reset the form after successful creation

    } catch (error: any) {
      console.error('Error calling create_user_as_admin function:', error);
      setAlertConfig({
        title: 'Error',
        message: error.message || 'Failed to create user.',
        type: 'error'
      });
      setAlertModalOpen(true);
    }
  };

  const closeToast = () => {
    setToast(null);
  };

  const renderSelect = (id: keyof FormValues, label: string, options: string[]) => (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>
      <select
        id={id}
        {...register(id as any)}
        className={`mt-1 block w-full pl-3 pr-10 py-2 text-base border ${errors[id] ? 'border-red-500' : 'border-gray-300 dark:border-gray-700'} dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md`}
      >
        {options.map(option => (
          <option key={option} value={option}>{option.charAt(0).toUpperCase() + option.slice(1)}</option>
        ))}
      </select>
      {errors[id] && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors[id]?.message}</p>}
    </div>
  );

  return (
    <div className="p-6 bg-white dark:bg-gray-800 rounded-lg transition-colors duration-300">
      {/* Toast notification */}
      {toast && toast.visible && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={closeToast}
        />
      )}
      
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 max-w-xl mx-auto">
        {serverMessage && (
          <div className={`p-4 rounded-md ${serverMessage.type === 'success' ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300' : 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300'}`}>
            {serverMessage.text}
          </div>
        )}

        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Full Name</label>
          <input
            id="name"
            type="text"
            {...register('full_name')}
            className={`mt-1 block w-full px-3 py-2 border ${errors.full_name ? 'border-red-500' : 'border-blue-200 dark:border-blue-800'} bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm`}
            placeholder="John Doe"
          />
          {errors.full_name && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.full_name.message}</p>}
        </div>

        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Email</label>
          <input
            id="email"
            type="email"
            {...register('email')}
            className={`mt-1 block w-full px-3 py-2 border ${errors.email ? 'border-red-500' : 'border-blue-200 dark:border-blue-800'} bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm`}
            placeholder="user@example.com"
          />
          {errors.email && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.email.message}</p>}
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Password</label>
          <input
            id="password"
            type="password"
            {...register('password')}
            className={`mt-1 block w-full px-3 py-2 border ${errors.password ? 'border-red-500' : 'border-blue-200 dark:border-blue-800'} bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm`}
            placeholder="********"
          />
          {errors.password && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.password.message}</p>}
          <PasswordStrengthMeter strength={passwordStrength} />
        </div>

        {renderSelect('role', 'Role', ['user', 'admin'])}
        {renderSelect('registered_voters_access', 'Registered Voters Access', ['none', 'view', 'edit'])}
        {renderSelect('family_situation_access', 'Family Situation Access', ['none', 'view', 'edit'])}
        {renderSelect('statistics_access', 'Statistics Access', ['none', 'view'])}
        {renderSelect('voting_day_access', 'Voting Day Access', ['none', 'view female', 'view male', 'view both', 'edit female', 'edit male', 'edit both'])}
        {renderSelect('vote_counting', 'Vote Counting Access', ['none', 'count female votes', 'count male votes'])}
        {renderSelect('live_score_access', 'Live Score Access', ['none', 'view'])}
        {renderSelect('candidate_access', 'Candidate Access', ['none', 'view', 'edit'])}

        <div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Creating User...' : 'Create User'}
          </button>
        </div>
      </form>

      {/* Alert modal for errors only */}
      <AlertModal 
        isOpen={alertModalOpen}
        onClose={() => setAlertModalOpen(false)}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
      />
    </div>
  );
};

// Manage Users Tab Component
const ManageUsersTab = () => {
  const { isDarkMode } = useThemeStore();
  
  // Use the global users store instead of local state
  const { users, loading, error, fetchUsers } = useUsersStore();
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [serverMessage, setServerMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const { session } = useAuthStore();
  const [sorting, setSorting] = useState<SortingState>([]);
  
  // State for modals
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<UserProfileWithEmail | null>(null);
  const [alertModalOpen, setAlertModalOpen] = useState(false);
  const [alertConfig, setAlertConfig] = useState<{
    title: string;
    message: string;
    type: 'success' | 'error' | 'info' | 'warning';
  }>({
    title: '',
    message: '',
    type: 'info'
  });
  
  // Toast state
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error' | 'info' | 'warning';
    visible: boolean;
  } | null>(null);

  const { register, handleSubmit, formState: { errors }, reset } = useForm<EditFormValues>({
    resolver: zodResolver(editSchema)
  });
  
  const closeToast = () => {
    setToast(null);
  };

  const columnHelper = createColumnHelper<UserProfileWithEmail>();
  const columns = [
    columnHelper.accessor('full_name', {
      header: 'Full Name',
      cell: ({ row, getValue }) => 
        editingId === row.original.id ? (
          <input 
            {...register('full_name')} 
            defaultValue={getValue() as string} 
            className="w-full p-1 border rounded dark:bg-gray-700 dark:text-white dark:border-gray-600"
          />
        ) : getValue(),
      enableSorting: true,
    }),
    columnHelper.accessor('email', {
      header: 'Email',
      cell: info => info.getValue(),
      enableSorting: true,
    }),
    columnHelper.accessor(row => row.role, {
      id: 'role',
      header: 'Role',
      cell: ({ row, getValue }) => 
        editingId === row.original.id ? (
          <select 
            {...register('role')} 
            defaultValue={getValue() as string} 
            className="w-full p-1 border rounded dark:bg-gray-700 dark:text-white dark:border-gray-600"
          >
            <option value="admin">Admin</option>
            <option value="user">User</option>
          </select>
        ) : getValue(),
      enableSorting: true,
    }),
    columnHelper.accessor(row => row.registered_voters_access, {
      id: 'registered_voters_access',
      header: 'Registered Voters Access',
      cell: ({ row, getValue }) => 
        editingId === row.original.id ? (
          <select 
            {...register('registered_voters_access')} 
            defaultValue={getValue() as string} 
            className="w-full p-1 border rounded dark:bg-gray-700 dark:text-white dark:border-gray-600"
          >
            <option value="none">None</option>
            <option value="view">View</option>
            <option value="edit">Edit</option>
          </select>
        ) : getValue(),
      enableSorting: true,
    }),
    columnHelper.accessor(row => row.family_situation_access, {
      id: 'family_situation_access',
      header: 'Family Situation Access',
      cell: ({ row, getValue }) => 
        editingId === row.original.id ? (
          <select 
            {...register('family_situation_access')} 
            defaultValue={getValue() as string} 
            className="w-full p-1 border rounded dark:bg-gray-700 dark:text-white dark:border-gray-600"
          >
            <option value="none">None</option>
            <option value="view">View</option>
            <option value="edit">Edit</option>
          </select>
        ) : getValue(),
      enableSorting: true,
    }),
    columnHelper.accessor(row => row.statistics_access, {
      id: 'statistics_access',
      header: 'Statistics Access',
      cell: ({ row, getValue }) => 
        editingId === row.original.id ? (
          <select 
            {...register('statistics_access')} 
            defaultValue={getValue() as string} 
            className="w-full p-1 border rounded dark:bg-gray-700 dark:text-white dark:border-gray-600"
          >
            <option value="none">None</option>
            <option value="view">View</option>
          </select>
        ) : getValue(),
      enableSorting: true,
    }),
    columnHelper.accessor(row => row.voting_day_access, {
      id: 'voting_day_access',
      header: 'Voting Day Access',
      cell: ({ row, getValue }) => 
        editingId === row.original.id ? (
          <select 
            {...register('voting_day_access')} 
            defaultValue={getValue() as string} 
            className="w-full p-1 border rounded dark:bg-gray-700 dark:text-white dark:border-gray-600"
          >
            <option value="none">None</option>
            <option value="view female">View Female</option>
            <option value="view male">View Male</option>
            <option value="view both">View Both</option>
            <option value="edit female">Edit Female</option>
            <option value="edit male">Edit Male</option>
            <option value="edit both">Edit Both</option>
          </select>
        ) : getValue(),
      enableSorting: true,
    }),
    columnHelper.accessor(row => row.vote_counting, {
      id: 'vote_counting',
      header: 'Vote Counting',
      cell: ({ row, getValue }) => 
        editingId === row.original.id ? (
          <select 
            {...register('vote_counting')} 
            defaultValue={getValue() as string || 'none'} 
            className="w-full p-1 border rounded dark:bg-gray-700 dark:text-white dark:border-gray-600"
          >
            <option value="none">None</option>
            <option value="count female votes">Count Female Votes</option>
            <option value="count male votes">Count Male Votes</option>
          </select>
        ) : getValue() || 'none',
      enableSorting: true,
    }),
    columnHelper.accessor(row => row.live_score_access, {
      id: 'live_score_access',
      header: 'Live Score Access',
      cell: ({ row, getValue }) => 
        editingId === row.original.id ? (
          <select 
            {...register('live_score_access')} 
            defaultValue={getValue() as string || 'none'} 
            className="w-full p-1 border rounded dark:bg-gray-700 dark:text-white dark:border-gray-600"
          >
            <option value="none">None</option>
            <option value="view">View</option>
          </select>
        ) : getValue() || 'none',
      enableSorting: true,
    }),
    columnHelper.accessor(row => row.candidate_access, {
      id: 'candidate_access',
      header: 'Candidate Access',
      cell: ({ row, getValue }) => 
        editingId === row.original.id ? (
          <select 
            {...register('candidate_access')} 
            defaultValue={getValue() as string || 'none'} 
            className="w-full p-1 border rounded dark:bg-gray-700 dark:text-white dark:border-gray-600"
          >
            <option value="none">None</option>
            <option value="view">View</option>
            <option value="edit">Edit</option>
          </select>
        ) : getValue() || 'none',
      enableSorting: true,
    }),
    columnHelper.display({
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => {
        const user = row.original;
        
        if (editingId === user.id) {
          return (
            <div className="flex space-x-3">
              <button 
                onClick={handleSubmit(data => saveUser(data))}
                className="text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-300 transition-colors"
                title="Save"
              >
                <i className="fas fa-save text-lg"></i>
              </button>
              <button 
                onClick={() => cancelEdit()}
                className="text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-300 transition-colors"
                title="Cancel"
              >
                <i className="fas fa-times text-lg"></i>
              </button>
            </div>
          );
        }
        
        return (
          <div className="flex space-x-3">
            <button 
              onClick={() => startEdit(user)}
              className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors"
              title="Edit"
            >
              <i className="fas fa-edit text-lg"></i>
            </button>
            <button 
              onClick={() => confirmDelete(user)}
              className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 transition-colors"
              title="Delete"
            >
              <i className="fas fa-trash-alt text-lg"></i>
            </button>
          </div>
        );
      }
    })
  ];

  const table = useReactTable({
    data: users as UserProfileWithEmail[], // Cast to ensure type compatibility
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    autoResetPageIndex: false,
    state: {
      sorting,
    },
    onSortingChange: setSorting,
  });

  // Initialize data fetching
  useEffect(() => {
    if (session) {
      fetchUsers();
    }
  }, [session, fetchUsers]);

  const startEdit = (user: UserProfileWithEmail) => {
    setEditingId(user.id);
    reset({
      id: user.id,
      full_name: user.full_name,
      role: user.role,
      registered_voters_access: user.registered_voters_access,
      family_situation_access: user.family_situation_access,
      statistics_access: user.statistics_access,
      voting_day_access: user.voting_day_access || 'none', // Include voting_day_access with fallback
      vote_counting: user.vote_counting || 'none', // Include vote_counting with fallback
      live_score_access: user.live_score_access || 'none', // Include live_score_access with fallback
      candidate_access: user.candidate_access || 'none' // Include candidate_access with fallback
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const saveUser = async (data: EditFormValues) => {
    setServerMessage(null);
    
    try {
      if (!session?.access_token) {
        throw new Error('Authentication error: No access token found.');
      }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      if (!supabaseUrl) {
        throw new Error('Configuration error: Supabase URL not found.');
      }
      
      const userBeingEdited = users.find(user => user.id === data.id);
      let votingDayAccessChanged = false;
      let voteCountingChanged = false;

      if (userBeingEdited) {
        votingDayAccessChanged = userBeingEdited.voting_day_access !== data.voting_day_access;
        voteCountingChanged = userBeingEdited.vote_counting !== data.vote_counting;
      }
      
      // Call our custom serverless function instead of directly updating
      const functionUrl = `${supabaseUrl}/functions/v1/update_user_as_admin`;
      
      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          userId: data.id,
          full_name: data.full_name,
          role: data.role,
          registered_voters_access: data.registered_voters_access,
          family_situation_access: data.family_situation_access,
          statistics_access: data.statistics_access,
          voting_day_access: data.voting_day_access,
          vote_counting: data.vote_counting,
          live_score_access: data.live_score_access,
          candidate_access: data.candidate_access
        }),
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || `HTTP error! status: ${response.status}`);
      }
      
      setEditingId(null);
      
      useUsersStore.setState(state => ({
        users: state.users.map(user => 
          user.id === data.id ? { 
            ...user, 
            full_name: data.full_name,
            role: data.role,
            registered_voters_access: data.registered_voters_access,
            family_situation_access: data.family_situation_access,
            statistics_access: data.statistics_access,
            voting_day_access: data.voting_day_access,
            vote_counting: data.vote_counting,
            live_score_access: data.live_score_access,
            candidate_access: data.candidate_access
          } : user
        )
      }));

      const currentUserId = session?.user?.id;
      if (currentUserId === data.id && (votingDayAccessChanged || voteCountingChanged)) {
        console.log('Current user permissions changed, dispatching event(s)');
        
        const { refreshUserProfile } = useAuthStore.getState();
        refreshUserProfile();
        
        if (votingDayAccessChanged) {
          window.dispatchEvent(new CustomEvent('permission_change_event', {
            detail: { 
              type: 'voting_day_access',
              value: data.voting_day_access
            }
          }));
        }
        if (voteCountingChanged) {
          window.dispatchEvent(new CustomEvent('permission_change_event', {
            detail: {
              type: 'vote_counting',
              value: data.vote_counting
            }
          }));
        }
      }
      
      setToast({
        message: 'User updated successfully',
        type: 'success',
        visible: true
      });

    } catch (error: any) {
      console.error('Error updating user:', error);
      
      // Show error message using AlertModal only on error
      setAlertConfig({
        title: 'Error',
        message: error.message || 'Failed to update user',
        type: 'error'
      });
      setAlertModalOpen(true);
    }
  };

  const confirmDelete = (user: UserProfileWithEmail) => {
    setUserToDelete(user);
    setDeleteModalOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (userToDelete) {
      deleteUser(userToDelete.id);
    }
  };

  const deleteUser = async (userId: string) => {
    setServerMessage(null);
    
    try {
      if (!session?.access_token) {
        throw new Error('Authentication error: No access token found.');
      }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      if (!supabaseUrl) {
        throw new Error('Configuration error: Supabase URL not found.');
      }
      
      // Call our custom serverless function instead of using the admin API directly
      const functionUrl = `${supabaseUrl}/functions/v1/delete_user_as_admin`;
      
      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ userId }),
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || `HTTP error! status: ${response.status}`);
      }
      
      // Show success message as toast instead of modal
      setToast({
        message: 'User deleted successfully!',
        type: 'success',
        visible: true
      });
      
      // Update local state instead of refreshing the list
      useUsersStore.setState(state => ({
        users: state.users.filter(user => user.id !== userId)
      }));
      
      // Close the delete confirmation modal
      setDeleteModalOpen(false);
    } catch (error: any) {
      console.error('Error deleting user:', error);
      
      // Show error message in custom alert modal
      setAlertConfig({
        title: 'Error',
        message: error.message || 'Failed to delete user',
        type: 'error'
      });
      setAlertModalOpen(true);
    }
  };

  if (loading) {
    return (
      <div className="p-6 bg-white dark:bg-gray-800 rounded-lg transition-colors duration-300">
        <div className="mb-6">
          <div className="h-10 w-72 bg-gray-200 dark:bg-gray-700 rounded-md animate-pulse mb-6"></div>
          <div className="h-12 w-full bg-gray-200 dark:bg-gray-700 rounded-md animate-pulse mb-8"></div>
        </div>
        
        <div className="border dark:border-gray-700 rounded-xl overflow-hidden bg-white dark:bg-gray-800 shadow-sm">
          <div className="bg-gray-50 dark:bg-gray-700 px-4 py-4">
            <div className="flex justify-between">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-6 bg-gray-200 dark:bg-gray-600 rounded-md animate-pulse my-2 w-32"></div>
              ))}
            </div>
          </div>
          
          <div className="divide-y dark:divide-gray-700">
            {Array.from({ length: 5 }).map((_, rowIndex) => (
              <div key={rowIndex} className="py-4 px-6 animate-pulse">
                <div className="flex justify-between items-center mb-3">
                  <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded-md w-48"></div>
                  <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded-full w-20"></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {Array.from({ length: 6 }).map((_, colIndex) => (
                    <div key={colIndex} className="h-5 bg-gray-200 dark:bg-gray-700 rounded-md w-full"></div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-center bg-white dark:bg-gray-800 rounded-lg transition-colors duration-300">
        <div className="bg-red-50 dark:bg-red-900/30 border-l-4 border-red-500 dark:border-red-700 p-6 rounded-lg shadow-sm max-w-lg">
          <div className="flex items-center">
            <i className="fas fa-exclamation-circle h-8 w-8 text-red-500 dark:text-red-400 mr-3"></i>
            <p className="text-red-700 dark:text-red-300 text-lg font-medium">{error}</p>
          </div>
          <p className="mt-3 text-red-600 dark:text-red-400 text-sm">Please try refreshing the page or contact an administrator.</p>
        </div>
      </div>
    );
  }

  // Calculate stats
  const adminUsers = users.filter(user => user.role === 'admin').length;
  const regularUsers = users.filter(user => user.role === 'user').length;
  const totalUsers = users.length;

  return (
    <div className="p-6 bg-white dark:bg-gray-800 rounded-lg transition-colors duration-300">
      {/* Toast notification */}
      {toast && toast.visible && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={closeToast}
        />
      )}

      {/* Stats Section */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 flex items-center border border-blue-100 dark:border-blue-900">
          <div className="rounded-full bg-blue-100 dark:bg-blue-900/50 p-3 mr-4 flex items-center justify-center w-12 h-12">
            <i className="fas fa-users text-blue-600 dark:text-blue-400"></i>
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Total Users</p>
            <p className="text-2xl font-bold text-gray-800 dark:text-gray-100">{totalUsers}</p>
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 flex items-center border border-blue-100 dark:border-blue-900">
          <div className="rounded-full bg-red-100 dark:bg-red-900/50 p-3 mr-4 flex items-center justify-center w-12 h-12">
            <i className="fas fa-user-shield text-red-600 dark:text-red-400"></i>
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Admins</p>
            <p className="text-2xl font-bold text-gray-800 dark:text-gray-100">{adminUsers}</p>
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 flex items-center border border-blue-100 dark:border-blue-900">
          <div className="rounded-full bg-green-100 dark:bg-green-900/50 p-3 mr-4 flex items-center justify-center w-12 h-12">
            <i className="fas fa-user text-green-600 dark:text-green-400"></i>
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Regular Users</p>
            <p className="text-2xl font-bold text-gray-800 dark:text-gray-100">{regularUsers}</p>
          </div>
        </div>
      </div>
      
      {serverMessage && (
        <div className={`p-4 mb-4 rounded-md ${serverMessage.type === 'success' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'}`}>
          {serverMessage.text}
        </div>
      )}
      
      {/* User table with improved styling */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden border border-blue-100 dark:border-gray-700">
        <div className="overflow-x-auto shadow-sm border border-blue-200 dark:border-gray-700">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-blue-50 dark:bg-blue-900/20">
              {table.getHeaderGroups().map(headerGroup => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map(header => (
                    <th 
                      key={header.id} 
                      scope="col" 
                      className="px-6 py-3.5 text-left text-xs font-semibold text-blue-800 dark:text-blue-300 uppercase tracking-wider whitespace-nowrap"
                      onClick={header.column.getToggleSortingHandler()}
                      style={{ cursor: header.column.getCanSort() ? 'pointer' : 'default' }}
                    >
                      <div className="flex items-center">
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                        {header.column.getIsSorted() === 'asc' && (
                          <i className="fas fa-sort-up ml-1.5 text-blue-600 dark:text-blue-400"></i>
                        )}
                        {header.column.getIsSorted() === 'desc' && (
                          <i className="fas fa-sort-down ml-1.5 text-blue-600 dark:text-blue-400"></i>
                        )}
                        {header.column.getCanSort() && !header.column.getIsSorted() && (
                          <i className="fas fa-sort ml-1.5 text-gray-400 dark:text-gray-600 opacity-30 group-hover:opacity-70 transition-opacity"></i>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {table.getRowModel().rows.map(row => (
                <tr key={row.id} className="hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors">
                  {row.getVisibleCells().map(cell => (
                    <td 
                      key={cell.id} 
                      className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300"
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Pagination Controls */}
      <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4 px-2">
        <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
          <span>
            Showing <span className="font-semibold text-blue-900 dark:text-blue-400">{table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1}</span> to{" "}
            <span className="font-semibold text-blue-900 dark:text-blue-400">
              {Math.min((table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize, users.length)}
            </span> of{" "}
            <span className="font-semibold text-blue-900 dark:text-blue-400">{users.length}</span> users
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => table.setPageIndex(0)}
            disabled={!table.getCanPreviousPage()}
            className="p-2 rounded-md border border-blue-200 dark:border-blue-800 bg-white dark:bg-gray-800 text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 disabled:opacity-50 disabled:pointer-events-none transition-colors"
            aria-label="Go to first page"
            title="First page"
          >
            <i className="fas fa-angle-double-left w-5 h-5"></i>
          </button>
          <button
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className="p-2 rounded-md border border-blue-200 dark:border-blue-800 bg-white dark:bg-gray-800 text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 disabled:opacity-50 disabled:pointer-events-none transition-colors"
            aria-label="Go to previous page"
            title="Previous page"
          >
            <i className="fas fa-angle-left w-5 h-5"></i>
          </button>

          <div className="hidden sm:flex items-center">
            {Array.from({length: Math.min(5, table.getPageCount())}, (_, i) => {
              const pageIndex = table.getState().pagination.pageIndex;
              let showPage: number;
              
              if (table.getPageCount() <= 5) {
                showPage = i;
              } else if (pageIndex < 3) {
                showPage = i;
              } else if (pageIndex > table.getPageCount() - 4) {
                showPage = table.getPageCount() - 5 + i;
              } else {
                showPage = pageIndex - 2 + i;
              }
              
              return (
                <button
                  key={showPage}
                  onClick={() => table.setPageIndex(showPage)}
                  disabled={pageIndex === showPage}
                  className={`px-3.5 py-2 mx-1 rounded-md text-sm font-medium border transition-colors ${
                    pageIndex === showPage 
                      ? 'bg-blue-600 dark:bg-blue-700 text-white border-blue-600 dark:border-blue-700' 
                      : 'bg-white dark:bg-gray-800 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-900/30'
                  }`}
                  aria-label={`Go to page ${showPage + 1}`}
                  aria-current={pageIndex === showPage ? 'page' : undefined}
                >
                  {showPage + 1}
                </button>
              );
            })}
          </div>
          
          <div className="sm:hidden flex items-center">
            <span className="px-3 py-1.5 text-sm text-blue-700 dark:text-blue-400 font-medium">
              Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
            </span>
          </div>

          <button
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className="p-2 rounded-md border border-blue-200 dark:border-blue-800 bg-white dark:bg-gray-800 text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 disabled:opacity-50 disabled:pointer-events-none transition-colors"
            aria-label="Go to next page"
            title="Next page"
          >
            <i className="fas fa-angle-right w-5 h-5"></i>
          </button>
          <button
            onClick={() => table.setPageIndex(table.getPageCount() - 1)}
            disabled={!table.getCanNextPage()}
            className="p-2 rounded-md border border-blue-200 dark:border-blue-800 bg-white dark:bg-gray-800 text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 disabled:opacity-50 disabled:pointer-events-none transition-colors"
            aria-label="Go to last page"
            title="Last page"
          >
            <i className="fas fa-angle-double-right w-5 h-5"></i>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-blue-700 dark:text-blue-400">
            Per page:
            <select
              value={table.getState().pagination.pageSize}
              onChange={e => {
                table.setPageSize(Number(e.target.value));
              }}
              className="ml-2 px-3 py-1.5 text-sm border border-blue-200 dark:border-blue-800 rounded-md bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {[5, 10, 20, 30, 50].map(pageSize => (
                <option key={pageSize} value={pageSize}>
                  {pageSize}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {/* Custom modals */}
      <ConfirmationModal 
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleDeleteConfirm}
        title="Delete User"
        message={userToDelete ? `Are you sure you want to delete ${userToDelete.full_name} (${userToDelete.email})?` : 'Are you sure you want to delete this user?'}
        confirmText="Delete"
        cancelText="Cancel"
        confirmButtonClass="bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800"
      />
      
      <AlertModal 
        isOpen={alertModalOpen}
        onClose={() => setAlertModalOpen(false)}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
      />
    </div>
  );
};

// Type definition for edit form
interface EditFormValues {
  id: string;
  full_name: string;
  role: 'admin' | 'user';
  registered_voters_access: 'none' | 'view' | 'edit';
  family_situation_access: 'none' | 'view' | 'edit';
  statistics_access: 'none' | 'view';
  voting_day_access: 'none' | 'view female' | 'view male' | 'view both' | 'edit female' | 'edit male' | 'edit both';
  vote_counting: 'none' | 'count female votes' | 'count male votes';
  live_score_access: 'none' | 'view';
  candidate_access: 'none' | 'view' | 'edit';
}

// Reset Voting Data Tab Component
const ResetVotingDataTab = () => {
  const { isDarkMode } = useThemeStore();
  const { session } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);
  
  // State for confirmation modal
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<string>('');
  
  // Toast state
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error' | 'info' | 'warning';
    visible: boolean;
  } | null>(null);
  
  // Alert modal state
  const [alertModalOpen, setAlertModalOpen] = useState(false);
  const [alertConfig, setAlertConfig] = useState<{
    title: string;
    message: string;
    type: 'success' | 'error' | 'info' | 'warning';
  }>({
    title: '',
    message: '',
    type: 'info'
  });
  
  const closeToast = () => {
    setToast(null);
  };
  
  const handleResetVotingMarks = () => {
    setConfirmAction('resetVotingMarks');
    setConfirmModalOpen(true);
  };
  
  const handleResetBallots = () => {
    setConfirmAction('resetBallots');
    setConfirmModalOpen(true);
  };
  
  const handleResetAll = () => {
    setConfirmAction('resetAll');
    setConfirmModalOpen(true);
  };
  
  const executeReset = async () => {
    setIsLoading(true);
    
    try {
      if (!session?.access_token) {
        throw new Error('Authentication error: No access token found.');
      }
      
      const { supabase } = await import('../lib/supabaseClient');
      
      if (confirmAction === 'resetVotingMarks' || confirmAction === 'resetAll') {
        // Reset voting marks
        const { error: votingError } = await supabase
          .from('avp_voters')
          .update({ comments: null, has_voted: false, voting_time: null })
          .neq('id', 0); // Make sure we update all records
        
        if (votingError) {
          throw new Error(`Error resetting voting marks: ${votingError.message}`);
        }
      }
      
      if (confirmAction === 'resetBallots' || confirmAction === 'resetAll') {
        // Delete all ballots
        const { error: ballotsError } = await supabase
          .from('avp_ballots')
          .delete()
          .neq('id', 0); // Make sure we delete all records
        
        if (ballotsError) {
          throw new Error(`Error resetting ballots: ${ballotsError.message}`);
        }
      }
      
      // Create a record in the reset_events table to notify other clients
      try {
        const { error: resetEventError } = await supabase
          .from('reset_events')
          .insert([{
            type: confirmAction,
            reset_by: session.user.id,
            reset_time: new Date().toISOString()
          }]);
          
        if (resetEventError) {
          console.error('Error creating reset event:', resetEventError);
          // Don't throw here, as the main reset operation already succeeded
          // But add more detailed logging to help debug the issue
          if (resetEventError.code === 'PGRST301') {
            console.error('Permission denied - make sure your user has admin role in JWT token');
          }
        } else {
          console.log('Reset event successfully recorded in reset_events table');
        }
      } catch (insertError) {
        console.error('Exception when inserting reset event:', insertError);
      }
      
      // Show success message
      setToast({
        message: getSuccessMessage(),
        type: 'success',
        visible: true
      });
      
      // Close the confirmation modal
      setConfirmModalOpen(false);
      
    } catch (error: any) {
      console.error('Error resetting voting data:', error);
      
      setAlertConfig({
        title: 'Error',
        message: error.message || 'An unknown error occurred',
        type: 'error'
      });
      setAlertModalOpen(true);
    } finally {
      setIsLoading(false);
    }
  };
  
  const getSuccessMessage = () => {
    switch (confirmAction) {
      case 'resetVotingMarks':
        return 'All voting marks have been reset successfully.';
      case 'resetBallots':
        return 'All ballots have been deleted successfully.';
      case 'resetAll':
        return 'All voting marks and ballots have been reset successfully.';
      default:
        return 'Operation completed successfully.';
    }
  };
  
  const getConfirmationMessage = () => {
    switch (confirmAction) {
      case 'resetVotingMarks':
        return 'Are you sure you want to reset all voting marks? This will set all candidate "has_voted" flags to false and clear all comments. This action cannot be undone.';
      case 'resetBallots':
        return 'Are you sure you want to delete all ballot records? This will remove all voting counts. This action cannot be undone.';
      case 'resetAll':
        return 'Are you sure you want to reset ALL voting data? This will reset all voting marks and delete all ballot records. This action cannot be undone.';
      default:
        return 'Are you sure you want to proceed? This action cannot be undone.';
    }
  };
  
  return (
    <div className="p-6 bg-white dark:bg-gray-800 rounded-lg transition-colors duration-300">
      {/* Toast notification */}
      {toast && toast.visible && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={closeToast}
        />
      )}
      
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h3 className="text-xl font-bold text-blue-800 dark:text-blue-300 mb-2">Reset Voting Data</h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Use the options below to reset different parts of the voting data. All actions are permanent and cannot be undone.
          </p>
          <div className="bg-amber-50 border-l-4 border-amber-500 p-4 dark:bg-amber-900/30 dark:border-amber-600 rounded-md mb-6">
            <div className="flex">
              <div className="flex-shrink-0">
                <i className="fas fa-exclamation-triangle text-amber-500 dark:text-amber-400"></i>
              </div>
              <div className="ml-3">
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  Warning: These actions will permanently delete voting data. Please make sure you have a backup if needed.
                </p>
              </div>
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Reset Voting Marks Card */}
            <div className="bg-white dark:bg-gray-700 rounded-lg shadow-sm border border-gray-200 dark:border-gray-600 overflow-hidden flex flex-col h-full">
            <div className="p-5 flex flex-col flex-grow">
              <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center mb-4">
                <i className="fas fa-check-square text-blue-600 dark:text-blue-400 text-xl"></i>
              </div>
              <h4 className="font-semibold text-lg mb-2 text-blue-800 dark:text-blue-300">Reset Voting Marks</h4>
              <p className="text-gray-600 dark:text-gray-400 text-sm mb-4 flex-grow">
                Clear all "has_voted" flags and comments from candidates. This will not affect the ballot counts.
              </p>
              <button
                onClick={handleResetVotingMarks}
                disabled={isLoading}
                className="w-full bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800 text-white py-2 px-4 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 disabled:opacity-50 transition-colors mt-auto"
              >
                {isLoading ? 'Processing...' : 'Reset Voting Marks'}
              </button>
            </div>
          </div>
          
          {/* Reset Ballots Card */}
          <div className="bg-white dark:bg-gray-700 rounded-lg shadow-sm border border-gray-200 dark:border-gray-600 overflow-hidden flex flex-col h-full">
            <div className="p-5 flex flex-col flex-grow">
              <div className="w-12 h-12 rounded-full bg-orange-100 dark:bg-orange-900/50 flex items-center justify-center mb-4">
                <i className="fas fa-vote-yea text-orange-600 dark:text-orange-400 text-xl"></i>
              </div>
              <h4 className="font-semibold text-lg mb-2 text-blue-800 dark:text-blue-300">Reset Ballots</h4>
              <p className="text-gray-600 dark:text-gray-400 text-sm mb-4 flex-grow">
                Delete all ballot records from the database. This will reset all voting counts.
              </p>
              <button
                onClick={handleResetBallots}
                disabled={isLoading}
                className="w-full bg-orange-600 hover:bg-orange-700 dark:bg-orange-700 dark:hover:bg-orange-800 text-white py-2 px-4 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 disabled:opacity-50 transition-colors mt-auto"
              >
                {isLoading ? 'Processing...' : 'Reset Ballots'}
              </button>
            </div>
          </div>
          
          {/* Reset All Card */}
          <div className="bg-white dark:bg-gray-700 rounded-lg shadow-sm border border-gray-200 dark:border-gray-600 overflow-hidden flex flex-col h-full">
            <div className="p-5 flex flex-col flex-grow">
              <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/50 flex items-center justify-center mb-4">
                <i className="fas fa-redo-alt text-red-600 dark:text-red-400 text-xl"></i>
              </div>
              <h4 className="font-semibold text-lg mb-2 text-blue-800 dark:text-blue-300">Reset Everything</h4>
              <p className="text-gray-600 dark:text-gray-400 text-sm mb-4 flex-grow">
                Reset all voting marks and delete all ballot records. This fully resets the voting state.
              </p>
              <button
                onClick={handleResetAll}
                disabled={isLoading}
                className="w-full bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800 text-white py-2 px-4 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 disabled:opacity-50 transition-colors mt-auto"
              >
                {isLoading ? 'Processing...' : 'Reset Everything'}
              </button>
            </div>
          </div>
        </div>
      </div>
      
      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={confirmModalOpen}
        onClose={() => setConfirmModalOpen(false)}
        onConfirm={executeReset}
        title="Confirm Reset Action"
        message={getConfirmationMessage()}
        confirmText="Yes, Reset Data"
        cancelText="Cancel"
        confirmButtonClass="bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800"
      />
      
      {/* Alert Modal */}
      <AlertModal
        isOpen={alertModalOpen}
        onClose={() => setAlertModalOpen(false)}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
      />
    </div>
  );
};

// Main AdminPage component with tabs
const AdminPage = () => {
  const { isDarkMode } = useThemeStore();
  
  // Add state to track the selected tab index
  const [selectedTabIndex, setSelectedTabIndex] = useState(0);

  // Load the saved tab index from localStorage when component mounts
  useEffect(() => {
    const savedTabIndex = localStorage.getItem('adminPageTabIndex');
    if (savedTabIndex !== null) {
      setSelectedTabIndex(parseInt(savedTabIndex, 10));
    }
  }, []);

  // Save the tab index to localStorage whenever it changes
  const handleTabChange = (index: number) => {
    setSelectedTabIndex(index);
    localStorage.setItem('adminPageTabIndex', index.toString());
  };

  // Use useMemo to persist the tab components across renders
  const createUserTabComponent = useMemo(() => <CreateUserTab />, []);
  const manageUsersTabComponent = useMemo(() => <ManageUsersTab />, []);
  const resetVotingDataTabComponent = useMemo(() => <ResetVotingDataTab />, []);

  return (
    <div className="p-4 sm:p-6 bg-white dark:bg-gray-900 min-h-screen transition-colors duration-300">
      <h2 className="text-3xl font-bold mb-2 text-blue-800 dark:text-blue-300">Admin Dashboard</h2>
      <p className="text-gray-600 dark:text-gray-400 mb-6">Manage users and access permissions</p>
      
      {/* Tabs with improved styling */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden border border-blue-100 dark:border-gray-700 mb-6 transition-colors duration-300">
        {/* Reverting to Headless UI v1 Tab pattern but with improved styling */}
        <Tab.Group selectedIndex={selectedTabIndex} onChange={handleTabChange}>
          <Tab.List className="flex border-b border-blue-100 dark:border-gray-700 bg-blue-50 dark:bg-gray-800">
            <Tab
              className={({ selected }: { selected: boolean }) =>
                `px-6 py-3 text-sm font-medium leading-5 focus:outline-none transition-colors ${
                  selected
                    ? 'text-blue-700 dark:text-blue-300 border-b-2 border-blue-600 dark:border-blue-500 bg-white dark:bg-gray-700'
                    : 'text-gray-600 dark:text-gray-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-100/50 dark:hover:bg-blue-900/30'
                }`
              }
            >
              Create User
            </Tab>
            <Tab
              className={({ selected }: { selected: boolean }) =>
                `px-6 py-3 text-sm font-medium leading-5 focus:outline-none transition-colors ${
                  selected
                    ? 'text-blue-700 dark:text-blue-300 border-b-2 border-blue-600 dark:border-blue-500 bg-white dark:bg-gray-700'
                    : 'text-gray-600 dark:text-gray-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-100/50 dark:hover:bg-blue-900/30'
                }`
              }
            >
              Manage Users
            </Tab>
            <Tab
              className={({ selected }: { selected: boolean }) =>
                `px-6 py-3 text-sm font-medium leading-5 focus:outline-none transition-colors ${
                  selected
                    ? 'text-blue-700 dark:text-blue-300 border-b-2 border-blue-600 dark:border-blue-500 bg-white dark:bg-gray-700'
                    : 'text-gray-600 dark:text-gray-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-100/50 dark:hover:bg-blue-900/30'
                }`
              }
            >
              Reset Voting Data
            </Tab>
          </Tab.List>
          <Tab.Panels>
            <Tab.Panel>{createUserTabComponent}</Tab.Panel>
            <Tab.Panel>{manageUsersTabComponent}</Tab.Panel>
            <Tab.Panel>{resetVotingDataTabComponent}</Tab.Panel>
          </Tab.Panels>
        </Tab.Group>
      </div>
    </div>
  );
};

export default AdminPage;
