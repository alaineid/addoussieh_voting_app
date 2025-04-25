import React, { useState, useEffect, useMemo } from 'react';
import { useForm, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import zxcvbn from 'zxcvbn';
import { useAuthStore, UserProfile } from '../store/authStore';
import { useUsersStore } from '../store/usersStore';
import { Tab } from '@headlessui/react';
import { 
  createColumnHelper, 
  flexRender, 
  getCoreRowModel, 
  useReactTable,
  getPaginationRowModel
} from '@tanstack/react-table';
import ConfirmationModal from '../components/ConfirmationModal';
import AlertModal from '../components/AlertModal';

// Toast notification component
interface ToastProps {
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  onClose: () => void;
}

const Toast: React.FC<ToastProps> = ({ message, type, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 3000);

    return () => clearTimeout(timer);
  }, [onClose]);

  const getBgColor = () => {
    switch (type) {
      case 'success': return 'bg-green-500';
      case 'error': return 'bg-red-500';
      case 'warning': return 'bg-yellow-500';
      case 'info': return 'bg-blue-500';
      default: return 'bg-gray-500';
    }
  };

  const getIcon = () => {
    switch (type) {
      case 'success':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
          </svg>
        );
      case 'error':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        );
      case 'warning':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
          </svg>
        );
      case 'info':
      default:
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
        );
    }
  };

  return (
    <div className={`fixed top-4 right-4 z-50 flex items-center p-4 text-white rounded-md shadow-lg transform transition-all duration-300 ${getBgColor()}`}>
      <div className="mr-3">
        {getIcon()}
      </div>
      <div>{message}</div>
      <button 
        onClick={onClose} 
        className="ml-6 text-white hover:text-gray-200"
        aria-label="Close"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
        </svg>
      </button>
    </div>
  );
};

// Create User Form Schema
const schema = z.object({
  email: z.string().email({ message: 'Invalid email address' }),
  full_name: z.string().min(1, { message: 'Full name is required' }),
  password: z.string().min(8, { message: 'Password must be at least 8 characters long' }),
  role: z.enum(['admin', 'user']),
  voters_list_access: z.enum(['none', 'view', 'edit']),
  family_situation_access: z.enum(['none', 'view', 'edit']),
  statistics_access: z.enum(['none', 'view']),
});

type FormValues = z.infer<typeof schema>;

// User Edit Form Schema
const editSchema = z.object({
  id: z.string(),
  full_name: z.string().min(1, { message: 'Full name is required' }),
  role: z.enum(['admin', 'user']),
  voters_list_access: z.enum(['none', 'view', 'edit']),
  family_situation_access: z.enum(['none', 'view', 'edit']),
  statistics_access: z.enum(['none', 'view']),
});

type EditFormValues = z.infer<typeof editSchema>;

