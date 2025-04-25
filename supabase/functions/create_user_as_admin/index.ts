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
    // Parse the request body
    let requestBody;
    try {
      if (!req.body) {
        throw new Error("Request body is missing.");
      }
      requestBody = await req.json();
    } catch (parseError: any) {
      throw new Error(`Invalid request body: ${parseError.message}`);
    }

    const { email, password, role, voters_list_access, family_situation_access, statistics_access, full_name } = requestBody;

    if (!email || !password || !role || voters_list_access === undefined || family_situation_access === undefined || statistics_access === undefined) {
      throw new Error("Missing required fields in request body.");
    }

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
    const { data: { user: callingUser }, error: verifyError } = await supabaseAdmin.auth.getUser(token);

    if (verifyError || !callingUser) {
      throw new Error('Invalid token or user not found');
    }

    // Check if the user is an admin by querying the profiles table
    const { data: profileData, error: profileError } = await supabaseAdmin
      .from('avp_profiles')
      .select('role')
      .eq('id', callingUser.id)
      .single();

    if (profileError || !profileData) {
      throw new Error('User profile not found');
    }

    if (profileData.role !== 'admin') {
      throw new Error('User is not authorized as an admin');
    }

    // Check if a user with the same email already exists
    const { data: existingUsersData, error: listError } = await supabaseAdmin.auth.admin.listUsers({
      filter: `email = '${email}'`
    });

    if (listError) {
      throw new Error(`Failed to check for existing user: ${listError.message || 'Unknown error'}`);
    }

    if (existingUsersData?.users?.length > 0) {
      const matchingUser = existingUsersData.users.find(user => user.email.toLowerCase() === email.toLowerCase());
      if (matchingUser) {
        return new Response(
          JSON.stringify({ error: "User with this email already exists." }), 
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 409 }
        );
      }
    }

    // Create the user in auth
    const { data: createData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    });

    if (createError || !createData?.user) {
      throw new Error(createError?.message || "Failed to create user.");
    }

    const newUser = createData.user;

    // Create the user profile
    try {
      const { error: profileInsertError } = await supabaseAdmin
        .from("avp_profiles")
        .insert({
          id: newUser.id,
          email,
          full_name: full_name || email.split('@')[0], // Use provided name or fallback
          role,
          voters_list_access,
          family_situation_access,
          statistics_access
        });

      if (profileInsertError) {
        // Clean up by deleting the auth user if profile creation fails
        await supabaseAdmin.auth.admin.deleteUser(newUser.id)
          .catch(err => console.error(`Cleanup failed for ${newUser.id}:`, err));
          
        throw new Error(profileInsertError.message || "Failed to create user profile.");
      }
    } catch (error: any) {
      // Clean up by deleting the auth user if profile creation fails
      await supabaseAdmin.auth.admin.deleteUser(newUser.id)
        .catch(err => console.error(`Cleanup failed for ${newUser.id}:`, err));
        
      throw error;
    }

    return new Response(
      JSON.stringify({ success: true, message: "User created successfully" }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
