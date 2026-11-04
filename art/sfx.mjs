// Синтезує звуки гри у WAV (моно, 22050 Гц, 16 біт) — без жодних завантажених файлів.
// Запуск: node art/sfx.mjs   → assets/audio/*.wav
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'audio');
const RATE = 22050;

function rng(seed) {
    let s = seed >>> 0;
    return () => {
        s = (s + 0x6d2b79f5) >>> 0;
        let t = s;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

const buffer = (seconds) => new Float32Array(Math.round(seconds * RATE));

function wav(samples, peak) {
    let max = 0;
    for (const v of samples) max = Math.max(max, Math.abs(v));
    const gain = max > 0 ? peak / max : 0;
    const data = Buffer.alloc(44 + samples.length * 2);
    data.write('RIFF', 0);
    data.writeUInt32LE(36 + samples.length * 2, 4);
    data.write('WAVEfmt ', 8);
    data.writeUInt32LE(16, 16);
    data.writeUInt16LE(1, 20);
    data.writeUInt16LE(1, 22);
    data.writeUInt32LE(RATE, 24);
    data.writeUInt32LE(RATE * 2, 28);
    data.writeUInt16LE(2, 32);
    data.writeUInt16LE(16, 34);
    data.write('data', 36);
    data.writeUInt32LE(samples.length * 2, 40);
    samples.forEach((v, i) => data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, v * gain)) * 32767), 44 + i * 2));
    return data;
}

// двополюсний смуговий фільтр (RBJ biquad)
function bandpass(samples, freq, q) {
    const w = (2 * Math.PI * freq) / RATE;
    const alpha = Math.sin(w) / (2 * q);
    const a0 = 1 + alpha;
    const b0 = alpha / a0, b2 = -alpha / a0, a1 = (-2 * Math.cos(w)) / a0, a2 = (1 - alpha) / a0;
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (let i = 0; i < samples.length; i++) {
        const x = samples[i];
        const y = b0 * x + b2 * x2 - a1 * y1 - a2 * y2;
        x2 = x1; x1 = x; y2 = y1; y1 = y;
        samples[i] = y;
    }
    return samples;
}

function lowpass(samples, freq) {
    const k = 1 - Math.exp((-2 * Math.PI * freq) / RATE);
    let y = 0;
    for (let i = 0; i < samples.length; i++) samples[i] = y += (samples[i] - y) * k;
    return samples;
}

// миттєва атака (attack с) і експоненційне згасання з постійною decay с
const env = (t, attack, decay) => (t < attack ? t / attack : Math.exp(-(t - attack) / decay));

function pick() {
    const out = buffer(0.22);
    const noise = rng(7);
    let phase = 0;
    for (let i = 0; i < out.length; i++) {
        const t = i / RATE;
        const freq = 330 + 650 * Math.exp(-t / 0.035);
        phase += (2 * Math.PI * freq) / RATE;
        const body = Math.sin(phase) + 0.25 * Math.sin(2 * phase);
        const click = (noise() * 2 - 1) * env(t, 0.001, 0.004);
        out[i] = body * env(t, 0.003, 0.06) + 0.5 * click;
    }
    return wav(out, 0.7);
}

function inedible() {
    const out = buffer(0.42);
    let phase = 0;
    for (let i = 0; i < out.length; i++) {
        const t = i / RATE;
        const freq = t < 0.15 ? 300 : 210;
        phase += (2 * Math.PI * freq) / RATE;
        // м'який «квадрат»: кілька непарних гармонік
        const tone = Math.sin(phase) + Math.sin(3 * phase) / 4 + Math.sin(5 * phase) / 9;
        const note = t < 0.15 ? env(t, 0.005, 0.07) : env(t - 0.15, 0.005, 0.09);
        out[i] = tone * note;
    }
    return wav(lowpass(out, 2500), 0.55);
}

function step(seed) {
    const r = rng(seed);
    const out = buffer(0.16);
    const crunch = buffer(0.16);
    for (let i = 0; i < crunch.length; i++) {
        const t = i / RATE;
        // трава й листя: кілька дрібних тріскотів замість одного шуму
        const grain = 0.6 + 0.4 * Math.sin(t * (180 + r() * 120));
        crunch[i] = (r() * 2 - 1) * env(t, 0.004, 0.035) * grain;
    }
    bandpass(crunch, 1600 + r() * 900, 0.9);
    let phase = 0;
    for (let i = 0; i < out.length; i++) {
        const t = i / RATE;
        phase += (2 * Math.PI * (85 + 20 * r())) / RATE;
        out[i] = crunch[i] * 1.4 + 0.5 * Math.sin(phase) * env(t, 0.003, 0.025);
    }
    return wav(out, 0.45);
}

function click() {
    const out = buffer(0.06);
    let phase = 0;
    for (let i = 0; i < out.length; i++) {
        const t = i / RATE;
        phase += (2 * Math.PI * 1400) / RATE;
        out[i] = Math.sin(phase) * env(t, 0.001, 0.012);
    }
    return wav(out, 0.5);
}

function chirp(out, start, r) {
    const notes = 2 + Math.floor(r() * 3);
    const base = 2800 + r() * 1400;
    let at = start;
    for (let n = 0; n < notes; n++) {
        const length = 0.06 + r() * 0.07;
        const sweep = (r() < 0.5 ? -1 : 1) * (600 + r() * 900);
        let phase = 0;
        const from = Math.round(at * RATE);
        for (let i = 0; i < length * RATE && from + i < out.length; i++) {
            const t = i / RATE;
            const freq = base + sweep * (t / length) + 120 * Math.sin(2 * Math.PI * 38 * t);
            phase += (2 * Math.PI * freq) / RATE;
            out[from + i] += 0.22 * Math.sin(phase) * Math.sin((Math.PI * t) / length);
        }
        at += length + 0.03 + r() * 0.05;
    }
}

function ambience(seconds) {
    const r = rng(42);
    const fade = 1.5;
    const raw = buffer(seconds + fade);
    // вітер: «коричневий» шум, повільно дихає
    let brown = 0;
    for (let i = 0; i < raw.length; i++) {
        brown = (brown + (r() * 2 - 1) * 0.02) * 0.998;
        const t = i / RATE;
        raw[i] = brown * (0.6 + 0.4 * Math.sin((2 * Math.PI * t) / 7.3) * Math.sin((2 * Math.PI * t) / 3.1 + 1));
    }
    lowpass(raw, 500);
    // безшовна петля: хвіст плавно накладається на початок
    const out = buffer(seconds);
    const n = Math.round(fade * RATE);
    for (let i = 0; i < out.length; i++) out[i] = raw[i];
    for (let i = 0; i < n; i++) {
        const k = i / n;
        out[i] = raw[i] * k + raw[out.length + i] * (1 - k);
    }
    let max = 0;
    for (const v of out) max = Math.max(max, Math.abs(v));
    for (let i = 0; i < out.length; i++) out[i] /= max;
    // птахи — подалі від шва петлі
    for (let at = 1.2; at < seconds - 1.2; at += 2.2 + r() * 3) chirp(out, at, r);
    return wav(out, 0.5);
}

mkdirSync(OUT, { recursive: true });
const files = {
    'pick.wav': pick(),
    'inedible.wav': inedible(),
    'step_1.wav': step(11),
    'step_2.wav': step(23),
    'step_3.wav': step(37),
    'click.wav': click(),
    'forest_ambience.wav': ambience(20),
};
for (const [name, data] of Object.entries(files)) writeFileSync(join(OUT, name), data);
console.log('written to', OUT, Object.keys(files).join(', '));
