"""Low-poly mushroom picker (player character) with a rigid-skinned rig and Idle / Walk / Run clips.

Run:  D:\\Blender\\blender.exe -b --factory-startup --python picker.py -- [--render DIR]

Same rules as forest_kit: origin at the feet, 1 unit = 1 m, flat shading, shared palette.
Faces Blender +Y, which becomes -Z in Cocos (Node.forward), so `node.forward = dir` turns the face to dir.
Every part belongs to exactly one bone (weight 1.0) - a low-poly "puppet", no bending.
Output: assets/models/characters/picker_rig.glb (the old static picker.glb is no longer written).
"""
import bpy, bmesh, math, os, sys
from mathutils import Vector, Matrix

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import forest_kit as fk
from forest_kit import C, lathe

OUT_DIR = os.path.normpath(os.path.join(HERE, "..", "assets", "models", "characters"))
NAME = "picker_rig"
FPS = 30

# bone: (head, tail, parent); +X is the character's right hand side
BONES = {
    "root": ((0, 0, 0), (0, 0, 0.25), None),
    "pelvis": ((0, 0, 0.56), (0, 0, 0.7), "root"),
    "leg_L": ((-0.1, 0, 0.56), (-0.1, 0, 0.08), "pelvis"),
    "leg_R": ((0.1, 0, 0.56), (0.1, 0, 0.08), "pelvis"),
    "spine": ((0, 0, 0.56), (0, 0, 1.1), "pelvis"),
    "head": ((0, 0, 1.13), (0, 0, 1.5), "spine"),
    "arm_L": ((-0.17, 0, 1.06), (-0.28, 0.02, 0.7), "spine"),
    "arm_R": ((0.17, 0, 1.06), (0.28, 0.11, 0.72), "spine"),
}
GROUPS = list(BONES)


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


def add(model, part, bone):
    """forest_kit.add + remember which bone owns the new vertices."""
    first = len(model.verts)
    fk.add(model, part)
    model.verts.ensure_lookup_table()
    deform = model.verts.layers.deform.verify()
    group = GROUPS.index(bone)
    for v in model.verts[first:]:
        v[deform][group] = 1.0


