import 'react-native-url-polyfill/auto';
import { authStorage } from './authStorage';
import { createClient } from '@supabase/supabase-js';

import { labBackend, labOfflineFetch } from './labBackend';

export const supabase = createClient(labBackend.url, labBackend.anonKey, {
    global: { fetch: labOfflineFetch },
    auth: {
        storage: authStorage,
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
    },
});
