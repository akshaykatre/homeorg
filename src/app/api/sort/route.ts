import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const MODEL = "claude-sonnet-4-6";
const MAX_CHARS = 4000;
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60_000;

// In-memory per-user request log. Resets on cold start / per serverless
// instance, so it's a basic abuse deterrent, not a hard guarantee.
const hits = new Map<string, number[]>();

function isRateLimited(userId: string) {
  const now = Date.now();
  const recent = (hits.get(userId) || []).filter((t) => now - t < RATE_WINDOW_MS);
  recent.push(now);
  hits.set(userId, recent);
  return recent.length > RATE_LIMIT;
}

type ExistingProject = { id: string; name: string; tasks: string[] };

function buildPrompt(text: string, existing: ExistingProject[]) {
  return (
    "You sort a household's brain dump into a shared home-management app and break bigger jobs into steps. Reply with only JSON and no other text.\n\n" +
    'Shape: {"projects":[{"name":"short project name","existing":"id of an existing project these steps belong to, or null","tasks":[{"text":"short action","suggested":false}]}],"tasks":["standalone action"],"groceries":["item to buy"],"routines":[{"name":"short routine name","days":[1,4]}],"unsure":["thing you cannot place"]}\n\n' +
    "Rules:\n" +
    "- Write in the same language as the dump.\n" +
    '- Anything that takes more than one step or more than one sitting becomes a project, even when the dump mentions it in a single line. Examples: "do the garden", "organise the clothes for the new season", "plan a party", "prepare for a trip", "sort out the loft". Give the project a short name and 3 to 8 concrete steps, in the order you would do them.\n' +
    '- Steps the dump itself mentions get "suggested": false. Steps you add to complete the job get "suggested": true. Make suggested steps practical and specific to what was written, such as the place, the season or the occasion. Do not pad: leave out obvious steps and steps that repeat each other.\n' +
    '- A genuinely single action that fits in one sitting, such as "call the dentist" or "book the car service", goes in "tasks".\n' +
    '- If part of the dump belongs to an existing project, set "existing" to its id, use its exact name, and only add steps that are not already in that project.\n' +
    '- Shopping and household supplies (diapers, milk, soap) go in "groceries" as plain item names.\n' +
    '- Something that repeats every week on its own, such as doing the laundry, bins, or watering plants, goes in "routines" instead of "tasks" or "projects", with a short name and "days": an array of the weekday numbers it repeats on (0=Sunday, 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday, 6=Saturday). If the dump names specific days, use only those. If it says "every day" or "daily", use [0,1,2,3,4,5,6]. If it repeats but no day is given, make your best guess at one or two sensible days rather than leaving it empty.\n' +
    "- Tasks start with a verb and stay short. Keep names, dates and details from the dump.\n" +
    '- Vague worries or anything you cannot place go in "unsure", worded as written.\n' +
    "- Always include all five keys, using empty arrays when there is nothing.\n\n" +
    "Existing projects: " + JSON.stringify(existing) + "\n\nDump:\n<<<\n" + text + "\n>>>"
  );
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (isRateLimited(user.id)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const body = (await req.json()) as { text?: string; existing?: ExistingProject[] };
  const text = (body.text || "").trim();
  if (!text) {
    return NextResponse.json({ error: "empty" }, { status: 400 });
  }
  if (text.length > MAX_CHARS) {
    return NextResponse.json({ error: "too_long" }, { status: 400 });
  }

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 2000,
      messages: [{ role: "user", content: buildPrompt(text, body.existing || []) }],
    }),
  });

  if (res.status === 429) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }
  if (!res.ok) {
    return NextResponse.json({ error: "failed" }, { status: 502 });
  }

  const payload = await res.json();
  const raw = payload?.content?.[0]?.text || "";
  const match = raw.match(/\{[\s\S]*\}/);
  try {
    const data = JSON.parse(match ? match[0] : raw);
    return NextResponse.json({ data });
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 502 });
  }
}
