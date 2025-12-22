import importlib
import json
import bpy
from bpy_types import Operator
import tempfile
from io import BytesIO 
from . import DEXF
from . import VPCUtilz
from . import CatalogUtils
from . import RoomBuilder2025

import requests

importlib.reload(DEXF)
importlib.reload(VPCUtilz)
importlib.reload(CatalogUtils)
importlib.reload(RoomBuilder2025)


class LoadVPCOperator(Operator):
    bl_idname = "object.rex_load_vpc_operator"
    bl_label = "Load VPC"

    def execute(self, context):
        self.report({'INFO'}, "LoadVPCOperator Executed")

        
        
        # Get VPC code and catalog path from the scene properties
        vpcCode = context.scene.rexTool.vpcCode
        if not vpcCode:
            self.report({'ERROR'}, "VPC code is not set.")
            return {'CANCELLED'}

        # Load the catalog JSON from the specified path
        catalogPath = context.scene.rexTool.catalogPath
        if not catalogPath:
            self.report({'ERROR'}, "Catalog path is not set.")
            return {'CANCELLED'}


        self.report({'INFO'}, f"Loding VPC Code: {vpcCode}")
        

        # Load the VPC code JSON
        vpcJSON = DEXF.loadVPCCode(vpcCode)
        
        # Load the catalog JSON
        with open(catalogPath) as json_file:
            catalogJSON = json.load(json_file)

        # Prepare the entity data from the VPC JSON
        hashedEntities = self.prepareEntityData(vpcJSON)
        hashedCatalogProducts = self.prepareCatalogData(catalogJSON)

        self.loadEntityModels(hashedEntities, hashedCatalogProducts)

        generateRoom = context.scene.rexTool.generateRoom
        generateCollisionWalls = context.scene.rexTool.generateCollisionWalls

        RoomBuilder2025.build(vpcJSON, generateRoom, generateCollisionWalls )

        return {'FINISHED'}
    

    def prepareEntityData(self, json_response):
        entities = json_response["configuration"]["content"]["entities"]
        hashedEntities = {}

        # Iterate over entities in VPC, cleans the data and adds missing fields
        for entity in entities:
            completeEntity = VPCUtilz.convertJSONVPCObject(entity)
            hashedEntities[completeEntity["id"]] = completeEntity
        return hashedEntities


    def prepareCatalogData(self, catalogJSON):
        hashedCatalogProducts = {}

        # Iterate over products in catalog, cleans the data and adds missing fields
        for product in catalogJSON["products"]:
            hashedCatalogProducts[product["id"]] = product
        return hashedCatalogProducts


    def loadModelFromUrl(self, url):
        local_path = tempfile.gettempdir() + '/' + 'temp.glb'
        response = requests.get(url, verify=True)
        with open(local_path, 'wb') as file:
            file.write(response.content)    
            
        return bpy.ops.import_scene.gltf(filepath = local_path)


    def transformModel(self, catalogProduct, entity):
        transformData = CatalogUtils.getModelTransformComponentData(catalogProduct)
        
        # Applying ModelTransformComponent data to the model
        if "rotation" in transformData:
            bpy.context.object.rotation_mode = 'XYZ'
            bpy.context.object.rotation_euler[0] = transformData["rotation"][0]
            bpy.context.object.rotation_euler[1] = transformData["rotation"][1]
            bpy.context.object.rotation_euler[2] = transformData["rotation"][2]
        
        if "position" in transformData:
            bpy.context.object.location[0] = transformData["position"][0]
            bpy.context.object.location[1] = transformData["position"][1]
            bpy.context.object.location[2] = transformData["position"][2]

        if "scale" in transformData:
            bpy.context.object.scale[0] = transformData["scale"][0]
            bpy.context.object.scale[1] = transformData["scale"][1]
            bpy.context.object.scale[2] = transformData["scale"][2]

        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)


        # Transform the model based on entity data
        bpy.context.object.rotation_mode = 'QUATERNION'
        
        bpy.ops.transform.translate(value=(entity["worldTransform"]["x"], 
                                           entity["worldTransform"]["z"] ,entity["worldTransform"]["y"]), 
                                           orient_type='GLOBAL', 
                                           orient_matrix=((1, 0, 0), (0, 1, 0), (0, 0, 1)), 
                                           orient_matrix_type='GLOBAL', 
                                           mirror=True, 
                                           use_proportional_edit=False,
                                           proportional_edit_falloff='SMOOTH', 
                                           proportional_size=1, 
                                           use_proportional_connected=False, 
                                           use_proportional_projected=False)
        bpy.context.object.rotation_quaternion[0] = entity["worldTransform"]["qw"]
        bpy.context.object.rotation_quaternion[1] = entity["worldTransform"]["qx"]
        bpy.context.object.rotation_quaternion[2] = -entity["worldTransform"]["qz"]      
        bpy.context.object.rotation_quaternion[3] = entity["worldTransform"]["qy"]



    def loadEntityModels(self, entities, hashedCatalogProducts):
        # Create a new collection
        collection_name = "Products"
        
        if collection_name in bpy.data.collections:
            product_collection = bpy.data.collections[collection_name]

        else:
            product_collection = bpy.data.collections.new(collection_name)
            bpy.context.scene.collection.children.link(product_collection)

        # Iterate over entities in VPC
        for e in entities:

            # Deselecting everything 
            bpy.ops.object.select_all(action='DESELECT')

            entity = entities[e]
            
            if entity["ref"] != "noValue" :
                ref = entity["ref"]
                #print("Entity:", entity)
                #print("Entity ref:", ref)
                
                if ref not in hashedCatalogProducts:
                    print("Reference not found in catalog:", ref)
                    continue

                catalogProduct = hashedCatalogProducts[ref]
                #print("Catalog Product:", catalogProduct)
                
                # Entity is a product
                modelPath = CatalogUtils.get3DModelPath(catalogProduct)
                if modelPath != "" :
                    print("Loading model for entity:", entity["id"], "from path:", modelPath)
                    self.loadModelFromUrl(modelPath)

                    # Hmmm is it ok to join.. really?
                    # Anyway... joining meshes to one
                    loaded_meshes = [obj for obj in bpy.context.selected_objects if obj.type == 'MESH']
                    
                    # Deselecting everything 
                    bpy.ops.object.select_all(action='DESELECT')

                    # Selecting the ones that are the meshes
                    for obj in loaded_meshes:
                        obj.select_set(True)

                    # Joining them together
                    if len(loaded_meshes) > 0:
                        bpy.context.view_layer.objects.active = loaded_meshes[0]
                        bpy.ops.object.join()

                        bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM')
                        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

                        # Transform the model based on entity data
                        self.transformModel(catalogProduct, entity)

                        self.moveToCollection(bpy.context.object, "Products")
                else:
                    # Its an empty entity, no model to load
                    # creating an empty for it
                    bpy.ops.object.empty_add(type='PLAIN_AXES', align='WORLD', location=(0, 0, 0), scale=(1, 1, 1))
                    self.transformModel(catalogProduct, entity)
                    self.moveToCollection(bpy.context.object, "Products")

        # Deselecting everything 
        bpy.ops.object.select_all(action='DESELECT')


    def moveToCollection(self, obj, collection_name):
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