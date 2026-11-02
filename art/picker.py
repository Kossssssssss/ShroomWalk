"""Low-poly mushroom picker (player character).

Run:  D:\\Blender\\blender.exe -b --factory-startup --python picker.py -- [--render DIR]

Same rules as forest_kit: origin at the feet, 1 unit = 1 m, flat shading, shared palette.
Faces Blender +Y, which becomes -Z in Cocos (Node.forward), so `node.forward = dir` turns the face to dir.
"""
import bpy, bmesh, math, os, sys
from mathutils import Vector, Matrix

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import forest_kit as fk
from forest_kit import C, lathe, add

OUT_DIR = os.path.normpath(os.path.join(HERE, "..", "assets", "models", "characters"))


def transformed(bm, mat):
    bmesh.ops.transform(bm, matrix=mat, verts=bm.verts)
    return bm


def sphere(center, radius, scale, color, subdiv=1):
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=subdiv, radius=radius)
    for v in bm.verts:
        v.co = Vector((v.co.x * scale[0], v.co.y * scale[1], v.co.z * scale[2])) + Vector(center)
    for f in bm.faces:
        f.material_index = color
    return bm


def limb(start, end, r0, r1, colors, sides=6):
    """Tapered tube from start to end (lathe along Z, then rotated into place)."""
    start, end = Vector(start), Vector(end)
    length = (end - start).length
    bm = lathe([(0.0, 0.0), (r0, 0.0), (r1, length), (0.0, length)], sides, colors)
    rot = Vector((0, 0, 1)).rotation_difference((end - start).normalized()).to_matrix().to_4x4()
    return transformed(bm, Matrix.Translation(start) @ rot)


def picker():
    m = bmesh.new()
    boot, pants, jacket, skin = C["bark_dark"], C["rock_dark"], C["jacket"], C["skin"]

    for s in (-1, 1):
        x = 0.1 * s
        # черевик (носок вперед, +Y) і нога
        add(m, sphere((x, 0.03, 0.06), 0.085, (0.85, 1.25, 0.75), boot))
        add(m, limb((x, 0, 0.08), (x, 0, 0.56), 0.072, 0.08, [boot, pants, pants]))

    # куртка-дзвоник: ширша внизу, вужча на плечах
    prof = [(0.0, 0.5), (0.22, 0.5), (0.215, 0.62), (0.18, 0.86), (0.19, 1.02), (0.14, 1.12), (0.07, 1.16), (0.0, 1.16)]
    add(m, lathe(prof, 8, [jacket, jacket, jacket, jacket, jacket, jacket, skin], rot=math.pi / 8))

    # руки: ліва вільна, права тримає кошик трохи попереду
    add(m, limb((-0.17, 0, 1.06), (-0.27, 0.02, 0.74), 0.06, 0.05, [jacket, jacket, jacket]))
    add(m, sphere((-0.28, 0.02, 0.7), 0.055, (1, 1, 1), skin))
    add(m, limb((0.17, 0, 1.06), (0.27, 0.1, 0.76), 0.06, 0.05, [jacket, jacket, jacket]))
    add(m, sphere((0.28, 0.11, 0.72), 0.055, (1, 1, 1), skin))

    # кошик: плетена миска, ручка й два боровики в ньому
    basket = lathe([(0.0, 0.0), (0.09, 0.0), (0.15, 0.12), (0.13, 0.12), (0.0, 0.05)], 8,
                   [C["wood_ring"], C["wood_light"], C["wood_ring"], C["wood_ring"]])
    add(m, transformed(basket, Matrix.Translation((0.33, 0.14, 0.5))))
    handle = lathe([(0.11, -0.012), (0.11, 0.012)], 8, [C["wood_ring"]])
    handle = transformed(handle, Matrix.Rotation(math.pi / 2, 4, "X"))
    for v in handle.verts:
        if v.co.z < -0.01:
            v.co.z = -0.01
    add(m, transformed(handle, Matrix.Translation((0.33, 0.14, 0.61)) @ Matrix.Rotation(math.pi / 2, 4, "Z")))
    add(m, sphere((0.30, 0.12, 0.62), 0.05, (1, 1, 0.6), C["porcini_cap"]))
    add(m, sphere((0.37, 0.17, 0.61), 0.045, (1, 1, 0.6), C["porcini_cap_dark"]))

    # голова (трохи завелика — так миліше) з очима й носом
    add(m, lathe([(0.0, 1.13), (0.12, 1.15), (0.18, 1.23), (0.195, 1.34), (0.175, 1.46), (0.1, 1.54), (0.0, 1.56)], 9,
                 [skin] * 6))
    for s in (-1, 1):
        add(m, sphere((0.065 * s, 0.17, 1.35), 0.022, (1, 0.6, 1.3), C["birch_black"]))
    add(m, sphere((0, 0.19, 1.3), 0.025, (1, 1, 1), skin))

    # шапка-біні з помпоном
    add(m, lathe([(0.205, 1.38), (0.21, 1.44), (0.17, 1.58), (0.08, 1.66), (0.0, 1.68)], 9,
                 [C["white"], C["amanita_red"], C["amanita_red"], C["amanita_red"]]))
    add(m, sphere((0, 0, 1.71), 0.055, (1, 1, 1), C["white"]))
    return fk.finish("picker", m)


def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    render_dir = argv[argv.index("--render") + 1] if "--render" in argv else None

    fk.reset_scene()
    os.makedirs(OUT_DIR, exist_ok=True)
    fk.MATERIAL = fk.make_material(fk.make_palette())
    obj = picker()
    fk.OUT_DIR = OUT_DIR
    fk.export_glb(obj)
    print(f"MODEL picker: {fk.tris(obj)} tris, size {obj.dimensions.x:.2f} x {obj.dimensions.y:.2f} x {obj.dimensions.z:.2f} m")

    if render_dir:
        sc = bpy.context.scene
        sc.render.engine = "BLENDER_WORKBENCH"
        sc.display.shading.light = "STUDIO"
        sc.display.shading.color_type = "TEXTURE"
        sc.display.shading.show_shadows = True
        if sc.world is None:
            sc.world = bpy.data.worlds.new("World")
        sc.world.color = (0.75, 0.82, 0.86)
        sc.render.resolution_x, sc.render.resolution_y = 900, 900
        cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
        sc.collection.objects.link(cam)
        sc.camera = cam
        target = Vector((0, 0, 0.85))
        for name, angle in (("picker_front.png", 25), ("picker_side.png", 115)):
            a = math.radians(angle)
            cam.location = target + Vector((math.sin(a) * 3.2, math.cos(a) * 3.2, 0.9))
            cam.rotation_euler = (target - cam.location).to_track_quat("-Z", "Y").to_euler()
            sc.render.filepath = os.path.join(render_dir, name)
            bpy.ops.render.render(write_still=True)


main()
