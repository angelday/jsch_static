import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { exportSceneAsZip } from './exportSceneZip.js';

// Vite + Three.js main entry: loads catalog.json and V3TMF8.json from public dir (served from ../assets)

const canvas = document.getElementById('canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio || 1);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf0f0f0);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.01, 1000);
camera.position.set(5, 3, 5);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 1, 0);

const exportBtn = document.createElement('button');
exportBtn.textContent = 'Export scene (zip)';
exportBtn.style.position = 'fixed';
exportBtn.style.top = '12px';
exportBtn.style.left = '12px';
exportBtn.style.zIndex = '10';
exportBtn.disabled = true;
document.body.appendChild(exportBtn);

const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1.0);
scene.add(hemi);
const dir = new THREE.DirectionalLight(0xffffff, 0.8);
dir.position.set(5, 10, 7.5);
scene.add(dir);

const grid = new THREE.GridHelper(20, 40);
scene.add(grid);

const loader = new GLTFLoader();
const dracoLoader = new DRACOLoader();
// Use Google's hosted Draco decoder (fast and widely available). You can copy decoders locally if preferred.
dracoLoader.setDecoderPath('https://www.gstatic.com/draco/v1/decoders/');
loader.setDRACOLoader(dracoLoader);

function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
}
animate();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- VPC/Catalog parsing helpers (port of VPCUtilz / CatalogUtils behaviour) ---
function convertJSONVPCObject(jsonObj) {
    const obj = {
        id: 'noValue',
        ref: 'noValue',
        parent: 'noValue',
        worldTransform: { x: 0, y: 0, z: 0, qw: 1, qx: 0, qy: 0, qz: 0 },
        connection: {},
        connectors: [],
        isAttachedToFloor: false,
    };
    if (jsonObj.id) obj.id = jsonObj.id;
    if (jsonObj.ref) obj.ref = jsonObj.ref;
    if (jsonObj.parent) obj.parent = jsonObj.parent;

    if (jsonObj.c && jsonObj.c.WorldTransformComponent) {
        const transform = jsonObj.c.WorldTransformComponent;
        const wt = { x: 0, y: 0, z: 0, qw: 1, qx: 0, qy: 0, qz: 0 };
        if (transform.p) {
            wt.x = (transform.p.x || 0) / 1000;
            wt.y = (transform.p.y || 0) / 1000;
            wt.z = -((transform.p.z || 0) / 1000);
        }
        if (transform.r) {
            wt.qw = (transform.r.w !== undefined) ? transform.r.w : 1;
            wt.qx = (transform.r.x !== undefined) ? transform.r.x : 0;
            wt.qy = (transform.r.y !== undefined) ? transform.r.y : 0;
            wt.qz = (transform.r.z !== undefined) ? transform.r.z : 0;
        }
        obj.worldTransform = wt;
    }

    if (jsonObj.c && jsonObj.c.Connections && Array.isArray(jsonObj.c.Connections.connections)) {
        const connectors = jsonObj.c.Connections.connections
            .map((c) => c && c.guestConnector)
            .filter((v) => typeof v === 'string');
        obj.connectors = connectors;
        obj.isAttachedToFloor = connectors.some((c) => c === 'connect-to-floor' || c.startsWith('attach-to-floor'));
    }
    return obj;
}

function snapToGroundIfNeeded(obj3d, epsilon = 1e-4) {
    obj3d.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(obj3d);
    if (!Number.isFinite(box.min.y)) return;
    if (box.min.y < -epsilon) {
        obj3d.position.y += -box.min.y;
        obj3d.updateMatrixWorld(true);
    }
}

function prepareEntityData(vpcJson) {
    const entities = vpcJson.configuration.content.entities;
    const hashed = {};
    for (const e of entities) {
        const ce = convertJSONVPCObject(e);
        hashed[ce.id] = ce;
    }
    return hashed;
}

function prepareCatalogData(catalogJson) {
    const hashed = {};
    for (const p of catalogJson.products) { hashed[p.id] = p; }
    return hashed;
}

function get3DModelPath(catalogProduct) {
    return (catalogProduct && catalogProduct.modelURI) ? catalogProduct.modelURI : '';
}

function getModelTransformComponentData(catalogProduct) {
    const transformData = { rotation: [0, 0, 0], position: [0, 0, 0], scale: [1, 1, 1] };
    if (catalogProduct && catalogProduct.template && catalogProduct.template.modelTransform) {
        const mt = catalogProduct.template.modelTransform;
        if (mt.r) {
            transformData.rotation[0] = (mt.r.x !== undefined) ? THREE.MathUtils.degToRad(mt.r.x) : 0;
            transformData.rotation[1] = (mt.r.z !== undefined) ? -THREE.MathUtils.degToRad(mt.r.z) : 0;
            transformData.rotation[2] = (mt.r.y !== undefined) ? THREE.MathUtils.degToRad(mt.r.y) : 0;
        }
        if (mt.p) {
            transformData.position[0] = (mt.p.x || 0) / 1000;
            // VPC uses Y-up; keep Y as vertical. Match worldTransform's Z sign flip.
            transformData.position[1] = (mt.p.y || 0) / 1000;
            transformData.position[2] = -((mt.p.z || 0) / 1000);
        }
        if (mt.s) {
            transformData.scale[0] = mt.s.x || 1;
            transformData.scale[2] = mt.s.y || 1;
            transformData.scale[1] = mt.s.z || 1;
        }
    }

    // Many VPC world positions appear to be the *center* of the object (e.g. y ~= height/2).
    // If the catalog doesn't provide an explicit vertical offset, shift down by half height.
    const hasExplicitVerticalOffset =
        !!(catalogProduct && catalogProduct.template && catalogProduct.template.modelTransform &&
            catalogProduct.template.modelTransform.p &&
            catalogProduct.template.modelTransform.p.y !== undefined);

    // Wall-mounted items (pictures/frames) are typically already positioned correctly by VPC worldTransform.
    // Applying the generic center->base fallback would drop them far too low.
    const templateId = catalogProduct?.template?.id;
    const isWallMountedTemplate =
        templateId === 'picture-frame' ||
        templateId === 'picture' ||
        templateId === 'wall-item' ||
        templateId === 'wall-item-no-rotation';

    const heightMm = catalogProduct?.template?.size?.height;
    if (!isWallMountedTemplate && !hasExplicitVerticalOffset && typeof heightMm === 'number' && Number.isFinite(heightMm)) {
        transformData.position[1] += -(heightMm / 2000);
    }
    return transformData;
}

