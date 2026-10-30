export interface GitHubRepo {
  id: number;
  name: string;
  fullName: string;
  owner: string;
  isPrivate: boolean;
  defaultBranch: string;
  htmlUrl: string;
}

export interface GitHubConnection {
  isConfigured: boolean;
  clientId: string | null;
  isConnected: boolean;
  user: {
    login: string;
    name?: string;
    avatarUrl?: string;
    htmlUrl: string;
  } | null;
  repositories: GitHubRepo[];
  repositoriesStatus?: { truncated?: boolean; errors?: string[] } | null;
  selectedRepo: string | null;
  deviceFlow: {
    userCode: string;
    verificationUri: string;
    expiresAt: number;
    interval: number;
  } | null;
  statusMessage?: string | null;
  errorMessage?: string | null;
}

export interface BudgetStatus {
  limitMicros: number;
  maxAttempts: number;
  reservedMicros: number;
  attempts: number;
  remainingMicros: number;
  canRequest: boolean;
}

export interface SettingsPolicy {
  maxDiffLines?: number;
  antiSlop?: boolean;
  requireTests?: boolean;
  [key: string]: any;
}

export interface SettingsProps {
  githubConnection: GitHubConnection;
  budget: BudgetStatus | null;
  policy: SettingsPolicy;
  statusMessage?: string | null;
  errorMessage?: string | null;
}
