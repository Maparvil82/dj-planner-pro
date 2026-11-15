import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import * as StoreReview from 'expo-store-review';

export interface ReviewUsage {
    firstSeen: number;
    days: string[];
    lastSave: number;
    lastRequest: number;
}
const DAY = 86400000;
export function reviewEligible(state: ReviewUsage, count: number, now: number) {
    return now - state.firstSeen >= 7 * DAY && state.days.length >= 3 && count >= 2 &&
        state.lastSave > state.lastRequest && now - state.lastSave < 60000 &&
        (!state.lastRequest || now - state.lastRequest >= 120 * DAY);
}
let queue: Promise<unknown> = Promise.resolve();
function update(userId: string, action: (state: ReviewUsage) => Promise<void>) {
    const next = queue.then(async () => {
        const key = `app-review-v1:${userId}`;
        const raw = await AsyncStorage.getItem(key);
        const state: ReviewUsage = raw ? JSON.parse(raw) : { firstSeen: Date.now(), days: [], lastSave: 0, lastRequest: 0 };
        await action(state);
        await AsyncStorage.setItem(key, JSON.stringify(state));
    });
    // Reviews must never interrupt a successful save or normal navigation.
    queue = next.catch(() => {});
    return queue;
}
export function recordReviewUse(userId: string, saved = false) {
    if (Platform.OS !== 'ios') return Promise.resolve();
    return update(userId, async state => {
        const now = new Date();
        const day = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
        state.days = [...new Set([...state.days, day])].slice(-3);
        if (saved) state.lastSave = now.getTime();
    });
}
export function requestReviewIfEligible(userId: string, count: number, isSafe: () => boolean) {
    if (Platform.OS !== 'ios') return Promise.resolve();
    return update(userId, async state => {
        if (!reviewEligible(state, count, Date.now()) || !isSafe()) return;
        if (!(await StoreReview.isAvailableAsync()) || !isSafe()) return;
        // Persist before requesting: Apple does not report whether the prompt appeared.
        state.lastRequest = Date.now();
        await AsyncStorage.setItem(`app-review-v1:${userId}`, JSON.stringify(state));
        await StoreReview.requestReview();
    });
}
