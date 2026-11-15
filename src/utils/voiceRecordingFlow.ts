export type VoiceRecordingStep = 'closed' | 'preparing' | 'recording' | 'review' | 'name' | 'reminder' | 'saving';
export type VoiceRecordingEvent = 'START' | 'READY' | 'STOPPED' | 'KEEP' | 'NAMED' | 'SAVE' | 'SAVED' | 'DISCARD' | 'FAILED';

// An audio file is uploaded only after the explicit final choice.
export function voiceRecordingTransition(step: VoiceRecordingStep, event: VoiceRecordingEvent): VoiceRecordingStep {
    if (event === 'DISCARD' || event === 'SAVED') return 'closed';
    if (event === 'FAILED') return step === 'saving' ? 'reminder' : 'closed';
    if (step === 'closed' && event === 'START') return 'preparing';
    if (step === 'preparing' && event === 'READY') return 'recording';
    if (step === 'recording' && event === 'STOPPED') return 'review';
    if (step === 'review' && event === 'KEEP') return 'name';
    if (step === 'name' && event === 'NAMED') return 'reminder';
    if (step === 'reminder' && event === 'SAVE') return 'saving';
    return step;
}
