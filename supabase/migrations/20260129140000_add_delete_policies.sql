-- Allow users to delete their own stories and sessions
-- Users can only delete stories they have a session for

-- Delete policy for sessions
DROP POLICY IF EXISTS "Users can delete own sessions" ON public.sessions;
CREATE POLICY "Users can delete own sessions"
  ON public.sessions FOR DELETE
  USING (auth.uid() = user_id);

-- Delete policy for stories (only if user has a session)
DROP POLICY IF EXISTS "Users can delete stories with sessions" ON public.stories;
CREATE POLICY "Users can delete stories with sessions"
  ON public.stories FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.sessions s
      WHERE s.story_id = stories.id
        AND s.user_id = auth.uid()
    )
  );
