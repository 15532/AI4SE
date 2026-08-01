import type { Feedback } from "./feedback.js";

export function buildContext(input: {
  task: string;
  feedback: Feedback[];
  memories: string[];
  workspace?: { id: string; name: string };
  allowedCommands?: string[];
}): string {
  const feedbackSection = input.feedback.length === 0
    ? "None"
    : input.feedback.map((feedback, index) => `${index + 1}. ${feedback.source} [${feedback.severity}]: ${feedback.message}\n${JSON.stringify(feedback.payload)}`).join("\n");
  const memoriesSection = input.memories.length === 0
    ? "None"
    : input.memories.map((memory, index) => `${index + 1}. ${memory}`).join("\n");
  const commandsSection = input.allowedCommands === undefined || input.allowedCommands.length === 0
    ? "No shell commands are allowed in this workspace."
    : input.allowedCommands.map((command) => `- ${command}`).join("\n");
  const workspaceSection = input.workspace === undefined
    ? "Unknown workspace"
    : `${input.workspace.name} (${input.workspace.id})`;

  return [
    "# Task",
    input.task,
    "",
    "# Workspace",
    workspaceSection,
    "",
    "# Available actions",
    "- list_files: {\"type\":\"list_files\",\"path\":\".\",\"reason\":\"inspect project\"}",
    "- read_file: {\"type\":\"read_file\",\"path\":\"src/index.ts\",\"reason\":\"inspect implementation\"}",
    "- write_file: {\"type\":\"write_file\",\"path\":\"src/index.ts\",\"content\":\"...\",\"reason\":\"apply fix\"}",
    "- run_command: {\"type\":\"run_command\",\"command\":\"npm test\",\"reason\":\"verify change\"}",
    "- remember: {\"type\":\"remember\",\"key\":\"project.testCommand\",\"value\":\"npm test\",\"scope\":\"workspace\",\"reason\":\"store project convention\"}",
    "- finish: {\"type\":\"finish\",\"summary\":\"what changed and how it was verified\"}",
    "",
    "# Allowed commands",
    commandsSection,
    "",
    "# Memories",
    memoriesSection,
    "",
    "# Recent feedback",
    feedbackSection,
    "",
    "# Operating rules",
    "- Inspect the workspace before editing unless the needed file is already known.",
    "- Prefer list_files and read_file before write_file.",
    "- After writing code, run an allowed verification command such as npm test or npm run build.",
    "- If feedback reports invalid_action, return a corrected JSON action with the exact required shape.",
    "- If feedback reports safety_blocked, choose a safer allowed action instead of repeating the blocked action.",
    "- Do not finish before you have either verified the requested change or explained why verification is impossible."
  ].join("\n");
}
