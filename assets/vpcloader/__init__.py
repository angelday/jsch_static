bl_info = {
    "name": "VPCLoader",
    "author": "Daniel Segertun",
    "version": (1, 0),
    "blender": (4, 0, 0),
    "location": "View3D > Sidebar > VPCLoader",
    "description": "Works in Blender 4.x",
    "category": "3D View",
}

import os
import sys
import bpy
import importlib
from bpy.props import StringProperty, PointerProperty, BoolProperty
from bpy.types import Panel, PropertyGroup
from . import RexUtils
from . import LoadVPCOperator
from . import CameraOperator

#print("System paths", sys.path)


class RexProperties(PropertyGroup):
    vpcCode: StringProperty(
        name="VPC Code",
        description="Put VPC code here",
        default="VVPNLJ",
        maxlen=1024,
    )

    catalogPath: StringProperty(
        name="Catalog path",
        description="Put path here",
        default="/Users/daniel.segertun/workspace/cbf-re-ipex-utils/packages/blender/screensaver/catalogs/merged/catalog.json",
        maxlen=1024,
    )

    generateRoom: BoolProperty(
        name="Generate Walls",
        description="Enable to generate walls",
        default=True,
    )

    generateCollisionWalls: BoolProperty(
        name="Generate Collision Walls",
        description="Enable to generate collision walls",
        default=False,
    )    

class VPCLoaderPanel(Panel):
    bl_label = "VPCLoader Panel"
    bl_idname = "VIEW3D_PT_vpc_loader"
    bl_space_type = 'VIEW_3D'
    bl_region_type = 'UI'
    bl_category = "VPCLoader"

    def draw(self, context):
        layout = self.layout
        scene = context.scene
        mytool = scene.rexTool

        layout.prop(mytool, "vpcCode")
        layout.prop(mytool, "catalogPath")
        layout.prop(mytool, "generateRoom")
        layout.prop(mytool, "generateCollisionWalls")
        layout.operator("object.rex_load_vpc_operator")
        layout.separator()
        layout.label(text="Cameras", icon='MODIFIER')
        layout.operator("object.rex_camera_operator")
        
        layout.separator()

        layout.label(text="Modify selected", icon='MODIFIER')
        layout.operator("object.ipex_center_operator")
        layout.operator("object.ipex_mirrorx_operator")
        layout.operator("object.ipex_rotate90x_operator")
        layout.operator("object.ipex_rotate90y_operator")
        layout.operator("object.ipex_rotate90z_operator")



classes = (
    RexProperties,
    VPCLoaderPanel,
    RexUtils.MirrorXOperator,
    RexUtils.RecenterOperator,
    RexUtils.Rotate90XOperator,
    RexUtils.Rotate90YOperator,
    RexUtils.Rotate90ZOperator,
    LoadVPCOperator.LoadVPCOperator,
    CameraOperator.CameraOperator,
)


def register():
    print("Registering VPCLoader addon...")

    from bpy.utils import register_class

    for cls in classes:
        register_class(cls)

    bpy.types.Scene.rexTool = PointerProperty(type=RexProperties)


def unregister():
    from bpy.utils import unregister_class
    for cls in reversed(classes):
        unregister_class(cls)

    del bpy.types.Scene.rexTool


if __name__ == "__main__":
    register()
