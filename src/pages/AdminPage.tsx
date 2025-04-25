import React, { useState, useEffect } from 'react';
import { useForm, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import zxcvbn from 'zxcvbn';
import { useAuthStore, UserProfile } from '../store/authStore';
import { Tab } from '@headlessui/react';
import { 
  createColumnHelper, 
  flexRender, 
  getCoreRowModel, 
  useReactTable,
  getPaginationRowModel
} from '@tanstack/react-table';
import { supabase } from '../lib/supabaseClient';
import ConfirmationModal from '../components/ConfirmationModal';
import AlertModal from '../components/AlertModal';

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
      voters_list_access: 'none',
      family_situation_access: 'none',
      statistics_access: 'none',
    },
  });
  const [serverMessage, setServerMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [passwordStrength, setPasswordStrength] = useState<PasswordStrength | null>(null);
  const { session } = useAuthStore();
  
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

      // Show success message using the custom alert modal
      setAlertConfig({
        title: 'Success',
        message: `User ${data.email} created successfully!`,
        type: 'success'
      });
      setAlertModalOpen(true);
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
      
      {/* Alert modal */}
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
  const [users, setUsers] = useState<UserProfileWithEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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

  const { register, handleSubmit, formState: { errors }, reset } = useForm<EditFormValues>({
    resolver: zodResolver(editSchema)
  });

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
    data: users,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  // Fetch users on component mount
  useEffect(() => {
    fetchUsers();
    setupRealtimeListeners();
    
    return () => {
      // Clean up realtime subscription when component unmounts
      supabase.channel('avp_profiles').unsubscribe();
    };
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    
    try {
      if (!session?.access_token) {
        throw new Error('Authentication error: No access token found.');
      }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      if (!supabaseUrl) {
        throw new Error('Configuration error: Supabase URL not found.');
      }
      
      // Call our custom serverless function instead of using the admin API directly
      const functionUrl = `${supabaseUrl}/functions/v1/list_users_as_admin`;
      
      const response = await fetch(functionUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || `HTTP error! status: ${response.status}`);
      }
      
      setUsers(result.users);
    } catch (error: any) {
      console.error('Error fetching users:', error);
      setError(error.message || 'Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  const setupRealtimeListeners = () => {
    supabase
      .channel('avp_profiles_changes')
      .on(
        'postgres_changes', 
        {
          event: '*',
          schema: 'public',
          table: 'avp_profiles'
        }, 
        () => {
          fetchUsers(); // Refresh data when changes occur
        }
      )
      .subscribe();
  };

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
      
      // Show success message using AlertModal
      setAlertConfig({
        title: 'Success',
        message: 'User updated successfully!',
        type: 'success'
      });
      setAlertModalOpen(true);
      
      setEditingId(null);
      fetchUsers(); // Refresh the list
    } catch (error: any) {
      console.error('Error updating user:', error);
      
      // Show error message using AlertModal
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
      
      // Show success message in custom alert modal
      setAlertConfig({
        title: 'Success',
        message: 'User deleted successfully!',
        type: 'success'
      });
      setAlertModalOpen(true);
      
      fetchUsers(); // Refresh the list
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
      
      <div className="flex items-center justify-between mt-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => table.setPageIndex(0)}
            disabled={!table.getCanPreviousPage()}
            className="px-2 py-1 border rounded disabled:opacity-50"
          >
            {'<<'}
          </button>
          <button
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className="px-2 py-1 border rounded disabled:opacity-50"
          >
            {'<'}
          </button>
          <button
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className="px-2 py-1 border rounded disabled:opacity-50"
          >
            {'>'}
          </button>
          <button
            onClick={() => table.setPageIndex(table.getPageCount() - 1)}
            disabled={!table.getCanNextPage()}
            className="px-2 py-1 border rounded disabled:opacity-50"
          >
            {'>>'}
          </button>
        </div>
        <div className="text-sm text-gray-700">
          Page {table.getState().pagination.pageIndex + 1} of{' '}
          {table.getPageCount()}
        </div>
        <select
          value={table.getState().pagination.pageSize}
          onChange={e => {
            table.setPageSize(Number(e.target.value));
          }}
          className="px-2 py-1 border rounded"
        >
          {[10, 20, 30, 40, 50].map(pageSize => (
            <option key={pageSize} value={pageSize}>
              Show {pageSize}
            </option>
          ))}
        </select>
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
  return (
    <div className="max-w-6xl mx-auto mt-8 bg-white shadow-lg rounded-lg overflow-hidden">
      <h1 className="text-3xl font-bold p-6 border-b">Admin Dashboard</h1>
      
      <Tab.Group>
        <Tab.List className="flex border-b">
          <Tab
            className={({ selected }) =>
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
            className={({ selected }) =>
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
          <Tab.Panel>
            <CreateUserTab />
          </Tab.Panel>
          <Tab.Panel>
            <ManageUsersTab />
          </Tab.Panel>
        </Tab.Panels>
      </Tab.Group>
    </div>
  );
};

export default AdminPage;
