import { create } from 'zustand';
import type { ConditionalAgreement } from '../utils/feeAgreement';
export const useConditionalDraft = create<{
    pending: ConditionalAgreement | null;
    set: (pending: ConditionalAgreement | null) => void;
}>((set) => ({ pending: null, set: (pending) => set({ pending }) }));
