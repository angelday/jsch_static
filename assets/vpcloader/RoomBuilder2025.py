import math
import bpy
import bmesh
import requests
import tempfile

from mathutils import Quaternion

def loadModelFromUrl(url):
    print("Loading model from url: ", url)
    local_path = tempfile.gettempdir() + '/' + 'temp.glb'
    print("Local path: ", local_path)
    response = requests.get(url, verify=True)
    print("Response: ", response)
    with open(local_path, 'wb') as file:
        file.write(response.content)    
        
    return bpy.ops.import_scene.gltf(filepath = local_path)

def create_surface(name, points, flipNormal=False, generateCollisionWalls=False):
    mesh = bpy.data.meshes.new(name)
    obj = bpy.data.objects.new(name+"-col", mesh)

    bpy.context.collection.objects.link(obj)

    bm = bmesh.new()
    
    # Ensure the UV layer is named "UVMap"
    uv_layer = bm.loops.layers.uv.get("UVMap") or bm.loops.layers.uv.new("UVMap")
    for p in points:
        bm.verts.new((p['x']/1000 if 'x' in p else 0, -p['z']/1000 if 'z' in p else 0, p['y']/1000 if 'y' in p else 0))

    face = bm.faces.new(bm.verts)
    bm.normal_update()

    if generateCollisionWalls:
        # Extrude the face
        extrude_result = bmesh.ops.extrude_face_region(bm, geom=[face])
        geom_extruded = extrude_result['geom']

        # Get only the new vertices from the extrusion
        verts_extruded = [ele for ele in geom_extruded if isinstance(ele, bmesh.types.BMVert)]


        # Move the extruded vertices along the face normal
        normal = face.normal.normalized()
        bmesh.ops.translate(bm, verts=verts_extruded, vec=normal*0.1)


        # Recalculate normals to point outside
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    
    # Assign UV coordinates
    for loop in face.loops:
        loop[uv_layer].uv = (loop.vert.co.x, loop.vert.co.y)

    bm.to_mesh(mesh)
    bm.free()

    # Unwrap UVs
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.unwrap(method='ANGLE_BASED', margin=0.001)
    bpy.ops.object.mode_set(mode='OBJECT')
    return obj

def setMaterial(obj, materialName) :
    mat = bpy.data.materials.get(materialName)
    if mat is not None:
        obj.data.materials.append(mat)


import bpy

def scaleMaterial(material):
    if not material or not material.use_nodes:
        raise Exception("Material not found or doesn't use nodes.")

    nodes = material.node_tree.nodes
    links = material.node_tree.links

    # Add a Texture Coordinate node if it doesn't exist
    tex_coord = nodes.get("Texture Coordinate")
    if not tex_coord:
        tex_coord = nodes.new(type="ShaderNodeTexCoord")
        tex_coord.location = (-800, 0)

    # Add a Mapping node if it doesn't exist
    mapping = nodes.get("Mapping")
    if not mapping:
        mapping = nodes.new(type="ShaderNodeMapping")
        mapping.location = (-600, 0)

    # Link Texture Coordinate to Mapping
    links.new(tex_coord.outputs['UV'], mapping.inputs['Vector'])

    # Find the Principled BSDF and add an Image Texture node if needed
    bsdf = nodes.get("Principled BSDF")
    image_tex = None
    for node in nodes:
        if node.type == 'TEX_IMAGE':
            image_tex = node
            break

    if not image_tex:
        image_tex = nodes.new(type="ShaderNodeTexImage")
        image_tex.location = (-400, 0)

    # Link Mapping to Image Texture
    links.new(mapping.outputs['Vector'], image_tex.inputs['Vector'])

    # Link Image Texture to BSDF (Color input)
    links.new(image_tex.outputs['Color'], bsdf.inputs['Base Color'])

    # Set the UV scale (e.g., 2x scale)
    mapping.inputs['Scale'].default_value = (2.0, 2.0, 2.0)

    return material
    # Get the material (assumes it's already created and uses nodes)
    material = bpy.data.materials.get("CustomColorMaterial")

    print("UV scaling applied to material.")


