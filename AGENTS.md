# AGENTS.md

## Agent Instructions
-   **Commit Messages**: At the end of every session, provide a **1-line commit message** summarizing your work, followed by **bullet points** of specific changes.
-   **Roadmap Hygiene**: After completing work, update `product_requirements_document.md` → **## 12. Roadmap Checklist** to mark done items with [x] and add new tasks if scope changed.

## Project Context
**FictionEngine** is an interactive fiction platform focused on narrative continuity and a premium reading experience.
-   **Core Backend**: Supabase Edge Functions (Deno/TypeScript) using `gpt-4o-mini`.
-   **Frontend**: React Native Mobile App (Expo).
-   **Key Mechanic**: User inputs story preferences -> Read text segment -> Make one of two choices -> Repeat.

## Developer Workflow
-   **Mobile**: `cd mobile && npx expo start` to run the app.
-   **Backend**: `supabase functions serve` (if locally testing).
-   **Edge Functions Deploy**: If a function needs to be pushed, you may deploy directly with `supabase functions deploy <function-name>`.
-   **Lint/Format**: Keep code minimal and clean.

## Design Philosophy
-   **Aesthetics**: Cool, minimal, elegant.
-   **Typography**: Critical. Must be optimized for long-form reading (serif for body, clean sans for UI).
-   **Layout**: Distraction-free. Content is king.
-   **Interaction**: Subtle animations, smooth transitions between story segments.

## Project Structure
-   `/src`: Shared logic / Backend code (Deno/Node compatible where possible).
-   `/supabase/functions`: Active Edge Functions logic.
-   `/design`: **Single Source of Truth** for Design System (Tokens, Assets).
-   `/mobile`: Active React Native application.
