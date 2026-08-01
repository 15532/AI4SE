export type GuardrailDecision =
  | { decision: "allow" }
  | { decision: "block"; reason: string; ruleId: string }
  | { decision: "require_approval"; reason: string; ruleId: string };
