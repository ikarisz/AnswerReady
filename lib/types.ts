export type CheckStatus = "pass" | "warn" | "fail";

export interface Check {
  id: string;
  label: string;
  status: CheckStatus;
  score: number;
  max: number;
  detail: string;
  fix?: string;
}

export interface Category {
  id: string;
  label: string;
  blurb: string;
  score: number;
  max: number;
  checks: Check[];
}

export interface BotStatus {
  ua: string;
  label: string;
  allowed: boolean;
}

export interface ScanResult {
  url: string;
  finalUrl: string;
  fetchedAt: string;
  ms: number;
  score: number;
  grade: string;
  categories: Category[];
  bots: BotStatus[];
  meta: {
    title: string | null;
    description: string | null;
    words: number;
  };
  ai?: {
    verdict: string;
    actions: string[];
  };
}
