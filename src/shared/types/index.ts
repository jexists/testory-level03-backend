export type Os = 'ANDROID' | 'IOS';
export type Role = 'ADMIN' | 'USER';
export type FeedbackType = 'BUG' | 'IMPROVEMENT' | 'PRAISE';
export type RecruitmentKind = 'APP_FULL' | 'FEATURE';
export type DeviceScope = 'ALL' | 'MODEL';
export type ApplicationStatus = 'APPLIED' | 'CANCELLED';

export interface AnalysisResult {
  recurringIssues: string[];
  improvementRequests: string[];
  positiveOpinions: string[];
  priorities: string[];
}