def picker():
    m = bmesh.new()
    boot, pants, jacket, skin = C["bark_dark"], C["rock_dark"], C["jacket"], C["skin"]

    for s, bone in ((-1, "leg_L"), (1, "leg_R")):
        x = 0.1 * s
        # черевик (носок вперед, +Y) і нога
        add(m, sphere((x, 0.03, 0.06), 0.085, (0.85, 1.25, 0.75), boot), bone)
        add(m, limb((x, 0, 0.08), (x, 0, 0.56), 0.072, 0.08, [boot, pants, pants]), bone)

    # куртка-дзвоник: ширша внизу, вужча на плечах
    prof = [(0.0, 0.5), (0.22, 0.5), (0.215, 0.62), (0.18, 0.86), (0.19, 1.02), (0.14, 1.12), (0.07, 1.16), (0.0, 1.16)]
    add(m, lathe(prof, 8, [jacket, jacket, jacket, jacket, jacket, jacket, skin], rot=math.pi / 8), "spine")

    # руки: ліва вільна, права тримає кошик трохи попереду
    add(m, limb((-0.17, 0, 1.06), (-0.27, 0.02, 0.74), 0.06, 0.05, [jacket, jacket, jacket]), "arm_L")
    add(m, sphere((-0.28, 0.02, 0.7), 0.055, (1, 1, 1), skin), "arm_L")
    add(m, limb((0.17, 0, 1.06), (0.27, 0.1, 0.76), 0.06, 0.05, [jacket, jacket, jacket]), "arm_R")
    add(m, sphere((0.28, 0.11, 0.72), 0.055, (1, 1, 1), skin), "arm_R")

    # кошик: плетена миска, ручка й два боровики в ньому — все на правій руці
    basket = lathe([(0.0, 0.0), (0.09, 0.0), (0.15, 0.12), (0.13, 0.12), (0.0, 0.05)], 8,
                   [C["wood_ring"], C["wood_light"], C["wood_ring"], C["wood_ring"]])
    add(m, transformed(basket, Matrix.Translation((0.33, 0.14, 0.5))), "arm_R")
    handle = lathe([(0.11, -0.012), (0.11, 0.012)], 8, [C["wood_ring"]])
    handle = transformed(handle, Matrix.Rotation(math.pi / 2, 4, "X"))
    for v in handle.verts:
        if v.co.z < -0.01:
            v.co.z = -0.01
    add(m, transformed(handle, Matrix.Translation((0.33, 0.14, 0.61)) @ Matrix.Rotation(math.pi / 2, 4, "Z")), "arm_R")
    add(m, sphere((0.30, 0.12, 0.62), 0.05, (1, 1, 0.6), C["porcini_cap"]), "arm_R")
    add(m, sphere((0.37, 0.17, 0.61), 0.045, (1, 1, 0.6), C["porcini_cap_dark"]), "arm_R")

    # голова (трохи завелика — так миліше) з очима й носом
    add(m, lathe([(0.0, 1.13), (0.12, 1.15), (0.18, 1.23), (0.195, 1.34), (0.175, 1.46), (0.1, 1.54), (0.0, 1.56)], 9,
                 [skin] * 6), "head")
    for s in (-1, 1):
        add(m, sphere((0.065 * s, 0.17, 1.35), 0.022, (1, 0.6, 1.3), C["birch_black"]), "head")
    add(m, sphere((0, 0.19, 1.3), 0.025, (1, 1, 1), skin), "head")

    # шапка-біні з помпоном
    add(m, lathe([(0.205, 1.38), (0.21, 1.44), (0.17, 1.58), (0.08, 1.66), (0.0, 1.68)], 9,
                 [C["white"], C["amanita_red"], C["amanita_red"], C["amanita_red"]]), "head")
    add(m, sphere((0, 0, 1.71), 0.055, (1, 1, 1), C["white"]), "head")

    obj = fk.finish(NAME, m)
    for bone in GROUPS:
        obj.vertex_groups.new(name=bone)
    return obj


def make_rig(mesh_obj):
    arm_data = bpy.data.armatures.new(NAME + "_armature")
    rig = bpy.data.objects.new("Armature", arm_data)
    bpy.context.scene.collection.objects.link(rig)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode="EDIT")
    for name, (head, tail, parent) in BONES.items():
        eb = arm_data.edit_bones.new(name)
        eb.head, eb.tail = head, tail
        if parent:
            eb.parent = arm_data.edit_bones[parent]
    bpy.ops.object.mode_set(mode="OBJECT")

    mesh_obj.parent = rig
    mod = mesh_obj.modifiers.new("Armature", "ARMATURE")
    mod.object = rig
    for pb in rig.pose.bones:
        pb.rotation_mode = "XYZ"
    return rig


def swing_world(rig, bone, angle):
    """Rotate a bone around the world X axis (forward/back swing) whatever its own axes are."""
    pb = rig.pose.bones[bone]
    rest = pb.bone.matrix_local.to_3x3()
    local_axis = rest.inverted() @ Vector((1, 0, 0))
    q = Matrix.Rotation(angle, 3, local_axis).to_quaternion()
    pb.rotation_euler = q.to_euler("XYZ")


def lift_world(rig, bone, dz):
    pb = rig.pose.bones[bone]
    rest = pb.bone.matrix_local.to_3x3()
    pb.location = rest.inverted() @ Vector((0, 0, dz))


def key_all(rig, frame):
    for pb in rig.pose.bones:
        pb.keyframe_insert("rotation_euler", frame=frame)
        pb.keyframe_insert("location", frame=frame)


