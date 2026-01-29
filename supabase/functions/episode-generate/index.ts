import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import storyProfileSchema from "../_shared/schemas/story_profile.schema.json" assert { type: "json" };
import episodeSchema from "../_shared/schemas/episode_generate.schema.json" assert { type: "json" };
import { createStructuredOutput } from "../_shared/openai.ts";
import { formatAjvErrors, validateSchema } from "../_shared/validation.ts";

interface EpisodeGenerateInput {
  story_id: string;
  episode_number: number;
  user_choice: { choice_id: "A" | "B"; text?: string };
  story_profile: Record<string, unknown>;
  continuity_notes?: Array<{ key: string; value: string; status: string }>;
  recent_recaps?: Record<string, unknown>;
  retrieved_context?: { snippets: string[] };
  segment_goal?: string;
  length_target?: { min_words?: number; max_words?: number };
  session_id?: string;
}

interface EpisodeOutput {
  episode_id: string;
  segment: { title: string; text: string; word_count: number };
  choices: Array<{
    choice_id: "A" | "B";
    text: string;
    intent: string;
    risk_level: "low" | "medium" | "high";
    leads_to: string;
  }>;
  state_update: Record<string, unknown>;
  ledger_updates: Array<Record<string, unknown>>;
  continuity_checks: Array<{ rule: string; result: "pass" | "warn"; note: string }>;
  assumptions: string[];
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

async function generateEpisode(
  prompt: string,
  schema: Record<string, unknown>,
): Promise<EpisodeOutput> {
  return await createStructuredOutput<EpisodeOutput>({
    model: "gpt-4o-mini",
    system:
      "You are the Episode Generator. Output ONLY valid JSON that matches the provided schema. " +
      "Use story_profile.canon.locked as immutable truth. Use continuity notes as constraints. " +
      "Continue the story based on the user choice, keep the tone/rating, " +
      "and end with exactly two choices (A/B).",
    user: prompt,
    schema,
    max_output_tokens: 1800,
  });
}

function buildPrompt(
  payload: EpisodeGenerateInput,
  episodeId: string,
  segmentGoal: string,
): string {
  const storyProfile = payload.story_profile as any;
  const lockedCanon = storyProfile?.canon?.locked ?? {};
  const flexibleCanon = storyProfile?.canon?.flexible ?? {};
  const lastRecap = payload.recent_recaps?.last_episode ?? {};
  const recentSummaries = payload.recent_recaps?.last_3_episodes_summaries ?? [];
  const retrievedSnippets = payload.retrieved_context?.snippets ?? [];

  return [
    "STORY_PROFILE (LOCKED CANON)",
    JSON.stringify(lockedCanon),
    "STORY_PROFILE (FLEXIBLE CANON)",
    JSON.stringify(flexibleCanon),
    "CONTINUITY_NOTES",
    JSON.stringify(payload.continuity_notes ?? []),
    "LAST_EPISODE_RECAP",
    JSON.stringify(lastRecap),
    "RECENT_SUMMARIES",
    JSON.stringify(recentSummaries),
    "RETRIEVED_SNIPPETS",
    JSON.stringify(retrievedSnippets),
    "USER_CHOICE",
    JSON.stringify(payload.user_choice),
    "SEGMENT_GOAL",
    segmentGoal,
    "LENGTH_TARGET",
    JSON.stringify(payload.length_target ?? {}),
    "EPISODE_ID",
    episodeId,
  ].join("\n");
}

function collectOutputText(output: EpisodeOutput): string {
  const parts: string[] = [];
  parts.push(output.segment?.title ?? "", output.segment?.text ?? "");
  for (const choice of output.choices ?? []) {
    parts.push(choice.text ?? "", choice.intent ?? "", choice.leads_to ?? "");
  }
  for (const assumption of output.assumptions ?? []) {
    parts.push(assumption);
  }
  return parts.filter(Boolean).join(" ");
}

function collectRatingIssues(
  output: EpisodeOutput,
  storyProfile: any,
): string[] {
  const issues: string[] = [];
  const text = collectOutputText(output);
  const lowerText = text.toLowerCase();
  const contentRating =
    (storyProfile?.content_rating as string) ??
      (storyProfile?.canon?.locked?.narrative_style?.content_rating as string) ??
      "";

  const hardForbidden: string[] =
    storyProfile?.canon?.locked?.hard_forbidden_topics ?? [];

  for (const topic of hardForbidden) {
    const normalized = String(topic).toLowerCase();
    if (normalized === "hate") {
      if (/\bhate speech\b/i.test(text) || /\bhate crime\b/i.test(text)) {
        issues.push("Hard forbidden topic: hate");
      }
      continue;
    }
    if (normalized === "sexual violence") {
      if (/\bsexual violence\b/i.test(text) ||
        /\brape\b/i.test(text) ||
        /\bsexual assault\b/i.test(text)) {
        issues.push("Hard forbidden topic: sexual violence");
      }
      continue;
    }
    if (normalized === "self-harm") {
      if (/\bself[- ]?harm\b/i.test(text) ||
        /\bsuicide\b/i.test(text) ||
        /\bkill myself\b/i.test(text)) {
        issues.push("Hard forbidden topic: self-harm");
      }
      continue;
    }
    if (lowerText.includes(normalized)) {
      issues.push(`Hard forbidden topic: ${topic}`);
    }
  }

  const explicitSexPatterns = [
    /\bexplicit sex\b/i,
    /\berotic\b/i,
    /\bnude\b/i,
    /\bnudity\b/i,
    /\bsexual content\b/i,
    /\bsex\b/i,
  ];

  const graphicGorePatterns = [
    /\bgore\b/i,
    /\bentrails\b/i,
    /\bdismember(?:ed|ment)?\b/i,
    /\bdecapitat(?:ed|ion)\b/i,
    /\bmutilat(?:ed|ion)\b/i,
  ];

  const graphicTorturePatterns = [
    /\bgraphic torture\b/i,
    /\btorture\b/i,
    /\bflay(?:ed|ing)?\b/i,
  ];

  if (contentRating === "PG") {
    if (explicitSexPatterns.some((re) => re.test(text))) {
      issues.push("Rating violation: explicit sexual content");
    }
    if (graphicGorePatterns.some((re) => re.test(text))) {
      issues.push("Rating violation: graphic violence/gore");
    }
  }

  if (contentRating === "PG-13") {
    if (explicitSexPatterns.some((re) => re.test(text))) {
      issues.push("Rating violation: explicit sexual content");
    }
    if (graphicGorePatterns.some((re) => re.test(text))) {
      issues.push("Rating violation: graphic violence/gore");
    }
  }

  if (contentRating === "ADULT") {
    if (graphicTorturePatterns.some((re) => re.test(text))) {
      issues.push("Rating violation: graphic torture");
    }
    if ((/how to/i.test(text) || /instructions/i.test(text)) &&
      (/\bself[- ]?harm\b/i.test(text) || /\bsuicide\b/i.test(text))) {
      issues.push("Rating violation: self-harm instructions");
    }
  }

  return issues;
}

function buildStateSnapshot(baseState: any, update: any) {
  const inventory = Array.isArray(baseState?.inventory)
    ? [...baseState.inventory]
    : [];
  const openThreads = Array.isArray(baseState?.open_threads)
    ? [...baseState.open_threads]
    : [];

  const inventoryDelta = Array.isArray(update?.inventory_delta)
    ? update.inventory_delta
    : [];
  for (const delta of inventoryDelta) {
    if (!delta?.item) {
      continue;
    }
    const item = String(delta.item);
    if (delta.op === "add") {
      if (!inventory.includes(item)) {
        inventory.push(item);
      }
    } else if (delta.op === "remove") {
      const index = inventory.indexOf(item);
      if (index >= 0) {
        inventory.splice(index, 1);
      }
    } else if (delta.op === "update") {
      const index = inventory.indexOf(item);
      if (index >= 0) {
        inventory[index] = item;
      } else {
        inventory.push(item);
      }
    }
  }

  const openDelta = update?.open_threads_delta ?? { add: [], resolve: [] };
  const toAdd = Array.isArray(openDelta.add) ? openDelta.add : [];
  const toResolve = Array.isArray(openDelta.resolve) ? openDelta.resolve : [];
  for (const thread of toAdd) {
    if (thread && !openThreads.includes(thread)) {
      openThreads.push(thread);
    }
  }
  for (const thread of toResolve) {
    const index = openThreads.indexOf(thread);
    if (index >= 0) {
      openThreads.splice(index, 1);
    }
  }

  return {
    time: update?.time ?? baseState?.current_time ?? "",
    location_id: update?.location_id ?? baseState?.current_location_id ?? "",
    characters_present: update?.characters_present ??
      baseState?.characters_present ??
      [],
    inventory,
    open_threads: openThreads,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  let payload: EpisodeGenerateInput;
  try {
    payload = (await req.json()) as EpisodeGenerateInput;
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  if (!payload?.story_id || !payload?.episode_number || !payload?.user_choice) {
    return jsonResponse(
      { error: "Missing required fields: story_id, episode_number, user_choice" },
      400,
    );
  }
  if (!payload?.story_profile) {
    return jsonResponse({ error: "Missing required field: story_profile" }, 400);
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

  const episodeId = `${payload.story_id}-${payload.episode_number}`;
  const segmentGoal =
    payload.segment_goal ??
      (payload.story_profile as any)?.flow?.dynamic_state?.segment_goal ??
      "Advance the plot";

  const prompt = buildPrompt(payload, episodeId, segmentGoal);

  let episodeOutput: EpisodeOutput | null = null;
  let issues: string[] = [];
  const maxAttempts = 2;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      episodeOutput = await generateEpisode(
        attempt === 0 ? prompt : JSON.stringify({
          issue_summary: issues,
          previous_output: episodeOutput,
          story_profile: payload.story_profile,
          continuity_notes: payload.continuity_notes ?? [],
          user_choice: payload.user_choice,
          segment_goal: segmentGoal,
          instruction:
            "Repair the episode to remove the issues while keeping continuity and tone.",
        }),
        episodeSchema,
      );
    } catch (error) {
      return jsonResponse(
        {
          error: attempt === 0
            ? "Failed to generate episode"
            : "Failed to repair episode",
          details: error instanceof Error ? error.message : String(error),
        },
        500,
      );
    }

    const outputValidation = validateSchema<EpisodeOutput>(
      episodeSchema,
      episodeOutput,
    );
    if (!outputValidation.valid) {
      return jsonResponse(
        {
          error: "Episode output failed schema validation",
          details: formatAjvErrors(outputValidation.errors),
        },
        500,
      );
    }

    issues = [];
    const hasWarnings = episodeOutput.continuity_checks?.some(
      (check) => check.result === "warn",
    );
    if (hasWarnings) {
      issues.push(
        ...episodeOutput.continuity_checks
          .filter((check) => check.result === "warn")
          .map((check) => check.note),
      );
    }

    const ratingIssues = collectRatingIssues(
      episodeOutput,
      payload.story_profile,
    );
    issues.push(...ratingIssues);

    if (issues.length === 0) {
      break;
    }
  }

  if (!episodeOutput || issues.length > 0) {
    return jsonResponse(
      { error: "Episode output failed safety checks", details: issues },
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
  const baseState = (payload.story_profile as any)?.flow?.dynamic_state ?? {};
  const stateSnapshot = buildStateSnapshot(baseState, episodeOutput.state_update);

  const { data: episodeRow, error: episodeError } = await supabase
    .from("episodes")
    .insert({
      story_id: payload.story_id,
      episode_number: payload.episode_number,
      title: episodeOutput.segment.title,
      text: episodeOutput.segment.text,
      choices: episodeOutput.choices,
      recap: null,
      state_snapshot: stateSnapshot,
    })
    .select()
    .single();

  if (episodeError) {
    return jsonResponse(
      { error: "Failed to persist episode", details: episodeError.message },
      500,
    );
  }

  if (payload.session_id) {
    await supabase
      .from("sessions")
      .update({ current_episode_number: payload.episode_number })
      .eq("id", payload.session_id);
  }

  return jsonResponse(
    {
      episode: episodeRow,
      output: episodeOutput,
    },
    201,
  );
});