def setKvadratMaterial(obj, entity) :
    if "kv-material" in entity["c"] :
        kv_material = entity["c"]["kv-material"]
        # Check if the material has a color code
        if "colorCode" in kv_material:
            print("Material color code:", kv_material["colorCode"])

            material = bpy.data.materials.new(name="CustomColorMaterial")


            material.use_nodes = True
            material.use_backface_culling = True

            # Step 2: Set the base color to #D0CCC4
            hex_color = kv_material["colorCode"]
            rgb = tuple(int(hex_color[i:i+2], 16)/255 for i in (1, 3, 5))
            bsdf = material.node_tree.nodes.get("Principled BSDF")
            bsdf.inputs['Base Color'].default_value = (*rgb, 1)
            # RGBA
            if obj.data.materials:
                obj.data.materials[0] = material
            else:
                obj.data.materials.append(material)

        elif "url" in kv_material:
            if kv_material["url"] != "":
                print("Material URL:", kv_material["url"])
                bpy.ops.object.select_all(action='DESELECT')
                matModel = loadModelFromUrl(kv_material["url"])

                imported_objects = bpy.context.selected_objects
                imported_obj = imported_objects[0] if imported_objects else None

                
                if imported_obj and imported_obj.data.materials:
                    mat = imported_obj.data.materials[0]
                    mat.use_backface_culling = True


                    for node in mat.node_tree.nodes:
                        if node.type == 'MAPPING':

                            new_scale = (20.0, 20.0, 20.0)

                            node.inputs['Scale'].default_value = new_scale
                            print(f"Updated Mapping node '{node.name}' scale to {new_scale}")


                    if mat is not None:
                         if obj.data.materials:
                            obj.data.materials[0] = mat
                         else:
                            obj.data.materials.append(mat)
                    else:
                        print("Material not found in Blender data.")
                else:
                    print("Failed to load material model from URL.")

                bpy.ops.object.delete(use_global=False)
    else:
        material = bpy.data.materials.new(name="CustomColorMaterial")

        material.use_nodes = True
        material.use_backface_culling = True

        # Step 2: Set the base color to #D0CCC4
        hex_color = "#BBBBBB"
        rgb = tuple(int(hex_color[i:i+2], 16)/255 for i in (1, 3, 5))
        bsdf = material.node_tree.nodes.get("Principled BSDF")
        bsdf.inputs['Base Color'].default_value = (*rgb, 1)
        # RGBA
        if obj.data.materials:
            obj.data.materials[0] = material
        else:
            obj.data.materials.append(material)


# Apply visibility settings to a LayerCollection and all its children
def apply_visibility_recursive(layer_coll):
    #layer_coll.exclude = True
    layer_coll.hide_viewport = True
    layer_coll.hide_render = True
    layer_coll.hide_select = True
    for child in layer_coll.children:
        apply_visibility_recursive(child)

def rotateActiveObject(trans):
    if "r" in trans:
        # Define the quaternion
        quat = Quaternion((trans["r"]["w"], trans["r"]["x"], trans["r"]["z"], trans["r"]["y"]))

        bpy.context.object.rotation_mode = 'QUATERNION'
        bpy.context.object.rotation_quaternion = quat

        bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)


def rotateObject(trans, obj):
    if "r" in trans:
        quat = Quaternion((
            trans["r"]["w"],
            trans["r"]["x"],
            trans["r"]["z"],
            trans["r"]["y"]
        ))
        obj.rotation_mode = 'QUATERNION'
        obj.rotation_quaternion = quat

                 

def setMaterialOnActiveObject():
    # Create a new material
    mat = bpy.data.materials.new(name="DoorMtrl")
    mat.use_nodes = True # Enable node-based material

    # Set the base color (RGBA)
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = (0.9, 0.9, 1.0, 1.0) # Red color

    # Assign the material to the cube
    if bpy.context.object.data.materials:
        bpy.context.object.data.materials[0] = mat
    else:
        bpy.context.object.data.materials.append(mat)

