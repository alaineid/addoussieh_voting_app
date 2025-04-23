import React, { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

// !! IMPORTANT SECURITY WARNING !!
// This component uses the SERVICE_ROLE_KEY directly in the frontend.
// This is EXTREMELY insecure and should ONLY be used for a temporary,
// local development setup to create an initial admin user.
// REMOVE this component, the route in App.tsx, and revert the
// VITE_SERVICE_ROLE_KEY back to SERVICE_ROLE_KEY in your .env file
// IMMEDIATELY after use.

const CreateAdminUser = () => {
  const [message, setMessage] = useState('Attempting to create admin user...');

  useEffect(() => {
    const createAdmin = async () => {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      // Read the DANGEROUSLY exposed service role key
      const serviceRoleKey = import.meta.env.VITE_SERVICE_ROLE_KEY;

      if (!supabaseUrl || !serviceRoleKey) {
        setMessage('Error: Supabase URL or Service Role Key is missing in .env file. Make sure they are prefixed with VITE_ for this temporary setup.');
        return;
      }

      // Create a Supabase client using the service role key
      // This bypasses Row Level Security (RLS)
      const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      });

      try {
        const { data, error } = await supabaseAdmin.auth.admin.createUser({
          email: 'bashir.karam@gmail.com', // Change this email
          password: 'Elections25M@y2@25', // CHANGE THIS PASSWORD
          email_confirm: true, // Automatically confirm the email
          // You can add user_metadata or app_metadata here if needed
          // user_metadata: { role: 'admin' } 
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

    // Run the creation function only once when the component mounts
    createAdmin();

  }, []); // Empty dependency array ensures this runs only once

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
