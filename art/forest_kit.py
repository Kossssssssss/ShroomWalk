"""Low-poly forest kit generator.

Run:  D:\\Blender\\blender.exe -b --factory-startup --python forest_kit.py -- [--render DIR]

Every model: origin at the bottom centre (ground contact), 1 unit = 1 m,
flat shading, one material with a shared 128x64 palette texture (colour = UV point).
"""
import bpy, bmesh, math, random, sys, os
from mathutils import Vector, noise

HERE = os.path.dirname(os.path.abspath(__file__))
OUT_DIR = os.path.normpath(os.path.join(HERE, "..", "assets", "models", "forest"))
BLEND_PATH = os.path.join(HERE, "forest_kit.blend")
PALETTE_PATH = os.path.join(HERE, "palette.png")

PALETTE = [
    ("stem_cream", "EDE3CF"), ("porcini_pores", "D9C27A"), ("porcini_cap", "8A5532"), ("porcini_cap_dark", "6E4127"),
    ("amanita_red", "D2382B"), ("amanita_red_dark", "A82820"), ("white", "F4F1EA"), ("chanterelle", "E89A2E"),
    ("chanterelle_light", "F2B655"), ("bark", "5E4331"), ("bark_dark", "46322A"), ("wood_light", "D8B07A"),
    ("wood_ring", "B98F5B"), ("pine", "2F6B45"), ("pine_dark", "24553A"), ("leaf", "5E9B3F"),
    ("leaf_light", "79B24A"), ("leaf_dark", "477F33"), ("birch_leaf", "9CC24D"), ("birch_leaf_light", "B5D35E"),
    ("birch_white", "E9E6DD"), ("birch_black", "2E2B2A"), ("rock", "8E9196"), ("rock_light", "A5A8AC"),
    ("rock_dark", "74777C"), ("moss", "6E8B4A"), ("grass", "6FA845"), ("grass_light", "8CC152"),
    ("berry", "C8324A"), ("pine_light", "3B7F52"), ("skin", "F0C39B"), ("jacket", "D9822B"),
]
C = {name: i for i, (name, _) in enumerate(PALETTE)}
SW, COLS, ROWS = 16, 8, 4


def swatch_uv(idx):
    col, row = idx % COLS, idx // COLS
    return ((col + 0.5) / COLS, 1.0 - (row + 0.5) / ROWS)


# ---------- geometry helpers (each returns a fresh bmesh; face.material_index = palette index) ----------

def lathe(profile, sides, colors, rot=0.0, jit=None):
    """Revolve (r, z) profile around Z. Traverse bottom->top along the outside so normals face out."""
    bm = bmesh.new()
    rings = []
    for i, (r, z) in enumerate(profile):
        if r < 1e-6:
            rings.append([bm.verts.new((0, 0, z))])
            continue
        ring = []
        for k in range(sides):
            a = rot + 2 * math.pi * k / sides
            p = Vector((r * math.cos(a), r * math.sin(a), z))
            if jit:
                p = jit(i, k, p)
            ring.append(bm.verts.new(p))
        rings.append(ring)
    for i in range(len(rings) - 1):
        A, B, col = rings[i], rings[i + 1], colors[i]
        for k in range(sides):
            k2 = (k + 1) % sides
            if len(A) == 1:
                f = bm.faces.new((A[0], B[k2], B[k]))
            elif len(B) == 1:
                f = bm.faces.new((A[k], A[k2], B[0]))
            else:
                f = bm.faces.new((A[k], A[k2], B[k2], B[k]))
            f.material_index = col
    return bm


def blob(center, radius, scale, amp, light, mid, dark, seed, subdiv=2):
    rnd = random.Random(seed)
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=subdiv, radius=radius)
    off = Vector((rnd.random() * 50, rnd.random() * 50, rnd.random() * 50))
    for v in bm.verts:
        n = v.co.normalized()
        v.co = v.co + n * noise.noise(v.co * (2.2 / radius) + off) * amp * radius
        v.co = Vector((v.co.x * scale[0], v.co.y * scale[1], v.co.z * scale[2])) + Vector(center)
    bm.normal_update()
    for f in bm.faces:
        nz = f.normal.z
        idx = light if nz > 0.45 else (dark if nz < -0.25 else mid)
        if rnd.random() < 0.18:
            idx = rnd.choice((light, mid, dark))
        f.material_index = idx
    return bm


