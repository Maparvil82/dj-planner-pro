// Deliberately independent of production environment variables.
// No local Supabase instance is required for the poster UI prototype.
export const labBackend = {
    url: 'http://127.0.0.1:54321',
    anonKey: 'local-lab-placeholder-not-a-production-key',
};
export const labOfflineFetch: typeof fetch = async () => {
    throw new Error('Laboratorio de carteles: backend desconectado.');
};
