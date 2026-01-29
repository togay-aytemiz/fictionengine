-- Fix: Allow authenticated users to read stories they have sessions for
-- This policy should already exist, but we add IF NOT EXISTS for safety

-- First, check if the policy exists and works correctly
-- Drop and recreate for safety
DROP POLICY IF EXISTS "Users can view stories with sessions" ON public.stories;

CREATE POLICY "Users can view stories with sessions"
  ON public.stories FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.sessions s
      WHERE s.story_id = stories.id
        AND s.user_id = auth.uid()
    )
  );

-- Also allow reading episodes for stories user has session
DROP POLICY IF EXISTS "Users can view episodes with sessions" ON public.episodes;

CREATE POLICY "Users can view episodes with sessions"
  ON public.episodes FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.sessions s
      WHERE s.story_id = episodes.story_id
        AND s.user_id = auth.uid()
    )
  );
