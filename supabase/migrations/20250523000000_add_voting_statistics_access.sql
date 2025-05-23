-- Add voting_statistics_access column to avp_profiles table
ALTER TABLE avp_profiles
ADD COLUMN IF NOT EXISTS voting_statistics_access text DEFAULT 'none'::text NOT NULL;

-- Update policies if needed
ALTER POLICY "Users can view their own profile" ON avp_profiles USING (auth.uid() = id);
ALTER POLICY "Admin users can view all profiles" ON avp_profiles USING (auth.jwt() ->> 'role'::text = 'admin'::text);
ALTER POLICY "Admin users can update all profiles" ON avp_profiles USING (auth.jwt() ->> 'role'::text = 'admin'::text);
ALTER POLICY "Users can update their own profile" ON avp_profiles USING (auth.uid() = id);
