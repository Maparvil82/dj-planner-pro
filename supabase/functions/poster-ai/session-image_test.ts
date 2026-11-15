import assert from 'node:assert/strict';
import { deflateSync } from 'node:zlib';
import { ImageMagick, MagickFormat, MagickImageInfo, initializeImageMagick } from 'npm:@imagemagick/magick-wasm@0.0.45';
// Independent decoder for assertions; this test dependency is not imported by the function.
await initializeImageMagick(await Deno.readFile(new URL(import.meta.resolve('npm:@imagemagick/magick-wasm@0.0.45/magick.wasm'))));
import { sessionPosterImage, SESSION_POSTER_MAX_BYTES } from './session-image.ts';

// Independent PNG fixture encoder, including real pixel data and valid checksums.
function png(width: number, height: number, noise = false, transparent = false) {
    const raw = new Uint8Array(height * (1 + width * 4));
    let seed = 123456789;
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        const i = y * (1 + width * 4) + 1 + x * 4;
        for (let c = 0; c < 3; c++) {
            seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
            raw[i + c] = noise ? seed & 255 : 0;
        }
        raw[i + 3] = transparent ? 0 : 255;
    }
    function chunk(name: string, data: Uint8Array) {
        const bytes = new Uint8Array(data.length + 12);
        const view = new DataView(bytes.buffer);
        view.setUint32(0, data.length);
        bytes.set(new TextEncoder().encode(name), 4); bytes.set(data, 8);
        let crc = 0xffffffff;
        for (const value of bytes.subarray(4, -4)) {
            crc ^= value;
            for (let k = 0; k < 8; k++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
        }
        view.setUint32(bytes.length - 4, (crc ^ 0xffffffff) >>> 0);
        return bytes;
    }
    const header = new Uint8Array(13); const view = new DataView(header.buffer);
    view.setUint32(0, width); view.setUint32(4, height); header[8] = 8; header[9] = 6;
    const chunks = [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', deflateSync(raw)), chunk('IEND', new Uint8Array())];
    const output = new Uint8Array(chunks.reduce((n, part) => n + part.length, 0));
    let offset = 0; for (const part of chunks) { output.set(part, offset); offset += part.length; }
    return output;
}
function jpegInfo(bytes: Uint8Array) {
    assert.ok(bytes.length <= SESSION_POSTER_MAX_BYTES);
    assert.deepEqual([...bytes.subarray(0, 3)], [255, 216, 255]);
    const info = MagickImageInfo.create(bytes);
    assert.equal(info.format, MagickFormat.Jpeg);
    assert.ok(Math.max(info.width, info.height) <= 1600);
    return info;
}

Deno.test('noisy PNG above 1 MiB becomes a bounded JPEG without changing the original or cropping', async () => {
    const original = png(1700, 1000, true);
    assert.ok(original.length > SESSION_POSTER_MAX_BYTES);
    const snapshot = original.slice();
    const start = performance.now();
    const output = await sessionPosterImage(original, 'image/png');
    const info = jpegInfo(output);
    assert.ok(Math.abs(info.width / info.height - 1.7) < 0.003);
    assert.deepEqual(original, snapshot);
    console.log(JSON.stringify({case:'noisy PNG', inputBytes:original.length, outputBytes:output.length, conversionMs:Math.round(performance.now()-start)}));
});
Deno.test('oversized JPEG is recompressed; already-compatible JPEG retains its exact bytes', async () => {
    const source = png(1400, 1400, true);
    await sessionPosterImage(png(2, 2), 'image/png'); // initialize the shared engine
    const large = ImageMagick.read(source, image => { image.quality = 100; return image.write(MagickFormat.Jpeg, data => data.slice()); });
    assert.ok(large.length > SESSION_POSTER_MAX_BYTES);
    const snapshot = large.slice();
    const output = await sessionPosterImage(large, 'image/jpeg');
    const info = jpegInfo(output); assert.equal(info.width, info.height);
    assert.deepEqual(large, snapshot);
    assert.strictEqual(await sessionPosterImage(output, 'image/jpeg'), output);
});
Deno.test('portrait, square and small images retain proportions without upscaling', async () => {
    for (const [width, height] of [[864, 1536], [1024, 1024], [32, 48]]) {
        const info = jpegInfo(await sessionPosterImage(png(width, height), 'image/png'));
        assert.equal(info.width, width); assert.equal(info.height, height);
    }
});
Deno.test('transparent PNG becomes white rather than a black background', async () => {
    const output = await sessionPosterImage(png(4, 2, false, true), 'image/png');
    ImageMagick.read(output, image => {
        const color = image.getPixels(pixels => pixels.getColor(0, 0));
        assert.ok(color && color.r > 245 && color.g > 245 && color.b > 245);
    });
});
Deno.test('invalid, unsupported, oversized and excessive-pixel inputs fail before session upload', async () => {
    for (const [bytes, mime] of [
        [new Uint8Array(), 'image/jpeg'],
        [new Uint8Array([255, 216, 255]), 'image/jpeg'],
        [png(2, 2), 'image/gif'],
        [png(2, 2), 'image/jpeg'],
        [new Uint8Array(10 * 1024 * 1024 + 1), 'image/jpeg'],
        [png(4096, 1025), 'image/png'],
    ] as const) {
        await assert.rejects(() => sessionPosterImage(bytes, mime), /poster_invalid_output/);
    }
});
