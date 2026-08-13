export type GccTarget = {
  id: string;
  company: string;
  role: string;
  dm_sent: boolean;
  email_sent: boolean;
  connection_sent: boolean;
  story_used: string;
  interview: boolean;
  follow_up: string;
  notes: string;
};

export type GccCampaign = {
  started_at: string;
  daily_log: Record<string, { connections: number; applications: number; mock_interview: boolean }>;
  targets: GccTarget[];
};

export const defaultGccCampaign = (): GccCampaign => ({
  started_at: new Date().toISOString().slice(0, 10),
  daily_log: {},
  targets: [],
});
