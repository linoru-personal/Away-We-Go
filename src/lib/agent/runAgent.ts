import type { AgentRequest, AgentResponse, AgentCard } from "@/src/types/agent";
import { planAgentAction } from "./planner";
import { searchPlaces } from "./tools/searchPlaces";
import type { SearchPlacesParams } from "./tools/searchPlaces";

/**
 * Minimal orchestrator for the local travel assistant.
 * Plans from user input, runs tools, returns a friendly response. No DB writes.
 */
export async function runAgent(input: AgentRequest): Promise<AgentResponse> {
  const { intent, params } = planAgentAction(input);

  if (intent === "search_places") {
    const searchParams: SearchPlacesParams = {
      city: params.city as string | undefined,
      category: params.category as string | undefined,
      tags: params.tags as string[] | undefined,
      childAge: params.childAge as number | undefined,
    };
    // [agent debug] remove when done
    console.log("[agent debug] searchPlaces input params:", searchParams);
    const results = await searchPlaces(searchParams);
    // [agent debug] remove when done
    console.log("[agent debug] searchPlaces final results count:", results.length);

    if (results.length === 0) {
      return {
        message: "I couldn't find anything that fits that exactly — try a broader search or a different type of place.",
        followups: [
          "Recommend family-friendly places in Munich",
          "Which parks are good for kids?",
        ],
      };
    }

    const cards: AgentCard[] = results.map((place) => ({
      id: place.id,
      title: place.name,
      subtitle: place.category || place.city,
      description: place.description,
      actionLabel: "Add to trip notes",
      actionType: "add_place",
      payload: { place },
    }));

    return {
      message: "Here are some places you might like:",
      cards,
    };
  }

  if (intent === "unknown") {
    return {
      message: "I can help with place ideas and recommendations for this trip.",
      followups: [
        "Which parks in Munich are good for kids?",
        "Recommend family places",
      ],
    };
  }

  // add_place and others: for now same as unknown (we don't execute add_place yet)
  return {
    message: "I can help with place ideas and recommendations for this trip.",
    followups: [
      "Which parks in Munich are good for kids?",
      "Recommend family places",
    ],
  };
}