def moveToCollection(obj, collection_name):
    # Check if the collection exists
    if collection_name in bpy.data.collections:
        collection = bpy.data.collections[collection_name]
    else:
        # Create a new collection if it doesn't exist
        collection = bpy.data.collections.new(collection_name)
        bpy.context.scene.collection.children.link(collection)

    # Unlink the object from all collections
    for coll in obj.users_collection:
        coll.objects.unlink(obj)

    # Link the object to the specified collection
    collection.objects.link(obj)

# This function formats the transform data to a standard structure
def formatTransform(transform):
    newTransform = {
                "p": {
                    "x": 0,
                    "y": 0,
                    "z": 0
                },
                "r": {
                    "w": 1,
                    "x": 0,
                    "y": 0,
                    "z": 0
                }
            }
    if "p" in transform:
        if "x" in transform["p"]:
            newTransform["p"]["x"] = transform["p"]["x"]
        if "y" in transform["p"]:
            newTransform["p"]["y"] = transform["p"]["y"]
        if "z" in transform["p"]:   
            newTransform["p"]["z"] = transform["p"]["z"]
    if "r" in transform:
        if "w" in transform["r"]:
            newTransform["r"]["w"] = transform["r"]["w"]
        if "x" in transform["r"]:
            newTransform["r"]["x"] = transform["r"]["x"]
        if "y" in transform["r"]:
            newTransform["r"]["y"] = transform["r"]["y"]
        if "z" in transform["r"]:
            newTransform["r"]["z"] = transform["r"]["z"]
    return newTransform


    