def make_action(rig, name, frames, pose):
    """pose(t) sets the rig for phase t in [0, 1); the last key repeats the first so the loop is seamless."""
    act = bpy.data.actions.new(name)
    act.use_fake_user = True
    rig.animation_data.action = act
    for f in range(frames + 1):
        for pb in rig.pose.bones:
            pb.rotation_euler = (0, 0, 0)
            pb.location = (0, 0, 0)
        pose((f % frames) / frames)
        key_all(rig, f)
    return act


def idle(rig):
    def pose(t):
        s = math.sin(2 * math.pi * t)
        swing_world(rig, "arm_L", math.radians(3) * s)
        swing_world(rig, "arm_R", math.radians(-2) * s)
        swing_world(rig, "head", math.radians(2) * math.sin(2 * math.pi * t + 1.2))
    return make_action(rig, "Idle", 60, pose)


def gait(rig, name, frames, legs, arms, bob, lean):
    def pose(t):
        s = math.sin(2 * math.pi * t)
        # ноги в протифазі; рука йде разом з протилежною ногою, права з кошиком — удвічі менше
        swing_world(rig, "leg_L", math.radians(legs) * s)
        swing_world(rig, "leg_R", -math.radians(legs) * s)
        swing_world(rig, "arm_L", -math.radians(arms) * s)
        swing_world(rig, "arm_R", math.radians(arms) * 0.5 * s)
        # найвище — коли ноги під тілом, найнижче — у широкому кроці
        lift_world(rig, "pelvis", bob * (math.cos(4 * math.pi * t) - 1) / 2)
        swing_world(rig, "spine", math.radians(lean))
        swing_world(rig, "head", -math.radians(lean) * 0.6)
    return make_action(rig, name, frames, pose)


def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    render_dir = argv[argv.index("--render") + 1] if "--render" in argv else None

    fk.reset_scene()
    for a in list(bpy.data.actions):
        bpy.data.actions.remove(a)
    for a in list(bpy.data.armatures):
        bpy.data.armatures.remove(a)
    os.makedirs(OUT_DIR, exist_ok=True)
    fk.MATERIAL = fk.make_material(fk.make_palette())
    obj = picker()
    rig = make_rig(obj)
    rig.animation_data_create()
    sc = bpy.context.scene
    sc.render.fps = FPS

    # walk: 16 кадрів = 0.53 с на цикл; run: 12 кадрів = 0.4 с; кут нахилу «-» = вперед (до +Y)
    actions = [idle(rig), gait(rig, "Walk", 16, 32, 22, 0.025, -4), gait(rig, "Run", 12, 50, 40, 0.045, -12)]
    rig.animation_data.action = actions[0]

    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    rig.select_set(True)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.export_scene.gltf(filepath=os.path.join(OUT_DIR, NAME + ".glb"), export_format="GLB",
                              use_selection=True, export_yup=True, export_apply=False,
                              export_animations=True, export_animation_mode="ACTIONS",
                              export_frame_range=False, export_force_sampling=True)
    print(f"MODEL {NAME}: {fk.tris(obj)} tris, bones {len(BONES)}, actions {[a.name for a in actions]}")

    if render_dir:
        sc.render.engine = "BLENDER_WORKBENCH"
        sc.display.shading.light = "STUDIO"
        sc.display.shading.color_type = "TEXTURE"
        if sc.world is None:
            sc.world = bpy.data.worlds.new("World")
        sc.world.color = (0.75, 0.82, 0.86)
        sc.render.resolution_x, sc.render.resolution_y = 500, 500
        cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
        sc.collection.objects.link(cam)
        sc.camera = cam
        target = Vector((0, 0, 0.85))
        # вид збоку з +X: персонаж дивиться ліворуч кадру
        cam.location = target + Vector((3.2, 0, 0.3))
        cam.rotation_euler = (target - cam.location).to_track_quat("-Z", "Y").to_euler()
        for act, frame in ((actions[1], 4), (actions[1], 12), (actions[2], 3), (actions[0], 0)):
            rig.animation_data.action = act
            sc.frame_set(frame)
            sc.render.filepath = os.path.join(render_dir, f"{act.name}_{frame:02d}.png")
            bpy.ops.render.render(write_still=True)


main()
