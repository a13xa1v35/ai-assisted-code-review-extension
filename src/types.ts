export interface Review {
  meta: {
    base: string;
    head: string;
    generated_at: string;
  };

  groups: Group[];
  moved?: MovedCode[];
  flags?: Flag[];
}

export interface Group {
  id: string;
  title: string;
  summary?: string;
  files: FileChange[];
  additions: number;
  deletions: number;
}

export interface FileChange {
  path: string;
  hunks: Array<{ start: number; end: number }>;
}

export interface MovedCode {
  description: string;
  from: { path: string; start: number; end: number };
  to: { path: string; start: number; end: number };
}

export interface Flag {
  severity: 'info' | 'warning' | 'error';
  category: string;
  title: string;
  file: string;
  line: number;
}
