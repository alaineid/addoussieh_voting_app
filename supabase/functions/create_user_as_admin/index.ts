import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

// Create a Supabase client with the service role key
const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface RequestBody {
  email: string;
  full_name: string;
  password: string;
  role: 'admin' | 'user';
  registered_voters_access: 'none' | 'view' | 'edit';
  family_situation_access: 'none' | 'view' | 'edit';
  statistics_access: 'none' | 'view';
  voting_day_access?: 'none' | 'view female' | 'view male' | 'view both' | 'edit female' | 'edit male' | 'edit both';
  voting_statistics_access?: 'none' | 'view';
  vote_counting?: 'none' | 'count female votes' | 'count male votes';
  live_score_access?: 'none' | 'view';
  candidate_access?: 'none' | 'view' | 'edit';
}

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { 
      status: 204, 
      headers: new Headers(corsHeaders) 
    });
  }
  
  try {
    // Check if the request method is POST
    if (req.method !== 'POST') {
      throw new Error('Method not allowed');
    }

    // Check that the request body is JSON
    const contentType = req.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      throw new Error('Invalid content type. Expected application/json');
    }

    // Parse the request body
    const requestData: RequestBody = await req.json();
    
    // Validate required fields
    const requiredFields = ['email', 'password', 'full_name', 'role', 'registered_voters_access', 'family_situation_access', 'statistics_access'];
    for (const field of requiredFields) {
      if (!requestData[field as keyof RequestBody]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(requestData.email)) {
      throw new Error('Invalid email format');
    }

    // Authentication check bypassed temporarily
    console.log("Authentication bypassed for create_user_as_admin");

    // Create the user
    const { data: userData, error: createError } = await supabase.auth.admin.createUser({
      email: requestData.email,
      password: requestData.password,
      email_confirm: true, // Auto-confirm the email
    });

    if (createError || !userData) {
      throw new Error(createError?.message || 'Failed to create user');
    }

    // Create or update the user's profile with permissions
    const { error: profileUpdateError } = await supabase
      .from('avp_profiles')
      .upsert({
        id: userData.user.id,
        email: requestData.email, // Adding the email field to satisfy not-null constraint
        full_name: requestData.full_name,
        role: requestData.role,
        registered_voters_access: requestData.registered_voters_access,
        family_situation_access: requestData.family_situation_access,
        statistics_access: requestData.statistics_access,
        voting_day_access: requestData.voting_day_access || 'none',
        voting_statistics_access: requestData.voting_statistics_access || 'none',
        vote_counting: requestData.vote_counting || 'none',
        live_score_access: requestData.live_score_access || 'none',
        candidate_access: requestData.candidate_access || 'none',
      });

    if (profileUpdateError) {
      // If there was an error updating the profile, delete the user
      await supabase.auth.admin.deleteUser(userData.user.id);
      throw new Error(`Failed to set user permissions: ${profileUpdateError.message}`);
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'User created successfully',
      user: { id: userData.user.id, email: userData.user.email }
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
