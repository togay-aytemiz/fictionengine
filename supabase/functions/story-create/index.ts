import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import storyProfileSchema from "../_shared/schemas/story_profile.schema.json" assert { type: "json" };
import storyCreateOutputSchema from "../_shared/schemas/story_create_output.schema.json" assert { type: "json" };
import { formatAjvErrors, validateSchema } from "../_shared/validation.ts";
import { createStructuredOutput } from "../_shared/openai.ts";

type ContentRating = "PG" | "PG-13" | "ADULT";

interface CreateStoryInput {
  genre: string;
  content_rating: ContentRating;
  app_lang: string;
  user_id?: string;
  is_anonymous?: boolean;
}

interface StoryCreateOutput {
  title: string;
  logline: string;
  episode_title: string;
  episode_text: string;
  choices: Array<{
    choice_id: "A" | "B";
    text: string;
    intent: string;
    risk_level: "low" | "medium" | "high";
    leads_to: string;
  }>;
}

type StoryProfile = Record<string, unknown>;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getTokenFromRequest(req: Request): string | null {
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return null;
  }
  return authHeader.slice("Bearer ".length).trim() || null;
}

async function validateAndGetUserId(
  supabaseUrl: string,
  supabaseAnonKey: string,
  token: string
): Promise<{ userId: string } | { error: string }> {
  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });

  const { data, error } = await userClient.auth.getUser();
  if (error || !data.user) {
    return { error: error?.message ?? "Invalid token" };
  }
  return { userId: data.user.id };
}

function buildStoryProfile(input: CreateStoryInput): StoryProfile {
  const mainCharacterName = input.genre.toLowerCase().includes("noir")
    ? "Kerem"
    : "Aylin";
  const themeTone = `${input.genre} adventure`;

  return {
    version: 1,
    language: input.app_lang,
    genre: input.genre,
    content_rating: input.content_rating,
    canon: {
      locked: {
        world_rules: [
          "Death is permanent; resurrection is impossible.",
          "Time travel is impossible.",
        ],
        main_characters: [
          {
            name: mainCharacterName,
            identity:
              "A resourceful traveler surviving through wit and courage.",
            traits: ["brave", "curious", "stubborn"],
            motivation: "Protect loved ones.",
            fear: "Losing control.",
          },
        ],
        narrative_style: {
          pov: "third",
          tense: "past",
          reading_level: "young_adult",
          tone_keywords: ["immersive", "emotional"],
        },
        theme_tone: themeTone,
        hard_forbidden_topics: ["hate", "sexual violence", "self-harm"],
      },
      flexible: {
        supporting_roles: [
          { value: "mentor", status: "tentative", evidence: [] },
          { value: "rival", status: "tentative", evidence: [] },
        ],
        core_conflict: {
          value: "Find a lost relic",
          status: "tentative",
          evidence: [],
        },
        locations_seed: [
          { value: "Old Harbor", status: "tentative", evidence: [] },
          { value: "Shadow Bazaar", status: "tentative", evidence: [] },
        ],
        key_items_or_secrets: [
          {
            value: "A map that glows in moonlight",
            status: "tentative",
            evidence: [],
          },
        ],
      },
    },
    flow: {
      dynamic_state: {
        current_time: "Night",
        current_location_id: "old_harbor",
        characters_present: [mainCharacterName],
        inventory: ["field notebook"],
        open_threads: ["Who stole the relic?"],
        segment_goal: "Find the first clue",
        cliffhanger_seed: "A hidden sigil appears on the map",
      },
    },
  };
}

