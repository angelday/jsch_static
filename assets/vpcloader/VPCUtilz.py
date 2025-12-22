def convertJSONVPCObject(jsonObj) :
    print("Inside convertJSONVPCObject function")
    obj = {
        "id" : "noValue",
        "ref" : "noValue",
        "parent" : "noValue",
        "worldTransform" : {
            "x" : 0,
            "y" : 0,
            "z" : 0,
            "qw" : 1,
            "qx" : 0,
            "qy" : 0,
            "qz" : 0
        },
        "connection" : {
            "guestId": "noValue",
            "hostId": "noValue",
            "guestConnector": "noValue",
            "hostConnector": "noValue"        
        }
    }

    if "id" in jsonObj :
        if jsonObj["id"] != "" :
            obj["id"] = jsonObj["id"]

    if "ref" in jsonObj :
        if jsonObj["ref"] != "" :
            obj["ref"] = jsonObj["ref"]

    if "parent" in jsonObj :
        if jsonObj["parent"] != "" :
            obj["parent"] = jsonObj["parent"]

    wt = {
        "x" : 0,
        "y" : 0,
        "z" : 0,
        "qw" : 1,
        "qx" : 0,
        "qy" : 0,
        "qz" : 0
    }

    con = {
        "guestId": "noValue",
        "hostId": "noValue",
        "guestConnector": "noValue",
        "hostConnector": "noValue"        
    }

    if "c" in jsonObj :
        if "WorldTransformComponent" in jsonObj["c"]:
            transform = jsonObj["c"]["WorldTransformComponent"]
    
            xx = 0
            yy = 0
            zz = 0

            qw = 1
            qx = 0
            qy = 0
            qz = 0

            
            if "x" in transform["p"]:
                xx = transform["p"]["x"]/1000
            
            if "y" in transform["p"]:
                yy = transform["p"]["y"]/1000

            if "z" in transform["p"]:
                zz = -transform["p"]["z"]/1000

            if "w" in transform["r"]:
                qw = transform["r"]["w"]

            if "x" in transform["r"]:
                qx = transform["r"]["x"]

            if "y" in transform["r"]:
                qy = transform["r"]["y"]

            if "z" in transform["r"]:
                qz = transform["r"]["z"]

            wt["x"] = xx
            wt["y"] = yy
            wt["z"] = zz

            wt["qw"] = qw
            wt["qx"] = qx
            wt["qy"] = qy
            wt["qz"] = qz

        if "Connections" in jsonObj["c"]:
                connections = jsonObj["c"]["Connections"]
                if "connections" in connections :
                    if len(connections) == 1 :
                        con = connections["connections"][0]
                        con["guestId"] = con["guestId"]
                        con["hostId"] = con["hostId"]
                        con["guestConnector"] = con["guestConnector"]
                        con["hostConnector"] = con["hostConnector"]

    obj["worldTransform"] = wt
    obj["connection"] = con

    return obj

def printHelloWorld():
    print("Hello World from VPCUtilz.py")