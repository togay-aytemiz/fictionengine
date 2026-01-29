# Product Requirements Document (PRD): Interactive Fiction Engine & Narrative Continuity Manager

## 1. Overview

The **Interactive Fiction Engine & Narrative Continuity Manager** is a backend system that:

1. **Creates** a brand-new interactive story from minimal onboarding inputs (**genre + content rating**), and
2. **Generates** the next story segment based on current story memory and the user’s choice.

It prioritizes: **continuity**, **rating compliance**, **interactive structure**, and **strict JSON output**.

---

## 2. Core Priorities (Non-Negotiable)

1. **Continuity**: Must never contradict the `Story Profile` (aka Story Bible) or `Continuity Notes` (aka Facts Ledger).
2. **Rating Compliance**: Strict adherence to `content_rating` rules and forbidden topic list.
3. **Interactive Structure**: Every episode ends with exactly **two** plausible choices (A/B).
4. **Structured Output**: Output must be valid JSON following the schema exactly. No text outside JSON.
5. **Operational Reliability**: Invalid JSON or schema mismatch must be auto-repaired via retries.

---

## 3. Rating Model

The product supports 3 ratings:

### 3.1 PG

- No explicit sex, no graphic violence/gore
- No hate content
- No self-harm content
- No sexual violence content

### 3.2 PG-13

- Mild/moderate violence allowed (no graphic gore)
- Non-explicit romance allowed
- No hate content
- No self-harm content
- No sexual violence content

### 3.3 ADULT

- Mature themes allowed
- Still forbidden: hate, sexual violence, self-harm instructions, graphic torture
- Must remain within reasonable fiction bounds

### 3.4 Global Forbidden Topics (always blocked)

`["hate", "sexual violence", "self-harm"]`

---

## 4. Key Concepts & Data Objects

### 4.1 Story (Top-level “Book”)

A story is the unit shown in the user’s library.

### 4.2 Story Profile (stable canon / story definition)

A compact, versioned definition containing:

- premise, world_rules
- style (pov, tense, reading_level, tone_keywords)
- main_character (and optionally persistent supporting characters)
- seed locations
- rating rules

### 4.3 Continuity Notes (persistent truths)

A minimal list of stable facts that should not be contradicted.

### 4.4 Episode

The actual content unit: text + two choices + recap + state snapshot.

### 4.5 Session

Tracks reader progress through a story.

### 4.6 Retrieved Context (optional)

Snippets retrieved from stored episode text (via search/embeddings) to maintain detail consistency.

---

## 5. System Architecture (High-Level)

The system is composed of these backend capabilities:

1. **Story Creation API** (onboarding → story_profile + episode_1)
2. **Episode Generation API** (state + memory + choice → episode_n+1)
3. **Episode Finalizer** (episode text → recap/state/continuity updates)
4. **Retrieval (RAG) Service** (optional initially)
   - chunk stored episodes → embeddings → fetch topK relevant snippets

---

## 6. Functional Requirements

### 6.1 Story Creation (Onboarding)

**Input** (only):

- `genre`
- `content_rating` (PG | PG-13 | ADULT)
- `app_lang` (e.g., "tr")

**System must decide**:

- world, characters, names, hook, tone, POV/tense, reading level

**Output must include**:

- `story` (title + logline)
- `story_profile` v1
- minimal `continuity_notes`
- `episode_1` with exactly two choices (A/B)
- session record for anonymous user

**Constraints**:

- Episode 1 must start with an immediate hook (no long exposition)
- Must strictly comply with rating rules

---

### 6.2 Episode Generation (Core Runtime)

The system accepts a JSON input containing:

**Meta**

- language
- genre
- content_rating
- segment_goal
- length targets

**Memory**

- `story_profile` (source of truth)
- `continuity_notes` (source of truth)
- `recent_recaps` (last episode + last 3 summaries + optional arc summary)
- `retrieved_context.snippets` (supporting evidence only)

**Interaction**

- user choice (`choice_id` A/B + text)
- (Surprise me is handled outside the model; see 6.3)

**Required behavior**

- Continue from last outcome/choice
- Move plot forward per `segment_goal`
- Avoid long exposition; prioritize action/dialogue/consequence
- Infer missing context minimally and record in `assumptions`
- Output exactly two choices (A/B)

---

### 6.3 Surprise Me (UI Control)

**Requirement**

- The UI provides a “Surprise me” button that does **not** create a third choice.

**Rules**

- The model MUST ALWAYS output exactly two choices: **A and B**
- If the user clicks “Surprise me”, the **backend** auto-selects A or B (random or heuristic)
- The next generation request is sent with that selected `choice_id`

---

### 6.4 Choice Generation

Each episode must output two choices with:

- `choice_id`: "A" / "B"
- `text`: user-facing option
- `intent`: short verb phrase
- `risk_level`: low | medium | high
- `leads_to`: 1-sentence preview, no spoilers beyond next scene

