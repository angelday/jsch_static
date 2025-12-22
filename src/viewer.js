import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';

const canvas = document.getElementById('canvas');

// Vite serves `publicDir` (the in-repo `assets/` folder) at the site root.
// So `assets/scene/scene_V3TMF8.json` is available at `/scene/scene_V3TMF8.json`.
const SCENE_JSON_URL = '/scene/scene_V3TMF8.json';
const SCENE_BASE_URL = '/scene/';

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio || 1);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf0f0f0);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.01, 2000);
camera.position.set(5, 3, 5);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 1, 0);
controls.update();

scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1.0));
const dir = new THREE.DirectionalLight(0xffffff, 0.8);
dir.position.set(5, 10, 7.5);
scene.add(dir);

const grid = new THREE.GridHelper(20, 40);
scene.add(grid);

const loader = new GLTFLoader();
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('https://www.gstatic.com/draco/v1/decoders/');
loader.setDRACOLoader(dracoLoader);

let loadedRoot = null;

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

    if (sceneJson?.scene?.background?.type === 'color' && typeof sceneJson.scene.background.hex === 'number') {
        scene.background = new THREE.Color(sceneJson.scene.background.hex);
    }

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
