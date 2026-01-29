# CLAUDE.md - BookEngine Agent Rules

## Project Overview
**FictionEngine** is an interactive fiction platform focusing on narrative continuity and premium reading experience.

## Tech Stack
- **Mobile**: React Native (Expo) with TypeScript
- **Backend**: Supabase Edge Functions (Deno/TypeScript)
- **AI**: OpenAI GPT-4o-mini for story generation
- **State**: Zustand

## Core Mechanic
User inputs story preferences → Read text segment → Make one of two choices → Repeat

## Non-Negotiable Priorities
1. **Continuity**: Never contradict Story Bible or Facts Ledger
2. **Rating Compliance**: Strict adherence to audience_profile limits
3. **Interactive Structure**: Always end with exactly two choices
4. **Structured Output**: Valid JSON following schema exactly

## Developer Workflow
```bash
# Mobile development
cd mobile && npx expo start

# Backend (local testing)
supabase functions serve
```

## Design Philosophy
- **Aesthetics**: Cool, minimal, elegant
- **Typography**: Serif for body (reading), clean sans for UI
- **Layout**: Distraction-free, content is king
- **Interaction**: Subtle animations, smooth transitions

## Folder Structure
```
/mobile           # Expo React Native app
  /app            # Expo Router screens
  /src            # Business logic
    /components   # Reusable UI
    /services     # API services
    /types        # TypeScript interfaces
    /stores       # Zustand stores
    /hooks        # Custom hooks
/supabase         # Edge Functions
/design           # Design tokens (single source of truth)
```

## Commit Convention
Provide 1-line summary + bullet points of specific changes at session end.

## Roadmap Hygiene
After completing work, update `product_requirements_document.md` → **## 12. Roadmap Checklist**:
- Mark completed items with [x]
- Add new tasks if scope expands

## Code Style
- Clean, minimal TypeScript
- Prefer composition over inheritance
- Keep components small and focused
- Use hooks for shared logic
