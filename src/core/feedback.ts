export type Feedback = {
  source:
    | "invalid_action"
    | "safety_blocked"
    | "command_failed"
    | "test_failed"
    | "static_check_failed"
    | "tool_succeeded"
    | "credential_missing";
  severity: "info" | "warning" | "error";
  message: string;
  payload?: Record<string, unknown>;
};
