import bpy
from bpy_types import Operator

class CameraOperator(Operator):
    bl_idname = "object.rex_camera_operator"
    bl_label = "Next camera"

    def execute(self, context):
        self.report({'INFO'}, "CameraOperator Executed")
        
        # Cycle through cameras in the scene
        cycle_cameras()
        
        return {'FINISHED'}
        


def cycle_cameras():
    # Get all camera objects
    cameras = [obj for obj in bpy.data.objects if obj.type == 'CAMERA']
    if not cameras:
        print("No cameras found.")
        return

    # Sort cameras to have a consistent order
    cameras.sort(key=lambda cam: cam.name)

    current_camera = bpy.context.scene.camera
    try:
        current_index = cameras.index(current_camera)
    except ValueError:
        current_index = -1

    next_index = (current_index + 1) % len(cameras)
    next_camera = cameras[next_index]

    # Set as scene's active camera
    bpy.context.scene.camera = next_camera

    # Ensure all 3D views switch to camera view
    for area in bpy.context.screen.areas:
        if area.type == 'VIEW_3D':
            for space in area.spaces:
                if space.type == 'VIEW_3D':
                    space.region_3d.view_perspective = 'CAMERA'