function buildCreationPrompt(
  storyProfile: StoryProfile,
  input: CreateStoryInput
): string {
  const isTurkish = input.app_lang === "tr";
  const lockedCanon = (storyProfile as any)?.canon?.locked ?? {};
  const mainCharacter = lockedCanon.main_characters?.[0] ?? {};

  const languageInstruction = isTurkish
    ? "IMPORTANT: Write ALL content in Turkish (Türkçe). The title, logline, episode text, and choices must all be in Turkish."
    : "Write all content in English.";

  const ratingInstructions: Record<ContentRating, string> = {
    "PG": "Keep content family-friendly. No violence, no explicit themes, no dark content.",
    "PG-13": "Mild tension and conflict allowed. No graphic violence or explicit themes.",
    "ADULT": "Mature themes allowed, but no hate speech, sexual violence, or self-harm.",
  };

  return `
You are a master storyteller creating the opening of an interactive fiction story.

GENRE: ${input.genre}
CONTENT RATING: ${input.content_rating} - ${ratingInstructions[input.content_rating]}
${languageInstruction}

STORY CANON (locked truths):
- World rules: ${JSON.stringify(lockedCanon.world_rules)}
- Main character: ${mainCharacter.name} - ${mainCharacter.identity}
- Character traits: ${JSON.stringify(mainCharacter.traits)}
- Motivation: ${mainCharacter.motivation}
- Fear: ${mainCharacter.fear}
- Narrative style: ${JSON.stringify(lockedCanon.narrative_style)}
- Theme/Tone: ${lockedCanon.theme_tone}

YOUR TASK:
1. Create an evocative, creative TITLE that captures the story's essence (not just "${input.genre} Story")
2. Write a compelling LOGLINE (1-2 sentences) that hooks readers
3. Write EPISODE 1:
   - Create an intriguing episode title
   - Write rich, immersive narrative text (400-600 words / minimum 1500 characters)
   - Start with an immediate hook (no long exposition)
   - Include vivid descriptions, character moments, and atmosphere
   - Build tension toward a decision point
   - End with exactly 2 meaningful choices (A and B)

The episode MUST be substantial - like the opening chapter of a novel, not just a few sentences.
Each choice should lead to meaningfully different story paths.
`.trim();
}

