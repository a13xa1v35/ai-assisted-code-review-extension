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
