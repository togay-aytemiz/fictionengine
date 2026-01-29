import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import storyProfileSchema from "../_shared/schemas/story_profile.schema.json" assert { type: "json" };
import finalizerSchema from "../_shared/schemas/episode_finalize.schema.json" assert { type: "json" };
import { createStructuredOutput } from "../_shared/openai.ts";
import { formatAjvErrors, validateSchema } from "../_shared/validation.ts";

interface EpisodeFinalizeInput {
  story_id: string;
  episode_id: string;
  episode_number: number;
  episode_text: string;
  story_profile: Record<string, unknown>;
  continuity_notes?: Array<{ key: string; value: string; status: string }>;
}

interface FlexibleCanonHit {
  category:
    | "supporting_roles"
    | "core_conflict"
    | "locations_seed"
    | "key_items_or_secrets";
  value: string;
  evidence: string;
}

interface FinalizerOutput {
  summary_bullets: string[];
  open_threads: string[];
  state_snapshot: {
    time?: string;
    location_id: string;
    characters_present: string[];
    inventory: string[];
  };
  new_persistent_facts: Array<{ key: string; value: string }>;
  flexible_canon_hits: FlexibleCanonHit[];
}

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

function applyFlexibleCanonUpdates(
  storyProfile: any,
  hits: FlexibleCanonHit[],
  episodeNumber: number,
) {
  const updated = structuredClone(storyProfile);
  const flexible = updated.canon?.flexible;
  if (!flexible) {
    return updated;
  }

  const touchItem = (item: any, evidence: string) => {
    if (!Array.isArray(item.evidence)) {
      item.evidence = [];
    }
    const entry = `episode:${episodeNumber} ${evidence}`;
    if (!item.evidence.includes(entry)) {
      item.evidence.push(entry);
    }
    const uniqueCount = new Set(item.evidence).size;
    if (item.status === "tentative" && uniqueCount >= 2) {
      item.status = "confirmed";
    } else if (item.status === "confirmed" && uniqueCount >= 3) {
      item.status = "locked";
    }
  };

  for (const hit of hits) {
    if (hit.category === "core_conflict") {
      const core = flexible.core_conflict;
      if (core.status !== "locked" && core.value !== hit.value) {
        core.value = hit.value;
        core.status = "tentative";
        core.evidence = [];
      }
      touchItem(core, hit.evidence);
      continue;
    }

    const list = flexible[hit.category] ?? [];
    let item = list.find((entry: any) => entry.value === hit.value);
    if (!item) {
      item = { value: hit.value, status: "tentative", evidence: [] };
      list.push(item);
    }
    touchItem(item, hit.evidence);
    flexible[hit.category] = list;
  }

  return updated;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  let payload: EpisodeFinalizeInput;
  try {
    payload = (await req.json()) as EpisodeFinalizeInput;
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  if (
    !payload?.story_id ||
    !payload?.episode_id ||
    !payload?.episode_number ||
    !payload?.episode_text ||
    !payload?.story_profile
  ) {
    return jsonResponse(
      {
        error:
          "Missing required fields: story_id, episode_id, episode_number, episode_text, story_profile",
      },
      400,
    );
  }

  const profileValidation = validateSchema<Record<string, unknown>>(
    storyProfileSchema,
    payload.story_profile,
  );
  if (!profileValidation.valid) {
    return jsonResponse(
      {
        error: "story_profile schema validation failed",
        details: formatAjvErrors(profileValidation.errors),
      },
      400,
    );
  }

  const systemPrompt =
    "You are the Episode Finalizer. Output ONLY valid JSON that matches the provided schema. " +
    "Summarize the episode into concrete bullets, extract open threads, update state snapshot, " +
    "list any new persistent facts, and note any flexible canon elements reinforced in this episode. " +
    "Use the same language as the story profile.";

  const userPrompt = JSON.stringify({
    story_profile: payload.story_profile,
    continuity_notes: payload.continuity_notes ?? [],
    episode_text: payload.episode_text,
    episode_number: payload.episode_number,
  });

  let finalizerOutput: FinalizerOutput;
  try {
    finalizerOutput = await createStructuredOutput<FinalizerOutput>({
      model: "gpt-4o-mini",
      system: systemPrompt,
      user: userPrompt,
      schema: finalizerSchema,
    });
  } catch (error) {
    return jsonResponse(
      {
        error: "Failed to generate finalizer output",
        details: error instanceof Error ? error.message : String(error),
      },
      500,
    );
  }

  const outputValidation = validateSchema<FinalizerOutput>(
    finalizerSchema,
    finalizerOutput,
  );
  if (!outputValidation.valid) {
    return jsonResponse(
      {
        error: "Finalizer output failed schema validation",
        details: formatAjvErrors(outputValidation.errors),
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

  const updatedProfile = applyFlexibleCanonUpdates(
    payload.story_profile,
    finalizerOutput.flexible_canon_hits,
    payload.episode_number,
  );

  if (updatedProfile.flow?.dynamic_state) {
    updatedProfile.flow.dynamic_state = {
      ...updatedProfile.flow.dynamic_state,
      time: finalizerOutput.state_snapshot.time ??
        updatedProfile.flow.dynamic_state.time,
      current_location_id: finalizerOutput.state_snapshot.location_id,
      characters_present: finalizerOutput.state_snapshot.characters_present,
      inventory: finalizerOutput.state_snapshot.inventory,
      open_threads: finalizerOutput.open_threads,
    };
  }

  const currentVersion = Number(updatedProfile.version ?? 1);
  const nextVersion = currentVersion + 1;

  const { data: profileRow, error: profileError } = await supabase
    .from("story_profiles")
    .insert({
      story_id: payload.story_id,
      version: nextVersion,
      jsonb_profile: { ...updatedProfile, version: nextVersion },
    })
    .select()
    .single();

  if (profileError) {
    return jsonResponse(
      { error: "Failed to store updated story profile", details: profileError },
      500,
    );
  }

  const { error: episodeUpdateError } = await supabase
    .from("episodes")
    .update({
      recap: {
        summary_bullets: finalizerOutput.summary_bullets,
        open_threads: finalizerOutput.open_threads,
      },
      state_snapshot: finalizerOutput.state_snapshot,
    })
    .eq("id", payload.episode_id);

  if (episodeUpdateError) {
    return jsonResponse(
      {
        error: "Failed to update episode recap/state",
        details: episodeUpdateError.message,
      },
      500,
    );
  }

  const existingKeys = new Set<string>();
  const { data: existingNotes } = await supabase
    .from("continuity_notes")
    .select("key")
    .eq("story_id", payload.story_id)
    .eq("status", "active");
  for (const note of existingNotes ?? []) {
    existingKeys.add(note.key);
  }

  const newFacts = finalizerOutput.new_persistent_facts.filter(
    (fact) => !existingKeys.has(fact.key),
  );

  if (newFacts.length) {
    const { error: continuityError } = await supabase
      .from("continuity_notes")
      .insert(
        newFacts.map((fact) => ({
          story_id: payload.story_id,
          key: fact.key,
          value: fact.value,
          status: "active",
          introduced_in_episode: payload.episode_number,
        })),
      );

    if (continuityError) {
      return jsonResponse(
        {
          error: "Failed to insert continuity notes",
          details: continuityError.message,
        },
        500,
      );
    }
  }

  return jsonResponse(
    {
      recap: finalizerOutput,
      story_profile: profileRow,
    },
    200,
  );
});
