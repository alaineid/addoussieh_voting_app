import React, { useState, useEffect, useMemo } from 'react';
import { useForm, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useAuthStore } from '../store/authStore';
import { useThemeStore } from '../store/themeStore';
import { supabase } from '../lib/supabaseClient';
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
        return <i className="fas fa-check-circle w-5 h-5"></i>;
      case 'error':
        return <i className="fas fa-times-circle w-5 h-5"></i>;
      case 'warning':
        return <i className="fas fa-exclamation-triangle w-5 h-5"></i>;
      case 'info':
      default:
        return <i className="fas fa-info-circle w-5 h-5"></i>;
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
        <i className="fas fa-times w-4 h-4"></i>
      </button>
    </div>
  );
};

// Candidate interface
interface Candidate {
  id: number;  // Foreign key from avp_voters table
  full_name?: string;  // From avp_voters table
  list_name: string;
  candidate_of: string;
  score: number;
}

// Voter interface for selecting candidates
interface Voter {
  id: number;
  full_name: string;
  gender?: string;
  register_sect?: string;
  residence?: string;
  situation?: string;
  family?: string;
  has_voted?: boolean;
  dob?: string;
}

// Create Candidate Form Schema
const candidateSchema = z.object({
  voter_id: z.number().min(1, { message: 'Voter is required' }),
  list_name: z.string().min(1, { message: 'List name is required' }),
  candidate_of: z.string().min(1, { message: 'Candidate of is required' }),
});

type CandidateFormValues = z.infer<typeof candidateSchema>;

// Create Candidate Tab Component
const CreateCandidateTab = () => {
  const { isDarkMode } = useThemeStore();
  const [voters, setVoters] = useState<Voter[]>([]);
  const [loading, setLoading] = useState(false);
  const [votersLoading, setVotersLoading] = useState(true);
  const { register, handleSubmit, formState: { errors, isSubmitting }, reset, watch } = useForm<CandidateFormValues>({
    resolver: zodResolver(candidateSchema),
  });
  const { session } = useAuthStore();
  
  // Alert modal state for errors
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

  // Fetch available voters
  useEffect(() => {
    const fetchVoters = async () => {
      setVotersLoading(true);
      try {
        // Fetch voters who are not already candidates
        const { data: candidates, error: candidatesError } = await supabase
          .from('avp_candidates')
          .select('id');
          
        if (candidatesError) throw candidatesError;
        
        const candidateIds = (candidates || []).map(c => c.id);
        
        let query = supabase
          .from('avp_voters')
          .select('id, full_name, gender, register_sect, residence');
          
        // If we have candidates, exclude them from the query
        if (candidateIds.length > 0) {
          query = query.not('id', 'in', `(${candidateIds.join(',')})`);
        }
        
        const { data: voters, error: votersError } = await query;
        
        if (votersError) throw votersError;
        
        setVoters(voters || []);
      } catch (error) {
        console.error('Error fetching voters:', error);
      } finally {
        setVotersLoading(false);
      }
    };
    
    fetchVoters();
  }, []);

  const onSubmit: SubmitHandler<CandidateFormValues> = async (data) => {
    setLoading(true);
    try {
      // Insert candidate into the avp_candidates table
      const { data: newCandidate, error } = await supabase
        .from('avp_candidates')
        .insert([
          { 
            id: data.voter_id, 
            list_name: data.list_name, 
            candidate_of: data.candidate_of, 
            score: 0  // Initialize score to 0
          }
        ])
        .select('*')
        .single();

      if (error) {
        throw new Error(`Error creating candidate: ${error.message}`);
      }

      // Show success message
      const selectedVoter = voters.find(v => v.id === data.voter_id);
      const voterName = selectedVoter?.full_name || `Voter ID: ${data.voter_id}`;
      
      setToast({
        message: `${voterName} added as a candidate successfully!`,
        type: 'success',
        visible: true
      });
      
      // Reset the form
      reset();

    } catch (error: any) {
      console.error('Error creating candidate:', error);
      setAlertConfig({
        title: 'Error',
        message: error.message || 'Failed to create candidate.',
        type: 'error'
      });
      setAlertModalOpen(true);
    } finally {
      setLoading(false);
    }
  };

  const closeToast = () => {
    setToast(null);
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
      
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 max-w-xl mx-auto">
        <div>
          <label htmlFor="voter_id" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Voter</label>
          <select
            id="voter_id"
            {...register('voter_id', { valueAsNumber: true })}
            className={`mt-1 block w-full px-3 py-2 border ${errors.voter_id ? 'border-red-500' : 'border-blue-200 dark:border-blue-800'} bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm`}
            disabled={votersLoading}
          >
            <option value="">Select a voter</option>
            {voters.map((voter) => (
              <option key={voter.id} value={voter.id}>
                {voter.full_name} {voter.gender ? `(${voter.gender})` : ''} {voter.residence ? `- ${voter.residence}` : ''}
              </option>
            ))}
          </select>
          {errors.voter_id && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.voter_id.message}</p>}
          {votersLoading && (
            <p className="mt-1 text-xs text-blue-600 dark:text-blue-400">Loading voters...</p>
          )}
        </div>

        <div>
          <label htmlFor="list_name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">List Name</label>
          <input
            id="list_name"
            type="text"
            {...register('list_name')}
            className={`mt-1 block w-full px-3 py-2 border ${errors.list_name ? 'border-red-500' : 'border-blue-200 dark:border-blue-800'} bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm`}
            placeholder="List name"
          />
          {errors.list_name && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.list_name.message}</p>}
        </div>

        <div>
          <label htmlFor="candidate_of" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Candidate Of</label>
          <input
            id="candidate_of"
            type="text"
            {...register('candidate_of')}
            className={`mt-1 block w-full px-3 py-2 border ${errors.candidate_of ? 'border-red-500' : 'border-blue-200 dark:border-blue-800'} bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm`}
            placeholder="e.g., Mayor, Council Member, etc."
          />
          {errors.candidate_of && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.candidate_of.message}</p>}
        </div>

        <div>
          <button
            type="submit"
            disabled={isSubmitting || loading || votersLoading}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting || loading ? 'Creating Candidate...' : 'Create Candidate'}
          </button>
        </div>
      </form>

      {/* Alert modal for errors */}
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

