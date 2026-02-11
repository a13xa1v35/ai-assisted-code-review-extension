export interface Review {
  meta: {
    base: string;
    head: string;
  };

  explanation: string;
  groups: Group[];
  flags?: Flag[];
}

export interface Group {
  title: string;
  summary?: string;
  files: string[];
}

export interface Flag {
  severity: 'info' | 'warning' | 'error';
  title: string;
  summary?: string;
  file: string;
  line: number;
}

export interface ValidationResult {
  missingFiles: string[];   // in git diff but not in review
  phantomFiles: string[];   // in review but not in git diff
}
