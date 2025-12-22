import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';

const canvas = document.getElementById('canvas');

// Vite serves `publicDir` (the in-repo `assets/` folder) at the site root.
// So `assets/scene/scene_V3TMF8.json` is available at `/scene/scene_V3TMF8.json`.
const SCENE_JSON_URL = '/scene/scene_V3TMF8.json';
const SCENE_BASE_URL = '/scene/';

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio || 1);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xFFDB00);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.01, 2000);
camera.position.set(5, 3, 5);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 1, 0);
controls.enableDamping = true;
controls.autoRotate = true;
controls.autoRotateSpeed = 0.5;
controls.update();

// Lights and Grid removed for blueprint look
/*
scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1.0));
const dir = new THREE.DirectionalLight(0xffffff, 0.8);
dir.position.set(5, 10, 7.5);
scene.add(dir);

const grid = new THREE.GridHelper(20, 40);
scene.add(grid);
*/

const loader = new GLTFLoader();
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('https://www.gstatic.com/draco/v1/decoders/');
loader.setDRACOLoader(dracoLoader);

let loadedRoot = null;
const lineMaterials = [];

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}
animate();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);

    const width = window.innerWidth;
    const height = window.innerHeight;
    lineMaterials.forEach(mat => {
        mat.resolution.set(width, height);
    });
});

function applyTransform(obj, transform) {
    const p = transform?.position || [0, 0, 0];
    const q = transform?.quaternion || [0, 0, 0, 1];
    const s = transform?.scale || [1, 1, 1];

    obj.position.set(p[0], p[1], p[2]);
    obj.quaternion.set(q[0], q[1], q[2], q[3]);
    obj.scale.set(s[0], s[1], s[2]);
}

async function loadGltfFromBlobUrl(url) {
    return await new Promise((resolve, reject) => {
        loader.load(url, resolve, undefined, reject);
    });
}

function setUserData(obj, userData) {
    if (userData && typeof userData === 'object') {
        obj.userData = { ...userData };
    }
}

function resolveAssetUrl(assetNameOrPath) {
    const raw = String(assetNameOrPath || '').trim();
    if (!raw) return '';
    if (/^https?:\/\//i.test(raw)) return raw;
    // Scene export uses paths like `models/xxx.glb` relative to the scene folder.
    const cleaned = raw.replace(/^\/+/, '');
    return SCENE_BASE_URL + cleaned;
}

function applyBlueprintStyle(object) {
    const lineColor = 0xFFFFFF; //0x0058A3;
    const bgColor = 0xFFFFFF; //0xFFDB00;

    const meshes = [];
    object.traverse((child) => {
        if (child.isMesh && !child.isLineSegments2) {
            meshes.push(child);
        }
    });

    for (const child of meshes) {
        child.material = new THREE.MeshBasicMaterial({
            color: bgColor,
            polygonOffset: true,
            polygonOffsetFactor: 1,
            polygonOffsetUnits: 1
        });

        const edges = new THREE.EdgesGeometry(child.geometry, 15);
        const lineGeometry = new LineSegmentsGeometry();
        lineGeometry.setPositions(edges.attributes.position.array);

        const lineMaterial = new LineMaterial({
            color: lineColor,
            linewidth: 2,
            resolution: new THREE.Vector2(window.innerWidth, window.innerHeight)
        });
        lineMaterials.push(lineMaterial);

        const line = new LineSegments2(lineGeometry, lineMaterial);
        child.add(line);
    }
}

async function buildNode(node, gltfCache) {
    const obj = new THREE.Group();
    obj.name = node?.name || '';
    applyTransform(obj, node?.transform);
    setUserData(obj, node?.userData);

    // Support nodes that have both an asset and children.
    if (node?.asset) {
        const assetUrl = resolveAssetUrl(node.asset);
        if (!assetUrl) {
            throw new Error(`Invalid asset path for node '${obj.name}'`);
        }

        let gltfPromise = gltfCache.get(assetUrl);
        if (!gltfPromise) {
            gltfPromise = (async () => {
                return await loadGltfFromBlobUrl(assetUrl);
            })();
            gltfCache.set(assetUrl, gltfPromise);
        }

        const gltf = await gltfPromise;
        // Clone for per-instance transforms; SkeletonUtils handles skinned meshes better.
        const model = SkeletonUtils.clone(gltf.scene);
        applyBlueprintStyle(model);
        obj.add(model);
    }

    const children = Array.isArray(node?.children) ? node.children : [];
    for (const child of children) {
        obj.add(await buildNode(child, gltfCache));
    }

    return obj;
}

async function rebuildFromSceneJson(sceneJson) {
    if (loadedRoot) {
        scene.remove(loadedRoot);
        loadedRoot = null;
    }

    lineMaterials.length = 0;

    // Force blueprint look, ignore scene background
    /*
    if (sceneJson?.scene?.background?.type === 'color' && typeof sceneJson.scene.background.hex === 'number') {
        scene.background = new THREE.Color(sceneJson.scene.background.hex);
    }
    */

    const gltfCache = new Map();

    const nodes = Array.isArray(sceneJson?.nodes) ? sceneJson.nodes : [];
    const rootNode = nodes[0];
    if (!rootNode) throw new Error('No root node in scene.json');

    loadedRoot = await buildNode(rootNode, gltfCache);
    scene.add(loadedRoot);

    const box = new THREE.Box3().setFromObject(loadedRoot);
    if (Number.isFinite(box.min.x)) {
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        controls.target.copy(center);

        // Frame the scene (simple heuristic).
        const maxDim = Math.max(size.x, size.y, size.z);
        const dist = Math.max(2, maxDim * 1.3);
        camera.position.copy(center).add(new THREE.Vector3(dist, dist * 0.6, dist));
        controls.update();
    }
}

(async function init() {
    try {
        console.log('Loading scene JSON:', SCENE_JSON_URL);
        console.log('Scene base URL:', SCENE_BASE_URL);

        const resp = await fetch(SCENE_JSON_URL, { cache: 'no-store' });
        const contentType = resp.headers.get('content-type') || '';
        const bodyText = await resp.text();
        if (!resp.ok) {
            throw new Error(`Failed to fetch scene JSON (${resp.status}) from ${resp.url || SCENE_JSON_URL}`);
        }
        if (!contentType.toLowerCase().includes('application/json')) {
            const snippet = bodyText.slice(0, 200).replace(/\s+/g, ' ').trim();
            throw new Error(
                `Scene URL did not return JSON (content-type: ${contentType || 'unknown'}). ` +
                `URL: ${resp.url || SCENE_JSON_URL}. Body starts with: ${snippet}`
            );
        }

        const sceneJson = JSON.parse(bodyText);
        await rebuildFromSceneJson(sceneJson);
    } catch (e) {
        console.error(e);
        alert(`Failed to load scene: ${e?.message || e}`);
    }
})();
