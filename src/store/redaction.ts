const credentialAssignmentPattern = /(\b(?:openai_api_key|api[_-]?key|apikey|secret|token|password|credential|private[_-]?key)\b["']?\s*[:=]\s*)(?:"[^"]*"|'[^']*'|[^\s,}\]]+)/gi;
const apiKeyPattern = /\bsk-[A-Za-z0-9_-]+\b/g;

export function isSensitiveKey(key: string): boolean {
  const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, "");
  return ["secret", "token", "apikey", "password", "credential", "privatekey"]
    .some((term) => normalized.includes(term));
}

export function redactSensitiveString(value: string): string {
  return value
    .replace(credentialAssignmentPattern, (match, prefix: string) => {
      const secretValue = match.slice(prefix.length);
      const quote = secretValue[0] === "\"" || secretValue[0] === "'" ? secretValue[0] : "";
      return `${prefix}${quote}[REDACTED]${quote}`;
    })
    .replace(apiKeyPattern, "[REDACTED]");
}

export function redactSensitiveValue(value: unknown, key?: string): unknown {
  if (key !== undefined && isSensitiveKey(key)) return "[REDACTED]";
  if (typeof value === "string") return redactSensitiveString(value);
  if (Array.isArray(value)) return value.map((item) => redactSensitiveValue(item));
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.entries(value).map(([nestedKey, nestedValue]) => [nestedKey, redactSensitiveValue(nestedValue, nestedKey)])
    );
  }
  return value;
}
