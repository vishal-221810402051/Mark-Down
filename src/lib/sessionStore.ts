const KEY = "markdown_session_v1";

export type SessionState = {
  rawText: string;
  normalizedOverride: string | null;
  theme: "whitepaper" | "dev" | "academic";
  includeToc: boolean;
  tocDepth: 2 | 3 | 4;
  docTitle: string;
  marginPreset: "compact" | "normal" | "spacious";
  tablePreset: "equal" | "wide-first" | "wide-middle";
};

export function saveSession(s: SessionState) {
  localStorage.setItem(KEY, JSON.stringify(s));
}

export function loadSession(): SessionState | null {
  const v = localStorage.getItem(KEY);
  if (!v) return null;
  try {
    return JSON.parse(v) as SessionState;
  } catch {
    return null;
  }
}

export function clearSession() {
  localStorage.removeItem(KEY);
}
