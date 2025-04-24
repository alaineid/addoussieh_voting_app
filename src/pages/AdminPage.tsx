import React, { useState, useEffect } from 'react';
import { useForm, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import zxcvbn from 'zxcvbn';
import { useAuthStore } from '../store/authStore';

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

interface PasswordStrength {
  score: number;
  feedback: {
    warning: string | null;
    suggestions: string[];
  };
}

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


const AdminCreateUser = () => {
  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<FormValues>({
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
      setServerMessage({ type: 'error', text: 'Authentication error: No access token found.' });
      return;
    }

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    if (!supabaseUrl) {
        setServerMessage({ type: 'error', text: 'Configuration error: Supabase URL not found.' });
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

      setServerMessage({ type: 'success', text: `User ${data.email} created successfully!` });

    } catch (error: any) {
      console.error('Error calling create_user_as_admin function:', error);
      setServerMessage({ type: 'error', text: error.message || 'Failed to create user.' });
    }
  };

  const renderSelect = (id: keyof FormValues, label: string, options: string[]) => (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700">{label}</label>
      <select
        id={id}
        {...register(id)}
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
    <div className="max-w-2xl mx-auto mt-10 p-8 bg-white shadow-lg rounded-lg">
      <h2 className="text-2xl font-semibold text-gray-900 mb-6">Create New User</h2>
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
    </div>
  );
};

export default AdminCreateUser;
