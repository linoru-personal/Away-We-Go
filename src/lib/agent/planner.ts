import type { AgentRequest, PlannerIntent, PlannerOutput } from "@/src/types/agent";

/**
 * Rule-based planner: maps user request to an intent and a small params object.
 * No AI or external packages.
 */
export function planAgentAction(input: AgentRequest): PlannerOutput {
  const message = input.message.trim().toLowerCase();

  const intent = detectIntent(message);
  const params = intent === "search_places" ? buildSearchParams(message, input) : {};

  // [agent debug] remove when done
  console.log("[agent debug] planner output:", { intent, params });

  return { intent, params };
}

function detectIntent(message: string): PlannerIntent {
  if (isSearchPlacesMessage(message)) return "search_places";
  if (isAddPlaceMessage(message)) return "add_place";
  return "unknown";
}

function isSearchPlacesMessage(message: string): boolean {
  const searchPhrases = [
    "recommend",
    "recommended",
    "recommendations",
    "suggestions",
    "suggest",
    "ideas",
    "things to do",
    "activities",
    "places to visit",
    "good places",
    "family-friendly",
    "family friendly",
    "for families",
    "with kids",
    "kids",
    "children",
    "what parks",
    "which places",
    "which parks",
    "indoor activities",
    "indoor places",
    "playground",
    "playgrounds",
    "play area",
    "park",
    "parks",
    "where to go",
    "rainy day",
    "rainy",
    "rain ",
    "outdoor",
    "family places",
  ];
  return searchPhrases.some((phrase) => message.includes(phrase));
}

function isAddPlaceMessage(message: string): boolean {
  const addPhrases = [
    "add the first one",
    "save this",
    "add this",
    "add it",
    "add ",
  ];
  return addPhrases.some((phrase) => message.includes(phrase));
}

function buildSearchParams(message: string, input: AgentRequest): Record<string, unknown> {
  const params: Record<string, unknown> = {};

  // Category: playground/play area takes precedence, then park/parks
  if (mentionsPlaygroundOrPlayArea(message)) {
    params.category = "playground";
  } else if (mentionsPark(message)) {
    params.category = "park";
  }

  const tags = new Set<string>();
  if (mentionsFamilyOrKids(message)) {
    tags.add("family");
    tags.add("kids");
  }
  if (mentionsIndoor(message)) {
    tags.add("indoor");
  }
  if (mentionsRainOrRainy(message)) {
    tags.add("rainy_day");
  }
  if (mentionsOutdoor(message)) {
    tags.add("outdoor");
  }
  if (mentionsAge4Or5(message)) {
    params.childAge = 4;
  }
  if (tags.size > 0) {
    params.tags = [...tags];
  }

  // Prefer city explicitly mentioned in the message (e.g. "parks in Munich"), else use trip destination
  const messageCity = getCityFromMessage(message);
  if (messageCity != null && messageCity !== "") {
    params.city = messageCity;
  } else if (input.destination != null && input.destination.trim() !== "") {
    params.city = input.destination.trim();
  }

  return params;
}

/** If the message explicitly mentions a known city, return it; otherwise null. */
function getCityFromMessage(message: string): string | null {
  const m = message.toLowerCase();
  if (m.includes("munich")) return "Munich";
  return null;
}

function mentionsPlaygroundOrPlayArea(message: string): boolean {
  return (
    message.includes("playground") ||
    message.includes("playgrounds") ||
    message.includes("play area")
  );
}

function mentionsPark(message: string): boolean {
  return message.includes("park") || message.includes("parks");
}

function mentionsFamilyOrKids(message: string): boolean {
  return (
    message.includes("family") ||
    message.includes("kids") ||
    message.includes("child") ||
    message.includes("children")
  );
}

function mentionsIndoor(message: string): boolean {
  return message.includes("indoor");
}

function mentionsRainOrRainy(message: string): boolean {
  return message.includes("rain") || message.includes("rainy");
}

function mentionsOutdoor(message: string): boolean {
  return message.includes("outdoor");
}

function mentionsAge4Or5(message: string): boolean {
  return (
    message.includes("age 4") ||
    message.includes("age 5") ||
    message.includes("4 year") ||
    message.includes("5 year") ||
    message.includes("4-year") ||
    message.includes("5-year") ||
    message.includes("four year") ||
    message.includes("five year")
  );
}
