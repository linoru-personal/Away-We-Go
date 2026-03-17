/**
 * Types for the local travel assistant agent.
 * Minimal type system, easy to expand later.
 */

export interface AgentRequest {
  message: string;
  tripId: string;
  destination?: string;
  startDate?: string;
  endDate?: string;
  childrenAges?: number[];
}

export type PlannerIntent =
  | "search_places"
  | "add_place"
  | "save_note"
  | "create_task"
  | "unknown";

export interface PlannerOutput {
  intent: PlannerIntent;
  params: Record<string, unknown>;
}

export type AgentCardActionType = "add_place" | "save_note" | "create_task";

export interface AgentCard {
  id: string;
  title: string;
  subtitle?: string;
  description?: string;
  actionLabel?: string;
  actionType?: AgentCardActionType;
  payload?: Record<string, unknown>;
}

export interface AgentResponse {
  message: string;
  cards?: AgentCard[];
  followups?: string[];
}
