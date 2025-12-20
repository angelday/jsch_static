import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

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
// Smooth damping and automatic rotation for an orbiting view
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.autoRotate = true;
controls.autoRotateSpeed = 1.0; // adjust to taste
controls.update();

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
    // update controls each frame so autoRotate and damping work
    controls.update();
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
    const obj = { id: 'noValue', ref: 'noValue', parent: 'noValue', worldTransform: { x: 0, y: 0, z: 0, qw: 1, qx: 0, qy: 0, qz: 0 }, connection: {} };
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
    return obj;
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
            transformData.position[2] = (mt.p.y || 0) / 1000;
            transformData.position[1] = -((mt.p.z || 0) / 1000);
        }
        if (mt.s) {
            transformData.scale[0] = mt.s.x || 1;
            transformData.scale[2] = mt.s.y || 1;
            transformData.scale[1] = mt.s.z || 1;
        }
    }
    return transformData;
}

function applyTransformsToObject(obj3d, catalogProduct, entity) {
    const mt = getModelTransformComponentData(catalogProduct);
    obj3d.rotation.set(mt.rotation[0], mt.rotation[1], mt.rotation[2]);
    obj3d.position.add(new THREE.Vector3(mt.position[0], mt.position[1], mt.position[2]));
    obj3d.scale.set(mt.scale[0], mt.scale[1], mt.scale[2]);

    const wt = entity.worldTransform || { x: 0, y: 0, z: 0, qw: 1, qx: 0, qy: 0, qz: 0 };
    const px = wt.x || 0;
    const py = wt.y || 0;
    const pz = wt.z || 0;
    obj3d.position.set(px, py, -pz);

    const qx = wt.qx || 0;
    const qy = wt.qy || 0;
    const qz = wt.qz || 0;
    const qw = (wt.qw !== undefined) ? wt.qw : 1;
    obj3d.quaternion.set(qx, qy, -qz, qw);
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
                applyTransformsToObject(root, catalogProduct, entity);
                productsGroup.add(root);
            } catch (err) {
                console.error('Failed to load model', modelPath, err);
            }
        } else {
            const empty = new THREE.Object3D();
            applyTransformsToObject(empty, catalogProduct || {}, entity);
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
    } catch (err) {
        console.error('Failed to load JSON or models:', err);
    }
})();
