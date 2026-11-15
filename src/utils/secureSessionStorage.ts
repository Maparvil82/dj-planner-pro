interface Storage {
    getItem(key: string): Promise<string | null>;
    setItem(key: string, value: string): Promise<void>;
    removeItem(key: string): Promise<void>;
}
interface Manifest { generation: string; count: number }

// Commit the manifest last: failed writes leave the previous session readable.
// Small chunks also support Keychain implementations with small value limits.
export function createSecureSessionStorage(secure: Storage, legacy: Storage, generation: () => string): Storage {
    const queues = new Map<string, Promise<unknown>>();
    const base = (key: string) => `dj.auth.${encodeURIComponent(key).replace(/%/g, '_')}`;
    const manifest = async (key: string): Promise<Manifest | null> => {
        const raw = await secure.getItem(base(key));
        if (!raw) return null;
        const m = JSON.parse(raw) as Manifest;
        if (!/^[a-zA-Z0-9-]+$/.test(m.generation) || !Number.isInteger(m.count) || m.count < 1 || m.count > 256) throw new Error('INVALID_SESSION_STORAGE');
        return m;
    };
    const cleanup = async (key: string, m: Manifest | null) => {
        if (m) await Promise.all(Array.from({length:m.count}, (_, i) => secure.removeItem(`${base(key)}.${m.generation}.${i}`)));
    };
    const write = async (key: string, value: string) => {
        const old = await manifest(key);
        const characters = Array.from(value), chunks: string[] = [];
        for (let i=0;i<characters.length;i+=400) chunks.push(characters.slice(i,i+400).join(''));
        if (!chunks.length) chunks.push('');
        if (chunks.length > 256) throw new Error('SESSION_TOO_LARGE');
        const next = {generation: generation(), count: chunks.length};
        try {
            for (let i=0;i<chunks.length;i++) await secure.setItem(`${base(key)}.${next.generation}.${i}`,chunks[i]);
            await secure.setItem(base(key),JSON.stringify(next));
        } catch (error) {
            await cleanup(key,next).catch(()=>{});
            throw error;
        }
        await legacy.removeItem(key);
        await cleanup(key,old).catch(()=>{});
    };
    const serialize = <T>(key: string, task: () => Promise<T>): Promise<T> => {
        const result = (queues.get(key) || Promise.resolve()).catch(()=>{}).then(task);
        queues.set(key,result);
        void result.finally(()=>{if(queues.get(key)===result) queues.delete(key);}).catch(()=>{});
        return result;
    };
    return {
        getItem: key => serialize(key,async()=>{
            const m = await manifest(key);
            if (m) {
                const chunks = await Promise.all(Array.from({length:m.count},(_,i)=>secure.getItem(`${base(key)}.${m.generation}.${i}`)));
                if (chunks.some(chunk=>chunk===null)) throw new Error('INCOMPLETE_SESSION_STORAGE');
                await legacy.removeItem(key);
                return chunks.join('');
            }
            const value = await legacy.getItem(key);
            if (value!==null) await write(key,value);
            return value;
        }),
        setItem: (key,value) => serialize(key,()=>write(key,value)),
        removeItem: key => serialize(key,async()=>{
            const old=await manifest(key);
            // Remove plaintext first, so it cannot be restored after logout.
            await legacy.removeItem(key);
            await secure.removeItem(base(key));
            await cleanup(key,old).catch(()=>{});
        }),
    };
}