async function generateStoryContent(
  storyProfile: StoryProfile,
  input: CreateStoryInput
): Promise<StoryCreateOutput> {
  const prompt = buildCreationPrompt(storyProfile, input);

  console.log("[story-create] Calling OpenAI for story generation...");
  const startTime = Date.now();

  const result = await createStructuredOutput<StoryCreateOutput>({
    model: "gpt-4o-mini",
    system:
      "You are the Story Creator. Output ONLY valid JSON matching the schema. " +
      "Create compelling, immersive interactive fiction with rich narrative text. " +
      "Episode text must be at least 400 words (1500+ characters).",
    user: prompt,
    schema: storyCreateOutputSchema,
    temperature: 0.7,
    max_output_tokens: 3000,
  });

  const elapsed = Date.now() - startTime;
  console.log(`[story-create] OpenAI response received in ${elapsed}ms`);
  console.log(`[story-create] Title: ${result.title}`);
  console.log(`[story-create] Episode text length: ${result.episode_text.length} chars`);

  return result;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  let payload: CreateStoryInput;
  try {
    payload = (await req.json()) as CreateStoryInput;
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  if (!payload?.genre || !payload?.content_rating || !payload?.app_lang) {
    return jsonResponse(
      { error: "Missing required fields: genre, content_rating, app_lang" },
      400,
    );
  }

  const storyProfile = buildStoryProfile(payload);
  const validation = validateSchema<StoryProfile>(
    storyProfileSchema,
    storyProfile,
  );
  if (!validation.valid) {
    return jsonResponse(
      {
        error: "story_profile schema validation failed",
        details: formatAjvErrors(validation.errors),
      },
      500,
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse(
      { error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" },
      500,
    );
  }

  // Try to get user from token first, fallback to user_id in body for anonymous users
  let resolvedUserId: string | null = null;

  const token = getTokenFromRequest(req);
  if (token) {
    const validationResult = await validateAndGetUserId(
      supabaseUrl,
      supabaseAnonKey || serviceRoleKey,
      token
    );
    if ("userId" in validationResult) {
      resolvedUserId = validationResult.userId;
    }
  }

  // Fallback: use user_id from body (for anonymous users)
  if (!resolvedUserId && payload.user_id && payload.is_anonymous) {
    console.log("[story-create] Using user_id from body:", payload.user_id);
    resolvedUserId = payload.user_id;
  }

  if (!resolvedUserId) {
    return jsonResponse({ code: 401, message: "Invalid JWT" }, 401);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const userRow = {
    id: resolvedUserId,
    is_anonymous: payload.is_anonymous ?? true,
    app_lang: payload.app_lang,
  };

  const { error: userError } = await supabase
    .from("users")
    .upsert(userRow, { onConflict: "id" });
  if (userError) {
    return jsonResponse(
      { error: "Failed to upsert user", details: userError.message },
      400,
    );
  }

  const { error: inputError } = await supabase
    .from("story_book_inputs")
    .insert({
      user_id: resolvedUserId,
      genres: [payload.genre],
      content_rating: payload.content_rating,
      language: payload.app_lang,
    });
  if (inputError) {
    return jsonResponse(
      { error: "Failed to store onboarding inputs", details: inputError.message },
      500,
    );
  }

  // Generate story content using LLM
  let storyContent: StoryCreateOutput;
  try {
    storyContent = await generateStoryContent(storyProfile, payload);
  } catch (error) {
    console.error("[story-create] LLM generation failed:", error);
    return jsonResponse(
      {
        error: "Failed to generate story content",
        details: error instanceof Error ? error.message : String(error),
      },
      500,
    );
  }

  const { data: story, error: storyError } = await supabase
    .from("stories")
    .insert({
      title: storyContent.title,
      logline: storyContent.logline,
      genre: payload.genre,
      content_rating: payload.content_rating,
      status: "active",
    })
    .select()
    .single();

  if (storyError || !story) {
    return jsonResponse(
      { error: "Failed to create story", details: storyError?.message },
      500,
    );
  }

  const { data: storyProfileRow, error: storyProfileError } = await supabase
    .from("story_profiles")
    .insert({
      story_id: story.id,
      version: 1,
      jsonb_profile: storyProfile,
    })
    .select()
    .single();

  if (storyProfileError) {
    return jsonResponse(
      {
        error: "Failed to create story profile",
        details: storyProfileError.message,
      },
      500,
    );
  }

  const worldRules = (storyProfile as any).canon.locked.world_rules as string[];
  const continuityNotes = worldRules.map((rule, index) => ({
    story_id: story.id,
    key: `world_rule_${index + 1}`,
    value: rule,
    status: "active",
    introduced_in_episode: 1,
  }));

  const { data: continuityRows, error: continuityError } = await supabase
    .from("continuity_notes")
    .insert(continuityNotes)
    .select();

  if (continuityError) {
    return jsonResponse(
      {
        error: "Failed to create continuity notes",
        details: continuityError.message,
      },
      500,
    );
  }

  const stateSnapshot = (storyProfile as any).flow.dynamic_state;

  const { data: episodeRow, error: episodeError } = await supabase
    .from("episodes")
    .insert({
      story_id: story.id,
      episode_number: 1,
      title: storyContent.episode_title,
      text: storyContent.episode_text,
      choices: storyContent.choices,
      recap: null,
      state_snapshot: stateSnapshot,
    })
    .select()
    .single();

  if (episodeError) {
    return jsonResponse(
      { error: "Failed to create episode_1", details: episodeError.message },
      500,
    );
  }

  const { data: sessionRow, error: sessionError } = await supabase
    .from("sessions")
    .insert({
      user_id: resolvedUserId,
      story_id: story.id,
      current_episode_number: 1,
    })
    .select()
    .single();

  if (sessionError) {
    return jsonResponse(
      { error: "Failed to create session", details: sessionError.message },
      500,
    );
  }

  return jsonResponse(
    {
      story,
      story_profile: storyProfileRow,
      continuity_notes: continuityRows ?? [],
      episode_1: episodeRow,
      session: sessionRow,
    },
    201,
  );
});
