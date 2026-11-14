export const ANALYTICS_EVENTS = ['app_opened', 'session_created', 'private_note_saved', 'audio_note_saved', 'paywall_viewed', 'pro_trial_started', 'pro_purchase_completed', 'research_survey_submitted'] as const;
export type AnalyticsEvent = typeof ANALYTICS_EVENTS[number];

// Events contain no free text, session IDs, locations, dates, fees, notes or audio.
export function safeProperties(event: string, input: Record<string, unknown> = {}): Record<string, boolean | string> | null {
    if (!(ANALYTICS_EVENTS as readonly string[]).includes(event)) return null;
    const output: Record<string, boolean | string> = {};
    if (event === 'research_survey_submitted' && input.survey_version === 'self-employed-djs-v1') output.survey_version = input.survey_version;
    if (event === 'audio_note_saved' && typeof input.reminder_enabled === 'boolean') output.reminder_enabled = input.reminder_enabled;
    if (event === 'paywall_viewed' && typeof input.paid_pro === 'boolean') output.paid_pro = input.paid_pro;
    if (event === 'pro_purchase_completed') {
        if (input.plan !== 'monthly' && input.plan !== 'yearly') return null;
        if (typeof input.is_sandbox !== 'boolean') return null;
        output.plan = input.plan;
        output.is_sandbox = input.is_sandbox;
    }
    return output;
}
