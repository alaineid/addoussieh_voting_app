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

    // Parse the JSON body to get the user ID to delete
    const { userId } = await req.json();
    
    if (!userId) {
      throw new Error('User ID is required');
    }

    // Don't allow admins to delete themselves
    if (userId === user.id) {
      throw new Error('Cannot delete your own account');
    }

    // Delete the user profile first
    const { error: deleteProfileError } = await supabaseAdmin
      .from('avp_profiles')
      .delete()
      .eq('id', userId);

    if (deleteProfileError) {
      throw deleteProfileError;
    }

    // Then delete the auth user
    const { error: deleteUserError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    
    if (deleteUserError) {
      throw deleteUserError;
    }

    return new Response(
      JSON.stringify({ success: true, message: "User deleted successfully" }),
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