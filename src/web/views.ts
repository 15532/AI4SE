export type PublicWorkspace = {
  id: string;
  name: string;
  allowedCommands: string[];
  memories?: Array<{ key: string; value: string }>;
  recentRuns?: Array<{ task: string; status: string; summary?: string }>;
};
export type PublicWorkspaceChange = {
  path: string;
  status: string;
};
export type PublicProvider = { id: string };

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
      .workspace-rail, .task-composer, .run-inspector { display: grid; gap: 12px; }
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
      .change-list { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 8px; margin: 0; padding: 0; list-style: none; }
      .change-list li { display: grid; gap: 4px; padding: 10px; border: 1px solid var(--line); border-radius: 6px; background: var(--soft); min-width: 0; }
      .change-list code { color: var(--blue); overflow-wrap: anywhere; }
      @media (max-width: 1060px) { .ide-shell { grid-template-columns: 1fr 1fr; } .run-inspector { grid-column: 1 / -1; } .run-meta { grid-template-columns: 1fr 1fr; } }
      @media (max-width: 760px) { main { padding: 16px; } .topbar, .ide-shell, .composer-grid, .run-layout, .run-meta, .session-panels { grid-template-columns: 1fr; display: grid; } .status-strip { justify-content: start; } .timeline-navigator { position: static; } }
`;

function eventLabel(kind: string): string {
  switch (kind) {
    case "parsed_action": return "动作 Action";
    case "guardrail": return "护栏 Guardrail";
    case "tool_result": return "工具结果 Tool Result";
    case "feedback": return "反馈 Feedback";
    case "stop": return "停止 Stop Reason";
    case "llm_response": return "模型响应 LLM Response";
    default: return kind;
  }
}

export function renderIndex(workspaces: PublicWorkspace[], providers: PublicProvider[] = [{ id: "mock" }]): string {
  const options = workspaces
    .map((workspace) => `<option value="${escapeHtml(workspace.id)}">${escapeHtml(workspace.name)} (${escapeHtml(workspace.id)})</option>`)
    .join("");
  const providerOptions = providers
    .map((provider) => `<option value="${escapeHtml(provider.id)}">${escapeHtml(provider.id)}</option>`)
    .join("");
  const providerLabel = providers.map((provider) => provider.id).join(", ");
  const workspaceCards = workspaces.map((workspace) => `
        <article class="panel workspace-card">
          <header>
            <h3>${escapeHtml(workspace.name)}</h3>
            <span class="workspace-id">${escapeHtml(workspace.id)}</span>
          </header>
          <p class="muted">可用命令</p>
          <ul class="commands">${workspace.allowedCommands.map((command) => `<li><code>${escapeHtml(command)}</code></li>`).join("")}</ul>
        </article>`).join("");
  const firstWorkspace = workspaces[0];
  const fileLinks = firstWorkspace === undefined
    ? ""
    : `<li><code>GET /api/workspaces/${escapeHtml(firstWorkspace.id)}/files</code></li>`;
  const memoryItems = workspaces.flatMap((workspace) =>
    (workspace.memories ?? []).map((memory) => `<li><strong>${escapeHtml(workspace.id)}</strong> ${escapeHtml(memory.key)}: ${escapeHtml(memory.value)}</li>`)
  ).join("");
  const recentRunItems = workspaces.flatMap((workspace) =>
    (workspace.recentRuns ?? []).map((run) => `<li><strong>${escapeHtml(run.status)}</strong> ${escapeHtml(run.task)}${run.summary === undefined ? "" : ` - ${escapeHtml(run.summary)}`}</li>`)
  ).join("");

  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8">
    <title>智能 IDE 工作台</title>
    <style>${baseStyles}</style>
  </head>
  <body>
    <main>
      <header class="topbar">
        <div>
          <p class="eyebrow">Coding Agent Harness</p>
          <h1>智能 IDE 工作台</h1>
        </div>
        <div class="status-strip">
          <span class="status-pill">Provider: ${escapeHtml(providerLabel)}</span>
          <span class="status-pill">Workspace: ${workspaces.length}</span>
        </div>
      </header>
      <section class="ide-shell">
        <aside class="workspace-rail">
          <section class="panel">
            <h2>工作区</h2>
            <p class="muted">预注册 workspace</p>
          </section>
          <div class="workspace-list">${workspaceCards}</div>
        </aside>
        <form class="panel task-composer" method="post" action="/api/runs">
          <h2>任务编排</h2>
          <div class="composer-grid">
            <label>工作区 <select name="workspaceId">${options}</select></label>
            <label>Provider <select name="provider">${providerOptions}</select></label>
          </div>
          <label>任务 <input class="task-input" name="task" required placeholder="例如：修复失败测试并说明验证结果"></label>
          <button type="submit">运行</button>
        </form>
        <aside class="panel run-inspector">
          <h2>Run Inspector</h2>
          <dl class="metric">
            <dt>动作</dt><dd>strict JSON</dd>
            <dt>执行</dt><dd>guarded tools</dd>
            <dt>反馈</dt><dd>next turn context</dd>
          </dl>
          <ul class="signal-list">
            <li><strong>Action</strong><span>list/read/write/run/finish</span></li>
            <li><strong>Guardrail</strong><span>path boundary 与 command allowlist</span></li>
            <li><strong>Timeline</strong><span>模型响应、工具结果、反馈、停止原因</span></li>
          </ul>
        </aside>
      </section>
      <section class="session-panels">
        <aside class="panel code-viewer">
          <h2>Code Viewer</h2>
          <p class="muted">只读文件查看入口，路径仍受 workspace boundary 约束。</p>
          <ul class="file-link-list">${fileLinks}</ul>
        </aside>
        <aside class="panel memory-panel">
          <h2>Workspace Memory</h2>
          <ul class="signal-list">${memoryItems || "<li><strong>None</strong><span>还没有记录 workspace memory</span></li>"}</ul>
        </aside>
        <aside class="panel recent-runs">
          <h2>Recent Runs</h2>
          <ul class="signal-list">${recentRunItems || "<li><strong>None</strong><span>还没有历史 run</span></li>"}</ul>
        </aside>
      </section>
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