def add(model, part):
    me = bpy.data.meshes.new("tmp")
    part.to_mesh(me)
    part.free()
    model.from_mesh(me)
    bpy.data.meshes.remove(me)


def bend(bm, fn):
    for v in bm.verts:
        dx, dy = fn(v.co.z)
        v.co.x += dx
        v.co.y += dy


def finish(name, bm):
    bm.normal_update()
    uv = bm.loops.layers.uv.new("UVMap")
    for f in bm.faces:
        u = swatch_uv(f.material_index)
        for loop in f.loops:
            loop[uv].uv = u
        f.material_index = 0
        f.smooth = False
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    me.materials.append(MATERIAL)
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    return obj


# ---------- models ----------

def mushroom_porcini():
    m = bmesh.new()
    prof = [(0.036, 0.0), (0.042, 0.035), (0.030, 0.105), (0.088, 0.104), (0.100, 0.122),
            (0.086, 0.160), (0.050, 0.184), (0.0, 0.194)]
    cols = [C["stem_cream"], C["stem_cream"], C["porcini_pores"], C["porcini_cap_dark"],
            C["porcini_cap"], C["porcini_cap"], C["porcini_cap"]]
    add(m, lathe(prof, 8, cols, rot=0.2))
    return finish("mushroom_porcini", m)


def mushroom_amanita():
    m = bmesh.new()
    prof = [(0.040, 0.0), (0.036, 0.022), (0.025, 0.045), (0.022, 0.125), (0.038, 0.118),
            (0.024, 0.138), (0.020, 0.200), (0.098, 0.192), (0.110, 0.205), (0.098, 0.242),
            (0.060, 0.270), (0.0, 0.280)]
    cols = [C["white"], C["white"], C["white"], C["white"], C["white"], C["white"], C["stem_cream"],
            C["amanita_red_dark"], C["amanita_red"], C["amanita_red"], C["amanita_red"]]
    add(m, lathe(prof, 9, cols))
    rnd = random.Random(7)
    for i in range(6):
        a = 2 * math.pi * i / 6 + rnd.uniform(-0.3, 0.3)
        t = rnd.uniform(0.15, 0.85)
        r = 0.098 + (0.060 - 0.098) * t
        z = 0.242 + (0.270 - 0.242) * t
        dot = bmesh.new()
        bmesh.ops.create_icosphere(dot, subdivisions=1, radius=1.0)
        s = rnd.uniform(0.010, 0.015)
        for v in dot.verts:
            v.co = Vector((v.co.x * s, v.co.y * s, v.co.z * s * 0.45)) + Vector((r * math.cos(a), r * math.sin(a), z + 0.002))
        for f in dot.faces:
            f.material_index = C["white"]
        add(m, dot)
    dot = bmesh.new()
    bmesh.ops.create_icosphere(dot, subdivisions=1, radius=1.0)
    for v in dot.verts:
        v.co = Vector((v.co.x * 0.016, v.co.y * 0.016, v.co.z * 0.006 + 0.281))
    for f in dot.faces:
        f.material_index = C["white"]
    add(m, dot)
    return finish("mushroom_amanita", m)


def mushroom_chanterelle():
    m = bmesh.new()
    prof = [(0.013, 0.0), (0.016, 0.040), (0.032, 0.068), (0.062, 0.088), (0.060, 0.100),
            (0.036, 0.096), (0.0, 0.086)]
    cols = [C["chanterelle_light"], C["chanterelle_light"], C["chanterelle_light"], C["chanterelle"],
            C["chanterelle"], C["chanterelle"]]

    def wave(i, k, p):
        if i in (3, 4):
            a = math.atan2(p.y, p.x)
            s = 1.0 + 0.12 * math.sin(a * 4 + 0.6)
            p = Vector((p.x * s, p.y * s, p.z + 0.008 * math.sin(a * 4)))
        return p

    add(m, lathe(prof, 10, cols, jit=wave))
    return finish("mushroom_chanterelle", m)


