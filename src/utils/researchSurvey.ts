// Versioned questionnaire. Stable option IDs are shared across languages and
// mirrored by server-side validation for consistent analysis.
export const RESEARCH_SURVEY_VERSION = 'self-employed-djs-v1';
export const researchSurveyQuestions = [
    { id: 'profile', kind: 'single', options: 'status', required: true },
    { id: 'frequency', kind: 'single', options: 'gigs', required: true },
    { id: 'recent', kind: 'text', maxLength: 1500, required: false },
    { id: 'tools', kind: 'multiple', options: 'management', exclusive: 'none', required: true },
    { id: 'time', kind: 'single', options: 'hours', required: true },
    { id: 'priorities', kind: 'multiple', options: 'features', maxChoices: 3, exclusive: 'none', required: true },
    { id: 'first', kind: 'single', optionsFrom: 'priorities', skipWhenOnly: 'none', required: true },
    { id: 'additional', kind: 'text', maxLength: 1500, required: false },
] as const;

export const researchSurveyOptionIds = {
    status: ['self_employed', 'mixed_work', 'preparing', 'not_self_employed', 'prefer_not_say'],
    gigs: ['none', 'one_two', 'three_five', 'six_ten', 'eleven_plus', 'prefer_not_say'],
    management: ['dj_planner', 'calendar', 'spreadsheet', 'notes', 'invoicing_app', 'external_professional', 'other', 'none'],
    hours: ['under_one', 'one_three', 'four_seven', 'eight_plus', 'unknown'],
    features: ['quotes_contracts', 'invoices', 'payments_due', 'expense_receipts', 'gig_profitability', 'accountant_export', 'client_management', 'cash_forecast', 'other', 'none'],
} as const;

export type SurveyAnswers = Partial<Record<'profile' | 'frequency' | 'recent' | 'tools' | 'time' | 'priorities' | 'first' | 'additional' | 'toolsOther' | 'prioritiesOther', string | string[]>>;
export type SurveyQuestion = typeof researchSurveyQuestions[number];
export function surveyQuestionsFor(answers: SurveyAnswers) {
    const priorities = Array.isArray(answers.priorities) ? answers.priorities : [];
    return researchSurveyQuestions.filter(q => (q.id !== 'recent' || answers.frequency !== 'none') && (q.id !== 'first' || priorities.length === 0 || (priorities.length > 1 && !priorities.includes('none'))));
}
export function surveyOptionsFor(question: SurveyQuestion, answers: SurveyAnswers): readonly string[] {
    if (question.id === 'first') return Array.isArray(answers.priorities) ? answers.priorities.filter(id => id !== 'none') : [];
    return 'options' in question ? researchSurveyOptionIds[question.options] : [];
}
export function surveyOptionGroup(question: SurveyQuestion) {
    return question.id === 'first' ? 'features' : 'options' in question ? question.options : '';
}
export function toggleSurveyOption(current: string[], value: string, max = Infinity) {
    if (current.includes(value)) return current.filter(id => id !== value);
    if (value === 'none') return ['none'];
    const next = current.filter(id => id !== 'none');
    return next.length < max ? [...next, value] : current;
}
export function normalizeSurveyAnswers(answers: SurveyAnswers): SurveyAnswers {
    const result: SurveyAnswers = {};
    for (const q of researchSurveyQuestions) {
        const value = answers[q.id];
        if (typeof value === 'string') result[q.id] = value.trim();
        else if (Array.isArray(value)) result[q.id] = [...value];
    }
    if (answers.frequency === 'none') delete result.recent;
    const priorities = Array.isArray(result.priorities) ? result.priorities : [];
    if (priorities.length === 1 && priorities[0] !== 'none') result.first = priorities[0];
    else if (priorities.includes('none') || !priorities.includes(String(result.first))) delete result.first;
    for (const field of ['tools', 'priorities'] as const) {
        const text = answers[`${field}Other`];
        if (Array.isArray(result[field]) && result[field].includes('other') && typeof text === 'string' && text.trim()) result[`${field}Other`] = text.trim();
    }
    return result;
}
export function surveyQuestionValid(question: SurveyQuestion, answers: SurveyAnswers) {
    const value = answers[question.id];
    if (question.kind === 'text') return value === undefined || (typeof value === 'string' && value.length <= question.maxLength);
    const options = surveyOptionsFor(question, answers);
    if (question.kind === 'single') return typeof value === 'string' && options.includes(value);
    if (!Array.isArray(value) || !value.length || new Set(value).size !== value.length || value.some(id => !options.includes(id))) return false;
    if (value.includes('none') && value.length !== 1) return false;
    return !('maxChoices' in question) || value.length <= question.maxChoices;
}
export function surveyAnswersValid(answers: SurveyAnswers) {
    const normalized = normalizeSurveyAnswers(answers);
    return surveyQuestionsFor(normalized).every(q => surveyQuestionValid(q, normalized)) &&
        (['toolsOther','prioritiesOther'] as const).every(key => normalized[key] === undefined || (typeof normalized[key] === 'string' && normalized[key].length <= 300));
}