// User Profile interface for the table data
interface UserProfileWithEmail extends Omit<UserProfile, 'id'> {
  id: string;
  email: string;
  full_name: string;
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
      <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
        <div
          className={`h-2.5 rounded-full transition-all duration-300 ease-in-out ${strengthColors[score]}`}
          style={{ width: barWidth }}
        ></div>
      </div>
      <p className={`text-sm font-medium ${score < 2 ? 'text-red-600' : score < 4 ? 'text-yellow-600' : 'text-green-600'}`}>
        Strength: {strengthLabels[score]}
      </p>
      {feedback.warning && (
        <p className="text-xs text-red-600">{feedback.warning}</p>
      )}
      {feedback.suggestions.length > 0 && (
        <ul className="list-disc list-inside text-xs text-gray-600">
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
  const { register, handleSubmit, watch, formState: { errors, isSubmitting }, reset } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      role: 'user',
      voters_list_access: 'view',
      family_situation_access: 'view',
      statistics_access: 'view',
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
          voters_list_access: data.voters_list_access,
          family_situation_access: data.family_situation_access,
          statistics_access: data.statistics_access,
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
      <label htmlFor={id} className="block text-sm font-medium text-gray-700">{label}</label>
      <select
        id={id}
        {...register(id as any)}
        className={`mt-1 block w-full pl-3 pr-10 py-2 text-base border ${errors[id] ? 'border-red-500' : 'border-gray-300'} focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md`}
      >
        {options.map(option => (
          <option key={option} value={option}>{option.charAt(0).toUpperCase() + option.slice(1)}</option>
        ))}
      </select>
      {errors[id] && <p className="mt-1 text-xs text-red-600">{errors[id]?.message}</p>}
    </div>
  );

  return (
    <div className="p-6">
      {/* Toast notification */}
      {toast && toast.visible && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={closeToast}
        />
      )}
      
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {serverMessage && (
          <div className={`p-4 rounded-md ${serverMessage.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
            {serverMessage.text}
          </div>
        )}

        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700">Full Name</label>
          <input
            id="name"
            type="text"
            {...register('full_name')}
            className={`mt-1 block w-full px-3 py-2 border ${errors.full_name ? 'border-red-500' : 'border-gray-300'} rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm`}
            placeholder="John Doe"
          />
          {errors.full_name && <p className="mt-1 text-xs text-red-600">{errors.full_name.message}</p>}
        </div>

        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email</label>
          <input
            id="email"
            type="email"
            {...register('email')}
            className={`mt-1 block w-full px-3 py-2 border ${errors.email ? 'border-red-500' : 'border-gray-300'} rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm`}
            placeholder="user@example.com"
          />
          {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>}
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700">Password</label>
          <input
            id="password"
            type="password"
            {...register('password')}
            className={`mt-1 block w-full px-3 py-2 border ${errors.password ? 'border-red-500' : 'border-gray-300'} rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm`}
            placeholder="********"
          />
          {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>}
          <PasswordStrengthMeter strength={passwordStrength} />
        </div>

        {renderSelect('role', 'Role', ['user', 'admin'])}
        {renderSelect('voters_list_access', 'Voters List Access', ['none', 'view', 'edit'])}
        {renderSelect('family_situation_access', 'Family Situation Access', ['none', 'view', 'edit'])}
        {renderSelect('statistics_access', 'Statistics Access', ['none', 'view'])}

        <div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
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
  // Use the global users store instead of local state
  const { users, loading, error, fetchUsers, setupRealtimeListeners, cleanupRealtimeListeners } = useUsersStore();
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [serverMessage, setServerMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const { session } = useAuthStore();
  
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
            className="w-full p-1 border rounded"
          />
        ) : getValue()
    }),
    columnHelper.accessor('email', {
      header: 'Email',
      cell: info => info.getValue()
    }),
    columnHelper.accessor(row => row.role, {
      id: 'role',
      header: 'Role',
      cell: ({ row, getValue }) => 
        editingId === row.original.id ? (
          <select 
            {...register('role')} 
            defaultValue={getValue() as string} 
            className="w-full p-1 border rounded"
          >
            <option value="admin">Admin</option>
            <option value="user">User</option>
          </select>
        ) : getValue()
    }),
    columnHelper.accessor(row => row.voters_list_access, {
      id: 'voters_list_access',
      header: 'Voters List Access',
      cell: ({ row, getValue }) => 
        editingId === row.original.id ? (
          <select 
            {...register('voters_list_access')} 
            defaultValue={getValue() as string} 
            className="w-full p-1 border rounded"
          >
            <option value="none">None</option>
            <option value="view">View</option>
            <option value="edit">Edit</option>
          </select>
        ) : getValue()
    }),
    columnHelper.accessor(row => row.family_situation_access, {
      id: 'family_situation_access',
      header: 'Family Situation Access',
      cell: ({ row, getValue }) => 
        editingId === row.original.id ? (
          <select 
            {...register('family_situation_access')} 
            defaultValue={getValue() as string} 
            className="w-full p-1 border rounded"
          >
            <option value="none">None</option>
            <option value="view">View</option>
            <option value="edit">Edit</option>
          </select>
        ) : getValue()
    }),
    columnHelper.accessor(row => row.statistics_access, {
      id: 'statistics_access',
      header: 'Statistics Access',
      cell: ({ row, getValue }) => 
        editingId === row.original.id ? (
          <select 
            {...register('statistics_access')} 
            defaultValue={getValue() as string} 
            className="w-full p-1 border rounded"
          >
            <option value="none">None</option>
            <option value="view">View</option>
          </select>
        ) : getValue()
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
                className="text-green-600 hover:text-green-800 transition-colors"
                title="Save"
              >
                <i className="fas fa-save text-lg"></i>
              </button>
              <button 
                onClick={() => cancelEdit()}
                className="text-gray-600 hover:text-gray-800 transition-colors"
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
              className="text-blue-600 hover:text-blue-800 transition-colors"
              title="Edit"
            >
              <i className="fas fa-edit text-lg"></i>
            </button>
            <button 
              onClick={() => confirmDelete(user)}
              className="text-red-600 hover:text-red-800 transition-colors"
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
  });

  // Initialize data fetching and realtime listeners
  useEffect(() => {
    if (session?.access_token) {
      console.log('Initializing ManageUsersTab with data and realtime listeners');
      fetchUsers(session.access_token);
      setupRealtimeListeners();
    }
    
    // Clean up when component unmounts
    return () => {
      console.log('Cleaning up ManageUsersTab realtime listeners');
      cleanupRealtimeListeners();
    };
  }, []);

  const startEdit = (user: UserProfileWithEmail) => {
    setEditingId(user.id);
    reset({
      id: user.id,
      full_name: user.full_name,
      role: user.role,
      voters_list_access: user.voters_list_access,
      family_situation_access: user.family_situation_access,
      statistics_access: user.statistics_access
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
          voters_list_access: data.voters_list_access,
          family_situation_access: data.family_situation_access,
          statistics_access: data.statistics_access
        }),
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || `HTTP error! status: ${response.status}`);
      }
      
      // Just exit edit mode without showing a success modal or refreshing the table
      setEditingId(null);
      
      // Manually update the user in the users array instead of refreshing the whole table
      useUsersStore.setState(state => ({
        users: state.users.map(user => 
          user.id === data.id ? { 
            ...user, 
            full_name: data.full_name,
            role: data.role,
            voters_list_access: data.voters_list_access,
            family_situation_access: data.family_situation_access,
            statistics_access: data.statistics_access
          } : user
        )
      }));
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
    return <div className="p-6 text-center">Loading users...</div>;
  }

  if (error) {
    return <div className="p-6 text-center text-red-600">Error: {error}</div>;
  }

  return (
    <div className="p-6">
      {/* Toast notification */}
      {toast && toast.visible && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={closeToast}
        />
      )}

      {serverMessage && (
        <div className={`p-4 mb-4 rounded-md ${serverMessage.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
          {serverMessage.text}
        </div>
      )}
      
      {/* Table and pagination controls */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            {table.getHeaderGroups().map(headerGroup => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map(header => (
                  <th 
                    key={header.id} 
                    scope="col" 
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {table.getRowModel().rows.map(row => (
              <tr key={row.id}>
                {row.getVisibleCells().map(cell => (
                  <td 
                    key={cell.id} 
                    className="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {/* Enhanced pagination controls */}
      <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4 px-2">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-700">
            Showing <span className="font-medium">{table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1}</span> to{" "}
            <span className="font-medium">
              {Math.min((table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize, users.length)}
            </span> of{" "}
            <span className="font-medium">{users.length}</span> users
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => table.setPageIndex(0)}
            disabled={!table.getCanPreviousPage()}
            className="p-2 rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:pointer-events-none"
            aria-label="Go to first page"
            title="First page"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
              <path fillRule="evenodd" d="M15.79 14.77a.75.75 0 01-1.06.02l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 111.04 1.08L11.832 10l3.938 3.71a.75.75 0 01.02 1.06zm-6 0a.75.75 0 01-1.06.02l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 111.04 1.08L5.832 10l3.938 3.71a.75.75 0 01.02 1.06z" clipRule="evenodd" />
            </svg>
          </button>

          <button
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className="p-2 rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:pointer-events-none"
            aria-label="Go to previous page"
            title="Previous page"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
              <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clipRule="evenodd" />
            </svg>
          </button>

          <div className="flex items-center">
            {Array.from({length: Math.min(5, table.getPageCount())}, (_, i) => {
              const pageIndex = table.getState().pagination.pageIndex;
              let showPage: number;
              
              // Logic for which page numbers to display
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
                  className={`px-3 py-1 mx-1 rounded-md text-sm font-medium border ${
                    pageIndex === showPage 
                      ? 'bg-red-600 text-white border-red-600' 
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                  aria-label={`Go to page ${showPage + 1}`}
                  aria-current={pageIndex === showPage ? 'page' : undefined}
                >
                  {showPage + 1}
                </button>
              );
            })}
          </div>

          <button
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className="p-2 rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:pointer-events-none"
            aria-label="Go to next page"
            title="Next page"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
              <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
            </svg>
          </button>

          <button
            onClick={() => table.setPageIndex(table.getPageCount() - 1)}
            disabled={!table.getCanNextPage()}
            className="p-2 rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:pointer-events-none"
            aria-label="Go to last page"
            title="Last page"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
              <path fillRule="evenodd" d="M4.21 5.23a.75.75 0 011.06-.02l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 11-1.04-1.08L8.168 10 4.23 6.29a.75.75 0 01-.02-1.06zm6 0a.75.75 0 011.06-.02l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 11-1.04-1.08L14.168 10l-3.938-3.71a.75.75 0 01-.02-1.06z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700">
            Per page:
            <select
              value={table.getState().pagination.pageSize}
              onChange={e => {
                table.setPageSize(Number(e.target.value));
              }}
              className="ml-2 px-3 py-1 text-sm border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
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
        confirmButtonClass="bg-red-600 hover:bg-red-700"
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

// Main AdminPage component with tabs
const AdminPage = () => {
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

  return (
    <div className="max-w-6xl mx-auto mt-8 bg-white shadow-lg rounded-lg overflow-hidden">
      <h1 className="text-3xl font-bold p-6 border-b">Admin Dashboard</h1>
      
      {/* Reverting to Headless UI v1 Tab pattern */}
      <Tab.Group selectedIndex={selectedTabIndex} onChange={handleTabChange}>
        <Tab.List className="flex border-b">
          <Tab
            className={({ selected }: { selected: boolean }) =>
              `px-6 py-3 text-sm font-medium leading-5 focus:outline-none ${
                selected
                  ? 'text-red-700 border-b-2 border-red-700 bg-red-50'
                  : 'text-gray-500 hover:text-gray-700'
              }`
            }
          >
            Create User
          </Tab>
          <Tab
            className={({ selected }: { selected: boolean }) =>
              `px-6 py-3 text-sm font-medium leading-5 focus:outline-none ${
                selected
                  ? 'text-red-700 border-b-2 border-red-700 bg-red-50'
                  : 'text-gray-500 hover:text-gray-700'
              }`
            }
          >
            Manage Users
          </Tab>
        </Tab.List>
        <Tab.Panels>
          <Tab.Panel className="h-full">
            {createUserTabComponent}
          </Tab.Panel>
          <Tab.Panel className="h-full">
            {manageUsersTabComponent}
          </Tab.Panel>
        </Tab.Panels>
      </Tab.Group>
    </div>
  );
};

export default AdminPage;