---

### 6.5 State Management

The system must output:

- `state_update`: time, location_id, characters_present
- `inventory_delta`: add/remove/update operations
- `open_threads_delta`: add/resolve hooks
- `ledger_updates`: new persistent truths (minimal)

---

### 6.6 Episode Finalizer (Memory Update Step)

After each episode is generated, the system MUST be able to produce:

- `summary_bullets` (5–10 concrete event bullets)
- `open_threads` (1–5 unresolved hooks)
- a compact `state_snapshot` (location, characters, inventory)
- `new_persistent_facts` (if any)

**Note**

- This can be implemented as a second lightweight LLM call.
- Output is stored and used as `recent_recaps` next time.

---

### 6.7 Retrieval & Token Budgeting (RAG)

**Goal**
Avoid sending entire history to the LLM.

**Requirements**

- Store full episode text in DB.
- Optionally chunk episode text and create embeddings.
- For each generation, fetch topK relevant snippets and pass only those in `retrieved_context.snippets`.

**Token Budget Rules**
Prompt context should be composed in this priority order:

1. story_profile (always)
2. continuity_notes (always)
3. last_episode recap/state (always)
4. topK retrieved snippets (only within budget)
5. older recaps / arc summary (only within budget)

---

## 7. Reliability Requirements (JSON & Schema Safety)

### 7.1 Validation

- All inputs must be schema-validated before model call.
- All outputs must be schema-validated after model call.

### 7.2 Auto-Repair

If output fails validation:

- Retry with a “repair prompt” that includes:
  - validation error summary
  - strict instruction: return JSON only and follow schema
- Maximum retries: 2 (configurable)
- On repeated failure: return a safe fallback error object (non-story) to the API client.

### 7.3 Length Control

If word_count is outside bounds:

- Retry once with instruction to shorten/expand to fit range.

---

## 8. Persistence Model (Supabase)

### 8.1 Tables (Minimal)

1. `stories`

- id (uuid), title, logline, genre, content_rating, status, created_at

2. `story_profiles` (aka story_bibles)

- id (uuid), story_id, version, jsonb_profile, created_at

3. `episodes`

- id (uuid), story_id, episode_number, title, text
- choices (jsonb), recap (jsonb), state_snapshot (jsonb)
- created_at

4. `continuity_notes` (aka facts_ledger)

- id (uuid), story_id, key, value, status, introduced_in_episode, created_at, updated_at

5. `sessions`

- id (uuid), user_id, story_id, current_episode_number, created_at

6. `users` (anonymous supported)

- id (uuid), is_anonymous, app_lang, created_at

### 8.2 Indexing (Recommended)

- episodes: (story_id, episode_number)
- continuity_notes: (story_id, key)
- sessions: (user_id, story_id)

---

## 9. API Contracts (High-Level)

### 9.1 POST /stories/create

Input: genre, content_rating, app_lang, anon_user_id  
Output: story + story_profile + continuity_notes + episode_1 + session

### 9.2 POST /episodes/generate

Input: story_profile + continuity_notes + recent_recaps + retrieved_context + user_choice  
Output: episode_n+1 (schema defined below)

### 9.3 POST /episodes/finalize

Input: episode text + current memory  
Output: recap + state_snapshot + continuity updates

---

## 10. Output Schema (Episode Generation)

```json
{
  "episode_id": "string",
  "segment": {
    "title": "string",
    "text": "string",
    "word_count": 0
  },
  "choices": [
    {
      "choice_id": "A",
      "text": "string",
      "intent": "string",
      "risk_level": "low|medium|high",
      "leads_to": "string"
    },
    {
      "choice_id": "B",
      "text": "string",
      "intent": "string",
      "risk_level": "low|medium|high",
      "leads_to": "string"
    }
  ],
  "state_update": {
    "time": "string",
    "location_id": "string",
    "characters_present": ["string"],
    "inventory_delta": [
      {
        "op": "add|remove|update",
        "owner_id": "string",
        "item": "string",
        "notes": "string"
      }
    ],
    "open_threads_delta": {
      "add": ["string"],
      "resolve": ["string"]
    }
  },
  "ledger_updates": [
    {
      "key": "string",
      "value": "string",
      "introduced_in": "string",
      "status": "active"
    }
  ],
  "continuity_checks": [
    {
      "rule": "Story Profile compliance",
      "result": "pass|warn",
      "note": "string"
    },
    {
      "rule": "Continuity Notes compliance",
      "result": "pass|warn",
      "note": "string"
    },
    {
      "rule": "Audience rating compliance",
      "result": "pass|warn",
      "note": "string"
    }
  ],
  "assumptions": ["string"]
}
```

## 11. Output Schema (Episode Generation)

