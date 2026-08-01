export type PublicWorkspace = {
  id: string;
  name: string;
  allowedCommands: string[];
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function renderIndex(workspaces: PublicWorkspace[], providerId = "mock"): string {
  const options = workspaces
    .map((workspace) => `<option value="${escapeHtml(workspace.id)}">${escapeHtml(workspace.name)} (${escapeHtml(workspace.id)})</option>`)
    .join("");

  return `<!doctype html>
<html lang="zh-CN">
  <head><meta charset="utf-8"><title>Harness Run Control</title></head>
  <body>
    <main>
      <h1>运行控制</h1>
      <form method="post" action="/api/runs">
        <label>工作区 <select name="workspaceId">${options}</select></label>
        <label>任务 <input name="task" required></label>
        <input type="hidden" name="provider" value="${escapeHtml(providerId)}">
        <button type="submit">运行</button>
      </form>
    </main>
  </body>
</html>`;
}

export function renderRun(input: {
  id: string;
  task: string;
  workspaceId: string;
  status: string;
  timeline: Array<{ sequence: number; kind: string; payload: Record<string, unknown> }>;
}): string {
  const events = input.timeline.map((event) => `
        <li>
          <h2>${event.sequence}. ${escapeHtml(event.kind)}</h2>
          <pre>${escapeHtml(JSON.stringify(event.payload, null, 2))}</pre>
        </li>`).join("");

  return `<!doctype html>
<html lang="zh-CN">
  <head><meta charset="utf-8"><title>运行时间线</title></head>
  <body>
    <main>
      <p><a href="/">返回运行控制</a></p>
      <h1>运行时间线</h1>
      <dl>
        <dt>运行 ID</dt><dd>${escapeHtml(input.id)}</dd>
        <dt>工作区</dt><dd>${escapeHtml(input.workspaceId)}</dd>
        <dt>状态</dt><dd>${escapeHtml(input.status)}</dd>
        <dt>任务</dt><dd>${escapeHtml(input.task)}</dd>
      </dl>
      <ol>${events}
      </ol>
    </main>
  </body>
</html>`;
}
