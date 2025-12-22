
import math


def isAssembly(catalogProduct):
    if "template" in catalogProduct and "modelPath" in catalogProduct:
        template = catalogProduct["template"]
        if "parts" in template:
            return True
        
        if not "modelURI" in catalogProduct:
            return True
        
        if catalogProduct["modelURI"] == "":
            return True
    return False


def has3DModel(catalogProduct):
    if "modelURI" in catalogProduct:
        if catalogProduct["modelURI"] != "":
            return True
    return False

def get3DModelPath(catalogProduct):
    if "modelURI" in catalogProduct:
        if catalogProduct["modelURI"] != "":
            return catalogProduct["modelURI"]
    return ""

def getModelTransformComponentData(catalogProduct):
    transformData = {
        "rotation": [0, 0, 0],
        "position": [0, 0, 0],
        "scale": [1, 1, 1]
    }
    
    if "template" in catalogProduct:
        if "modelTransform" in catalogProduct["template"]:
            if "r" in catalogProduct["template"]["modelTransform"]:
                if "x" in catalogProduct["template"]["modelTransform"]["r"] :
                    transformData["rotation"][0] = math.radians(catalogProduct["template"]["modelTransform"]["r"]["x"])
                if "z" in catalogProduct["template"]["modelTransform"]["r"] :                    
                    transformData["rotation"][1] = -math.radians(catalogProduct["template"]["modelTransform"]["r"]["z"])
                if "y" in catalogProduct["template"]["modelTransform"]["r"] : 
                    transformData["rotation"][2] = math.radians(catalogProduct["template"]["modelTransform"]["r"]["y"])
                            
            if "p" in catalogProduct["template"]["modelTransform"]:
                if "x" in catalogProduct["template"]["modelTransform"]["p"] :
                    transformData["position"][0] = catalogProduct["template"]["modelTransform"]["p"]["x"] / 1000
                if "y" in catalogProduct["template"]["modelTransform"]["p"] :
                    transformData["position"][2] = catalogProduct["template"]["modelTransform"]["p"]["y"] / 1000
                if "z" in catalogProduct["template"]["modelTransform"]["p"] :
                    transformData["position"][1] = -catalogProduct["template"]["modelTransform"]["p"]["z"] / 1000
            
            if "s" in catalogProduct["template"]["modelTransform"]:
                if "x" in catalogProduct["template"]["modelTransform"]["s"] :
                    transformData["scale"][0] = catalogProduct["template"]["modelTransform"]["s"]["x"]
                if "y" in catalogProduct["template"]["modelTransform"]["s"] :
                    transformData["scale"][2] = catalogProduct["template"]["modelTransform"]["s"]["y"]
                if "z" in catalogProduct["template"]["modelTransform"]["s"] :
                    transformData["scale"][1] = catalogProduct["template"]["modelTransform"]["s"]["z"] 
    return transformData