- Validity: ≥ 99% outputs validate without retries; 100% validate after retry policy.
- Compliance: No rating violations; forbidden topics never appear.
- Continuity: Low contradiction rate (measured via automated checks and user reports).
- Engagement: High choice completion rate; “Surprise me” usage tracked.

---

## 12. Roadmap Checklist

### Phase 0 — Foundations
- [x] Define core persistence schema (stories, story_profiles, episodes, continuity_notes, sessions, users)
- [x] Implement RLS write strategy (service role server-only writes or client write policies)
- [x] Seed minimal data validation utilities (shared schemas for requests/outputs)
- [x] Define story_profile JSON schema (locked canon, flexible canon, dynamic flow)
- [x] Implement canon locking rules (tentative → confirmed → locked)

### Phase 1 — Story Creation
- [x] Build POST /stories/create endpoint (Edge Function)
- [ ] Enforce rating rules + forbidden topics
- [x] Persist story + profile + continuity notes + episode_1 + session
- [x] Add onboarding input capture (genre, content_rating, app_lang)
- [x] Initialize locked canon from onboarding + model output

### Phase 2 — Episode Generation
- [x] Build POST /episodes/generate endpoint
- [x] Implement prompt assembly with memory priority rules
- [x] Enforce exactly two choices (A/B)
- [x] Persist generated episode with choices/recap/state
- [x] Add rating/forbidden-topic checks + retry on violations
- [x] Enforce locked canon compliance during generation (retry/repair)

### Phase 3 — Episode Finalizer
- [x] Build POST /episodes/finalize endpoint
- [x] Produce summary_bullets, open_threads, state_snapshot, new_persistent_facts
- [x] Store recap/state for next generation
- [x] Promote flexible canon via evidence (tentative/confirmed/locked)

### Phase 4 — Reliability & Compliance
- [ ] Input schema validation before model call
- [ ] Output schema validation after model call
- [ ] Auto-repair on schema failures (max retries)
- [ ] Length control + retry on word_count bounds

### Phase 5 — Retrieval (Optional / RAG)
- [ ] Store full episode text + chunk embeddings
- [ ] Implement topK snippet retrieval
- [ ] Integrate retrieved_context.snippets into prompt

### Phase 6 — Mobile UX
- [x] Reader flow: story text → 2 choices → continue (Onboarding part done)
- [ ] “Surprise me” button (backend auto-selects A/B)
- [x] Reading-optimized typography (serif body, clean sans UI)
- [x] Smooth transitions between story segments
- [x] Story library list with create-new-story entry point

---

## 13. Story Profile JSON Schema (v1)

### 13.1 Canon Model

- **Locked canon**: immutable narrative backbone.
- **Flexible canon**: starts tentative and gets locked via evidence or user confirmation.
- **Dynamic flow**: per-episode state that changes constantly.

### 13.2 JSON Shape (example)

```json
{
  "version": 1,
  "language": "tr",
  "genre": "fantasy",
  "content_rating": "PG-13",
  "canon": {
    "locked": {
      "world_rules": [
        "Magic exists but requires a personal cost.",
        "Time travel is impossible."
      ],
      "main_characters": [
        {
          "name": "Aylin",
          "identity": "A street-smart courier with a hidden lineage.",
          "traits": ["bold", "loyal", "impulsive"],
          "motivation": "Protect her younger brother.",
          "fear": "Being abandoned."
        }
      ],
      "narrative_style": {
        "pov": "third",
        "tense": "past",
        "reading_level": "young_adult",
        "tone_keywords": ["moody", "adventurous"]
      },
      "theme_tone": "noir-tinged urban adventure",
      "hard_forbidden_topics": ["hate", "sexual violence", "self-harm"]
    },
    "flexible": {
      "supporting_roles": [
        { "value": "mentor", "status": "tentative", "evidence": [] },
        { "value": "rival", "status": "tentative", "evidence": [] }
      ],
      "core_conflict": { "value": "Find the stolen relic", "status": "tentative", "evidence": [] },
      "locations_seed": [
        { "value": "Old Harbor", "status": "tentative", "evidence": [] },
        { "value": "Skyline Bazaar", "status": "tentative", "evidence": [] }
      ],
      "key_items_or_secrets": [
        { "value": "A map that burns in moonlight", "status": "tentative", "evidence": [] }
      ]
    }
  },
  "flow": {
    "dynamic_state": {
      "current_time": "Night",
      "current_location_id": "old_harbor",
      "characters_present": ["Aylin"],
      "inventory": ["courier satchel"],
      "open_threads": ["Who hired the shadow courier?"],
      "segment_goal": "Escape the dock ambush",
      "cliffhanger_seed": "A hidden sigil appears on the map"
    }
  }
}
```

### 13.3 Status Rules

- `tentative` → `confirmed` after **2** consecutive episodes without contradiction.
- `confirmed` → `locked` after **3** confirmations or explicit user approval.
- Any contradiction triggers a repair and resets that item to `tentative`.
