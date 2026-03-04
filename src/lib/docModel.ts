export type DocHeading = {
  depth: 1 | 2 | 3 | 4 | 5 | 6;
  text: string;
  id: string;
};

export type ParseResult = {
  html: string; // rendered HTML
  headings: DocHeading[];
};

export type DocState = {
  rawText: string;
  normalizedText: string;
  headings: DocHeading[];
  renderedPreview: string; // HTML (Phase 3+)
};

export type NormalizeStats = {
  fencesAutoClosed: number;
  headingsFixed: number;
  bulletsNormalized: number;
  numberingNormalized: number;
  commandBlocksCreated: number;
  mermaidBlocksCreated: number;
};

export type NormalizeResult = {
  normalizedText: string;
  notes: string[]; // useful later for logging what got fixed
  stats: NormalizeStats;
};
