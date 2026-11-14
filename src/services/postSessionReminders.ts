import { supabase } from '../lib/supabase';
import { localDateString } from '../utils/sessionPlanning';
import type { ReviewSession } from '../utils/postSessionReminders';

export async function listSessionsForReview(userId: string): Promise<ReviewSession[]> {
    // Includes overnight sessions and the full range of venue timezones.
    const from = new Date();
    from.setDate(from.getDate() - 3);
    const { data, error } = await supabase.from('sessions')
        .select('id,user_id,date,start_time,end_time,venue,booking_timezone,status')
        .eq('user_id', userId).gte('date', localDateString(from))
        .order('date').order('start_time').order('id').limit(200);
    if (error) throw error;
    return data || [];
}
