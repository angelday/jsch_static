import requests

DEXF_API_KEY = "8eddfe53-9b0f-4d10-bc8f-f380c821664b"
DEXF_PRODUCT_URL = "https://api.dexf.ikea.com/product/v1/query"

hashedData = {}

def cacheProducts(products) :
    for prod in products :
        hashedData[prod["itemId"]] = prod

def loadProduct(product):
    response = requests.get(
    DEXF_PRODUCT_URL + "?filter.itemId=" + product + "&fields=assetV2",
    params={},
    headers={'DEXF-API-KEY': DEXF_API_KEY},
    )
    json_response = response.json()
    
    if "data" in json_response :
        cacheProducts(json_response["data"])
    
    return json_response

def loadVPCCode(code):
    response = requests.get(
    'https://api.dexf.ikea.com/vpc/v1/configurations/retailunit/SE/locale/sv-SE/'+code,
    params={},
    headers={'DEXF-API-KEY': '8eddfe53-9b0f-4d10-bc8f-f380c821664b'},
    )
    json_response = response.json()
    return json_response

def getProduct(productId) :
    if (productId in hashedData) :
        return hashedData[productId]
    
    loadProduct(productId)

    if (productId in hashedData) :
        return hashedData[productId]

    return None

def getMainTypeCode(productId) :
    productData = getProduct(productId)
    if productData is not None :
        if "valid" in productData :
            if productData["valid"] == True :
                if "mainTypeCode" in productData["content"] :
                    return productData["content"]["mainTypeCode"]
    return "noValue"

def getProductContent(productId) :
    productData = getProduct(productId)
    if productData is not None :
        if "valid" in productData :
            if productData["valid"] == True :
                return productData["content"]
    return None

def getAssetV2Content(productId, assetName, levelOfDetail="rt") :
    productData = getProduct(productId)
    if productData is not None :
        if "valid" in productData :
            if productData["valid"] == True :
                if "assetV2" in productData["content"] :
                    for asset in productData["content"]["assetV2"]:
                        if asset["name"] == assetName:
                            for model in asset["model"]:
                                if model["levelOfDetail"] == levelOfDetail:
                                    return model["url"]
    return None


def printAllMainTypeNames() :
    for k, v in hashedData.items():
        productData = v
        if "valid" in productData :
            if productData["valid"] == True :
                content = productData["content"]
                mainTypeName = "No mainTypeName"
                mainTypeCode = "No mainTypeCode"
                typeName = "No typeName"
                typeCode = "No typeCode"
                if "mainTypeCode" in content:
                    mainTypeCode = content["mainTypeCode"]
                if "mainTypeName" in content:
                    mainTypeName = content["mainTypeName"]
                if "typeName" in content:
                    typeName = content["typeName"]
                if "typeCode" in content:
                    typeCode = content["typeCode"]

                print(mainTypeName + "(" + mainTypeCode + ")")
                print("--" + typeName + "(" + typeCode + ")")

def helloWorld():
    print("Hello World from DEXF.py")