import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { decode } from 'base64-arraybuffer';

export async function shareDoorQr(id:string,base64:string):Promise<void> {
    if(!(await Sharing.isAvailableAsync()))throw new Error('door.shareUnavailable');
    const file=new File(Paths.cache,`door-invitation-${id}.png`);
    try {
        file.create({overwrite:true});file.write(new Uint8Array(decode(base64)));
        await Sharing.shareAsync(file.uri,{mimeType:'image/png',UTI:'public.png'});
    }finally{if(file.exists)file.delete();}
}
