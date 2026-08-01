import type { Feedback } from "./feedback";

export function buildContext(input: {
  task: string;
  feedback: Feedback[];
  memories: string[];
}): string {
  return JSON.stringify(input);
}
