import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

interface RequestBody {
  userId: string;
  full_name: string;
  role: string;
  registered_voters_access: string;
  family_situation_access: string;
  statistics_access: string;
  voting_day_access: string;
  voting_statistics_access: string;
  vote_counting: string;
  live_score_access: string;
  candidate_access: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Check if the request method is POST
    if (req.method !== 'POST') {
      throw new Error('Method not allowed');
    }

    // Check content type
    const contentType = req.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      throw new Error('Invalid content type. Expected application/json');
    }

    // Parse the request body
    const requestData = await req.json();
    
    // Validate required fields
    if (!requestData.userId) {
      throw new Error('Missing required field: userId');
    }

    // Create Supabase client with admin privileges
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
    
    // Authentication check bypassed temporarily
    console.log("Authentication bypassed for update_user_as_admin");

    // Update the user's profile
    const { data: updatedData, error: updateError } = await supabaseAdmin
      .from('avp_profiles')
      .update({
        full_name: requestData.full_name,
        role: requestData.role,
        registered_voters_access: requestData.registered_voters_access,
        family_situation_access: requestData.family_situation_access,
        statistics_access: requestData.statistics_access,
        voting_day_access: requestData.voting_day_access,
        voting_statistics_access: requestData.voting_statistics_access,
        vote_counting: requestData.vote_counting,
        live_score_access: requestData.live_score_access,
        candidate_access: requestData.candidate_access
      })
      .eq('id', requestData.userId)
      .select();

    if (updateError) {
      throw new Error(`Failed to update user profile: ${updateError.message}`);
    }

    return new Response(
      JSON.stringify({ success: true, user: updatedData }),
      { 
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json' 
        },
        status: 200
      }
    );

  } catch (error) {
    console.error(error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }),
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