def tree_pine(seed=1):
    rnd = random.Random(seed)
    m = bmesh.new()
    add(m, lathe([(0.20, 0.0), (0.16, 0.6), (0.11, 1.3)], 6, [C["bark_dark"], C["bark"]]))
    tiers = [(1.65, 1.0, 2.1), (1.35, 2.25, 1.9), (1.02, 3.4, 1.7), (0.68, 4.45, 1.7)]
    for t, (R, z0, h) in enumerate(tiers):
        def jit(i, k, p, R=R):
            if i == 1:
                s = rnd.uniform(0.9, 1.08)
                p = Vector((p.x * s, p.y * s, p.z + rnd.uniform(-0.08, 0.08)))
            return p
        prof = [(R * 0.35, z0 + 0.22), (R, z0), (0.0, z0 + h)]
        top = C["pine"] if t % 2 == 0 else C["pine_light"]
        add(m, lathe(prof, 7, [C["pine_dark"], top], rot=rnd.uniform(0, 1), jit=jit))
    return finish("tree_pine", m)


def tree_oak(seed=3):
    m = bmesh.new()
    trunk = lathe([(0.26, 0.0), (0.20, 0.25), (0.16, 1.4), (0.13, 2.4)], 6,
                  [C["bark_dark"], C["bark"], C["bark"]])
    bend(trunk, lambda z: (0.08 * math.sin(z * 1.3), 0.0))
    add(m, trunk)
    L, M, D = C["leaf_light"], C["leaf"], C["leaf_dark"]
    add(m, blob((0.1, 0.0, 3.3), 1.45, (1.0, 1.0, 0.85), 0.22, L, M, D, seed))
    add(m, blob((-0.9, 0.35, 2.75), 0.95, (1.0, 1.0, 0.85), 0.25, L, M, D, seed + 1))
    add(m, blob((0.85, -0.45, 2.85), 0.9, (1.0, 1.0, 0.85), 0.25, L, M, D, seed + 2))
    return finish("tree_oak", m)


def tree_birch(seed=5):
    rnd = random.Random(seed)
    m = bmesh.new()
    prof = [(0.15, 0.0)] + [(0.14 - 0.012 * i, 0.55 * (i + 1)) for i in range(7)]
    trunk = lathe(prof, 6, [C["birch_white"]] * 7)
    for f in trunk.faces:
        if rnd.random() < 0.22:
            f.material_index = C["birch_black"]
    bend(trunk, lambda z: (0.05 * math.sin(z * 0.9), 0.04 * math.sin(z * 1.7)))
    add(m, trunk)
    L, M, D = C["birch_leaf_light"], C["birch_leaf"], C["leaf"]
    add(m, blob((0.1, 0.05, 4.4), 1.05, (0.95, 0.95, 1.35), 0.22, L, M, D, seed))
    add(m, blob((-0.45, -0.2, 3.35), 0.8, (1.0, 1.0, 1.15), 0.25, L, M, D, seed + 1))
    add(m, blob((0.5, 0.3, 3.0), 0.6, (1.0, 1.0, 1.1), 0.25, L, M, D, seed + 2))
    return finish("tree_birch", m)


def rock(name, size, seed):
    rnd = random.Random(seed)
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=2, radius=1.0)
    off = Vector((rnd.random() * 50, rnd.random() * 50, 0))
    sx, sy, sz = size[0] * rnd.uniform(0.9, 1.1), size[1], size[2]
    for v in bm.verts:
        d = 1.0 + 0.22 * noise.noise(v.co * 1.6 + off)
        v.co = Vector((v.co.x * d * sx, v.co.y * d * sy, v.co.z * d * sz))
    minz = min(v.co.z for v in bm.verts)
    for v in bm.verts:
        v.co.z -= minz + 0.12 * sz
        if v.co.z < 0:
            v.co.z *= 0.3
    bm.normal_update()
    for f in bm.faces:
        nz = f.normal.z
        if nz > 0.75 and rnd.random() < 0.75:
            f.material_index = C["moss"]
        elif nz > 0.2:
            f.material_index = rnd.choice((C["rock_light"], C["rock"]))
        else:
            f.material_index = rnd.choice((C["rock"], C["rock_dark"], C["rock_dark"]))
    m = bmesh.new()
    add(m, bm)
    return finish(name, m)


