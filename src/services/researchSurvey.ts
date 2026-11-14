import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { RESEARCH_SURVEY_VERSION, normalizeSurveyAnswers, surveyAnswersValid, type SurveyAnswers } from '../utils/researchSurvey';
export type SurveyDraft = { answers: SurveyAnswers; step: number };
const draftKey = (user: string) => `research-survey:${RESEARCH_SURVEY_VERSION}:${user}`;
let writes: Promise<unknown> = Promise.resolve();
export async function readSurveyDraft(user: string): Promise<SurveyDraft> {
    await writes.catch(() => {});
    const raw = await AsyncStorage.getItem(draftKey(user));
    if (!raw) return { answers: {}, step: 0 };
    const data = JSON.parse(raw);
    if (!data || typeof data.answers !== 'object' || Array.isArray(data.answers) || !data.answers) return { answers: {}, step: 0 };
    return { answers: data.answers, step: Number.isInteger(data.step) && data.step >= 0 ? Math.min(data.step, 8) : 0 };
}
export function saveSurveyDraft(user: string, draft: SurveyDraft) {
    const next = writes.catch(() => {}).then(() => AsyncStorage.setItem(draftKey(user), JSON.stringify(draft)));
    writes = next;
    return next;
}
export function clearSurveyDraft(user: string) {
    const next = writes.catch(() => {}).then(() => AsyncStorage.removeItem(draftKey(user)));
    writes = next;
    return next;
}
export async function getSurveyResponse(user: string) {
    const { data, error } = await supabase.from('research_survey_responses').select('submitted_at').eq('user_id', user).eq('survey_version', RESEARCH_SURVEY_VERSION).maybeSingle();
    if (error) throw error;
    return data as { submitted_at: string } | null;
}
export async function submitSurveyResponse(user: string, language: string, answers: SurveyAnswers) {
    if (!surveyAnswersValid(answers)) throw new Error('invalid_survey');
    const lang = language.split('-')[0];
    const { error } = await supabase.from('research_survey_responses').insert({ user_id: user, survey_version: RESEARCH_SURVEY_VERSION, language: ['es','en','de','fr','it','pt','ja'].includes(lang) ? lang : 'en', answers: normalizeSurveyAnswers(answers) });
    if (error && error.code !== '23505') throw error;
    const saved = await getSurveyResponse(user);
    if (!saved) throw new Error('survey_not_saved');
    return saved;
}
