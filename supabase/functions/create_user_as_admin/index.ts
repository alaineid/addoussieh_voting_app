import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const allowedOrigins = [
  'http://localhost:8090',
];

const corsHeaders = (origin: string | null) => {
  const headers = new Headers();
  headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'authorization, x-client-info, apikey, content-type');

  if (origin && allowedOrigins.includes(origin)) {
    headers.set('Access-Control-Allow-Origin', origin);
  }
  return headers;
};

serve(async (req) => {
  const requestOrigin = req.headers.get('origin');
  const responseHeaders = corsHeaders(requestOrigin);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: responseHeaders });
  }

  let requestBody;
  try {
    if (!req.body) {
        console.error("Request received without a body.");
        return new Response(JSON.stringify({ error: "Request body is missing." }), {
            headers: { ...Object.fromEntries(responseHeaders), 'Content-Type': 'application/json' },
            status: 400
        });
    }
    requestBody = await req.json();
  } catch (parseError: any) {
    console.error("Failed to parse request body:", parseError);
    console.error("Request Headers:", Object.fromEntries(req.headers.entries()));
    try {
        const textBody = await req.text();
        console.error("Raw request body (text):", textBody);
    } catch (textError) {
        console.error("Could not read request body as text.");
    }
    return new Response(JSON.stringify({ error: `Invalid request body: ${parseError.message}` }), {
      headers: { ...Object.fromEntries(responseHeaders), 'Content-Type': 'application/json' },
      status: 400
    });
  }

  const { email, password, role, voters_list_access, family_situation_access, statistics_access, full_name } = requestBody;

  if (!email || !password || !role || voters_list_access === undefined || family_situation_access === undefined || statistics_access === undefined ) {
    console.error("Missing required fields after parsing body:", requestBody);
    return new Response(JSON.stringify({ error: "Missing required fields in request body." }), {
        headers: { ...Object.fromEntries(responseHeaders), 'Content-Type': 'application/json' },
        status: 400
    });
  }

  const supabaseUrl = Deno.env.get("PROJECT_URL")!;
  const anonKey = Deno.env.get("ANON_KEY")!;
  const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY")!;

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    console.error("Missing environment variables");
    return new Response(JSON.stringify({ error: "Internal server configuration error." }), {
      headers: { ...Object.fromEntries(responseHeaders), 'Content-Type': 'application/json' },
      status: 500
    });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Missing or invalid Authorization header." }), {
      headers: { ...Object.fromEntries(responseHeaders), 'Content-Type': 'application/json' },
      status: 401
    });
  }
  const jwt = authHeader.split("Bearer ")[1];

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const adminClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } }
  });

  try {
    const { data: { user: callingUser }, error: getUserError } = await adminClient.auth.getUser();
    if (getUserError || !callingUser) {
      throw new Error(getUserError?.message || "Could not retrieve calling user session.");
    }

    const { data: profile, error: profileError } = await supabase
      .from("avp_profiles")
      .select("role")
      .eq("id", callingUser.id)
      .single();

    if (profileError) {
       throw new Error(profileError.message || "Could not retrieve calling user profile.");
    }
    if (!profile || profile.role !== "admin") {
      return new Response(JSON.stringify({ error: "Forbidden: User is not an admin." }), {
        headers: { ...Object.fromEntries(responseHeaders), 'Content-Type': 'application/json' },
        status: 403
      });
    }
  } catch (error: any) {
    console.error("Authorization check failed:", error);
    return new Response(JSON.stringify({ error: `Authorization failed: ${error.message}` }), {
      headers: { ...Object.fromEntries(responseHeaders), 'Content-Type': 'application/json' },
      status: 401
    });
  }

  try {
      console.log(`Checking for existing user with email: ${email}`);
      const filterString = `email = '${email}'`;
      console.log(`Using filter string: ${filterString}`);

      const { data: existingUsersData, error: listError } = await supabase.auth.admin.listUsers({
          filter: filterString
      });

      console.log(`Raw response from listUsers for filter [${filterString}]:`, JSON.stringify(existingUsersData));

      if (listError) {
          console.error("Supabase listUsers error:", listError);
          throw new Error(`Failed to check for existing user: ${listError.message || 'Unknown error'}`);
      }

      if (existingUsersData && existingUsersData.users && existingUsersData.users.length > 0) {
          const matchingUser = existingUsersData.users.find(user => user.email.toLowerCase() === email.toLowerCase());
          if (matchingUser) {
              console.log(`Found matching user via manual filter: ${JSON.stringify(matchingUser)}`);
              return new Response(JSON.stringify({ error: "User with this email already exists." }), {
                  headers: { ...Object.fromEntries(responseHeaders), 'Content-Type': 'application/json' },
                  status: 409
              });
          } else {
              console.log(`No matching user found after manual filtering.`);
          }
      } else {
          console.log(`No existing user found matching email via server-side filter: ${email}`);
      }
  } catch (error: any) {
      console.error("Error checking user existence:", error);
      return new Response(JSON.stringify({ error: error.message || "Failed checking user existence." }), {
          headers: { ...Object.fromEntries(responseHeaders), 'Content-Type': 'application/json' },
          status: 500
      });
  }

  let newUser;
  try {
    const { data: createData, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    });

    if (createError || !createData?.user) {
      console.error("Supabase createUser error:", createError);
      let errorMessage = "Failed to create user.";
      if (createError?.message) {
        errorMessage = createError.message;
      }
      return new Response(JSON.stringify({ error: errorMessage }), {
        headers: { ...Object.fromEntries(responseHeaders), 'Content-Type': 'application/json' },
        status: 400
      });
    }
    newUser = createData.user;
  } catch (error: any) {
    console.error("Error during user creation:", error);
    return new Response(JSON.stringify({ error: "An unexpected error occurred during user creation." }), {
      headers: { ...Object.fromEntries(responseHeaders), 'Content-Type': 'application/json' },
      status: 500
    });
  }

  try {
    const { error: profileError } = await supabase
      .from("avp_profiles")
      .insert({
        id: newUser.id,
        email,
        name: full_name || email.split('@')[0], // Use provided name or fallback to username part of email
        role,
        voters_list_access,
        family_situation_access,
        statistics_access
      });

    if (profileError) {
      console.error("Supabase insert profile error:", profileError);
      console.log(`Attempting to delete orphaned auth user: ${newUser.id}`);
      const { error: deleteError } = await supabase.auth.admin.deleteUser(newUser.id);
      if (deleteError) {
        console.error(`Failed to delete orphaned auth user ${newUser.id}:`, deleteError);
      }
      return new Response(JSON.stringify({ error: profileError.message || "Failed to create user profile." }), {
        headers: { ...Object.fromEntries(responseHeaders), 'Content-Type': 'application/json' },
        status: profileError.code === '23505' ? 409 : 500
      });
    }
  } catch (error: any) {
    console.error("Error during profile insertion:", error);
    if (newUser?.id) {
      console.log(`Attempting to delete orphaned auth user due to insertion error: ${newUser.id}`);
      await supabase.auth.admin.deleteUser(newUser.id).catch(err => console.error(`Cleanup failed for ${newUser.id}:`, err));
    }
    return new Response(JSON.stringify({ error: "An unexpected error occurred during profile creation." }), {
      headers: { ...Object.fromEntries(responseHeaders), 'Content-Type': 'application/json' },
      status: 500
    });
  }

  return new Response(JSON.stringify({ message: "User created successfully" }), {
    headers: { ...Object.fromEntries(responseHeaders), 'Content-Type': 'application/json' },
    status: 200
  });
});