def bush(seed=11):
    rnd = random.Random(seed)
    m = bmesh.new()
    L, M, D = C["leaf_light"], C["leaf"], C["leaf_dark"]
    add(m, blob((0.0, 0.0, 0.42), 0.55, (1.0, 1.0, 0.8), 0.25, L, M, D, seed))
    add(m, blob((0.45, 0.2, 0.32), 0.42, (1.0, 1.0, 0.8), 0.25, L, M, D, seed + 1))
    add(m, blob((-0.38, 0.25, 0.3), 0.4, (1.0, 1.0, 0.8), 0.25, L, M, D, seed + 2))
    for i in range(6):
        a = 2 * math.pi * i / 6 + rnd.uniform(-0.4, 0.4)
        el = rnd.uniform(0.15, 0.75)
        d = Vector((math.cos(a) * math.cos(el), math.sin(a) * math.cos(el), math.sin(el)))
        p = Vector((0.6 * d.x, 0.6 * d.y, 0.42 + 0.5 * d.z))
        b = bmesh.new()
        bmesh.ops.create_icosphere(b, subdivisions=1, radius=0.045)
        for v in b.verts:
            v.co += p
        for f in b.faces:
            f.material_index = C["berry"]
        add(m, b)
    return finish("bush_berries", m)


def stump(seed=13):
    rnd = random.Random(seed)

    def roots(i, k, p):
        if i == 0:
            s = 1.0 + (0.35 if k % 2 == 0 else 0.0) * rnd.uniform(0.6, 1.0)
            p = Vector((p.x * s, p.y * s, p.z))
        return p

    prof = [(0.36, 0.0), (0.29, 0.10), (0.27, 0.42), (0.24, 0.45), (0.13, 0.45), (0.0, 0.45)]
    cols = [C["bark_dark"], C["bark"], C["wood_ring"], C["wood_light"], C["wood_ring"]]
    m = bmesh.new()
    add(m, lathe(prof, 8, cols, jit=roots))
    return finish("stump", m)


def log():
    prof = [(0.0, -1.2), (0.14, -1.2), (0.19, -1.17), (0.21, -1.12), (0.22, 0.0),
            (0.20, 1.12), (0.18, 1.17), (0.13, 1.2), (0.0, 1.2)]
    cols = [C["wood_ring"], C["wood_light"], C["bark_dark"], C["bark"], C["bark"],
            C["bark_dark"], C["wood_light"], C["wood_ring"]]
    bm = lathe(prof, 7, cols, rot=0.22)
    for v in bm.verts:
        x, y, z = v.co
        v.co = Vector((z, y, x + 0.19))
    m = bmesh.new()
    add(m, bm)
    return finish("log", m)


def grass_tuft(seed=17):
    rnd = random.Random(seed)
    bm = bmesh.new()
    for i in range(8):
        a = rnd.uniform(0, 2 * math.pi)
        r = rnd.uniform(0.0, 0.09)
        c = Vector((r * math.cos(a), r * math.sin(a), 0.0))
        h = rnd.uniform(0.18, 0.34)
        lean = Vector((math.cos(a), math.sin(a), 0)) * rnd.uniform(0.04, 0.10)
        rot = rnd.uniform(0, 2 * math.pi)
        base = [bm.verts.new(c + Vector((0.016 * math.cos(rot + j * 2.094), 0.016 * math.sin(rot + j * 2.094), 0)))
                for j in range(3)]
        tip = bm.verts.new(c + lean + Vector((0, 0, h)))
        col = C["grass_light"] if i % 2 else C["grass"]
        for j in range(3):
            f = bm.faces.new((base[j], base[(j + 1) % 3], tip))
            f.material_index = col
    m = bmesh.new()
    add(m, bm)
    return finish("grass_tuft", m)


# ---------- scene / material / export ----------

def reset_scene():
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    for coll in (bpy.data.meshes, bpy.data.materials, bpy.data.images, bpy.data.cameras, bpy.data.lights):
        for b in list(coll):
            coll.remove(b)


