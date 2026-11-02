# Превʼю розкладки Glade.scene у Blender (без Cocos).
# Запуск: D:\Blender\blender.exe -b --factory-startup --python glade_preview.py -- OUT_DIR
# Читає glade_layout.json (пише його art/glade_layout.mjs) і рендерить кадр з камери гри + вид зверху.
import bpy, json, math, os, sys
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = sys.argv[sys.argv.index("--") + 1] if "--" in sys.argv else HERE
MODELS = os.path.join(HERE, "..", "assets", "models", "forest")
layout = json.load(open(os.path.join(HERE, "glade_layout.json"), encoding="utf-8"))

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

def cocos_to_blender(x, y, z):
    return Vector((x, -z, y))

# моделі: імпортуємо кожну один раз, далі linked-копії
source = {}
for item in layout["items"]:
    name = item["model"]
    if name in source:
        continue
    bpy.ops.import_scene.gltf(filepath=os.path.join(MODELS, name + ".glb"))
    obj = [o for o in bpy.context.selected_objects if o.type == "MESH"][0]
    obj.hide_render = True
    obj.hide_viewport = True
    source[name] = obj

for item in layout["items"]:
    src = source[item["model"]]
    obj = bpy.data.objects.new(item["model"], src.data)
    scene.collection.objects.link(obj)
    obj.location = cocos_to_blender(item["x"], item["y"], item["z"])
    obj.rotation_euler = (0, 0, math.radians(item["rotY"]))
    obj.scale = (item["scale"],) * 3

# земля 40x40 як Plane зі scale 4
bpy.ops.mesh.primitive_plane_add(size=40)
ground = bpy.context.active_object
mat = bpy.data.materials.new("M_Ground")
mat.use_nodes = True
bsdf = mat.node_tree.nodes["Principled BSDF"]
bsdf.inputs["Base Color"].default_value = (*(pow(c / 255, 2.2) for c in (107, 143, 71)), 1)
bsdf.inputs["Roughness"].default_value = 1
ground.data.materials.append(mat)

# світло як Main Light: euler (-35, 45, 0), теплий колір
d = (-0.579, -0.574, -0.579)
sun_dir = cocos_to_blender(*d).normalized()
sun = bpy.data.objects.new("Sun", bpy.data.lights.new("Sun", "SUN"))
sun.data.energy = 4
sun.data.color = (1.0, 0.886, 0.722)
sun.data.angle = math.radians(2)
sun.rotation_euler = sun_dir.to_track_quat("-Z", "Y").to_euler()
scene.collection.objects.link(sun)

world = bpy.data.worlds.new("World")
world.use_nodes = True
bg = world.node_tree.nodes["Background"]
bg.inputs["Color"].default_value = (0.40, 0.55, 0.75, 1)
bg.inputs["Strength"].default_value = 0.9
scene.world = world

for engine in ("BLENDER_EEVEE", "BLENDER_EEVEE_NEXT", "BLENDER_WORKBENCH"):
    try:
        scene.render.engine = engine
        break
    except TypeError:
        pass
scene.view_settings.view_transform = "Standard"
scene.render.resolution_x, scene.render.resolution_y = 1280, 720

cam = bpy.data.objects.new("Camera", bpy.data.cameras.new("Camera"))
scene.collection.objects.link(cam)
scene.camera = cam

def render(name):
    scene.render.filepath = os.path.join(OUT, name)
    bpy.ops.render.render(write_still=True)

# 1. кадр з Main Camera: (0, 3.5, 10), pitch, FOV 50 по вертикалі
c = layout["camera"]
cam.location = cocos_to_blender(*c["pos"])
cam.rotation_euler = (math.radians(90 + c["pitch"]), 0, 0)
cam.data.sensor_fit = "VERTICAL"
cam.data.angle_y = math.radians(50)
render("glade_camera.png")

# 2. ближче, як гравець біля грибів
cam.location = cocos_to_blender(1.5, 1.2, 3.2)
cam.rotation_euler = (math.radians(90 - 14), 0, math.radians(14))
render("glade_close.png")

# 3. вид зверху
cam.data.type = "ORTHO"
cam.data.ortho_scale = 42
cam.location = (0, 0, 60)
cam.rotation_euler = (0, 0, 0)
scene.render.resolution_x = scene.render.resolution_y = 900
render("glade_top.png")
