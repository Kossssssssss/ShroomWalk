// Розставляє лісову галявину з префабів у assets/Main.scene.
// Запуск з кореня проєкту:  node art/glade_layout.mjs [seed]
// Зі старої сцени лишаються світло, камера, земля й налаштування сцени (Ambient, Fog, Shadows...);
// усе інше (гриби, дерева, групи) замінюється новою розстановкою.
// Відсутні префаби (Grass, Bush, RockBig, RockSmall, Stump, Log) створюються в assets/prefabs.
// UUID і fileId детерміновані, тож повторний запуск перезаписує ті самі файли без дублікатів.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), '..');
const ASSETS = path.join(ROOT, 'assets');
const SEED = Number(process.argv[2] ?? 7);

// ---------- детерміновані id ----------
const hash = (s) => crypto.createHash('md5').update('kosmo-glade:' + s).digest();
const uuidOf = (s) => {
    const h = hash(s).toString('hex');
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
};
const fid = (s) => hash(s).toString('base64').replace(/=/g, '').slice(0, 22);

// ---------- seeded random ----------
function mulberry32(a) {
    return () => {
        a |= 0; a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
const rnd = mulberry32(SEED);
const range = (a, b) => a + (b - a) * rnd();
const pick = (weights) => {
    let r = rnd() * Object.values(weights).reduce((a, b) => a + b, 0);
    for (const [k, w] of Object.entries(weights)) if ((r -= w) <= 0) return k;
    return Object.keys(weights)[0];
};

// ---------- моделі та префаби ----------
const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const writeJson = (p, data) => fs.writeFileSync(p, JSON.stringify(data, null, 2));

function glbInfo(model) {
    const meta = readJson(path.join(ASSETS, 'models/forest', model + '.glb.meta'));
    const subs = Object.values(meta.subMetas);
    const sceneUuid = subs.find((s) => s.importer === 'gltf-scene').uuid;
    const lib = readJson(path.join(ROOT, 'library', sceneUuid.slice(0, 2), sceneUuid + '.json'));
    const root = lib[1];
    const meshNode = lib[root._children[0].__id__];
    return {
        sceneUuid,
        rootFid: lib[root._prefab.__id__].fileId,
        meshNodeFid: lib[meshNode._prefab.__id__].fileId,
        compFid: lib[lib[meshNode._components[0].__id__].__prefab.__id__].fileId,
    };
}

// префаби, які ви зробили самі
const USER_PREFABS = {
    Porcini: 'mushroom_porcini', Amanita: 'mushroom_amanita', Chanterelle: 'mushroom_chanterelle',
    Pine: 'tree_pine', Oak: 'tree_oak', Birch: 'tree_birch',
};
// префаби, яких ще не було: name -> [model, castShadows]
const NEW_PREFABS = {
    Grass: ['grass_tuft', false], Bush: ['bush_berries', true], RockBig: ['rock_big', true],
    RockSmall: ['rock_small', true], Stump: ['stump', true], Log: ['log', true],
};

const vec3 = (x, y, z) => ({ __type__: 'cc.Vec3', x, y, z });
const quatY = (deg) => {
    const r = (deg * Math.PI) / 360;
    return { __type__: 'cc.Quat', x: 0, y: Math.sin(r), z: 0, w: Math.cos(r) };
};

function writeNewPrefab(name, model, castShadows) {
    const g = glbInfo(model);
    const k = 'prefab:' + name;
    const overrides = [
        ['_name', model], ['_lpos', vec3(0, 0, 0)], ['_lrot', quatY(0)], ['_euler', vec3(0, 0, 0)],
    ];
    const data = [
        { __type__: 'cc.Prefab', _name: name, _objFlags: 0, __editorExtras__: {}, _native: '', data: { __id__: 1 }, optimizationPolicy: 0, persistent: false },
        {
            __type__: 'cc.Node', _name: name, _objFlags: 0, __editorExtras__: {}, _parent: null, _children: [{ __id__: 2 }], _active: true, _components: [],
            _prefab: null, _lpos: vec3(0, 0, 0), _lrot: quatY(0), _lscale: vec3(1, 1, 1), _mobility: 0, _layer: 1073741824, _euler: vec3(0, 0, 0), _id: '',
        },
        { __type__: 'cc.Node', _objFlags: 0, _parent: { __id__: 1 }, _prefab: { __id__: 3 }, __editorExtras__: {} },
        { __type__: 'cc.PrefabInfo', root: { __id__: 2 }, asset: { __uuid__: g.sceneUuid, __expectedType__: 'cc.Prefab' }, fileId: g.rootFid, instance: { __id__: 4 }, targetOverrides: null },
        { __type__: 'cc.PrefabInstance', fileId: fid(k + ':inst'), prefabRootNode: { __id__: 1 }, mountedChildren: [], mountedComponents: [], propertyOverrides: [], removedComponents: [] },
        { __type__: 'cc.TargetInfo', localID: [g.rootFid] },
    ];
    for (const [prop, value] of overrides) {
        data[4].propertyOverrides.push({ __id__: data.length });
        data.push({ __type__: 'CCPropertyOverrideInfo', targetInfo: { __id__: 5 }, propertyPath: [prop], value });
    }
    if (castShadows) {
        data[4].propertyOverrides.push({ __id__: data.length });
        data.push({ __type__: 'CCPropertyOverrideInfo', targetInfo: { __id__: data.length + 1 }, propertyPath: ['_shadowCastingMode'], value: 1 });
        data.push({ __type__: 'cc.TargetInfo', localID: [g.compFid] });
    }
    data[1]._prefab = { __id__: data.length };
    data.push({ __type__: 'cc.PrefabInfo', root: { __id__: 1 }, asset: { __id__: 0 }, fileId: fid(k + ':root'), targetOverrides: null, nestedPrefabInstanceRoots: [{ __id__: 2 }] });

    const file = path.join(ASSETS, 'prefabs', name + '.prefab');
    const metaFile = file + '.meta';
    const uuid = fs.existsSync(metaFile) ? readJson(metaFile).uuid : uuidOf(k);
    writeJson(file, data);
    writeJson(metaFile, { ver: '1.1.50', importer: 'prefab', imported: true, uuid, files: ['.json'], subMetas: {}, userData: { syncNodeName: name } });
    return { uuid, rootFid: data[data.length - 1].fileId, glb: g, nestedFid: null, castShadows };
}

function readUserPrefab(name, model) {
    const file = path.join(ASSETS, 'prefabs', name + '.prefab');
    const data = readJson(file);
    return {
        uuid: readJson(file + '.meta').uuid,
        rootFid: data[data[1]._prefab.__id__].fileId,
        nestedFid: data.find((o) => o.__type__ === 'cc.PrefabInstance').fileId,
        glb: glbInfo(model),
        mushroom: name in { Porcini: 1, Amanita: 1, Chanterelle: 1 },
    };
}

const PREFABS = {};
for (const [name, model] of Object.entries(USER_PREFABS)) PREFABS[name] = readUserPrefab(name, model);
for (const [name, [model, cast]] of Object.entries(NEW_PREFABS)) PREFABS[name] = writeNewPrefab(name, model, cast);

// ---------- розстановка ----------
// Камера дивиться з +Z, тож у кільці дерев лишаємо «стежку» в той бік.
const placed = []; // { prefab, group, x, z, rotY, scale, r }
const deg = (rad) => (rad * 180) / Math.PI;
const angleOf = (x, z) => deg(Math.atan2(x, z)); // 0° = напрям на камеру
const onPath = (x, z, halfWidth) => z > 0 && Math.abs(x) < halfWidth;
const nearCamera = (x, z) => z > 4.5 && Math.abs(x) < 6.5; // кущі й каміння тут закривали б кадр
const free = (x, z, r) => placed.every((p) => Math.hypot(p.x - x, p.z - z) >= p.r + r);

function put(prefab, group, x, z, { r = 0.3, scale = 1, rotY = range(0, 360), y = 0 } = {}) {
    const item = { prefab, group, x, z, y, rotY, scale, r };
    placed.push(item);
    return item;
}
function tryPut(prefab, group, sampler, opts = {}, attempts = 40) {
    for (let i = 0; i < attempts; i++) {
        const [x, z] = sampler();
        if (Math.hypot(x, z) > 19.2) continue;
        if (opts.avoidPath && onPath(x, z, opts.avoidPath)) continue;
        if (opts.avoidCamera && nearCamera(x, z)) continue;
        if (free(x, z, opts.r ?? 0.3)) return put(prefab, group, x, z, opts);
    }
    return null;
}
const ring = (rMin, rMax, a) => () => {
    const ang = ((a ?? range(0, 360)) * Math.PI) / 180;
    const rad = range(rMin, rMax);
    return [Math.sin(ang) * rad, Math.cos(ang) * rad];
};
const around = (cx, cz, rMin, rMax) => () => {
    const ang = range(0, Math.PI * 2);
    const rad = range(rMin, rMax);
    return [cx + Math.sin(ang) * rad, cz + Math.cos(ang) * rad];
};

// 1. Внутрішнє кільце: світлий мішаний ліс навколо галявини
const inner = [];
const INNER_COUNT = 13;
for (let i = 0; i < INNER_COUNT; i++) {
    const a = 28 + (304 / (INNER_COUNT - 1)) * i + range(-8, 8);
    const kind = pick({ Birch: 4, Oak: 3, Pine: 3 });
    const t = tryPut(kind, 'Trees', ring(8.5, 11.5, a), { r: 1.6, scale: range(0.85, 1.15), avoidPath: 2.2 });
    if (t) inner.push(t);
}
// 2. Зовнішнє кільце: темна стіна з сосен ховає край землі
const OUTER_COUNT = 22;
for (let i = 0; i < OUTER_COUNT; i++) {
    const a = 16 + (328 / (OUTER_COUNT - 1)) * i + range(-6, 6);
    const kind = pick({ Pine: 6, Birch: 2, Oak: 2 });
    tryPut(kind, 'Trees', ring(13.5, 18.5, a), { r: 1.7, scale: range(1.0, 1.3), avoidPath: 1.6 });
}

// 3. Великі камені біля краю галявини, дрібні — поруч з ними
const bigRocks = [];
for (const a of [-115, 70, 160]) {
    const rock = tryPut('RockBig', 'Rocks', ring(6.0, 7.5, a + range(-10, 10)), { r: 0.9, scale: range(0.8, 1.25), y: -0.06, avoidCamera: true });
    if (rock) bigRocks.push(rock);
}
for (const rock of bigRocks) {
    const n = 2 + Math.floor(range(0, 2));
    for (let i = 0; i < n; i++) tryPut('RockSmall', 'Rocks', around(rock.x, rock.z, 0.9, 1.6), { r: 0.3, scale: range(0.6, 1.3), y: -0.03 });
}
tryPut('RockSmall', 'Rocks', () => [range(-4, -2.5), range(-1, 1)], { r: 0.3, scale: 1.1 });

// 4. Кущі з ягодами між деревами
for (let i = 0; i < 6; i++) tryPut('Bush', 'Bushes', ring(6.5, 8.5), { r: 0.7, scale: range(0.85, 1.25), avoidPath: 2.5, avoidCamera: true });

// 5. Пеньок і колода
const stump = put('Stump', 'Props', 3.2, -1.8, { r: 0.4, scale: 1.1 });
const logAngle = 38;
const logPos = ring(6.2, 6.2, logAngle)();
put('Log', 'Props', logPos[0], logPos[1], { r: 1.2, rotY: logAngle + 90 + range(-10, 10) });

// 6. Гриби: де вони ростуть у справжньому лісі
//    боровик — біля дубів і сосен, мухомор — біля беріз, лисички — купками в моху та біля пенька
const mush = (kind, sampler, n = 1) => {
    for (let i = 0; i < n; i++) tryPut(kind, 'Mushrooms', sampler, { r: 0.18, scale: range(1.3, 1.7) });
};
const towardCenter = (t, dMin, dMax) => () => {
    const len = Math.hypot(t.x, t.z);
    const d = range(dMin, dMax);
    const side = range(-1.2, 1.2);
    return [t.x - (t.x / len) * d + (t.z / len) * side, t.z - (t.z / len) * d - (t.x / len) * side];
};
put('Porcini', 'Mushrooms', 0.6, 0.9, { r: 0.18, scale: 1.6 }); // «герой» у центрі кадру
const oaks = inner.filter((t) => t.prefab !== 'Birch').slice(0, 3);
const birches = inner.filter((t) => t.prefab === 'Birch').slice(0, 3);
for (const t of oaks) mush('Porcini', towardCenter(t, 1.6, 2.6), 2);
birches.forEach((t, i) => mush('Amanita', towardCenter(t, 1.6, 2.4), i === 0 ? 3 : 1));
mush('Chanterelle', around(stump.x, stump.z, 0.45, 0.9), 4);
mush('Chanterelle', around(-2.2, -3.0, 0.1, 0.6), 3);

// 7. Трава: пучки біля грибів, каміння й пенька + трохи по галявині
const anchors = placed.filter((p) => p.group === 'Mushrooms' || p.prefab === 'RockBig' || p.prefab === 'Stump');
for (const a of anchors) {
    const n = a.group === 'Mushrooms' ? 1 : 3;
    for (let i = 0; i < n; i++) tryPut('Grass', 'Grass', around(a.x, a.z, 0.3, 0.9), { r: 0.12, scale: range(0.9, 1.6) });
}
for (let i = 0; i < 14; i++) tryPut('Grass', 'Grass', ring(1.5, 8), { r: 0.15, scale: range(0.9, 1.5), avoidPath: 0.8 });

// ---------- збірка сцени ----------
const main = readJson(path.join(ASSETS, 'Main.scene'));
const sceneUuid = main[1]._id;
const findNode = (name) => main.findIndex((o) => o.__type__ === 'cc.Node' && o._name === name);

const out = [];
const add = (o) => (out.push(o), out.length - 1);
const ref = (id) => ({ __id__: id });

// копіюємо підграф вузла з Main.scene, переназначаючи __id__
function copyFrom(srcIndex, parentId, map = new Map()) {
    const order = [];
    const visit = (i) => {
        if (map.has(i)) return;
        map.set(i, -1); order.push(i);
        const walk = (v) => {
            if (v && typeof v === 'object') {
                if (typeof v.__id__ === 'number') visit(v.__id__);
                else for (const val of Object.values(v)) walk(val);
            }
        };
        for (const [key, val] of Object.entries(main[i])) if (key !== '_parent') walk(val);
    };
    visit(srcIndex);
    for (const i of order) map.set(i, out.push(null) - 1);
    const remap = (v) => {
        if (Array.isArray(v)) return v.map(remap);
        if (v && typeof v === 'object') {
            if (typeof v.__id__ === 'number') return { __id__: map.get(v.__id__) ?? v.__id__ };
            return Object.fromEntries(Object.entries(v).map(([k, val]) => [k, remap(val)]));
        }
        return v;
    };
    for (const i of order) {
        const o = remap(main[i]);
        if (i === srcIndex && '_parent' in o) o._parent = ref(parentId);
        out[map.get(i)] = o;
    }
    return map.get(srcIndex);
}

add({ ...main[0], scene: ref(1) });
const sceneNode = { ...main[1], _children: [] };
add(sceneNode);

for (const name of ['Main Light', 'Main Camera', 'Plane']) sceneNode._children.push(ref(copyFrom(findNode(name), 1)));

// камера над стежкою, дивиться в центр галявини
const cam = out[sceneNode._children[1].__id__];
const pitch = -deg(Math.atan2(3.0, 10));
const pr = (pitch * Math.PI) / 360;
cam._lpos = vec3(0, 3.5, 10);
cam._lrot = { __type__: 'cc.Quat', x: Math.sin(pr), y: 0, z: 0, w: Math.cos(pr) };
cam._euler = vec3(pitch, 0, 0);

function groupNode(name, parentId, mobility = 0) {
    const id = add({
        __type__: 'cc.Node', _name: name, _objFlags: 0, __editorExtras__: {}, _parent: ref(parentId), _children: [], _active: true, _components: [],
        _prefab: null, _lpos: vec3(0, 0, 0), _lrot: quatY(0), _lscale: vec3(1, 1, 1), _mobility: mobility, _layer: 1073741824, _euler: vec3(0, 0, 0), _id: fid('group:' + name),
    });
    out[parentId]._children.push(ref(id));
    return id;
}
const envId = groupNode('Environment', 1);
const groups = {
    Trees: groupNode('Trees', envId), Rocks: groupNode('Rocks', envId), Bushes: groupNode('Bushes', envId),
    Props: groupNode('Props', envId), Grass: groupNode('Grass', envId), Mushrooms: groupNode('Mushrooms', 1, 2),
};

const instanceRoots = [];
const counters = {};
const r3 = (v) => Math.round(v * 1000) / 1000;
for (const p of placed) {
    const pf = PREFABS[p.prefab];
    counters[p.prefab] = (counters[p.prefab] ?? 0) + 1;
    const name = `${p.prefab}-${String(counters[p.prefab]).padStart(2, '0')}`;
    const parentId = groups[p.group];
    const key = 'inst:' + name;

    const nodeId = add({ __type__: 'cc.Node', _objFlags: 0, _parent: ref(parentId), _prefab: null, __editorExtras__: {} });
    out[parentId]._children.push(ref(nodeId));
    instanceRoots.push(ref(nodeId));
    const infoId = add({ __type__: 'cc.PrefabInfo', root: ref(nodeId), asset: { __uuid__: pf.uuid, __expectedType__: 'cc.Prefab' }, fileId: pf.rootFid, instance: null, targetOverrides: null });
    out[nodeId]._prefab = ref(infoId);
    const instId = add({ __type__: 'cc.PrefabInstance', fileId: fid(key), prefabRootNode: null, mountedChildren: [], mountedComponents: [], propertyOverrides: [], removedComponents: [] });
    out[infoId].instance = ref(instId);

    const targets = new Map(); // localID -> id TargetInfo, один на кожну ціль
    const override = (localID, prop, value) => {
        const k = localID.join('/');
        if (!targets.has(k)) targets.set(k, add({ __type__: 'cc.TargetInfo', localID }));
        const ovId = add({ __type__: 'CCPropertyOverrideInfo', targetInfo: ref(targets.get(k)), propertyPath: [prop], value });
        out[instId].propertyOverrides.push(ref(ovId));
    };
    const rootLocal = [pf.rootFid];
    override(rootLocal, '_name', name);
    override(rootLocal, '_lpos', vec3(r3(p.x), p.y, r3(p.z)));
    override(rootLocal, '_lrot', quatY(r3(p.rotY)));
    override(rootLocal, '_euler', vec3(0, r3(p.rotY), 0));
    override(rootLocal, '_lscale', vec3(r3(p.scale), r3(p.scale), r3(p.scale)));
    if (pf.nestedFid) {
        // ваші префаби: увімкнути тіні моделі, а грибам зробити всю ієрархію Movable
        override([pf.nestedFid, pf.glb.compFid], '_shadowCastingMode', 1);
        if (pf.mushroom) {
            override([pf.nestedFid, pf.glb.rootFid], '_mobility', 2);
            override([pf.nestedFid, pf.glb.meshNodeFid], '_mobility', 2);
        }
    }
}

const scenePrefabInfo = add({ __type__: 'cc.PrefabInfo', root: ref(1), asset: null, fileId: sceneUuid, instance: null, targetOverrides: null, nestedPrefabInstanceRoots: instanceRoots });
sceneNode._prefab = ref(scenePrefabInfo);
sceneNode._globals = ref(copyFrom(main[1]._globals.__id__, null));

const sceneFile = path.join(ASSETS, 'Main.scene');
writeJson(sceneFile, out);

// розкладка для превʼю в Blender (art/glade_preview.py)
const MODEL_OF = { ...USER_PREFABS, ...Object.fromEntries(Object.entries(NEW_PREFABS).map(([k, v]) => [k, v[0]])) };
writeJson(path.join(ROOT, 'art', 'glade_layout.json'), {
    camera: { pos: [0, 3.5, 10], pitch },
    items: placed.map((p) => ({ model: MODEL_OF[p.prefab], x: p.x, y: p.y, z: p.z, rotY: p.rotY, scale: p.scale })),
});

const summary = {};
for (const p of placed) summary[p.prefab] = (summary[p.prefab] ?? 0) + 1;
console.log('seed', SEED, '| objects', placed.length, summary);
console.log('scene ->', path.relative(ROOT, sceneFile), '| uuid', sceneUuid);