def build(json_response, generateRoom=True, generateCollisionWalls=False):
    entities = json_response["configuration"]["content"]["entities"]

    hashedKvadratObject = {}
    hashedKvadratSurfaces = {}
    hashedKvObjects = {}
    hashedKvObsticles = []

    # Hashing all kvadrat id:n
    # and filtering them into different lists
    for entity in entities:
        print("Ref:", entity["ref"])
        if "ref" in entity:
            print("Ref2:", entity["ref"])
            if "kvadrat-obstacle" == entity["ref"] :
                hashedKvObsticles.append(entity)
        if "c" in entity:
            if "kv-id" in entity["c"] :
                e = entity["c"]["kv-id"]["id"]
                hashedKvadratObject[e] = entity
            if "kv-surface" in entity["c"] :
                e = entity["c"]["kv-id"]["id"]
                hashedKvadratSurfaces[e] = entity
            if "kv-parametric-object" in entity["c"] :
                e = entity["c"]["kv-id"]["id"]
                hashedKvObjects[e] = entity

    if ( bpy.data.objects.get("room-window-2") is None or bpy.data.objects.get("room-door-2") is None or bpy.data.node_groups.get("VertOffGeo") is None):
        print("Required objects or node group not found to generate proportional windows and doors.")
        for door in hashedKvObjects:
            kvSize = hashedKvObjects[door]["c"]["kv-parametric-object"]["size"]
            p = formatTransform(hashedKvObjects[door]["c"]["WorldTransformComponent"])["p"]

            bpy.ops.mesh.primitive_cube_add(size=1, enter_editmode=False, align='WORLD', location=(p["x"]/1000, -p["z"]/1000, p["y"]/1000), scale=(kvSize["X"]/1000, 0.22, kvSize["Y"]/1000))

            trans = formatTransform(hashedKvObjects[door]["c"]["WorldTransformComponent"])
            rotateActiveObject(trans)
            setMaterialOnActiveObject()
            # Adding the cube to the 
            moveToCollection(bpy.context.object, "BooleanCollection")
                
            #bpy.context.object.hide_viewport = True
            bpy.context.object.hide_render = True
    else :
        for door in hashedKvObjects:
            kvSize = hashedKvObjects[door]["c"]["kv-parametric-object"]["size"]
            p = formatTransform(hashedKvObjects[door]["c"]["WorldTransformComponent"])["p"]

            bpy.ops.mesh.primitive_cube_add(size=1, enter_editmode=False, align='WORLD', location=(p["x"]/1000, (-p["z"]/1000), 0.0005+p["y"]/1000), scale=(kvSize["X"]/1000, 0.444, kvSize["Y"]/1000))

            trans = formatTransform(hashedKvObjects[door]["c"]["WorldTransformComponent"])
            rotateActiveObject(trans)
            setMaterialOnActiveObject()
            # Adding the cube to the 
            moveToCollection(bpy.context.object, "BooleanCollection")
                
            bpy.context.object.hide_viewport = True
            bpy.context.object.hide_render = True
            
            if "ref" in hashedKvObjects[door] and hashedKvObjects[door]["ref"] == "kvadrat-window":
                original = bpy.data.objects.get("room-window-2")
            elif "ref" in hashedKvObjects[door] and hashedKvObjects[door]["ref"] == "kvadrat-door":
                original = bpy.data.objects.get("room-door-2")
            else:
                original = bpy.data.objects.get("room-door-3")

            if original is None:
                raise ValueError("Object named 'window' not found.")

            # Step 2: Duplicate the object
            clone = original.copy()
            clone.data = original.data.copy()
            bpy.context.collection.objects.link(clone)

            # Step 3: Add the Geometry Nodes modifier to the clone
            modifier = clone.modifiers.new(name="VertOffGeo", type='NODES')
            if not modifier:
                raise ValueError("Modifier 'VertOffGeo' not found.")


            # Step 4: Assign the node group (make sure it exists in your file)
            node_group = bpy.data.node_groups.get("VertOffGeo")
            if node_group is None:
                raise ValueError("Node group 'VertOffGeo' not found.")
            modifier.node_group = node_group

            # Set values using known input identifiers
            modifier["Socket_2"] = kvSize["X"]/1000 # x_size_in_m
            modifier["Socket_4"] = kvSize["Y"]/1000# y_size_in_m
            modifier["Socket_3"] = 0.03 # z_size_in_m

            trans = formatTransform(hashedKvObjects[door]["c"]["WorldTransformComponent"])
            
            clone.location[0] = (p["x"]/1000)
            clone.location[2] = (p["y"]/1000)
            clone.location[1] = -(p["z"]/1000)
            rotateObject(trans , clone)

            clone.hide_viewport = False
            clone.hide_render = False

            # Adding the clone to the boolean collection
            moveToCollection(clone, "Room")
        
        
    for surface in hashedKvadratSurfaces:
        points = []
        for point in hashedKvadratSurfaces[surface]["c"]["kv-surface"]["cornerPersistentIds"]:
            p = formatTransform(hashedKvadratObject[point]["c"]["WorldTransformComponent"])["p"]
            points.append(p)

        roomSurface = create_surface(surface, points, False, generateCollisionWalls)

        moveToCollection(roomSurface, "Room")

        setKvadratMaterial(roomSurface, hashedKvadratSurfaces[surface])


        # Add Boolean modifier to the first cube
        # Cutting hole in the walls. 
        if bpy.data.collections["BooleanCollection"] is not None:
            bool_mod = roomSurface.modifiers.new(name="Boolean", type='BOOLEAN')
            bool_mod.operation = 'DIFFERENCE'
            bool_mod.solver = 'EXACT'
            bool_mod.use_self = False
            bool_mod.use_hole_tolerant = False
            bool_mod.material_mode = 'INDEX'
            bool_mod.operand_type = 'COLLECTION'
            bool_mod.collection = bpy.data.collections["BooleanCollection"]        
        

    for obs in hashedKvObsticles:
        kvSize = obs["c"]["params"]["size"]
        p = formatTransform(obs["c"]["WorldTransformComponent"])["p"]

        bpy.ops.mesh.primitive_cube_add(size=1, enter_editmode=False, align='WORLD', location=(p["x"]/1000, -p["z"]/1000, p["y"]/1000), scale=(kvSize["depth"]/1000, kvSize["width"]/1000, kvSize["height"]/1000))
        trans = formatTransform(hashedKvObjects[door]["c"]["WorldTransformComponent"])
        rotateActiveObject(trans)
        setMaterialOnActiveObject()

        moveToCollection(bpy.context.object, "Room")
