import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  const { email, password, role, voters_list_access, family_situation_access, statistics_access } = await req.json();

  const supabaseUrl = Deno.env.get("PROJECT_URL")!;
  const anonKey = Deno.env.get("ANON_KEY")!;
  const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY")!;

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const authHeader = req.headers.get("Authorization")!;
  const jwt = authHeader?.split("Bearer ")[1];

  const adminClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } }
  });

  const { data: userSession } = await adminClient.auth.getUser();
  const userId = userSession?.user?.id;

  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { data: profile } = await supabase
    .from("avp_profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if (!profile || profile.role !== "admin") {
    return new Response("Forbidden", { status: 403 });
  }

  const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true
  });

  if (createError) {
    return new Response(JSON.stringify(createError), { status: 400 });
  }

  const { error: profileError } = await supabase
    .from("avp_profiles")
    .insert({
      id: newUser.user?.id,
      email,
      role,
      voters_list_access,
      family_situation_access,
      statistics_access
    });

  if (profileError) {
    return new Response(JSON.stringify(profileError), { status: 400 });
  }

  return new Response(JSON.stringify({ message: "User created successfully" }), {
    headers: { "Content-Type": "application/json" },
    status: 200
  });
});
