import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Create a Supabase client with the service role key, which has admin privileges
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Get the authorization header from the incoming request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing Authorization header');
    }

    // Verify the requesting user's JWT
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: verifyError } = await supabaseAdmin.auth.getUser(token);

    if (verifyError || !user) {
      throw new Error('Invalid token or user not found');
    }

    // Check if the user is an admin by querying the profiles table
    const { data: profileData, error: profileError } = await supabaseAdmin
      .from('avp_profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError || !profileData) {
      throw new Error('User profile not found');
    }

    if (profileData.role !== 'admin') {
      throw new Error('User is not authorized as an admin');
    }

    // Fetch user profiles from the database
    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from('avp_profiles')
      .select('*');

    if (profilesError) {
      throw profilesError;
    }

    // Fetch corresponding auth users to get emails
    const { data: authUsers, error: authUsersError } = await supabaseAdmin.auth.admin.listUsers();
    if (authUsersError) {
      throw authUsersError;
    }

    // Merge the profile and auth data
    const mergedUsers = profiles.map(profile => {
      const authUser = authUsers.users.find(user => user.id === profile.id);
      return {
        ...profile,
        email: authUser?.email || 'Unknown email'
      };
    });

    // Return the list of users
    return new Response(
      JSON.stringify({ users: mergedUsers }),
      { 
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json' 
        },
        status: 200
      }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json' 
        },
        status: 400
      }
    );
  }
});