// Manage Candidates Tab Component
const ManageCandidatesTab = () => {
  const { isDarkMode } = useThemeStore();
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [sorting, setSorting] = useState<SortingState>([]);
  
  // State for modals
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [candidateToDelete, setCandidateToDelete] = useState<Candidate | null>(null);
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

  const { register, handleSubmit, formState: { errors }, reset, setValue } = useForm<{
    list_name: string;
    candidate_of: string;
  }>({
    resolver: zodResolver(z.object({
      list_name: z.string().min(1, { message: 'List name is required' }),
      candidate_of: z.string().min(1, { message: 'Candidate of is required' }),
    }))
  });
  
  const closeToast = () => {
    setToast(null);
  };

  // Fetch candidates data
  const fetchCandidates = async () => {
    try {
      // Join avp_candidates with avp_voters to get voter information
      const { data, error } = await supabase
        .from('avp_candidates')
        .select(`
          id,
          list_name,
          candidate_of,
          score,
          avp_voters!inner(full_name, gender, register_sect, residence)
        `)
        .order('id', { ascending: true });
      
      if (error) throw error;
      
      // Transform the data to match our Candidate interface
      const formattedCandidates = (data || []).map(item => ({
        id: item.id,
        full_name: item.avp_voters.full_name,
        list_name: item.list_name,
        candidate_of: item.candidate_of,
        score: item.score
      }));
      
      setCandidates(formattedCandidates);
      setLoading(false);
    } catch (error: any) {
      console.error('Error fetching candidates:', error);
      setError(error.message);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCandidates();

    // Set up real-time subscription
    const channel = supabase
      .channel('avp-candidates-changes')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'avp_candidates' 
      }, () => {
        fetchCandidates();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const columnHelper = createColumnHelper<Candidate>();
  const columns = [
    columnHelper.accessor('id', {
      header: 'ID',
      cell: info => info.getValue(),
      enableSorting: true,
    }),
    columnHelper.accessor('full_name', {
      header: 'Candidate Name',
      cell: info => info.getValue(),
      enableSorting: true,
    }),
    columnHelper.accessor('list_name', {
      header: 'List Name',
      cell: ({ row, getValue }) => 
        editingId === row.original.id ? (
          <input 
            {...register('list_name')} 
            defaultValue={getValue() as string} 
            className="w-full p-1 border rounded dark:bg-gray-700 dark:text-white dark:border-gray-600"
          />
        ) : getValue(),
      enableSorting: true,
    }),
    columnHelper.accessor('candidate_of', {
      header: 'Candidate Of',
      cell: ({ row, getValue }) => 
        editingId === row.original.id ? (
          <input 
            {...register('candidate_of')} 
            defaultValue={getValue() as string} 
            className="w-full p-1 border rounded dark:bg-gray-700 dark:text-white dark:border-gray-600"
          />
        ) : getValue(),
      enableSorting: true,
    }),
    columnHelper.accessor('score', {
      header: 'Score',
      cell: info => info.getValue(),
      enableSorting: true,
    }),
    columnHelper.display({
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => {
        const candidate = row.original;
        
        if (editingId === candidate.id) {
          return (
            <div className="flex space-x-3">
              <button 
                onClick={handleSubmit(data => saveCandidate(candidate.id, data))}
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
              onClick={() => startEdit(candidate)}
              className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors"
              title="Edit"
            >
              <i className="fas fa-edit text-lg"></i>
            </button>
            <button 
              onClick={() => confirmDelete(candidate)}
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
    data: candidates,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    state: {
      sorting,
    },
    onSortingChange: setSorting,
  });

  const startEdit = (candidate: Candidate) => {
    setEditingId(candidate.id);
    setValue('list_name', candidate.list_name);
    setValue('candidate_of', candidate.candidate_of);
  };

  const cancelEdit = () => {
    setEditingId(null);
    reset();
  };

  const saveCandidate = async (id: number, data: { list_name: string; candidate_of: string }) => {
    try {
      // Update candidate in the database
      const { error } = await supabase
        .from('avp_candidates')
        .update({ 
          list_name: data.list_name,
          candidate_of: data.candidate_of,
        })
        .eq('id', id);

      if (error) {
        throw new Error(`Error updating candidate: ${error.message}`);
      }

      // Show success toast
      setToast({
        message: 'Candidate updated successfully',
        type: 'success',
        visible: true
      });
      
      // Exit edit mode and refresh data
      setEditingId(null);
      fetchCandidates();

    } catch (error: any) {
      console.error('Error updating candidate:', error);
      setAlertConfig({
        title: 'Error',
        message: error.message || 'Failed to update candidate',
        type: 'error'
      });
      setAlertModalOpen(true);
    }
  };

  const confirmDelete = (candidate: Candidate) => {
    setCandidateToDelete(candidate);
    setDeleteModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!candidateToDelete) return;
    
    try {
      // Delete the candidate from the database
      const { error } = await supabase
        .from('avp_candidates')
        .delete()
        .eq('id', candidateToDelete.id);

      if (error) {
        throw new Error(`Error deleting candidate: ${error.message}`);
      }

      // Show success toast
      setToast({
        message: `${candidateToDelete.full_name} removed as candidate successfully`,
        type: 'success',
        visible: true
      });
      
      // Close the modal and refresh data
      setDeleteModalOpen(false);
      fetchCandidates();

    } catch (error: any) {
      console.error('Error deleting candidate:', error);
      setAlertConfig({
        title: 'Error',
        message: error.message || 'Failed to delete candidate',
        type: 'error'
      });
      setAlertModalOpen(true);
    }
  };

  if (loading) {
    return (
      <div className="p-6 bg-white dark:bg-gray-800 rounded-lg transition-colors duration-300">
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-center bg-white dark:bg-gray-800 rounded-lg transition-colors duration-300">
        <div className="bg-red-50 dark:bg-red-900/30 border-l-4 border-red-500 dark:border-red-700 p-6 rounded-lg shadow-sm max-w-lg mx-auto">
          <div className="flex items-center">
            <i className="fas fa-exclamation-circle h-8 w-8 text-red-500 dark:text-red-400 mr-3"></i>
            <p className="text-red-700 dark:text-red-300 text-lg font-medium">{error}</p>
          </div>
          <p className="mt-3 text-red-600 dark:text-red-400 text-sm">Please try refreshing the page or contact an administrator.</p>
        </div>
      </div>
    );
  }

  // Calculate stats for display
  const totalCandidates = candidates.length;
  const totalScore = candidates.reduce((sum, candidate) => sum + candidate.score, 0);
  const uniqueLists = new Set(candidates.map(c => c.list_name)).size;

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
            <i className="fas fa-user-tie text-blue-600 dark:text-blue-400"></i>
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Total Candidates</p>
            <p className="text-2xl font-bold text-gray-800 dark:text-gray-100">{totalCandidates}</p>
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 flex items-center border border-blue-100 dark:border-blue-900">
          <div className="rounded-full bg-green-100 dark:bg-green-900/50 p-3 mr-4 flex items-center justify-center w-12 h-12">
            <i className="fas fa-vote-yea text-green-600 dark:text-green-400"></i>
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Total Score</p>
            <p className="text-2xl font-bold text-gray-800 dark:text-gray-100">{totalScore}</p>
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 flex items-center border border-blue-100 dark:border-blue-900">
          <div className="rounded-full bg-purple-100 dark:bg-purple-900/50 p-3 mr-4 flex items-center justify-center w-12 h-12">
            <i className="fas fa-list text-purple-600 dark:text-purple-400"></i>
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Lists</p>
            <p className="text-2xl font-bold text-gray-800 dark:text-gray-100">{uniqueLists}</p>
          </div>
        </div>
      </div>
      
      {/* Candidates table */}
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
              {Math.min((table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize, candidates.length)}
            </span> of{" "}
            <span className="font-semibold text-blue-900 dark:text-blue-400">{candidates.length}</span> candidates
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

          {/* Page number buttons */}
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
          
          {/* Mobile pagination info */}
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

        {/* Items per page selector */}
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
        title="Remove Candidate"
        message={candidateToDelete ? `Are you sure you want to remove ${candidateToDelete.full_name} as a candidate?` : 'Are you sure you want to remove this candidate?'}
        confirmText="Remove"
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

// Main Candidates component with tabs
const Candidates = () => {
  const { isDarkMode } = useThemeStore();
  const [selectedTabIndex, setSelectedTabIndex] = useState(0);

  // Load the saved tab index from localStorage when component mounts
  useEffect(() => {
    const savedTabIndex = localStorage.getItem('candidatesPageTabIndex');
    if (savedTabIndex !== null) {
      setSelectedTabIndex(parseInt(savedTabIndex, 10));
    }
  }, []);

  // Save the tab index to localStorage whenever it changes
  const handleTabChange = (index: number) => {
    setSelectedTabIndex(index);
    localStorage.setItem('candidatesPageTabIndex', index.toString());
  };

  // Use useMemo to persist the tab components across renders
  const createCandidateTabComponent = useMemo(() => <CreateCandidateTab />, []);
  const manageCandidatesTabComponent = useMemo(() => <ManageCandidatesTab />, []);

  return (
    <div className="p-4 sm:p-6 bg-white dark:bg-gray-900 min-h-screen transition-colors duration-300">
      <h2 className="text-3xl font-bold mb-2 text-blue-800 dark:text-blue-300">Candidates Management</h2>
      <p className="text-gray-600 dark:text-gray-400 mb-6">Create and manage election candidates</p>
      
      {/* Tabs with improved styling */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden border border-blue-100 dark:border-gray-700 mb-6 transition-colors duration-300">
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
              Create Candidate
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
              Manage Candidates
            </Tab>
          </Tab.List>
          <Tab.Panels>
            <Tab.Panel>{createCandidateTabComponent}</Tab.Panel>
            <Tab.Panel>{manageCandidatesTabComponent}</Tab.Panel>
          </Tab.Panels>
        </Tab.Group>
      </div>
    </div>
  );
};

export default Candidates;