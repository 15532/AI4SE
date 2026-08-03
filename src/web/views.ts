export type PublicWorkspace = {
  id: string;
  name: string;
  allowedCommands: string[];
  memories?: Array<{ key: string; value: string }>;
  recentRuns?: Array<{ id: string; task: string; status: string; summary?: string }>;
};
export type PublicWorkspaceChange = {
  path: string;
  status: string;
};
export type PublicSessionRun = {
  id: string;
  task: string;
  workspaceId: string;
  status: string;
  summary?: string;
};
export type PublicSession = {
  id: string;
  workspaceId: string;
  provider: string;
  title: string;
  runs: PublicSessionRun[];
  memories?: Array<{ key: string; value: string }>;
  changes?: PublicWorkspaceChange[];
};
export type PublicProvider = { id: string };
export type PublicApproval = {
  id: string;
  ruleId: string;
  reason: string;
  action: unknown;
};
export type PublicWorkspaceFile = {
  path: string;
  kind: "file" | "directory";
};
export type PublicChatRun = {
  id: string;
  task: string;
  workspaceId: string;
  status: string;
  summary?: string;
  approvals?: PublicApproval[];
  changes?: PublicWorkspaceChange[];
  timeline: Array<{ sequence: number; kind: string; payload: Record<string, unknown> }>;
};
export type PublicChatFilePreview = {
  workspaceId: string;
  path: string;
  content: string;
  status?: string;
};
export type PublicChatDiffPreview = {
  workspaceId: string;
  path: string;
  diff: string;
  status?: string;
};
export type PublicChatWorkspaceFiles = {
  workspaceId: string;
  files: PublicWorkspaceFile[];
};
export type PublicChatSession = {
  id: string;
  workspaceId: string;
  provider: string;
  title: string;
  runs: PublicChatRun[];
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const baseStyles = `
      :root { color-scheme: light; --ink: #17202a; --muted: #657386; --line: #d7dee8; --surface: #ffffff; --soft: #f4f6f8; --green: #0f766e; --amber: #a16207; --blue: #2458a6; }
      * { box-sizing: border-box; }
      body { margin: 0; font-family: Arial, "Microsoft YaHei", sans-serif; color: var(--ink); background: #eef2f5; }
      main { width: min(1440px, 100%); margin: 0 auto; padding: 24px; }
      .chat-body { height: 100vh; overflow: hidden; background: #fff; }
      .chat-body main { width: 100%; }
      h1 { margin: 0; font-size: 26px; line-height: 1.2; }
      h2 { margin: 0; font-size: 16px; line-height: 1.25; }
      h3 { margin: 0; font-size: 14px; line-height: 1.25; }
      p { line-height: 1.55; }
      .muted { color: var(--muted); }
      .topbar { display: flex; justify-content: space-between; gap: 18px; align-items: end; margin-bottom: 18px; }
      .eyebrow { margin: 0 0 6px; color: var(--green); font-size: 13px; font-weight: 700; }
      .status-strip { display: flex; flex-wrap: wrap; gap: 8px; justify-content: flex-end; }
      .status-pill { border: 1px solid var(--line); border-radius: 6px; background: var(--surface); padding: 7px 9px; font-size: 13px; color: var(--muted); }
      .ide-shell { display: grid; grid-template-columns: minmax(230px, 300px) minmax(360px, 1fr) minmax(260px, 340px); gap: 14px; align-items: start; }
      .panel, .event { background: var(--surface); border: 1px solid var(--line); border-radius: 8px; padding: 16px; box-shadow: 0 1px 2px rgba(23, 32, 42, 0.05); }
      .workspace-rail, .task-composer, .session-composer, .run-inspector { display: grid; gap: 12px; }
      .workspace-list { display: grid; gap: 10px; }
      .workspace-card { display: grid; gap: 9px; }
      .workspace-card header { display: flex; gap: 8px; justify-content: space-between; align-items: baseline; }
      .workspace-id { font-family: Consolas, monospace; color: var(--green); font-size: 13px; }
      .commands { display: flex; flex-wrap: wrap; gap: 7px; padding: 0; margin: 0; list-style: none; }
      .commands code { display: inline-block; padding: 4px 7px; border-radius: 6px; background: #eef7f4; color: #115e59; font-size: 12px; }
      .signal-list { display: grid; gap: 8px; margin: 0; padding: 0; list-style: none; }
      .signal-list li { display: grid; gap: 2px; padding: 9px; border: 1px solid var(--line); border-radius: 6px; background: var(--soft); }
      .signal-list strong { font-size: 13px; }
      .signal-list span { color: var(--muted); font-size: 12px; }
      form { display: grid; gap: 14px; }
      label { display: grid; gap: 6px; font-weight: 600; }
      select, input { min-height: 38px; padding: 7px 9px; border: 1px solid #cbd5e1; border-radius: 6px; font: inherit; }
      input { width: 100%; }
      button { min-height: 40px; border: 0; border-radius: 6px; background: var(--blue); color: #fff; font: inherit; font-weight: 700; cursor: pointer; }
      .composer-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
      .task-input { min-height: 46px; }
      .run-inspector .metric { display: grid; grid-template-columns: max-content 1fr; gap: 6px 10px; margin: 0; }
      .run-inspector dt { color: var(--muted); font-size: 12px; }
      .run-inspector dd { margin: 0; font-weight: 700; }
      dl { display: grid; grid-template-columns: max-content 1fr; gap: 8px 14px; margin: 18px 0; }
      dt { font-weight: 700; color: #475569; }
      dd { margin: 0; }
      .timeline { list-style: none; padding: 0; display: grid; gap: 12px; }
      .event h2 { display: flex; gap: 10px; align-items: baseline; }
      .sequence { color: #64748b; font-family: Consolas, monospace; font-size: 14px; }
      pre { white-space: pre-wrap; word-break: break-word; overflow-wrap: anywhere; background: #0f172a; color: #e2e8f0; border-radius: 6px; padding: 12px; }
      .run-layout { display: grid; grid-template-columns: minmax(220px, 300px) minmax(0, 1fr); gap: 14px; align-items: start; }
      .run-meta { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; margin: 18px 0; }
      .meta-tile { background: var(--surface); border: 1px solid var(--line); border-radius: 8px; padding: 12px; min-width: 0; }
      .meta-tile span { display: block; color: var(--muted); font-size: 12px; margin-bottom: 5px; }
      .meta-tile strong { display: block; overflow-wrap: anywhere; }
      .timeline-navigator { position: sticky; top: 16px; display: grid; gap: 10px; }
      .event-nav { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
      .event-nav a { display: grid; grid-template-columns: 34px 1fr; gap: 8px; align-items: center; padding: 8px; border: 1px solid var(--line); border-radius: 6px; color: var(--ink); text-decoration: none; background: var(--soft); }
      .event-nav span { color: var(--muted); font-family: Consolas, monospace; font-size: 12px; }
      .event-detail-stack { margin: 0; }
      .session-panels { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; margin-top: 14px; }
      .code-viewer, .memory-panel, .recent-runs { display: grid; gap: 10px; }
      .file-link-list { display: grid; gap: 6px; margin: 0; padding: 0; list-style: none; }
      .file-link-list code { font-size: 12px; color: var(--blue); }
      .diff-inspector { margin: 18px 0; display: grid; gap: 10px; }
      .interactive-session { display: grid; gap: 14px; }
      .session-dashboard { display: grid; grid-template-columns: minmax(300px, 420px) minmax(0, 1fr); gap: 14px; align-items: start; }
      .session-run-list { display: grid; gap: 8px; margin: 0; padding: 0; list-style: none; }
      .session-run-list li { display: grid; gap: 4px; padding: 10px; border: 1px solid var(--line); border-radius: 6px; background: var(--soft); min-width: 0; }
      .session-run-list a { color: var(--blue); font-weight: 700; text-decoration: none; overflow-wrap: anywhere; }
      .change-list { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 8px; margin: 0; padding: 0; list-style: none; }
      .change-list li { display: grid; gap: 4px; padding: 10px; border: 1px solid var(--line); border-radius: 6px; background: var(--soft); min-width: 0; }
      .change-list code { color: var(--blue); overflow-wrap: anywhere; }
      .workspace-file-browser, .workspace-editor { display: grid; gap: 14px; }
      .workspace-editor-layout { display: grid; grid-template-columns: minmax(220px, 300px) minmax(0, 1fr) minmax(240px, 320px); gap: 14px; align-items: start; }
      .workspace-file-tree { display: grid; gap: 5px; margin: 0; padding: 0; list-style: none; }
      .workspace-file-tree a, .workspace-file-tree span { display: block; padding: 7px 8px; border-radius: 6px; color: var(--ink); text-decoration: none; overflow-wrap: anywhere; }
      .workspace-file-tree a:hover { background: #e8f0f8; }
      .workspace-file-tree .directory { color: var(--muted); font-weight: 700; }
      .workspace-editor-shell { display: grid; gap: 0; overflow: hidden; border: 1px solid #cbd5e1; border-radius: 8px; background: #f8fafc; box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.8); }
      .workspace-editor-toolbar { display: flex; justify-content: space-between; gap: 10px; align-items: center; min-height: 42px; padding: 10px 12px; border-bottom: 1px solid #dbe3ed; background: #edf3f8; }
      .workspace-editor-toolbar code { color: var(--blue); overflow-wrap: anywhere; }
      .workspace-editor-textarea { width: 100%; min-height: 560px; resize: vertical; border: 0; outline: none; padding: 16px 18px; background: #f9fbfd; color: #1f2937; font: 14px/1.55 Consolas, "Cascadia Mono", monospace; tab-size: 2; }
      .workspace-editor-textarea:focus { background: #ffffff; box-shadow: inset 0 0 0 2px rgba(36, 88, 166, 0.18); }
      .workspace-editor-actions { display: flex; justify-content: flex-end; gap: 10px; padding: 10px 12px; border-top: 1px solid #dbe3ed; background: #edf3f8; }
      .workspace-editor-status { padding: 8px 10px; border-radius: 6px; background: #e7f6ee; color: #166534; font-weight: 700; }
      .workspace-editor-note { display: grid; gap: 8px; }
      .codex-app-shell { width: 100%; max-width: none; min-height: 100vh; margin: 0; padding: 0; display: grid; grid-template-columns: 280px minmax(0, 1fr) 320px; grid-template-rows: 52px minmax(0, 1fr); background: #f6f7f9; overflow: hidden; }
      .codex-app-bar { grid-column: 1 / -1; display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 0 16px; border-bottom: 1px solid #d9dee7; background: rgba(255, 255, 255, 0.92); backdrop-filter: blur(10px); }
      .codex-brand { display: flex; align-items: center; gap: 10px; min-width: 0; }
      .codex-mark { width: 24px; height: 24px; display: grid; place-items: center; border-radius: 7px; color: #fff; background: #1f2937; font-weight: 800; font-size: 13px; }
      .codex-title { display: grid; gap: 1px; min-width: 0; }
      .codex-title strong { font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .codex-title span { color: #667085; font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .codex-top-actions { display: flex; align-items: center; gap: 8px; min-width: 0; }
      .codex-chip { min-height: 28px; display: inline-flex; align-items: center; gap: 6px; padding: 0 9px; border: 1px solid #d9dee7; border-radius: 7px; background: #fff; color: #475467; font-size: 12px; white-space: nowrap; }
      .codex-sidebar { grid-column: 1; grid-row: 2; min-height: 0; display: grid; grid-template-rows: auto minmax(0, 1fr); gap: 10px; padding: 14px 10px 14px 14px; border-right: 1px solid #d9dee7; background: #f1f3f6; }
      .codex-sidebar-header { display: flex; justify-content: space-between; align-items: center; gap: 10px; padding: 0 4px; }
      .codex-sidebar-header h2, .codex-agent-section h2 { margin: 0; font-size: 12px; color: #667085; text-transform: uppercase; letter-spacing: 0; }
      .codex-file-scroll { min-height: 0; overflow: auto; padding-right: 4px; }
      .codex-file-tree { display: grid; gap: 2px; margin: 0; padding: 0; list-style: none; }
      .codex-file-tree a, .codex-file-tree span { min-height: 28px; display: flex; align-items: center; gap: 7px; padding: 5px 8px; border-radius: 7px; color: #344054; text-decoration: none; font-size: 13px; line-height: 1.25; overflow-wrap: anywhere; }
      .codex-file-tree a:hover { background: #e6eaf0; }
      .codex-file-tree a[aria-current="page"] { color: #111827; background: #dfe7f3; box-shadow: inset 2px 0 0 #2563eb; }
      .codex-file-tree .directory { color: #667085; font-weight: 700; }
      .codex-editor-main { grid-column: 2; grid-row: 2; min-width: 0; min-height: 0; display: grid; grid-template-rows: 42px minmax(0, 1fr) 34px; background: #fbfcfd; }
      .codex-editor-tabbar { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 0 12px; border-bottom: 1px solid #e1e6ee; background: #f8fafc; }
      .codex-editor-tab { min-width: 0; max-width: 70%; display: inline-flex; align-items: center; gap: 8px; height: 30px; padding: 0 10px; border: 1px solid #d9dee7; border-bottom-color: #fbfcfd; border-radius: 7px 7px 0 0; background: #fff; color: #1f2937; font: 13px Consolas, "Cascadia Mono", monospace; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .codex-editor-tools { display: flex; align-items: center; gap: 8px; color: #667085; font-size: 12px; }
      .codex-editor-save { min-height: 30px; padding: 0 12px; border-radius: 7px; background: #2563eb; color: #fff; font-size: 13px; font-weight: 700; }
      .codex-editor-canvas { min-height: 0; display: grid; background: linear-gradient(#fbfcfd, #f7f9fc); }
      .codex-editor-textarea { width: 100%; min-height: 100%; resize: none; border: 0; outline: none; padding: 18px 22px; background: transparent; color: #202938; font: 14px/1.65 Consolas, "Cascadia Mono", monospace; tab-size: 2; }
      .codex-editor-textarea:focus { background: rgba(255, 255, 255, 0.58); box-shadow: inset 0 0 0 2px rgba(37, 99, 235, 0.12); }
      .codex-editor-statusbar { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 0 12px; border-top: 1px solid #e1e6ee; background: #f8fafc; color: #667085; font-size: 12px; }
      .codex-empty-editor { min-height: 0; display: grid; place-items: center; padding: 32px; color: #667085; text-align: center; }
      .codex-empty-editor h2 { margin-bottom: 8px; color: #1f2937; font-size: 18px; }
      .codex-agent-panel { grid-column: 3; grid-row: 2; min-height: 0; display: grid; align-content: start; gap: 12px; padding: 14px; border-left: 1px solid #d9dee7; background: #f1f3f6; overflow: auto; }
      .codex-agent-section { display: grid; gap: 8px; }
      .codex-agent-card { display: grid; gap: 4px; padding: 10px; border: 1px solid #d9dee7; border-radius: 8px; background: rgba(255, 255, 255, 0.78); }
      .codex-agent-card strong { font-size: 13px; }
      .codex-agent-card span, .codex-agent-card code { color: #667085; font-size: 12px; overflow-wrap: anywhere; }
      .codex-change-list { display: grid; gap: 8px; margin: 0; padding: 0; list-style: none; }
      .codex-change-list li { display: grid; gap: 3px; padding: 10px; border: 1px solid #d9dee7; border-radius: 8px; background: rgba(255, 255, 255, 0.78); }
      .codex-change-list code { color: #2563eb; font-size: 12px; overflow-wrap: anywhere; }
      .chat-app-shell { width: 100%; max-width: none; height: 100vh; min-height: 0; margin: 0; padding: 0; display: grid; grid-template-columns: 260px minmax(480px, 1fr) 320px; background: #ffffff; overflow: hidden; }
      .chat-sidebar { min-height: 0; overflow: hidden; display: grid; grid-template-rows: auto minmax(0, 1fr) auto; gap: 18px; padding: 18px 10px 12px; border-right: 1px solid #e5e7eb; background: #f7f7f8; }
      .chat-sidebar-brand { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 0 8px; }
      .chat-sidebar-brand strong { font-size: 18px; letter-spacing: 0; }
      .chat-nav { display: grid; gap: 6px; min-height: 0; overflow: auto; }
      .chat-nav-section { display: grid; gap: 5px; }
      .chat-nav-title { padding: 10px 8px 4px; color: #9ca3af; font-size: 12px; }
      .chat-nav-item { display: grid; grid-template-columns: 22px 1fr; gap: 8px; align-items: center; min-height: 34px; padding: 7px 8px; border-radius: 8px; color: #374151; text-decoration: none; font-size: 14px; }
      .chat-nav-item[aria-current="page"], .chat-nav-item:hover { background: #eceef2; color: #111827; }
      .chat-nav-item span:last-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .chat-file-list { display: grid; gap: 2px; margin: 0; padding: 0; list-style: none; }
      .chat-file-list a, .chat-file-list span { display: grid; grid-template-columns: 18px 1fr; gap: 6px; align-items: center; min-height: 28px; padding: 5px 8px; border-radius: 8px; color: #4b5563; text-decoration: none; font-size: 13px; line-height: 1.25; }
      .chat-file-list a:hover, .chat-file-list a[aria-current="page"] { background: #eceef2; color: #111827; }
      .chat-file-list span { color: #9ca3af; }
      .chat-file-list code { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: inherit; font-family: Arial, "Microsoft YaHei", sans-serif; }
      .chat-recent-run-list { display: grid; gap: 2px; margin: 0; padding: 0; list-style: none; }
      .chat-recent-run-list a { display: grid; grid-template-columns: minmax(0, 1fr) max-content; gap: 8px; align-items: center; min-height: 30px; padding: 6px 8px; border-radius: 8px; color: #4b5563; text-decoration: none; font-size: 13px; line-height: 1.25; }
      .chat-recent-run-list a:hover, .chat-recent-run-list a[aria-current="page"] { background: #eceef2; color: #111827; }
      .chat-recent-run-list strong { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 600; }
      .chat-recent-run-list span { color: #9ca3af; font-size: 12px; white-space: nowrap; }
      .chat-sidebar-footer { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 10px 8px 0; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 13px; }
      .chat-main { min-width: 0; min-height: 0; overflow: hidden; display: grid; grid-template-rows: 52px minmax(0, 1fr) auto; background: #ffffff; }
      .chat-header { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 0 20px; border-bottom: 1px solid #eef0f3; }
      .chat-header-title { display: flex; align-items: center; gap: 10px; min-width: 0; }
      .chat-header-title strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .chat-header-actions { display: flex; gap: 8px; align-items: center; }
      .chat-thread { min-height: 0; overflow: auto; display: grid; align-content: start; gap: 18px; padding: 28px min(8vw, 96px) 24px; }
      .chat-message { display: grid; grid-template-columns: 34px minmax(0, 760px); gap: 12px; align-items: start; }
      .chat-avatar { width: 34px; height: 34px; border-radius: 10px; display: grid; place-items: center; background: #111827; color: #fff; font-weight: 800; font-size: 12px; }
      .chat-bubble { min-width: 0; display: grid; gap: 10px; color: #24292f; font-size: 15px; line-height: 1.65; }
      .chat-bubble p { margin: 0; }
      .chat-card { display: grid; gap: 8px; padding: 14px; border: 1px solid #e5e7eb; border-radius: 10px; background: #f8fafc; }
      .chat-card-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; color: #4b5563; font-size: 13px; }
      .chat-card-row code { color: #2563eb; }
      .chat-run-result { gap: 12px; }
      .chat-run-result header { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
      .chat-run-result h2 { color: #111827; font-size: 15px; }
      .chat-run-result a { color: #2563eb; font-size: 13px; text-decoration: none; }
      .chat-live-indicator { display: inline-flex; align-items: center; gap: 6px; margin-left: 8px; color: #047857; font-size: 12px; font-weight: 700; }
      .chat-live-indicator::before { content: ""; width: 7px; height: 7px; border-radius: 999px; background: #10b981; box-shadow: 0 0 0 4px rgba(16, 185, 129, 0.14); }
      .chat-run-meta { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
      .chat-run-meta div { display: grid; gap: 2px; padding: 9px; border: 1px solid #e5e7eb; border-radius: 8px; background: #fff; min-width: 0; }
      .chat-run-meta span { color: #6b7280; font-size: 12px; }
      .chat-run-meta strong, .chat-run-meta code { overflow-wrap: anywhere; }
      .chat-timeline-list { display: grid; gap: 8px; margin: 0; padding: 0; list-style: none; }
      .chat-timeline-list li { display: grid; gap: 6px; padding: 10px; border: 1px solid #e5e7eb; border-radius: 8px; background: #fff; }
      .chat-timeline-list strong { font-size: 13px; }
      .chat-timeline-list pre { margin: 0; max-height: 220px; overflow: auto; background: #f3f4f6; color: #1f2937; border: 1px solid #e5e7eb; }
      .chat-event-summary-list { display: flex; gap: 6px; flex-wrap: wrap; margin: 0; padding: 0; list-style: none; }
      .chat-event-summary-list li { display: inline-flex; align-items: center; gap: 5px; min-height: 26px; padding: 0 8px; border: 1px solid #e5e7eb; border-radius: 999px; background: #f9fafb; color: #4b5563; font-size: 12px; }
      .chat-event-sequence { color: #9ca3af; font-family: Consolas, monospace; }
      .chat-timeline-details { display: grid; gap: 8px; }
      .chat-timeline-details summary { cursor: pointer; color: #2563eb; font-size: 13px; font-weight: 700; }
      .chat-timeline-details[open] summary { margin-bottom: 8px; }
      .chat-tool-call-list { display: grid; gap: 8px; margin-top: 2px; }
      .chat-tool-call-list h3 { color: #6b7280; font-size: 12px; text-transform: uppercase; }
      .chat-tool-card { display: grid; gap: 8px; padding: 11px; border: 1px solid #e5e7eb; border-radius: 10px; background: #fff; }
      .chat-tool-card header { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
      .chat-tool-name { display: inline-flex; align-items: center; gap: 7px; color: #111827; font-weight: 700; font-size: 13px; }
      .chat-tool-target { color: #2563eb; font-family: Consolas, "Cascadia Mono", monospace; font-size: 12px; overflow-wrap: anywhere; }
      .chat-tool-status { padding: 3px 7px; border-radius: 999px; background: #ecfdf3; color: #047857; font-size: 12px; font-weight: 700; white-space: nowrap; }
      .chat-tool-status[data-ok="false"] { background: #fff1f2; color: #be123c; }
      .chat-tool-reason { margin: 0; color: #6b7280; font-size: 13px; line-height: 1.45; }
      .chat-tool-preview { margin: 0; max-height: 150px; overflow: auto; background: #f6f7f9; color: #1f2937; border: 1px solid #e5e7eb; font-size: 12px; line-height: 1.55; }
      .chat-tool-actions { display: flex; gap: 8px; flex-wrap: wrap; }
      .chat-tool-actions a { min-height: 28px; display: inline-flex; align-items: center; padding: 0 9px; border: 1px solid #e5e7eb; border-radius: 7px; background: #f9fafb; color: #2563eb; font-size: 12px; text-decoration: none; }
      .chat-tool-actions a:hover { background: #eef2ff; border-color: #c7d2fe; }
      .chat-context-attachments { display: grid; grid-template-columns: minmax(0, 760px); gap: 10px; margin-left: 46px; }
      .chat-context-attachment { display: grid; gap: 8px; padding: 12px; border: 1px solid #e5e7eb; border-radius: 12px; background: #fbfcfd; box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04); }
      .chat-context-attachment header { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
      .chat-context-attachment strong { overflow-wrap: anywhere; }
      .chat-attachment-kind { color: #6b7280; font-size: 12px; font-weight: 700; }
      .chat-attachment-meta { display: flex; gap: 6px; flex-wrap: wrap; color: #6b7280; font-size: 12px; }
      .chat-attachment-actions { display: flex; gap: 8px; flex-wrap: wrap; }
      .chat-attachment-actions a { min-height: 28px; display: inline-flex; align-items: center; padding: 0 9px; border: 1px solid #e5e7eb; border-radius: 7px; background: #fff; color: #2563eb; font-size: 12px; text-decoration: none; }
      .chat-change-panel, .chat-approval-list { display: grid; gap: 8px; }
      .chat-change-panel header, .chat-approval-list > header { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
      .chat-change-panel h3, .chat-approval-list h3 { color: #6b7280; font-size: 12px; text-transform: uppercase; }
      .chat-change-count { color: #6b7280; font-size: 12px; }
      .chat-change-card, .chat-approval-card { display: grid; gap: 8px; padding: 11px; border: 1px solid #e5e7eb; border-radius: 10px; background: #fff; }
      .chat-change-card header, .chat-approval-card header { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
      .chat-change-status, .chat-approval-state { padding: 3px 7px; border-radius: 999px; background: #eff6ff; color: #1d4ed8; font-size: 12px; font-weight: 700; white-space: nowrap; }
      .chat-change-card code, .chat-approval-card code { color: #2563eb; overflow-wrap: anywhere; }
      .chat-change-actions { display: flex; gap: 8px; flex-wrap: wrap; }
      .chat-change-actions a { color: #2563eb; font-size: 12px; text-decoration: none; }
      .chat-approval-panel { display: grid; gap: 10px; border-color: #f3c96b; background: #fffaf0; }
      .chat-approval-actions { display: flex; gap: 8px; flex-wrap: wrap; }
      .chat-approval-actions form { display: inline-grid; }
      .chat-approval-actions button { min-height: 34px; padding: 0 12px; border-radius: 8px; font-size: 13px; }
      .chat-approval-actions form:last-child button { background: #6b7280; }
      .chat-composer-wrap { padding: 0 min(8vw, 96px) 20px; background: linear-gradient(rgba(255,255,255,0), #fff 22%); }
      .chat-composer { display: grid; gap: 10px; padding: 14px; border: 1px solid #e5e7eb; border-radius: 18px; background: #fff; box-shadow: 0 16px 40px rgba(15, 23, 42, 0.10); }
      .chat-composer textarea { width: 100%; min-height: 74px; max-height: 180px; resize: vertical; border: 0; outline: 0; padding: 4px; font: 15px/1.55 Arial, "Microsoft YaHei", sans-serif; color: #111827; }
      .chat-composer textarea::placeholder { color: #9ca3af; }
      .chat-composer-controls { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
      .chat-composer-selects { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
      .chat-composer-selects label { display: flex; align-items: center; gap: 6px; color: #6b7280; font-size: 12px; font-weight: 600; }
      .chat-composer-selects select { min-height: 32px; border-radius: 8px; background: #f9fafb; font-size: 13px; }
      .chat-send { width: 38px; min-height: 38px; border-radius: 999px; display: grid; place-items: center; background: #111827; color: #fff; font-size: 18px; line-height: 1; }
      .chat-inspector { min-height: 0; overflow: auto; display: grid; align-content: start; gap: 12px; padding: 18px 14px; border-left: 1px solid #e5e7eb; background: #fafafa; }
      .chat-inspector-section { display: grid; gap: 8px; }
      .chat-inspector-section h2 { color: #9ca3af; font-size: 12px; text-transform: uppercase; }
      .chat-inspector-card { display: grid; gap: 5px; padding: 12px; border: 1px solid #e5e7eb; border-radius: 10px; background: #fff; }
      .chat-inspector-card strong { font-size: 13px; }
      .chat-inspector-card span, .chat-inspector-card code { color: #6b7280; font-size: 12px; overflow-wrap: anywhere; }
      .chat-file-preview { gap: 9px; }
      .chat-file-preview header { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
      .chat-file-preview h2 { color: #111827; font-size: 13px; text-transform: none; }
      .chat-file-preview a { color: #2563eb; font-size: 12px; text-decoration: none; }
      .chat-file-preview pre { max-height: 420px; margin: 0; overflow: auto; background: #f3f4f6; color: #1f2937; border: 1px solid #e5e7eb; font-size: 12px; line-height: 1.55; }
      .chat-file-preview-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
      .chat-file-meta { display: flex; gap: 6px; flex-wrap: wrap; }
      .chat-file-stat { display: inline-flex; align-items: center; min-height: 24px; padding: 0 7px; border-radius: 999px; background: #f3f4f6; color: #4b5563; font-size: 12px; }
      .chat-code-preview { max-height: 420px; margin: 0; overflow: auto; border: 1px solid #e5e7eb; border-radius: 8px; background: #f8fafc; color: #1f2937; font-size: 12px; line-height: 1.55; }
      .chat-code-row { display: grid; grid-template-columns: 34px minmax(0, 1fr); min-width: max-content; }
      .chat-code-line-number { padding: 0 9px; color: #9ca3af; text-align: right; user-select: none; border-right: 1px solid #e5e7eb; background: #f1f5f9; }
      .chat-code-line { padding: 0 10px; white-space: pre-wrap; }
      .chat-inline-editor { display: grid; gap: 8px; margin-top: 4px; }
      .chat-inline-editor textarea { width: 100%; min-height: 220px; max-height: 420px; resize: vertical; padding: 10px; border: 1px solid #e5e7eb; border-radius: 8px; background: #fbfcfd; color: #1f2937; font: 12px/1.55 Consolas, "Cascadia Mono", monospace; }
      .chat-inline-editor footer { display: flex; align-items: center; justify-content: space-between; gap: 8px; color: #6b7280; font-size: 12px; }
      .chat-inline-editor button { min-height: 32px; padding: 0 11px; border-radius: 8px; font-size: 13px; }
      .chat-diff-review { gap: 9px; }
      .chat-diff-review header { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
      .chat-diff-review h2 { color: #111827; font-size: 13px; text-transform: none; }
      .chat-diff-review a { color: #2563eb; font-size: 12px; text-decoration: none; }
      .chat-diff-block { max-height: 520px; overflow: auto; border: 1px solid #e5e7eb; border-radius: 8px; background: #fbfcfd; font: 12px/1.55 Consolas, "Cascadia Mono", monospace; }
      .chat-diff-row { display: grid; grid-template-columns: 34px minmax(0, 1fr); min-width: max-content; }
      .chat-diff-line-number { padding: 0 9px; color: #9ca3af; text-align: right; user-select: none; border-right: 1px solid #e5e7eb; background: #f1f5f9; }
      .chat-diff-line { padding: 0 10px; white-space: pre-wrap; color: #374151; }
      .chat-diff-line.addition { background: #ecfdf3; color: #047857; }
      .chat-diff-line.deletion { background: #fff1f2; color: #be123c; }
      .chat-diff-line.header { background: #eef2ff; color: #3730a3; font-weight: 700; }
      @media (max-width: 1060px) { .ide-shell { grid-template-columns: 1fr 1fr; } .run-inspector { grid-column: 1 / -1; } .run-meta { grid-template-columns: 1fr 1fr; } }
      @media (max-width: 1060px) { .workspace-editor-layout { grid-template-columns: minmax(220px, 300px) minmax(0, 1fr); } .workspace-editor-note { grid-column: 1 / -1; } }
      @media (max-width: 1100px) { .codex-app-shell { grid-template-columns: 240px minmax(0, 1fr); } .codex-agent-panel { display: none; } }
      @media (max-width: 1180px) { .chat-app-shell { grid-template-columns: 230px minmax(0, 1fr); } .chat-inspector { display: none; } }
      @media (max-width: 760px) { main { padding: 16px; } .topbar, .ide-shell, .composer-grid, .run-layout, .run-meta, .session-panels, .session-dashboard, .workspace-editor-layout { grid-template-columns: 1fr; display: grid; } .status-strip { justify-content: start; } .timeline-navigator { position: static; } .codex-app-shell { height: auto; min-height: 100vh; grid-template-columns: 1fr; grid-template-rows: auto auto minmax(520px, 1fr); padding: 0; } .codex-app-bar, .codex-sidebar, .codex-editor-main { grid-column: 1; grid-row: auto; } .codex-agent-panel { display: grid; grid-column: 1; grid-row: auto; } .codex-sidebar { max-height: 240px; border-right: 0; border-bottom: 1px solid #d9dee7; } .chat-app-shell { grid-template-columns: 1fr; height: 100vh; min-height: 0; padding: 0; overflow: hidden; } .chat-sidebar, .chat-inspector { display: none; } .chat-thread, .chat-composer-wrap { padding-left: 16px; padding-right: 16px; } .chat-main { min-height: 0; } .chat-message { grid-template-columns: 28px minmax(0, 1fr); } .chat-context-attachments { margin-left: 40px; grid-template-columns: minmax(0, 1fr); } .chat-run-meta { grid-template-columns: 1fr; } }
`;

function eventLabel(kind: string): string {
  switch (kind) {
    case "parsed_action": return "动作 Action";
    case "guardrail": return "护栏 Guardrail";
    case "tool_result": return "工具结果 Tool Result";
    case "feedback": return "反馈 Feedback";
    case "stop": return "停止 Stop Reason";
    case "llm_response": return "模型响应 LLM Response";
    case "approval_required": return "审批 Approval";
    case "approval_decision": return "审批结果 Approval Decision";
    default: return kind;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function truncate(value: string, maxLength = 900): string {
  return value.length <= maxLength ? value : `${value.slice(0, maxLength)}\n...`;
}

function actionLabel(action: Record<string, unknown>): string {
  switch (action.type) {
    case "list_files": return "列出文件";
    case "read_file": return "读取文件";
    case "write_file": return "写入文件";
    case "run_command": return "运行命令";
    case "remember": return "记录记忆";
    default: return typeof action.type === "string" ? action.type : "工具调用";
  }
}

function actionTarget(action: Record<string, unknown>): string {
  return stringValue(action.path)
    ?? stringValue(action.command)
    ?? stringValue(action.key)
    ?? "";
}

function resultPreview(result: Record<string, unknown>): string {
  const stdout = stringValue(result.stdout);
  const stderr = stringValue(result.stderr);
  const error = stringValue(result.error);
  const parts = [
    stdout === undefined || stdout === "" ? undefined : stdout,
    stderr === undefined || stderr === "" ? undefined : stderr,
    error
  ].filter((part): part is string => part !== undefined);
  return truncate(parts.join("\n") || "没有输出");
}

function isFileToolAction(action: Record<string, unknown>): boolean {
  const type = action.type;
  const path = stringValue(action.path);
  return (type === "read_file" || type === "write_file") && path !== undefined && path !== "";
}

function chatFilePreviewHref(run: PublicChatRun, path: string, sessionId?: string): string {
  const sessionQuery = sessionId === undefined ? "" : `&sessionId=${encodeURIComponent(sessionId)}`;
  return `/?workspaceId=${encodeURIComponent(run.workspaceId)}&file=${encodeURIComponent(path)}&runId=${encodeURIComponent(run.id)}${sessionQuery}`;
}

function chatFileEditorHref(run: PublicChatRun, path: string): string {
  return `/workspaces/${encodeURIComponent(run.workspaceId)}/files/${encodeURIComponent(path)}`;
}

function renderChatToolActions(run: PublicChatRun, action: Record<string, unknown>, sessionId?: string): string {
  if (!isFileToolAction(action)) return "";
  const path = stringValue(action.path);
  if (path === undefined) return "";
  return `
                  <div class="chat-tool-actions">
                    <a href="${escapeHtml(chatFilePreviewHref(run, path, sessionId))}">预览文件</a>
                    <a href="${escapeHtml(chatFileEditorHref(run, path))}">编辑文件</a>
                  </div>`;
}

function renderChatToolCards(run: PublicChatRun, sessionId?: string): string {
  const cards = run.timeline
    .filter((event) => event.kind === "tool_result")
    .map((event) => {
      const action = isRecord(event.payload.action) ? event.payload.action : {};
      const result = isRecord(event.payload.result) ? event.payload.result : {};
      const ok = result.ok === true;
      const target = actionTarget(action);
      const reason = stringValue(action.reason);
      return `
                <article class="chat-tool-card">
                  <header>
                    <span class="chat-tool-name">${escapeHtml(actionLabel(action))}</span>
                    <span class="chat-tool-status" data-ok="${ok ? "true" : "false"}">${ok ? "成功" : "失败"}</span>
                  </header>
                  ${target === "" ? "" : `<code class="chat-tool-target">${escapeHtml(target)}</code>`}
                  ${reason === undefined ? "" : `<p class="chat-tool-reason">${escapeHtml(reason)}</p>`}
                  <pre class="chat-tool-preview">${escapeHtml(resultPreview(result))}</pre>
                  ${renderChatToolActions(run, action, sessionId)}
                </article>`;
    }).join("");

  return cards === ""
    ? ""
    : `
              <section class="chat-tool-call-list" aria-label="工具调用">
                <h3>工具调用</h3>
                ${cards}
              </section>`;
}

function renderChatApprovals(approvals: PublicApproval[] = []): string {
  const cards = approvals.map((approval) => {
    const action = isRecord(approval.action) ? approval.action : {};
    const target = actionTarget(action);
    const reason = stringValue(action.reason);
    return `
                <article class="chat-card approval-panel chat-approval-panel chat-approval-card">
                  <header>
                    <span class="chat-approval-state">等待审批</span>
                    <strong>${escapeHtml(approval.ruleId)}</strong>
                  </header>
                  ${target === "" ? "" : `<code>${escapeHtml(target)}</code>`}
                  <p class="chat-tool-reason">${escapeHtml(reason ?? approval.reason)}</p>
                  <pre>${escapeHtml(JSON.stringify(approval.action, null, 2))}</pre>
                  <div class="chat-approval-actions">
                    <form method="post" action="/api/approvals/${escapeHtml(encodeURIComponent(approval.id))}/approve">
                      <button type="submit">批准执行</button>
                    </form>
                    <form method="post" action="/api/approvals/${escapeHtml(encodeURIComponent(approval.id))}/reject">
                      <button type="submit">拒绝</button>
                    </form>
                  </div>
                </article>`;
  }).join("");

  return cards === ""
    ? ""
    : `
              <section class="chat-approval-list approval-panel" aria-label="等待审批">
                <header>
                  <h3>等待审批</h3>
                  <span class="chat-change-count">${approvals.length}</span>
                </header>
                ${cards}
              </section>`;
}

function renderChatChangePanel(run: PublicChatRun): string {
  const changes = run.changes ?? [];
  if (changes.length === 0) {
    return `
              <section class="chat-card chat-change-panel" aria-label="文件变更">
                <header>
                  <h3>文件变更</h3>
                  <span class="chat-change-count">0</span>
                </header>
              </section>`;
  }

  const cards = changes.map((change) => {
    const previewHref = `/?workspaceId=${encodeURIComponent(run.workspaceId)}&file=${encodeURIComponent(change.path)}&runId=${encodeURIComponent(run.id)}`;
    const diffHref = `/?workspaceId=${encodeURIComponent(run.workspaceId)}&diff=${encodeURIComponent(change.path)}&runId=${encodeURIComponent(run.id)}`;
    return `
                <article class="chat-change-card">
                  <header>
                    <strong>${escapeHtml(change.path)}</strong>
                    <span class="chat-change-status">${escapeHtml(change.status)}</span>
                  </header>
                  <div class="chat-change-actions">
                    <a href="${escapeHtml(previewHref)}">预览文件</a>
                    <a href="${escapeHtml(diffHref)}">查看 diff</a>
                  </div>
                </article>`;
  }).join("");

  return `
              <section class="chat-card chat-change-panel" aria-label="文件变更">
                <header>
                  <h3>文件变更</h3>
                  <span class="chat-change-count">${changes.length}</span>
                </header>
                ${cards}
              </section>`;
}

function renderChatEventSummary(timeline: PublicChatRun["timeline"]): string {
  const items = timeline.map((event) => `
                  <li data-event-kind="${escapeHtml(event.kind)}">
                    <span class="chat-event-sequence">${event.sequence}</span>
                    <span>${escapeHtml(eventLabel(event.kind))}</span>
                  </li>`).join("");
  return items === ""
    ? ""
    : `
                <ul class="chat-event-summary-list" aria-label="运行事件摘要">
                  ${items}
                </ul>`;
}

function renderChatRunMessages(run?: PublicChatRun, compact = false, sessionId?: string): string {
  if (run === undefined) {
    return `
          <article class="chat-message">
            <div class="chat-avatar">You</div>
            <div class="chat-bubble">
              <p>在底部输入框描述任务，例如：阅读项目结构，修复失败测试，并说明验证结果。</p>
            </div>
          </article>`;
  }

  const approvalItems = compact ? "" : renderChatApprovals(run.approvals);
  const timelineItems = run.timeline.map((event) => `
                <li>
                  <strong>${event.sequence}. ${escapeHtml(eventLabel(event.kind))}</strong>
                  <pre>${escapeHtml(JSON.stringify(event.payload, null, 2))}</pre>
                </li>`).join("");
  const toolCards = compact ? "" : renderChatToolCards(run, sessionId);
  const changePanel = compact ? "" : renderChatChangePanel(run);
  const eventSummary = compact ? "" : renderChatEventSummary(run.timeline);
  const timelineDetails = compact
    ? ""
    : `<details class="chat-timeline-details">
                  <summary>查看完整 timeline (${run.timeline.length})</summary>
                  <ol class="chat-timeline-list">${timelineItems}</ol>
                </details>`;
  const isLive = run.status === "running" && !compact;
  const lastSequence = run.timeline.reduce((max, event) => Math.max(max, event.sequence), 0);
  const liveAttrs = isLive
    ? ` data-live-run-id="${escapeHtml(run.id)}" data-live-after="${lastSequence}" data-live-endpoint="/api/runs/${escapeHtml(encodeURIComponent(run.id))}/timeline"`
    : "";

  return `
          <article class="chat-message">
            <div class="chat-avatar">You</div>
            <div class="chat-bubble">
              <p>${escapeHtml(run.task)}</p>
            </div>
          </article>
          <article class="chat-message">
            <div class="chat-avatar">AI</div>
            <div class="chat-bubble chat-run-result">
              <div class="chat-card chat-run-result"${liveAttrs}>
                <header>
                  <h2>${compact ? "历史运行" : "运行结果"}${isLive ? '<span class="chat-live-indicator">运行中</span>' : ""}</h2>
                  <a href="/runs/${escapeHtml(encodeURIComponent(run.id))}">打开详细 timeline</a>
                </header>
                <div class="chat-run-meta">
                  <div><span>状态</span><strong data-live-status>${escapeHtml(run.status)}</strong></div>
                  <div><span>工作区</span><code>${escapeHtml(run.workspaceId)}</code></div>
                  <div><span>Run ID</span><code>${escapeHtml(run.id)}</code></div>
                </div>
                <p>${escapeHtml(run.summary ?? "这次运行没有返回 summary，请查看 timeline 事件。")}</p>
                ${approvalItems}
                ${toolCards}
                ${eventSummary}
                ${timelineDetails}
              </div>
              ${changePanel}
            </div>
          </article>`;
}

function renderChatSessionThread(session?: PublicChatSession, activeRun?: PublicChatRun): string {
  if (session === undefined) return renderChatRunMessages(activeRun);
  const activeRunId = activeRun?.id ?? session.runs.at(-1)?.id;
  const messages = session.runs.map((run) => renderChatRunMessages(
    run.id === activeRunId && activeRun !== undefined ? activeRun : run,
    run.id !== activeRunId,
    session.id
  )).join("");
  return `<div class="chat-session-thread" data-session-id="${escapeHtml(session.id)}">${messages || renderChatRunMessages(activeRun, false, session.id)}</div>`;
}

function renderChatLiveScript(activeRun?: PublicChatRun): string {
  if (activeRun?.status !== "running") return "";
  return `
    <script>
      (() => {
        const card = document.querySelector("[data-live-run-id]");
        if (!(card instanceof HTMLElement)) return;
        const timeline = card.querySelector(".chat-timeline-list");
        const status = card.querySelector("[data-live-status]");
        let after = Number(card.dataset.liveAfter || "0");
        const endpoint = card.dataset.liveEndpoint;
        if (!endpoint) return;

        const label = (kind) => ({
          parsed_action: "动作 Action",
          guardrail: "护栏 Guardrail",
          tool_result: "工具结果 Tool Result",
          feedback: "反馈 Feedback",
          stop: "停止 Stop Reason",
          llm_response: "模型响应 LLM Response",
          approval_required: "审批 Approval",
          approval_decision: "审批结果 Approval Decision",
          run_started: "开始 Run Started"
        })[kind] || kind;

        const appendEvent = (event) => {
          if (!(timeline instanceof HTMLElement)) return;
          const item = document.createElement("li");
          const title = document.createElement("strong");
          title.textContent = event.sequence + ". " + label(event.kind);
          const detail = document.createElement("pre");
          detail.textContent = JSON.stringify(event.payload, null, 2);
          item.append(title, detail);
          timeline.append(item);
        };

        const poll = async () => {
          try {
            const response = await fetch(endpoint + "?after=" + after, { headers: { accept: "application/json" } });
            if (!response.ok) throw new Error("timeline request failed");
            const payload = await response.json();
            for (const event of payload.timeline || []) {
              appendEvent(event);
              after = Math.max(after, Number(event.sequence || 0));
            }
            card.dataset.liveAfter = String(after);
            if (status instanceof HTMLElement) status.textContent = payload.status;
            if (payload.status === "running") {
              window.setTimeout(poll, 1000);
            } else {
              window.setTimeout(() => window.location.reload(), 350);
            }
          } catch {
            window.setTimeout(poll, 2000);
          }
        };
        window.setTimeout(poll, 1000);
      })();
    </script>`;
}

const chatShowcaseFileLimit = 24;

function isChatShowcaseNoise(pathValue: string): boolean {
  const normalized = pathValue.toLowerCase();
  return normalized === ".superpowers"
    || normalized.startsWith(".superpowers/")
    || normalized === "data"
    || normalized.startsWith("data/")
    || normalized === "logs"
    || normalized.startsWith("logs/")
    || normalized === "docs/superpowers"
    || normalized.startsWith("docs/superpowers/")
    || normalized.endsWith(".sqlite")
    || normalized.endsWith(".sqlite3")
    || normalized.endsWith(".db")
    || normalized.endsWith(".log");
}

function chatShowcasePriority(entry: PublicWorkspaceFile): number {
  const normalized = entry.path.toLowerCase();
  if (normalized === "readme.md") return 0;
  if (normalized === "package.json") return 1;
  if (normalized === "spec.md" || normalized === "spec_process.md") return 2;
  if (normalized === "src") return 10;
  if (normalized.startsWith("src/")) return 11;
  if (normalized === "tests") return 20;
  if (normalized.startsWith("tests/")) return 21;
  if (normalized === "config") return 30;
  if (normalized.startsWith("config/")) return 31;
  if (normalized === "docs") return 40;
  if (normalized.startsWith("docs/")) return 41;
  return entry.kind === "directory" ? 80 : 90;
}

function selectChatShowcaseFiles(files: PublicWorkspaceFile[]): PublicWorkspaceFile[] {
  return files
    .filter((file) => !isChatShowcaseNoise(file.path))
    .sort((left, right) => {
      const priority = chatShowcasePriority(left) - chatShowcasePriority(right);
      if (priority !== 0) return priority;
      return left.path.localeCompare(right.path);
    })
    .slice(0, chatShowcaseFileLimit);
}

function previewLines(content: string): string[] {
  const normalized = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  if (normalized === "") return [""];
  const lines = normalized.split("\n");
  if (lines.at(-1) === "") lines.pop();
  return lines.length === 0 ? [""] : lines;
}

function renderChatCodePreview(content: string, status?: string): string {
  const lines = previewLines(content);
  const statusAttr = status === undefined ? "" : ` data-change-status="${escapeHtml(status)}"`;
  const rows = lines.map((line, index) => `
                <span class="chat-code-row">
                  <span class="chat-code-line-number">${index + 1}</span>
                  <span class="chat-code-line">${escapeHtml(line)}</span>
                </span>`).join("");
  return `<pre class="chat-code-preview" data-lines="${lines.length}"${statusAttr}>${rows}
            </pre>`;
}

function diffLineKind(line: string): "addition" | "deletion" | "header" | "context" {
  if (line.startsWith("+") && !line.startsWith("+++")) return "addition";
  if (line.startsWith("-") && !line.startsWith("---")) return "deletion";
  if (line.startsWith("diff --git") || line.startsWith("@@") || line.startsWith("---") || line.startsWith("+++")) return "header";
  return "context";
}

function renderChatDiffPreview(diff: string): string {
  const lines = previewLines(diff);
  const rows = lines.map((line, index) => {
    const kind = diffLineKind(line);
    return `
                <span class="chat-diff-row">
                  <span class="chat-diff-line-number">${index + 1}</span>
                  <span class="chat-diff-line ${kind}">${escapeHtml(line)}</span>
                </span>`;
  }).join("");
  return `<div class="chat-diff-block">${rows}
            </div>`;
}

function renderChatContextAttachments(input: {
  activeRun?: PublicChatRun;
  filePreview?: PublicChatFilePreview;
  filePreviewLines: number;
  filePreviewStatus?: string;
  filePreviewDiffHref?: string;
  filePreviewEditorHref?: string;
  diffPreview?: PublicChatDiffPreview;
  diffPreviewStatus?: string;
  diffFileHref?: string;
}): string {
  const attachments: string[] = [];
  if (input.filePreview !== undefined) {
    attachments.push(`
            <article class="chat-context-attachment" data-attachment-kind="file">
              <header>
                <span class="chat-attachment-kind">文件预览</span>
                <strong>${escapeHtml(input.filePreview.path)}</strong>
              </header>
              <div class="chat-attachment-meta">
                <span>${input.filePreviewLines} 行</span>
                <span>${input.filePreview.content.length} 字符</span>
                ${input.filePreviewStatus === undefined ? "" : `<span>${escapeHtml(input.filePreviewStatus)}</span>`}
              </div>
              <div class="chat-attachment-actions">
                ${input.filePreviewDiffHref === undefined ? "" : `<a href="${escapeHtml(input.filePreviewDiffHref)}">查看 diff</a>`}
                ${input.filePreviewEditorHref === undefined ? "" : `<a href="${escapeHtml(input.filePreviewEditorHref)}">打开编辑器</a>`}
              </div>
            </article>`);
  }
  if (input.diffPreview !== undefined) {
    attachments.push(`
            <article class="chat-context-attachment" data-attachment-kind="diff">
              <header>
                <span class="chat-attachment-kind">Diff 审查</span>
                <strong>${escapeHtml(input.diffPreview.path)}</strong>
              </header>
              <div class="chat-attachment-meta">
                ${input.diffPreviewStatus === undefined ? "" : `<span>${escapeHtml(input.diffPreviewStatus)}</span>`}
                <span>${previewLines(input.diffPreview.diff).length} 行 diff</span>
              </div>
              <div class="chat-attachment-actions">
                ${input.diffFileHref === undefined ? "" : `<a href="${escapeHtml(input.diffFileHref)}">打开文件</a>`}
              </div>
            </article>`);
  }
  const approvals = input.activeRun?.approvals ?? [];
  if (approvals.length > 0) {
    const firstApproval = approvals[0];
    const action = isRecord(firstApproval.action) ? firstApproval.action : {};
    const target = actionTarget(action);
    attachments.push(`
            <article class="chat-context-attachment" data-attachment-kind="approval">
              <header>
                <span class="chat-attachment-kind">人工审批</span>
                <strong>${approvals.length} 个待审批</strong>
              </header>
              ${target === "" ? "" : `<div class="chat-attachment-meta"><span>${escapeHtml(target)}</span></div>`}
              <div class="chat-attachment-actions">
                <a href="/api/approvals/${escapeHtml(encodeURIComponent(firstApproval.id))}/approve">批准执行</a>
                <a href="/api/approvals/${escapeHtml(encodeURIComponent(firstApproval.id))}/reject">拒绝</a>
              </div>
            </article>`);
  }
  return attachments.length === 0
    ? ""
    : `<section class="chat-context-attachments" aria-label="当前对话附件">${attachments.join("")}
          </section>`;
}

export function renderIndex(
  workspaces: PublicWorkspace[],
  providers: PublicProvider[] = [{ id: "mock" }],
  activeRun?: PublicChatRun,
  fileContext?: {
    activeWorkspaceId?: string;
    activeSessionId?: string;
    activeRunId?: string;
    workspaceFiles?: PublicChatWorkspaceFiles;
    workspaceChanges?: PublicWorkspaceChange[];
    filePreview?: PublicChatFilePreview;
    diffPreview?: PublicChatDiffPreview;
  },
  chatSession?: PublicChatSession
): string {
  const options = workspaces
    .map((workspace) => `<option value="${escapeHtml(workspace.id)}">${escapeHtml(workspace.name)} (${escapeHtml(workspace.id)})</option>`)
    .join("");
  const providerOptions = providers
    .map((provider) => `<option value="${escapeHtml(provider.id)}">${escapeHtml(provider.id)}</option>`)
    .join("");
  const providerLabel = providers.map((provider) => provider.id).join(", ");
  const activeWorkspaceId = fileContext?.activeWorkspaceId ?? workspaces[0]?.id;
  const workspaceCards = workspaces.map((workspace, index) => `
            <a class="chat-nav-item" href="/?workspaceId=${escapeHtml(encodeURIComponent(workspace.id))}"${workspace.id === activeWorkspaceId || (activeWorkspaceId === undefined && index === 0) ? ' aria-current="page"' : ""}>
              <span>□</span><span>${escapeHtml(workspace.name)}</span>
            </a>`).join("");
  const firstWorkspace = workspaces[0];
  const fileLinks = firstWorkspace === undefined
    ? ""
    : `<a class="chat-nav-item" href="/workspaces/${escapeHtml(encodeURIComponent(firstWorkspace.id))}/files"><span>⌁</span><span>文件浏览</span></a>`;
  const sessionQuery = fileContext?.activeSessionId === undefined ? "" : `&sessionId=${encodeURIComponent(fileContext.activeSessionId)}`;
  const activeRunId = activeRun?.id ?? fileContext?.activeRunId;
  const runQuery = activeRunId === undefined ? "" : `&runId=${encodeURIComponent(activeRunId)}`;
  const chatFileItems = selectChatShowcaseFiles(fileContext?.workspaceFiles?.files ?? []).map((file) => {
    const icon = file.kind === "directory" ? "▸" : "·";
    if (file.kind === "directory") {
      return `<li><span><span>${icon}</span><code>${escapeHtml(file.path)}</code></span></li>`;
    }
    const href = `/?workspaceId=${encodeURIComponent(fileContext?.workspaceFiles?.workspaceId ?? "")}&file=${encodeURIComponent(file.path)}${sessionQuery}${runQuery}`;
    const active = fileContext?.filePreview?.path === file.path ? ' aria-current="page"' : "";
    return `<li><a${active} href="${escapeHtml(href)}"><span>${icon}</span><code>${escapeHtml(file.path)}</code></a></li>`;
  }).join("");
  const sidebarRecentRuns = workspaces
    .filter((workspace) => activeWorkspaceId === undefined || workspace.id === activeWorkspaceId)
    .flatMap((workspace) => (workspace.recentRuns ?? []).map((run) => {
      const href = `/?workspaceId=${encodeURIComponent(workspace.id)}&runId=${encodeURIComponent(run.id)}`;
      const active = activeRunId === run.id ? ' aria-current="page"' : "";
      return `<li><a${active} href="${escapeHtml(href)}" aria-label="打开最近对话 ${escapeHtml(run.task)}"><strong>${escapeHtml(run.task)}</strong><span>${escapeHtml(run.status)}</span></a></li>`;
    })).join("");
  const filePreview = fileContext?.filePreview;
  const filePreviewLines = filePreview === undefined ? 0 : previewLines(filePreview.content).length;
  const filePreviewStatus = filePreview?.status ?? fileContext?.workspaceChanges?.find((change) => change.path === filePreview?.path)?.status;
  const filePreviewDiffHref = filePreview === undefined || filePreviewStatus === undefined
    ? undefined
    : `/?workspaceId=${encodeURIComponent(filePreview.workspaceId)}&diff=${encodeURIComponent(filePreview.path)}${sessionQuery}${runQuery}`;
  const filePreviewReturnTo = filePreview === undefined
    ? undefined
    : `/?workspaceId=${encodeURIComponent(filePreview.workspaceId)}&file=${encodeURIComponent(filePreview.path)}${sessionQuery}${runQuery}`;
  const filePreviewEditorHref = filePreview === undefined
    ? undefined
    : fileHref(filePreview.workspaceId, filePreview.path);
  const filePreviewPanel = filePreview === undefined
    ? `<div class="chat-inspector-card"><strong>未选择文件</strong><span>从左侧文件列表打开预览，主对话会保持不变。</span></div>`
    : `<div class="chat-inspector-card chat-file-preview">
            <header>
              <h2>${escapeHtml(filePreview.path)}</h2>
              ${filePreviewDiffHref === undefined ? "" : `<a href="${escapeHtml(filePreviewDiffHref)}">查看 diff</a>`}
              <a href="${escapeHtml(fileHref(filePreview.workspaceId, filePreview.path))}">打开编辑器</a>
            </header>
            <div class="chat-file-meta">
              <span class="chat-file-stat">${filePreviewLines} 行</span>
              <span class="chat-file-stat">${filePreview.content.length} 字符</span>
              ${filePreviewStatus === undefined ? "" : `<span class="chat-file-stat">${escapeHtml(filePreviewStatus)}</span>`}
            </div>
            ${renderChatCodePreview(filePreview.content, filePreviewStatus)}
            <form class="chat-inline-editor" method="post" action="/api/workspaces/${escapeHtml(encodeURIComponent(filePreview.workspaceId))}/files/${escapeHtml(encodeURIComponent(filePreview.path))}">
              <textarea name="content" spellcheck="false">${escapeHtml(filePreview.content)}</textarea>
              ${filePreviewReturnTo === undefined ? "" : `<input type="hidden" name="returnTo" value="${escapeHtml(encodeURIComponent(filePreviewReturnTo))}">`}
              <footer>
                <span>保存会经过 workspace guardrail，并回到当前对话。</span>
                <button type="submit">保存</button>
              </footer>
            </form>
          </div>`;
  const diffPreview = fileContext?.diffPreview;
  const diffPreviewStatus = diffPreview?.status ?? fileContext?.workspaceChanges?.find((change) => change.path === diffPreview?.path)?.status;
  const diffFileHref = diffPreview === undefined
    ? undefined
    : `/?workspaceId=${encodeURIComponent(diffPreview.workspaceId)}&file=${encodeURIComponent(diffPreview.path)}${sessionQuery}${runQuery}`;
  const diffPreviewPanel = diffPreview === undefined
    ? ""
    : `<div class="chat-inspector-card chat-diff-review" data-diff-path="${escapeHtml(diffPreview.path)}"${diffPreviewStatus === undefined ? "" : ` data-diff-status="${escapeHtml(diffPreviewStatus)}"`}>
            <header>
              <h2>${escapeHtml(diffPreview.path)}</h2>
              ${diffFileHref === undefined ? "" : `<a href="${escapeHtml(diffFileHref)}">打开文件</a>`}
            </header>
            <div class="chat-file-meta">
              ${diffPreviewStatus === undefined ? "" : `<span class="chat-file-stat">${escapeHtml(diffPreviewStatus)}</span>`}
              <span class="chat-file-stat">${previewLines(diffPreview.diff).length} 行 diff</span>
            </div>
            ${renderChatDiffPreview(diffPreview.diff)}
          </div>`;
  const contextAttachments = renderChatContextAttachments({
    activeRun,
    filePreview,
    filePreviewLines,
    filePreviewStatus,
    filePreviewDiffHref,
    filePreviewEditorHref,
    diffPreview,
    diffPreviewStatus,
    diffFileHref
  });
  const memoryItems = workspaces.flatMap((workspace) =>
    (workspace.memories ?? []).map((memory) => `<div class="chat-inspector-card"><strong>${escapeHtml(workspace.id)} / ${escapeHtml(memory.key)}</strong><span>${escapeHtml(memory.value)}</span></div>`)
  ).join("");
  const recentRunItems = workspaces.flatMap((workspace) =>
    (workspace.recentRuns ?? []).map((run) => `<div class="chat-card-row"><span>${escapeHtml(run.task)}</span><code>${escapeHtml(run.status)}</code></div>`)
  ).join("");
  const commandItems = workspaces.flatMap((workspace) =>
    workspace.allowedCommands.map((command) => `<div class="chat-card-row"><span>${escapeHtml(workspace.id)}</span><code>${escapeHtml(command)}</code></div>`)
  ).join("");

  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8">
    <title>Coding Agent Harness</title>
    <style>${baseStyles}</style>
  </head>
  <body class="chat-body">
    <main class="chat-app-shell">
      <aside class="chat-sidebar">
        <div class="chat-sidebar-brand">
          <strong>Codex Harness</strong>
          <span class="muted">${workspaces.length}</span>
        </div>
        <nav class="chat-nav" aria-label="工作区与工具">
          <section class="chat-nav-section">
            <div class="chat-nav-title">工作区</div>
            ${workspaceCards || '<span class="chat-nav-item"><span>□</span><span>没有工作区</span></span>'}
          </section>
          <section class="chat-nav-section">
            <div class="chat-nav-title">工具</div>
            <a class="chat-nav-item" href="/"><span>+</span><span>新对话</span></a>
            ${fileLinks}
          </section>
          <section class="chat-nav-section" data-nav-section="recent-runs">
            <div class="chat-nav-title">最近对话</div>
            <ul class="chat-recent-run-list">${sidebarRecentRuns || '<li><span class="chat-nav-item"><span>·</span><span>暂无对话</span></span></li>'}</ul>
          </section>
          <section class="chat-nav-section">
            <div class="chat-nav-title">文件</div>
            <ul class="chat-file-list">${chatFileItems || '<li><span><span>·</span><code>暂无可预览文件</code></span></li>'}</ul>
          </section>
        </nav>
        <div class="chat-sidebar-footer">
          <span>AI4SE</span>
          <span>${escapeHtml(providerLabel)}</span>
        </div>
      </aside>
      <section class="chat-main">
        <header class="chat-header">
          <div class="chat-header-title">
            <span>□</span>
            <strong>对话式 Coding Agent</strong>
          </div>
          <div class="chat-header-actions">
            <span class="codex-chip">Provider: ${escapeHtml(providerLabel)}</span>
            ${chatSession === undefined ? "" : `<span class="codex-chip">Session: ${escapeHtml(chatSession.id)}</span>`}
            <span class="codex-chip">真实 harness run</span>
          </div>
        </header>
        <section class="chat-thread">
          <article class="chat-message">
            <div class="chat-avatar">AI</div>
            <div class="chat-bubble">
              <p>告诉我你希望在当前工作区完成的开发任务。我会通过 harness 调用模型，按结构化 Action 查看文件、修改代码、运行 allowlist 命令，并把结果记录到 timeline。</p>
              <div class="chat-card">
                <div class="chat-card-row"><span>可用 workspace</span><code>${workspaces.map((workspace) => workspace.id).join(", ") || "none"}</code></div>
                <div class="chat-card-row"><span>工具链路</span><code>read / write / run / finish</code></div>
                <div class="chat-card-row"><span>安全边界</span><code>workspace boundary + guardrail</code></div>
              </div>
            </div>
          </article>
          ${contextAttachments}
          ${renderChatSessionThread(chatSession, activeRun)}
        </section>
        <div class="chat-composer-wrap">
          <form class="chat-composer task-composer" method="post" action="${chatSession === undefined ? "/api/runs/start" : `/api/sessions/${escapeHtml(encodeURIComponent(chatSession.id))}/runs/start`}">
            <textarea class="task-input" name="task" required placeholder="描述你希望 AI 在这个 workspace 中完成的代码开发任务"></textarea>
            <div class="chat-composer-controls">
              <div class="chat-composer-selects">
                <label>工作区 <select name="workspaceId">${options}</select></label>
                <label>Provider <select name="provider">${providerOptions}</select></label>
              </div>
              <button class="chat-send" type="submit" aria-label="发送任务">↑</button>
            </div>
          </form>
        </div>
      </section>
      <aside class="chat-inspector">
        <section class="chat-inspector-section">
          <h2>Inspector</h2>
          <div class="chat-inspector-card">
            <strong>运行机制</strong>
            <span>提交后进入 <code>${chatSession === undefined ? "/api/runs/start" : `/api/sessions/${escapeHtml(chatSession.id)}/runs/start`}</code>，由同一套 loop、provider、guardrail 和 tool dispatcher 执行。</span>
          </div>
          <div class="chat-inspector-card">
            <strong>对话上下文</strong>
            <span>${chatSession === undefined ? "新任务会自动创建 session" : `${escapeHtml(chatSession.title)} / ${chatSession.runs.length} runs`}</span>
          </div>
          <div class="chat-inspector-card">
            <strong>当前运行</strong>
            <span>${activeRun === undefined ? "尚未选择 run" : `${escapeHtml(activeRun.status)} / ${escapeHtml(activeRun.id)}`}</span>
          </div>
          <div class="chat-inspector-card">
            <strong>文件入口</strong>
            <span>${activeWorkspaceId === undefined ? "暂无 workspace" : `/?workspaceId=${escapeHtml(activeWorkspaceId)}`}</span>
          </div>
        </section>
        <section class="chat-inspector-section">
          <h2>文件预览</h2>
          ${diffPreviewPanel}
          ${filePreviewPanel}
        </section>
        <section class="chat-inspector-section">
          <h2>最近运行</h2>
          <div class="chat-inspector-card">${recentRunItems || '<div class="chat-card-row"><span>最近运行</span><code>暂无</code></div>'}</div>
        </section>
        <section class="chat-inspector-section">
          <h2>允许命令</h2>
          <div class="chat-inspector-card">${commandItems || "<span>暂无 allowlist 命令</span>"}</div>
        </section>
        <section class="chat-inspector-section">
          <h2>Memory</h2>
          ${memoryItems || '<div class="chat-inspector-card"><strong>None</strong><span>还没有记录 workspace memory</span></div>'}
        </section>
      </aside>
    </main>
    ${renderChatLiveScript(activeRun)}
  </body>
</html>`;
}

function fileHref(workspaceId: string, path: string): string {
  return `/workspaces/${encodeURIComponent(workspaceId)}/files/${encodeURIComponent(path)}`;
}

function renderFileTree(workspace: PublicWorkspace, files: PublicWorkspaceFile[], selectedPath?: string): string {
  if (files.length === 0) {
    return `<li><span class="muted">当前工作区没有可显示的文件</span></li>`;
  }

  return files.map((file) => {
    const label = `${file.kind === "directory" ? "› " : ""}${file.path}`;
    if (file.kind === "directory") {
      return `<li><span class="directory">${escapeHtml(label)}</span></li>`;
    }
    const active = selectedPath === file.path ? " aria-current=\"page\"" : "";
    return `<li><a${active} href="${escapeHtml(fileHref(workspace.id, file.path))}">${escapeHtml(label)}</a></li>`;
  }).join("");
}

function renderChangeList(workspaceId: string, changes: PublicWorkspaceChange[] = []): string {
  return changes.map((change) => `
          <li>
            <strong>${escapeHtml(change.status)}</strong>
            <code>${escapeHtml(change.path)}</code>
            <span class="muted">/api/workspaces/${escapeHtml(workspaceId)}/changes/${escapeHtml(encodeURIComponent(change.path))}</span>
          </li>`).join("") || "<li><strong>clean</strong><span class=\"muted\">当前工作区没有可展示的 git 变更</span></li>";
}

export function renderWorkspaceFiles(input: {
  workspace: PublicWorkspace;
  files: PublicWorkspaceFile[];
  changes?: PublicWorkspaceChange[];
}): string {
  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8">
    <title>${escapeHtml(input.workspace.name)} - 文件浏览</title>
    <style>${baseStyles}</style>
  </head>
  <body>
    <main class="codex-app-shell workspace-file-browser">
      <header class="codex-app-bar">
        <div class="codex-brand">
          <span class="codex-mark">AI</span>
          <div class="codex-title">
            <strong>Coding Agent Harness</strong>
            <span>${escapeHtml(input.workspace.name)} / 文件浏览</span>
          </div>
        </div>
        <div class="codex-top-actions">
          <a class="codex-chip" href="/">运行控制</a>
          <span class="codex-chip">Workspace: ${escapeHtml(input.workspace.id)}</span>
          <span class="codex-chip">${input.files.length} entries</span>
        </div>
      </header>
      <aside class="codex-sidebar">
        <div class="codex-sidebar-header">
          <h2>文件</h2>
          <span class="muted">${escapeHtml(input.workspace.id)}</span>
        </div>
        <div class="codex-file-scroll">
          <ul class="workspace-file-tree codex-file-tree">${renderFileTree(input.workspace, input.files)}</ul>
        </div>
      </aside>
      <section class="codex-editor-main">
        <div class="codex-editor-tabbar">
          <span class="codex-editor-tab">欢迎</span>
          <span class="codex-editor-tools">选择左侧文件开始编辑</span>
        </div>
        <div class="codex-empty-editor">
          <div>
            <h2>打开一个文件</h2>
            <p>保存操作会经过 harness 的路径边界和敏感内容护栏。</p>
          </div>
        </div>
        <div class="codex-editor-statusbar">
          <span>只展示 workspace 相对路径</span>
          <span>Guarded workspace</span>
        </div>
      </section>
      <aside class="codex-agent-panel">
        <section class="codex-agent-section">
          <h2>Agent 上下文</h2>
          <div class="codex-agent-card">
            <strong>Workspace</strong>
            <span>${escapeHtml(input.workspace.name)} (${escapeHtml(input.workspace.id)})</span>
          </div>
          <div class="codex-agent-card">
            <strong>保存护栏</strong>
            <span>路径逃逸、敏感路径、密钥样式内容会被拒绝</span>
          </div>
        </section>
        <section class="codex-agent-section">
          <h2>变更</h2>
          <ul class="change-list codex-change-list">${renderChangeList(input.workspace.id, input.changes)}</ul>
        </section>
      </aside>
    </main>
  </body>
</html>`;
}

export function renderWorkspaceFileEditor(input: {
  workspace: PublicWorkspace;
  files: PublicWorkspaceFile[];
  file: { path: string; content: string };
  changes?: PublicWorkspaceChange[];
  saved?: boolean;
}): string {
  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8">
    <title>${escapeHtml(input.file.path)} - 工作区编辑器</title>
    <style>${baseStyles}</style>
  </head>
  <body>
    <main class="codex-app-shell workspace-editor">
      <header class="codex-app-bar">
        <div class="codex-brand">
          <span class="codex-mark">AI</span>
          <div class="codex-title">
            <strong>${escapeHtml(input.file.path)}</strong>
            <span>${escapeHtml(input.workspace.name)} / Browser Editor</span>
          </div>
        </div>
        <div class="codex-top-actions">
          <a class="codex-chip" href="/workspaces/${escapeHtml(encodeURIComponent(input.workspace.id))}/files">文件浏览</a>
          <span class="codex-chip">Workspace: ${escapeHtml(input.workspace.id)}</span>
          <span class="codex-chip">${input.saved ? "已保存" : "Guarded Save"}</span>
        </div>
      </header>
      <aside class="codex-sidebar">
        <div class="codex-sidebar-header">
          <h2>文件</h2>
          <span class="muted">${escapeHtml(input.workspace.id)}</span>
        </div>
        <div class="codex-file-scroll">
          <ul class="workspace-file-tree codex-file-tree">${renderFileTree(input.workspace, input.files, input.file.path)}</ul>
        </div>
      </aside>
      <form class="codex-editor-main workspace-editor-shell" method="post" action="/api/workspaces/${escapeHtml(encodeURIComponent(input.workspace.id))}/files/${escapeHtml(encodeURIComponent(input.file.path))}">
        <div class="codex-editor-tabbar workspace-editor-toolbar">
          <span class="codex-editor-tab">${escapeHtml(input.file.path)}</span>
          <div class="codex-editor-tools">
            <span>${input.saved ? "已保存" : "UTF-8"}</span>
            <button class="codex-editor-save" type="submit">保存</button>
          </div>
        </div>
        <div class="codex-editor-canvas">
          <textarea class="workspace-editor-textarea codex-editor-textarea" name="content" spellcheck="false">${escapeHtml(input.file.content)}</textarea>
        </div>
        <div class="codex-editor-statusbar">
          <span>${escapeHtml(input.file.path)}</span>
          <span>Guarded write_file</span>
        </div>
      </form>
      <aside class="codex-agent-panel">
        <section class="codex-agent-section">
          <h2>Agent 上下文</h2>
          <div class="codex-agent-card">
            <strong>保存护栏</strong>
            <span>路径逃逸、敏感路径、密钥样式内容会被拒绝</span>
          </div>
          <div class="codex-agent-card">
            <strong>工作区</strong>
            <span>页面只展示 workspace id 与相对路径</span>
          </div>
        </section>
        <section class="codex-agent-section">
          <h2>变更</h2>
          <ul class="change-list codex-change-list">${renderChangeList(input.workspace.id, input.changes)}</ul>
        </section>
      </aside>
    </main>
  </body>
</html>`;
}

export function renderRun(input: {
  id: string;
  task: string;
  workspaceId: string;
  status: string;
  changes?: PublicWorkspaceChange[];
  approvals?: PublicApproval[];
  timeline: Array<{ sequence: number; kind: string; payload: Record<string, unknown> }>;
}): string {
  const nav = input.timeline.map((event) => `
            <li><a href="#event-${event.sequence}"><span>${event.sequence}</span>${escapeHtml(eventLabel(event.kind))}</a></li>`).join("");
  const events = input.timeline.map((event) => `
        <li class="event" id="event-${event.sequence}">
          <h2><span class="sequence">${event.sequence}</span>${escapeHtml(eventLabel(event.kind))}</h2>
          <pre>${escapeHtml(JSON.stringify(event.payload, null, 2))}</pre>
        </li>`).join("");
  const changes = input.changes ?? [];
  const changeItems = changes.map((change) => `
          <li>
            <strong>${escapeHtml(change.status)}</strong>
            <code>${escapeHtml(change.path)}</code>
            <span class="muted">GET /api/workspaces/${escapeHtml(input.workspaceId)}/changes/${escapeHtml(encodeURIComponent(change.path))}</span>
          </li>`).join("");
  const approvalItems = (input.approvals ?? []).map((approval) => `
          <li>
            <strong>${escapeHtml(approval.ruleId)}</strong>
            <span>${escapeHtml(approval.reason)}</span>
            <pre>${escapeHtml(JSON.stringify(approval.action, null, 2))}</pre>
            <form method="post" action="/api/approvals/${escapeHtml(approval.id)}/approve">
              <button type="submit">批准执行</button>
            </form>
            <form method="post" action="/api/approvals/${escapeHtml(approval.id)}/reject">
              <button type="submit">拒绝</button>
            </form>
          </li>`).join("");

  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8">
    <title>Run Inspector</title>
    <style>${baseStyles}</style>
  </head>
  <body>
    <main>
      <p><a href="/">返回运行控制</a></p>
      <header class="topbar">
        <div>
          <p class="eyebrow">Run Inspector</p>
          <h1>运行时间线</h1>
        </div>
        <div class="status-strip">
          <span class="status-pill">${escapeHtml(input.status)}</span>
          <span class="status-pill">${input.timeline.length} events</span>
        </div>
      </header>
      <section class="run-meta">
        <div class="meta-tile"><span>运行 ID</span><strong>${escapeHtml(input.id)}</strong></div>
        <div class="meta-tile"><span>工作区</span><strong>${escapeHtml(input.workspaceId)}</strong></div>
        <div class="meta-tile"><span>状态</span><strong>${escapeHtml(input.status)}</strong></div>
        <div class="meta-tile"><span>任务</span><strong>${escapeHtml(input.task)}</strong></div>
      </section>
      <section class="panel diff-inspector">
        <h2>文件变更 Diff Inspector</h2>
        <ul class="change-list">${changeItems || "<li><strong>clean</strong><span class=\"muted\">当前工作区没有可展示的 git 变更</span></li>"}</ul>
      </section>
      <section class="panel approval-panel">
        <h2>人工审批 Approval</h2>
        <ul class="signal-list">${approvalItems || "<li><strong>None</strong><span>当前没有等待人工审批的动作</span></li>"}</ul>
      </section>
      <section class="run-layout">
        <aside class="panel timeline-navigator">
          <h2>Timeline Navigator</h2>
          <ol class="event-nav">${nav}
          </ol>
        </aside>
        <ol class="timeline event-detail-stack">${events}
        </ol>
      </section>
    </main>
  </body>
</html>`;
}

export function renderSession(input: PublicSession): string {
  const runItems = input.runs.map((run) => `
              <li>
                <a href="/runs/${escapeHtml(encodeURIComponent(run.id))}">${escapeHtml(run.task)}</a>
                <span>${escapeHtml(run.status)}${run.summary === undefined ? "" : ` - ${escapeHtml(run.summary)}`}</span>
              </li>`).join("");
  const memoryItems = (input.memories ?? [])
    .map((memory) => `<li><strong>${escapeHtml(memory.key)}</strong><span>${escapeHtml(memory.value)}</span></li>`)
    .join("");
  const changeItems = (input.changes ?? []).map((change) => `
              <li>
                <strong>${escapeHtml(change.status)}</strong>
                <code>${escapeHtml(change.path)}</code>
              </li>`).join("");

  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8">
    <title>Interactive Session</title>
    <style>${baseStyles}</style>
  </head>
  <body>
    <main class="interactive-session">
      <p><a href="/">返回运行控制</a></p>
      <header class="topbar">
        <div>
          <p class="eyebrow">Interactive Session</p>
          <h1>${escapeHtml(input.title)}</h1>
        </div>
        <div class="status-strip">
          <span class="status-pill">Workspace: ${escapeHtml(input.workspaceId)}</span>
          <span class="status-pill">Provider: ${escapeHtml(input.provider)}</span>
          <span class="status-pill">${input.runs.length} runs</span>
        </div>
      </header>
      <section class="session-dashboard">
        <section class="panel task-composer">
          <h2>继续指令</h2>
          <form method="post" action="/api/sessions/${escapeHtml(input.id)}/runs">
            <label>任务 <input class="task-input" name="task" required placeholder="继续描述你希望 agent 完成的代码开发任务"></label>
            <button type="submit">继续运行</button>
          </form>
        </section>
        <section class="panel">
          <h2>Session Runs</h2>
          <ol class="session-run-list">${runItems || "<li><strong>None</strong><span>这个 session 还没有 run</span></li>"}</ol>
        </section>
      </section>
      <section class="session-panels">
        <aside class="panel memory-panel">
          <h2>Workspace Memory</h2>
          <ul class="signal-list">${memoryItems || "<li><strong>None</strong><span>还没有 workspace memory</span></li>"}</ul>
        </aside>
        <aside class="panel diff-inspector">
          <h2>Diff Inspector</h2>
          <ul class="change-list">${changeItems || "<li><strong>clean</strong><span class=\"muted\">当前工作区没有可展示的 git 变更</span></li>"}</ul>
        </aside>
        <aside class="panel recent-runs">
          <h2>Session Context</h2>
          <ul class="signal-list">
            <li><strong>${escapeHtml(input.workspaceId)}</strong><span>后续指令会继续使用这个 workspace</span></li>
            <li><strong>${escapeHtml(input.provider)}</strong><span>后续 run 会继续使用这个 provider</span></li>
          </ul>
        </aside>
      </section>
    </main>
  </body>
</html>`;
}
