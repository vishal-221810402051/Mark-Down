export type DocState = {
  rawText: string;
  normalizedText: string;
  // Phase 3: markdown AST + HTML will be added here
  renderedPreview: string;
};

export type NormalizeResult = {
  normalizedText: string;
  notes: string[]; // useful later for logging what got fixed
};

export type ParseResult = {
  parseOutput: string;
  notes: string[];
};
