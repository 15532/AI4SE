export type PublicWorkspace = {
  id: string;
  name: string;
  allowedCommands: string[];
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
      body { margin: 0; font-family: Arial, "Microsoft YaHei", sans-serif; color: #1f2937; background: #f5f7fb; }
      main { max-width: 1120px; margin: 0 auto; padding: 32px 20px 48px; }
      h1 { margin: 0 0 8px; font-size: 28px; }
      h2 { margin: 0 0 12px; font-size: 18px; }
      p { line-height: 1.6; }
      .muted { color: #64748b; }
      .grid { display: grid; grid-template-columns: minmax(280px, 1fr) minmax(320px, 420px); gap: 20px; align-items: start; }
      .panel, .event { background: #fff; border: 1px solid #dbe3ef; border-radius: 8px; padding: 18px; box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04); }
      .workspace-list { display: grid; gap: 12px; margin-top: 16px; }
      .workspace-id { font-family: Consolas, monospace; color: #0f766e; }
      .commands { display: flex; flex-wrap: wrap; gap: 8px; padding: 0; margin: 10px 0 0; list-style: none; }
      .commands code { display: inline-block; padding: 4px 7px; border-radius: 6px; background: #eef6ff; color: #164e63; font-size: 13px; }
      form { display: grid; gap: 14px; }
      label { display: grid; gap: 6px; font-weight: 600; }
      select, input { min-height: 38px; padding: 7px 9px; border: 1px solid #cbd5e1; border-radius: 6px; font: inherit; }
      button { min-height: 40px; border: 0; border-radius: 6px; background: #2563eb; color: #fff; font: inherit; font-weight: 700; cursor: pointer; }
      dl { display: grid; grid-template-columns: max-content 1fr; gap: 8px 14px; margin: 18px 0; }
      dt { font-weight: 700; color: #475569; }
      dd { margin: 0; }
      .timeline { list-style: none; padding: 0; display: grid; gap: 12px; }
      .event h2 { display: flex; gap: 10px; align-items: baseline; }
      .sequence { color: #64748b; font-family: Consolas, monospace; font-size: 14px; }
      pre { white-space: pre-wrap; word-break: break-word; overflow-wrap: anywhere; background: #0f172a; color: #e2e8f0; border-radius: 6px; padding: 12px; }
      @media (max-width: 780px) { .grid { grid-template-columns: 1fr; } }
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
        <article class="panel">
          <h2>${escapeHtml(workspace.name)} <span class="workspace-id">${escapeHtml(workspace.id)}</span></h2>
          <p class="muted">可用命令</p>
          <ul class="commands">${workspace.allowedCommands.map((command) => `<li><code>${escapeHtml(command)}</code></li>`).join("")}</ul>
        </article>`).join("");

  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8">
    <title>简单模型前端</title>
    <style>${baseStyles}</style>
  </head>
  <body>
    <main>
      <h1>简单模型前端</h1>
      <p class="muted">用于演示 Coding Agent Harness 的工作区边界、动作执行、护栏拦截和反馈闭环。可选 provider：${escapeHtml(providerLabel)}。</p>
      <section class="grid">
        <div>
          <h2>已注册工作区</h2>
          <div class="workspace-list">${workspaceCards}</div>
        </div>
        <form class="panel" method="post" action="/api/runs">
          <h2>创建 Harness Run</h2>
          <label>工作区 <select name="workspaceId">${options}</select></label>
          <label>Provider <select name="provider">${providerOptions}</select></label>
          <label>任务 <input name="task" required placeholder="例如：运行测试并解释结果"></label>
          <button type="submit">运行</button>
        </form>
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
  timeline: Array<{ sequence: number; kind: string; payload: Record<string, unknown> }>;
}): string {
  const events = input.timeline.map((event) => `
        <li class="event">
          <h2><span class="sequence">${event.sequence}</span>${escapeHtml(eventLabel(event.kind))}</h2>
          <pre>${escapeHtml(JSON.stringify(event.payload, null, 2))}</pre>
        </li>`).join("");

  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8">
    <title>运行时间线</title>
    <style>${baseStyles}</style>
  </head>
  <body>
    <main>
      <p><a href="/">返回运行控制</a></p>
      <h1>运行时间线</h1>
      <p class="muted">按 harness 机制展示模型响应、动作解析、护栏、工具结果、反馈和停止原因。</p>
      <dl>
        <dt>运行 ID</dt><dd>${escapeHtml(input.id)}</dd>
        <dt>工作区</dt><dd>${escapeHtml(input.workspaceId)}</dd>
        <dt>状态</dt><dd>${escapeHtml(input.status)}</dd>
        <dt>任务</dt><dd>${escapeHtml(input.task)}</dd>
      </dl>
      <ol class="timeline">${events}
      </ol>
    </main>
  </body>
</html>`;
}