function applyTransformsToObject(obj3d, catalogProduct, entity) {
    const mt = getModelTransformComponentData(catalogProduct);
    obj3d.scale.set(mt.scale[0], mt.scale[1], mt.scale[2]);

    const wt = entity.worldTransform || { x: 0, y: 0, z: 0, qw: 1, qx: 0, qy: 0, qz: 0 };
    const px = wt.x || 0;
    const py = wt.y || 0;
    const pz = wt.z || 0;
    const qx = wt.qx || 0;
    const qy = wt.qy || 0;
    const qz = wt.qz || 0;
    const qw = (wt.qw !== undefined) ? wt.qw : 1;

    const worldQuat = new THREE.Quaternion(qx, qy, -qz, qw).normalize();

    // Compose world position with the catalog model offset in the entity's local frame.
    // (The old code added the model offset and then overwrote it.)
    const worldPos = new THREE.Vector3(px, py, -pz);
    const modelOffset = new THREE.Vector3(mt.position[0], mt.position[1], mt.position[2]).applyQuaternion(worldQuat);
    obj3d.position.copy(worldPos.add(modelOffset));

    // Compose world rotation (entity) with local model rotation (catalog).
    // Order matters: world * model applies the model's rotation in the entity's local frame.
    const modelQuat = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(mt.rotation[0], mt.rotation[1], mt.rotation[2], 'XYZ')
    );
    obj3d.quaternion.copy(worldQuat.clone().multiply(modelQuat)).normalize();
}

async function loadEntityModels(entitiesMap, catalogMap) {
    const productsGroup = new THREE.Group();
    productsGroup.name = 'Products';
    scene.add(productsGroup);

    for (const id in entitiesMap) {
        const entity = entitiesMap[id];
        if (!entity || entity.ref === 'noValue') continue;
        const ref = entity.ref;
        if (!(ref in catalogMap)) { console.warn('Reference not found in catalog:', ref); continue; }
        const catalogProduct = catalogMap[ref];
        const modelPath = get3DModelPath(catalogProduct);
        if (modelPath) {
            try {
                const gltf = await new Promise((resolve, reject) => loader.load(modelPath, resolve, undefined, reject));
                const root = gltf.scene || gltf.scenes[0] || new THREE.Group();
                root.name = root.name || `product:${id}`;
                root.userData = root.userData || {};
                root.userData.sourceUrl = modelPath;
                root.userData.entityId = id;
                root.userData.catalogRef = ref;
                applyTransformsToObject(root, catalogProduct, entity);
                if (entity.isAttachedToFloor) snapToGroundIfNeeded(root);
                productsGroup.add(root);
            } catch (err) {
                console.error('Failed to load model', modelPath, err);
            }
        } else {
            const empty = new THREE.Object3D();
            empty.name = `product:${id}`;
            empty.userData = empty.userData || {};
            empty.userData.entityId = id;
            empty.userData.catalogRef = ref;
            applyTransformsToObject(empty, catalogProduct || {}, entity);
            if (entity.isAttachedToFloor) snapToGroundIfNeeded(empty);
            productsGroup.add(empty);
        }
    }
}

// Auto-load JSON assets from public dir and initialize scene
(async function initAutoLoad() {
    const vpcUrl = '/V3TMF8.json';
    const catalogUrl = '/catalog.json';

    try {
        const [vpcResp, catalogResp] = await Promise.all([fetch(vpcUrl), fetch(catalogUrl)]);
        const vpcJson = await vpcResp.json();
        const catalogJson = await catalogResp.json();

        const entities = prepareEntityData(vpcJson);
        const catalog = prepareCatalogData(catalogJson);
        await loadEntityModels(entities, catalog);
        console.log('Loaded models into scene.');

        exportBtn.disabled = false;
        exportBtn.onclick = async () => {
            exportBtn.disabled = true;
            try {
                const result = await exportSceneAsZip({ scene, rootName: 'Products' });
                console.log('Exported zip:', result);
            } catch (e) {
                console.error('Export failed:', e);
                alert(`Export failed: ${e?.message || e}`);
            } finally {
                exportBtn.disabled = false;
            }
        };
    } catch (err) {
        console.error('Failed to load JSON or models:', err);
    }
})();
