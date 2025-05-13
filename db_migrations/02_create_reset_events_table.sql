-- Create reset_events table to track data reset operations
CREATE TABLE IF NOT EXISTS public.reset_events (
    id SERIAL PRIMARY KEY,
    type VARCHAR NOT NULL, -- resetVotingMarks, resetBallots, resetAll, etc.
    reset_by UUID NOT NULL,
    reset_time TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    
    CONSTRAINT fk_reset_by
        FOREIGN KEY (reset_by)
        REFERENCES auth.users (id)
        ON DELETE CASCADE
);

-- Enable Row Level Security
ALTER TABLE public.reset_events ENABLE ROW LEVEL SECURITY;

-- Add a policy to allow only admins to insert records
CREATE POLICY "Allow admins to insert reset events"
    ON public.reset_events FOR INSERT
    TO authenticated
    WITH CHECK (auth.jwt() ->> 'role' = 'admin');

-- Add a policy to allow everyone to select records
CREATE POLICY "Allow all to view reset events"
    ON public.reset_events FOR SELECT
    USING (true);

-- Enable real-time subscriptions for this table
ALTER PUBLICATION supabase_realtime ADD TABLE public.reset_events;

-- Add comment to explain purpose
COMMENT ON TABLE public.reset_events IS 'Tracks events when voting data is reset from the admin page';