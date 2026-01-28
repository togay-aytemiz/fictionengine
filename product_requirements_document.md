# Product Requirements Document: Interactive Fiction Engine & Narrative Continuity Manager

## 1. Overview
The **Interactive Fiction Engine and Narrative Continuity Manager** is a backend system designed to generate the next story segment in an interactive narrative. It prioritizes continuity, safety/rating compliance, and structured interactive output. The system acts as a "dungeon master" or "author engine" that takes specific story state and user choices as input and produces a JSON-structured story segment with exactly two follow-up choices.

## 2. Core Priorities (Non-Negotiable)
1.  **Continuity**: Must never contradict the provided `Story Bible` or `Facts Ledger`.
2.  **Rating Compliance**: Strict adherence to `audience_profile` limits (content_rating, violence, romance, horror, and `topics_blocklist`).
3.  **Interactive Structure**: Output must always end with exactly **two** plausible choices fitting the current scene.
4.  **Structured Output**: Output must be valid JSON following the provided schema exactly. No conversational text outside JSON.

## 3. Functional Requirements

### 3.1 Input Handling
The system accepts a JSON input containing:
-   **Meta**: App language, Audience profile (age, ratings, blocklist), Genre, Tone, Segment Goal, Target Length.
-   **Memory**:
    -   `story_bible`: Premise, world rules, characters, locations, style rules.
    -   `facts_ledger`: Active facts about the world state.
    -   `recent_recaps`: Summaries of previous episodes.
    -   `retrieved_context`: Snippets for supporting details.
-   **Interaction**: User's chosen path (`from_episode_id`, `choice_id`, `choice_text`).

### 3.2 Story Generation Logic
-   **Continuity**: Use Story Bible + Facts Ledger as the strict source of truth.
-   **Style & Safety**:
    -   Tone and vocabulary must match `audience_profile.age`.
    -   Forbidden topics in `topics_blocklist` are strictly blocked.
    -   Content intensity (violence, romance, horror) must match the specified levels.
-   **Narrative Flow**:
    -   Continue from the last cliffhanger/choice.
    -   Move the plot forward based on `segment_goal`.
    -   Avoid long exposition; favor action, dialogue, and consequence.
    -   Infer missing context minimally and record in assumptions.

### 3.3 Choice Generation
-   Generate exactly **two** choices (A and B).
-   Choices must be:
    -   Mutually distinct.
    -   Plausible within the scene.
    -   Aligned with current stakes.
-   Each choice must define:
    -   `intent`: Short verb phrase.
    -   `risk_level`: Low, Medium, or High.
    -   `leads_to`: One-sentence preview (no spoilers beyond next scene).

### 3.4 State Management
-   Update `state` (time, location, characters present, inventory) in the output.
-   Update `open_threads` (add/resolve).
-   Log new persistent facts in `ledger_updates`.

### 3.5 Output Format
The system must return a JSON object with the following schema:
```json
{
  "episode_id": "string",
  "segment": {
    "title": "string",
    "text": "string",
    "word_count": number
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
      {"op":"add|remove|update","owner_id":"string","item":"string","notes":"string"}
    ],
    "open_threads_delta": {
      "add": ["string"],
      "resolve": ["string"]
    }
  },
  "ledger_updates": [
    {"key":"string", "value":"string", "introduced_in":"string", "status":"active"}
  ],
  "continuity_checks": [
    {"rule":"Story Bible compliance", "result":"pass|warn", "note":"string"},
    {"rule":"Facts Ledger compliance", "result":"pass|warn", "note":"string"},
    {"rule":"Audience rating compliance", "result":"pass|warn", "note":"string"}
  ],
  "assumptions": ["string"]
}
```

## 4. Continuity & Safety Rules

-   **Memory Rules**:
    -   `Story Bible`: Source of truth for world/characters/style.
    -   `Facts Ledger`: Source of truth for current state.
    -   `retrieved_context`: Supporting evidence only.

-   **Safety Rules**:
    -   Under 13: Safe, non-graphic, avoid mature themes.
    -   `topics_blocklist` overrides all other settings.

## 5. Success Metrics
-   **Validity**: Output is always valid, parseable JSON.
-   **Adherence**: Story segment respects all constraints (word count, rating, continuity).
-   **Interactivity**: User always has two meaningful choices to proceed.
