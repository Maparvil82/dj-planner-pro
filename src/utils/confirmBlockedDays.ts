import type { TFunction } from 'i18next';
import type { CreateSessionInput } from '../types/session';
import { sessionTools } from '../services/sessionTools';
import { blockedSessionDays } from './blockedDays';
import { confirmAction } from './confirmAction';
export async function confirmBlockedDays(
    inputs: CreateSessionInput[],
    t: TFunction,
) {
    const blocked = await sessionTools.blockedDays();
    const conflicts = [
        ...new Set(
            inputs.flatMap((input) => blockedSessionDays(input, blocked)),
        ),
    ].sort();
    if (!conflicts.length) return true;
    return confirmAction(
        t('tools.blockedWarning'),
        t('tools.blockedWarningHint', { dates: conflicts.join(', ') }),
        t('cancel'),
        t('continue'),
    );
}
