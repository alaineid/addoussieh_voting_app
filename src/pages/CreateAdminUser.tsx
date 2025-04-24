import React, { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const CreateAdminUser = () => {
  const [message, setMessage] = useState('Attempting to create admin user...');

  useEffect(() => {
    const createAdmin = async () => {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const serviceRoleKey = import.meta.env.VITE_SERVICE_ROLE_KEY;

      if (!supabaseUrl || !serviceRoleKey) {
        setMessage('Error: Supabase URL or Service Role Key is missing in .env file. Make sure they are prefixed with VITE_ for this temporary setup.');
        return;
      }

      const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      });

      try {
        const { data, error } = await supabaseAdmin.auth.admin.createUser({
          email: 'bashir.karam@gmail.com',
          password: 'Elections25M@y2@25',
          email_confirm: true,
        });

        if (error) {
          console.error('Supabase admin error:', error);
          setMessage(`Error creating admin user: ${error.message}`);
        } else {
          console.log('Admin user created:', data);
          setMessage(`Successfully created admin user: ${data.user?.email}`);
        }
      } catch (err) {
        console.error('Error during admin user creation:', err);
        setMessage(`An unexpected error occurred: ${err instanceof Error ? err.message : String(err)}`);
      }
    };

    createAdmin();

  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] text-center px-4">
      <h1 className="text-2xl font-bold mb-4">Temporary Admin User Creation</h1>
      <p className="text-red-600 font-semibold mb-4">!! SECURITY WARNING !! This page exposes sensitive credentials. Remove it immediately after use.</p>
      <div className="bg-gray-100 p-6 rounded shadow-md">
        <p className="text-lg">{message}</p>
      </div>
      <p className="mt-4 text-sm text-gray-600">Check the browser console for more details.</p>
    </div>
  );
};

export default CreateAdminUser;
