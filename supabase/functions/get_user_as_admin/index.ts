import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.29.0';
import { serve } from 'https://deno.land/std@0.131.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

// Create a Supabase client with the service role key
const supabase = createClient(supabaseUrl, supabaseServiceKey);

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { 
      status: 204, 
      headers: new Headers(corsHeaders) 
    });
  }
  
  try {
    // Check if the request method is GET
    if (req.method !== 'GET') {
      throw new Error('Method not allowed');
    }

    // Get the user ID from the URL
    const url = new URL(req.url);
    const userId = url.searchParams.get('id');
    
    if (!userId) {
      throw new Error('User ID is required');
    }

    // Authentication check bypassed temporarily
    console.log("Authentication bypassed for get_user_as_admin");

    // Get the user details
    const { data: userData, error: getUserError } = await supabase.auth.admin.getUserById(userId);

    if (getUserError) {
      throw new Error(`Failed to get user: ${getUserError.message}`);
    }

    // Get the user's profile
    const { data: userProfile, error: profileGetError } = await supabase
      .from('avp_profiles')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (profileGetError) {
      throw new Error(`Failed to get user profile: ${profileGetError.message}`);
    }

    return new Response(JSON.stringify({ 
      success: true, 
      user: {
        ...userData.user,
        profile: userProfile
      }
    }), {
      status: 200,
      headers: new Headers({ ...corsHeaders, 'Content-Type': 'application/json' })
    });

  } catch (error) {
    console.error(error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }), {
      status: 400,
      headers: new Headers({ ...corsHeaders, 'Content-Type': 'application/json' })
    });
  }
});
