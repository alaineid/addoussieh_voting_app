-- Create the avp_candidate_lists table
CREATE TABLE IF NOT EXISTS public.avp_candidate_lists (
    id SERIAL PRIMARY KEY,
    name VARCHAR NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Insert existing unique list names from avp_candidates into avp_candidate_lists
INSERT INTO public.avp_candidate_lists (name)
SELECT DISTINCT list_name FROM public.avp_candidates
WHERE list_name IS NOT NULL;

-- Add list_id column to avp_candidates table (nullable at first)
ALTER TABLE public.avp_candidates ADD COLUMN list_id INTEGER;

-- Create foreign key reference from avp_candidates.list_id to avp_candidate_lists.id
ALTER TABLE public.avp_candidates ADD CONSTRAINT fk_candidate_list
    FOREIGN KEY (list_id) REFERENCES public.avp_candidate_lists (id);

-- Update the list_id in avp_candidates to match the inserted list names
UPDATE public.avp_candidates c
SET list_id = l.id
FROM public.avp_candidate_lists l
WHERE c.list_name = l.name;

-- Create RLS policies for the new table
ALTER TABLE public.avp_candidate_lists ENABLE ROW LEVEL SECURITY;

-- Everyone can select from this table
CREATE POLICY "Allow all users to select candidate lists" 
    ON public.avp_candidate_lists FOR SELECT 
    USING (true);

-- Only authenticated users with proper role can insert/update/delete
CREATE POLICY "Allow authorized users to insert candidate lists" 
    ON public.avp_candidate_lists FOR INSERT 
    TO authenticated 
    USING (auth.jwt() ->> 'candidate_access' = 'edit');

CREATE POLICY "Allow authorized users to update candidate lists" 
    ON public.avp_candidate_lists FOR UPDATE 
    TO authenticated 
    USING (auth.jwt() ->> 'candidate_access' = 'edit');

CREATE POLICY "Allow authorized users to delete candidate lists" 
    ON public.avp_candidate_lists FOR DELETE 
    TO authenticated 
    USING (auth.jwt() ->> 'candidate_access' = 'edit');