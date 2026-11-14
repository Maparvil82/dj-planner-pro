import { create } from 'zustand';
export const useResearchOverlayStore = create<{ updatesVisible: boolean }>(() => ({ updatesVisible: false }));
