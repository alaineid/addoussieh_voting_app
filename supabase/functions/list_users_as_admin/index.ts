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
    
    // Check if a specific userId is requested
    const url = new URL(req.url);
    const userId = url.searchParams.get('userId');
    
    // If userId is provided, fetch just that specific user
    if (userId) {
      console.log(`Fetching single user with ID: ${userId}`);
      
      // Fetch the specific profile
      const { data: profile, error: profileError } = await supabaseAdmin
        .from('avp_profiles')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (profileError) {
        throw new Error(`User profile not found: ${profileError.message}`);
      }
      
      // Fetch the auth user to get the email
      const { data: authUser, error: authUserError } = await supabaseAdmin.auth.admin.getUserById(userId);
      
      if (authUserError || !authUser) {
        throw new Error(`Auth user not found: ${authUserError?.message || 'Unknown error'}`);
      }
      
      // Merge the profile and auth data
      const userData = {
        ...profile,
        email: authUser.user?.email || 'Unknown email'
      };
      
      // Return the single user
      return new Response(
        JSON.stringify({ user: userData }),
        { 
          headers: { 
            ...corsHeaders,
            'Content-Type': 'application/json' 
          },
          status: 200
        }
      );
    }
    
    // If no userId is provided, fetch all users as before
    console.log("Fetching all users");

    // Fetch user profiles from the database
    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from('avp_profiles')
      .select('*');

    if (profilesError) {
      console.error("Error fetching profiles:", profilesError);
      throw profilesError;
    }

    // Fetch corresponding auth users to get emails
    const { data: authUsers, error: authUsersError } = await supabaseAdmin.auth.admin.listUsers();
    if (authUsersError) {
      console.error("Error fetching auth users:", authUsersError);
      throw authUsersError;
    }

    // Merge the profile and auth data
    const mergedUsers = profiles.map(profile => {
      const authUser = authUsers.users.find(user => user.id === profile.id);
      if (!authUser) {
        console.warn(`No auth user found for profile ID: ${profile.id}`);
      }
      return {
        ...profile,
        email: authUser?.email || 'Unknown email'
      };
    });

    console.log("Merged users:", mergedUsers);

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