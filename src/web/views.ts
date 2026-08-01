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

export function renderIndex(workspaces: PublicWorkspace[]): string {
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
        <input type="hidden" name="provider" value="mock">
        <button type="submit">运行</button>
      </form>
    </main>
  </body>
</html>`;
}
