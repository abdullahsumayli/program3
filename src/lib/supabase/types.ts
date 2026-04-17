export type TranscriptSegment = {
  speaker_id: number;
  speaker_name?: string;
  text: string;
  start_ms: number;
  end_ms: number;
  is_final?: boolean;
};

export type MeetingSource = "live_recording" | "uploaded_recording";
export type MeetingProcessingStatus = "processing" | "completed" | "error";

export type Meeting = {
  id: string;
  workspace_id: string;
  title: string | null;
  transcript: string;
  transcript_segments: TranscriptSegment[] | null;
  summary: string | null;
  key_points: string[] | null;
  notes: string | null;
  duration: number;
  audio_url: string | null;
  source_type: MeetingSource;
  processing_status: MeetingProcessingStatus;
  processing_error: string | null;
  created_at: string;
  updated_at: string;
};

export type MeetingDecision = {
  id: string;
  meeting_id: string;
  workspace_id: string;
  user_id: string;
  content: string;
  created_at: string;
};

export type TaskStatus = "in_progress" | "completed";

export type MeetingTask = {
  id: string;
  meeting_id: string;
  workspace_id: string;
  user_id: string;
  description: string;
  owner_name: string | null;
  due_date: string | null;
  status: TaskStatus;
  created_at: string;
  updated_at: string;
};

export type WorkspaceRole = "owner" | "admin" | "member";
export type WorkspacePlan = "free" | "basic" | "pro" | "enterprise";
export type SubscriptionStatus = "active" | "trial" | "expired" | "canceled" | "past_due";

export type Workspace = {
  id: string;
  name: string;
  owner_id: string;
  plan: WorkspacePlan;
  subscription_status: SubscriptionStatus;
  subscription_renews_at: string | null;
  subscription_started_at: string | null;
  moyasar_subscription_id: string | null;
  created_at: string;
  updated_at: string;
};

export type WorkspaceMember = {
  workspace_id: string;
  user_id: string;
  role: WorkspaceRole;
  created_at: string;
};

export type WorkspaceInvite = {
  id: string;
  workspace_id: string;
  email: string;
  role: WorkspaceRole;
  token: string;
  invited_by: string | null;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
};

export type WorkspaceSummary = {
  id: string;
  name: string;
  role: WorkspaceRole;
  plan: WorkspacePlan;
  planName: string;
  subscription_status: SubscriptionStatus;
  subscription_renews_at: string | null;
};

export type Settings = {
  user_id: string;
  system_prompt: string;
  language: "en" | "ar";
  updated_at: string;
};

export type UsageSummary = {
  plan: WorkspacePlan;
  limitMinutes: number;
  usedMinutes: number;
  remainingMinutes: number;
  remainingSeconds: number;
  limitMeetings: number;
  usedMeetings: number;
  remainingMeetings: number;
  unlimited: boolean;
  minutesUnlimited: boolean;
  meetingsUnlimited: boolean;
  monthlyMeetingLimitOverride: number | null;
};

export type RecordingSessionStatus = "starting" | "recording" | "completed" | "interrupted" | "error";

export type RecordingSession = {
  id: string;
  workspace_id: string;
  user_id: string;
  user_email: string | null;
  meeting_id: string | null;
  recording_mode: "remote-share" | "mic-only";
  status: RecordingSessionStatus;
  interruption_count: number;
  duration_seconds: number;
  system_audio_requested: boolean;
  system_audio_active: boolean;
  last_error_status: string | null;
  last_error_message: string | null;
  started_at: string;
  ended_at: string | null;
  last_heartbeat_at: string;
  created_at: string;
  updated_at: string;
};

export type UsageCounter = {
  workspace_id: string;
  period_start: string;
  seconds_used: number;
  updated_at: string;
};

export type SubscriptionEvent = {
  id: string;
  workspace_id: string | null;
  event_type: string;
  moyasar_payment_id: string | null;
  moyasar_payload: unknown | null;
  created_at: string;
};

export type DashboardData = {
  usage: UsageSummary;
  workspace: WorkspaceSummary;
  meetings: Meeting[];
  decisions: Array<MeetingDecision & {
    meeting_title: string | null;
    meeting_created_at: string | null;
    follow_up_owner: string | null;
  }>;
  tasks: Array<MeetingTask & {
    meeting_title: string | null;
    meeting_created_at: string | null;
  }>;
};
