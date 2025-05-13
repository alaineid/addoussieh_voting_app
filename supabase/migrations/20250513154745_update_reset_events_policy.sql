-- Drop the existing policy that's causing the permission error
DROP POLICY IF EXISTS "Allow admins to insert reset events" ON public.reset_events;

-- Create a new policy that allows any authenticated user to insert records
-- This simplifies the permission model for your current application structure
CREATE POLICY "Allow authenticated users to insert reset events"
    ON public.reset_events 
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Optional: Add a comment explaining the change
COMMENT ON POLICY "Allow authenticated users to insert reset events" 
    ON public.reset_events
    IS 'Allows any authenticated user to insert reset events, simplified from previous admin-only policy';