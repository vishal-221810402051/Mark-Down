export type SuggestionTarget = "raw" | "normalized";

export type SuggestionPatch = {
  target: SuggestionTarget;
  apply: (text: string) => string;
};

export type Suggestion = {
  id: string;
  title: string;
  rationale: string;
  patches: SuggestionPatch[];
  confidence?: number;
};
