// Генерує білі PNG для екранного джойстика (колір задається в Sprite → Color).
// Запуск: node art/ui_textures.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'textures', 'ui');

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
});

function crc32(buf) {
    let c = 0xffffffff;
    for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([len, body, crc]);
}

function png(size, alphaAt) {
    const raw = Buffer.alloc((size * 4 + 1) * size);
    for (let y = 0; y < size; y++) {
        const row = y * (size * 4 + 1);
        raw[row] = 0;
        for (let x = 0; x < size; x++) {
            const i = row + 1 + x * 4;
            raw[i] = raw[i + 1] = raw[i + 2] = 255;
            raw[i + 3] = Math.round(255 * Math.min(1, Math.max(0, alphaAt(x + 0.5, y + 0.5))));
        }
    }
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(size, 0);
    ihdr.writeUInt32BE(size, 4);
    ihdr[8] = 8;
    ihdr[9] = 6;
    return Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        chunk('IHDR', ihdr),
        chunk('IDAT', deflateSync(raw)),
        chunk('IEND', Buffer.alloc(0)),
    ]);
}

// покриття пікселя колом радіуса r: 1 всередині, 0 зовні, згладжений край в 1 px
const inside = (d, r) => Math.min(1, Math.max(0, r - d + 0.5));

function base(size) {
    const c = size / 2;
    const outer = c - 2;
    const ring = 6;
    return png(size, (x, y) => {
        const d = Math.hypot(x - c, y - c);
        const fill = 0.22 * inside(d, outer);
        const stroke = 0.85 * (inside(d, outer) - inside(d, outer - ring));
        return fill + stroke;
    });
}

function knob(size) {
    const c = size / 2;
    return png(size, (x, y) => 0.9 * inside(Math.hypot(x - c, y - c), c - 2));
}

mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, 'joystick_base.png'), base(256));
writeFileSync(join(OUT, 'joystick_knob.png'), knob(128));
console.log('written to', OUT);
