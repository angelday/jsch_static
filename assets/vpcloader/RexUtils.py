import bpy


class MirrorXOperator(bpy.types.Operator):
    "Mirror the model on X"
    bl_idname = "object.ipex_mirrorx_operator"
    bl_label = "MirrorX object"

    @classmethod
    def poll(cls, context):
        return context.active_object is not None

    def execute(self, context):
        bpy.ops.view3d.snap_cursor_to_center()
        for ob in context.selected_objects:
            bpy.ops.transform.resize(value=(-1, 1, 1), orient_type='VIEW', orient_matrix=((1, -0, -0), (-0, -1.34359e-07, 1), (0, -1, -1.34359e-07)), orient_matrix_type='VIEW', constraint_axis=(False, False, False), mirror=True, use_proportional_edit=False, proportional_edit_falloff='SMOOTH', proportional_size=1, use_proportional_connected=False, use_proportional_projected=False)
            bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
        return {'FINISHED'}


class RecenterOperator(bpy.types.Operator):
    "Origin to geometry (bounds) then recenter the model "
    bl_idname = "object.ipex_center_operator"
    bl_label = "Center object"

    @classmethod
    def poll(cls, context):
        return context.active_object is not None

    def execute(self, context):
        centerBounds(context)
        return {'FINISHED'}

class Rotate90XOperator(bpy.types.Operator):
    "Rotate around X"
    bl_idname = "object.ipex_rotate90x_operator"
    bl_label = "Rotate X 90"

    @classmethod
    def poll(cls, context):
        return context.active_object is not None

    def execute(self, context):
        bpy.ops.view3d.snap_cursor_to_center()
        for ob in context.selected_objects:
            bpy.ops.transform.rotate(value=1.5708, orient_axis='X', orient_type='GLOBAL', orient_matrix=((1, 0, 0), (0, 1, 0), (0, 0, 1)), orient_matrix_type='GLOBAL', constraint_axis=(False, False, False), mirror=True, use_proportional_edit=False, proportional_edit_falloff='SMOOTH', proportional_size=1, use_proportional_connected=False, use_proportional_projected=False)
            bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
        return {'FINISHED'}

class Rotate90YOperator(bpy.types.Operator):
    "Rotate around Y"
    bl_idname = "object.ipex_rotate90y_operator"
    bl_label = "Rotate Y 90"

    @classmethod
    def poll(cls, context):
        return context.active_object is not None

    def execute(self, context):
        bpy.ops.view3d.snap_cursor_to_center()
        for ob in context.selected_objects:
            bpy.ops.transform.rotate(value=1.5708, orient_axis='Y', orient_type='GLOBAL', orient_matrix=((1, 0, 0), (0, 1, 0), (0, 0, 1)), orient_matrix_type='GLOBAL', constraint_axis=(False, False, False), mirror=True, use_proportional_edit=False, proportional_edit_falloff='SMOOTH', proportional_size=1, use_proportional_connected=False, use_proportional_projected=False)
            bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
        return {'FINISHED'}

class Rotate90ZOperator(bpy.types.Operator):
    "Rotate around Z"
    bl_idname = "object.ipex_rotate90z_operator"
    bl_label = "Rotate Z 90"

    @classmethod
    def poll(cls, context):
        return context.active_object is not None

    def execute(self, context):
        bpy.ops.view3d.snap_cursor_to_center()
        for ob in context.selected_objects:
            bpy.ops.transform.rotate(value=1.5708, orient_axis='Z', orient_type='GLOBAL', orient_matrix=((1, 0, 0), (0, 1, 0), (0, 0, 1)), orient_matrix_type='GLOBAL', constraint_axis=(False, False, True), mirror=True, use_proportional_edit=False, proportional_edit_falloff='SMOOTH', proportional_size=1, use_proportional_connected=False, use_proportional_projected=False)
            bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
        return {'FINISHED'}

def centerBounds(context):
    for ob in context.selected_objects:
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
        bpy.ops.object.origin_set(type='ORIGIN_GEOMETRY', center='BOUNDS')
        bpy.ops.object.location_clear(clear_delta=False)
        bpy.ops.object.rotation_clear(clear_delta=False)
        bpy.ops.object.scale_clear(clear_delta=False)
        bpy.context.object.location[0] = 0
        bpy.context.object.location[1] = 0
        bpy.context.object.location[2] = 0
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)