def make_palette():
    w, h = SW * COLS, SW * ROWS
    img = bpy.data.images.new("palette", w, h, alpha=False)
    px = [0.0] * (w * h * 4)
    for idx, (_, hexc) in enumerate(PALETTE):
        r, g, b = (int(hexc[i:i + 2], 16) / 255 for i in (0, 2, 4))
        col, row = idx % COLS, idx // COLS
        for y in range(SW):
            for x in range(SW):
                py = (ROWS - 1 - row) * SW + y
                p = (py * w + col * SW + x) * 4
                px[p:p + 4] = [r, g, b, 1.0]
    img.pixels = px
    img.filepath_raw = PALETTE_PATH
    img.file_format = "PNG"
    img.save()
    return img


def make_material(img):
    mat = bpy.data.materials.new("forest_palette")
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.image = img
    tex.interpolation = "Closest"
    nt.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = 1.0
    bsdf.inputs["Metallic"].default_value = 0.0
    return mat


def export_glb(obj):
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.export_scene.gltf(filepath=os.path.join(OUT_DIR, obj.name + ".glb"), export_format="GLB",
                              use_selection=True, export_yup=True, export_apply=True)


def tris(obj):
    return sum(len(p.vertices) - 2 for p in obj.data.polygons)


def render_row(objs, gap, path, height_hint):
    x = 0.0
    for o in objs:
        dims = o.dimensions
        o.location = (x + dims.x / 2, 0, 0)
        x += dims.x + gap
    width = x - gap
    for o in bpy.context.scene.objects:
        if o.type == "MESH":
            o.hide_render = o not in objs
    cam_data = bpy.data.cameras.new("cam")
    cam_data.lens = 50
    cam = bpy.data.objects.new("cam", cam_data)
    bpy.context.scene.collection.objects.link(cam)
    target = Vector((width / 2, 0, height_hint * 0.45))
    dist = max(width * 1.5, height_hint * 2.6)
    cam.location = target + Vector((0, -dist, dist * 0.42))
    cam.rotation_euler = (target - cam.location).to_track_quat("-Z", "Y").to_euler()
    sc = bpy.context.scene
    sc.camera = cam
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)
    bpy.data.objects.remove(cam, do_unlink=True)


def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    render_dir = argv[argv.index("--render") + 1] if "--render" in argv else None

    global MATERIAL
    reset_scene()
    os.makedirs(OUT_DIR, exist_ok=True)
    MATERIAL = make_material(make_palette())

    small = [mushroom_porcini(), mushroom_amanita(), mushroom_chanterelle(), grass_tuft()]
    large = [tree_pine(), tree_oak(), tree_birch(), bush(), rock("rock_big", (0.75, 0.6, 0.55), 21),
             rock("rock_small", (0.32, 0.27, 0.22), 23), stump(), log()]

    for o in small + large:
        o.location = (0, 0, 0)
        export_glb(o)
        print(f"MODEL {o.name}: {tris(o)} tris, {len(o.data.vertices)} verts, "
              f"size {o.dimensions.x:.2f} x {o.dimensions.y:.2f} x {o.dimensions.z:.2f} m")

    sc = bpy.context.scene
    sc.render.engine = "BLENDER_WORKBENCH"
    sc.display.shading.light = "STUDIO"
    sc.display.shading.color_type = "TEXTURE"
    sc.display.shading.show_shadows = True
    sc.display.shading.show_cavity = False
    if sc.world is None:
        sc.world = bpy.data.worlds.new("World")
    sc.world.color = (0.75, 0.82, 0.86)
    sc.render.resolution_x, sc.render.resolution_y = 1800, 700

    if render_dir:
        render_row(small, 0.08, os.path.join(render_dir, "preview_small.png"), 0.3)
        render_row(large, 1.0, os.path.join(render_dir, "preview_large.png"), 6.0)

    x = 0.0
    for o in small + large:
        o.hide_render = False
        o.location = (x, 0, 0)
        x += o.dimensions.x + 0.6
    bpy.ops.wm.save_as_mainfile(filepath=BLEND_PATH)


if __name__ == "__main__":
    main()
