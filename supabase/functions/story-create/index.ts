import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import storyProfileSchema from "../_shared/schemas/story_profile.schema.json" assert { type: "json" };
import { formatAjvErrors, validateSchema } from "../_shared/validation.ts";

type ContentRating = "PG" | "PG-13" | "ADULT";

interface CreateStoryInput {
  genre: string;
  content_rating: ContentRating;
  app_lang: string;
  user_id: string;
  is_anonymous?: boolean;
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
  if (!payload?.user_id) {
    return jsonResponse({ error: "Missing required field: user_id" }, 400);
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
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse(
      { error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" },
      500,
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const userRow = {
    id: payload.user_id,
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
      user_id: payload.user_id,
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

  const storyTitle = `${payload.genre} Story`;
  const logline = `A mysterious journey begins in a ${payload.genre} world.`;

  const { data: story, error: storyError } = await supabase
    .from("stories")
    .insert({
      title: storyTitle,
      logline,
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

  const mainCharacter = (storyProfile as any).canon.locked.main_characters[0]
    ?.name ?? "The protagonist";
  const episodeText =
    `Fog drifts across the harbor as the first sign appears. ` +
    `${mainCharacter} hears footsteps approaching through the shadows.`;
  const episodeChoices = [
    {
      choice_id: "A",
      text: "Move quietly toward the source of the sound",
      intent: "Investigate the footsteps",
      risk_level: "medium",
      leads_to: "Spot the approaching danger early",
    },
    {
      choice_id: "B",
      text: "Stay hidden and keep watching",
      intent: "Observe from cover",
      risk_level: "low",
      leads_to: "Gather more information",
    },
  ];

  const stateSnapshot = (storyProfile as any).flow.dynamic_state;

  const { data: episodeRow, error: episodeError } = await supabase
    .from("episodes")
    .insert({
      story_id: story.id,
      episode_number: 1,
      title: "First Spark",
      text: episodeText,
      choices: episodeChoices,
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
      user_id: payload.user_id,
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
