import type { Feedback } from "./feedback.js";

export function buildContext(input: {
  task: string;
  feedback: Feedback[];
  memories: string[];
  recentRuns?: string[];
  workspace?: { id: string; name: string };
  allowedCommands?: string[];
}): string {
  const feedbackSection = input.feedback.length === 0
    ? "None"
    : input.feedback.map((feedback, index) => `${index + 1}. ${feedback.source} [${feedback.severity}]: ${feedback.message}\n${JSON.stringify(feedback.payload)}`).join("\n");
  const memoriesSection = input.memories.length === 0
    ? "None"
    : input.memories.map((memory, index) => `${index + 1}. ${memory}`).join("\n");
  const recentRunsSection = input.recentRuns === undefined || input.recentRuns.length === 0
    ? "None"
    : input.recentRuns.map((run, index) => `${index + 1}. ${run}`).join("\n");
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
    "- read_file: {\"type\":\"read_file\",\"path\":\"src/index.js\",\"reason\":\"inspect implementation\"}",
    "- write_file: {\"type\":\"write_file\",\"path\":\"src/index.js\",\"content\":\"...\",\"reason\":\"apply fix\"}",
    "- run_command: {\"type\":\"run_command\",\"command\":\"npm test\",\"reason\":\"verify change\"}",
    "- remember: {\"type\":\"remember\",\"key\":\"project.testCommand\",\"value\":\"npm test\",\"scope\":\"workspace\",\"reason\":\"store project convention\"}",
    "- finish: {\"type\":\"finish\",\"summary\":\"中文说明：改了哪些文件、完成了什么、如何验证\"}",
    "",
    "# Allowed commands",
    commandsSection,
    "",
    "# Memories",
    memoriesSection,
    "",
    "# Recent runs",
    recentRunsSection,
    "",
    "# Recent feedback",
    feedbackSection,
    "",
    "# Operating rules",
    "- Inspect the workspace before editing unless the needed file is already known.",
    "- Prefer list_files and read_file before write_file.",
    "- If the task asks for a small new feature or algorithm, create or update the appropriate file in this workspace instead of only describing the answer.",
    "- Do not keep calling list_files after the useful project layout is visible; move on to read_file, write_file, run_command, or finish.",
    "- After writing code, run an allowed verification command such as npm test or npm run build.",
    "- Write finish.summary in Chinese with 2-4 sentences, including changed files, implementation result, and verification result.",
    "- After successful verification, return finish instead of repeating read_file, list_files, or write_file.",
    "- If feedback reports invalid_action, return a corrected JSON action with the exact required shape.",
    "- If feedback reports safety_blocked, choose a safer allowed action instead of repeating the blocked action.",
    "- Do not finish before you have either verified the requested change or explained why verification is impossible."
  ].join("\n");
}
