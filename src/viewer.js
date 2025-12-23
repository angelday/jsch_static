import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';

const canvas = document.getElementById('canvas');

const SCENE_JSON_URL = 'scene/scene_V3TMF8.json';
const SCENE_BASE_URL = 'scene/';

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

const loader = new GLTFLoader();
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('https://www.gstatic.com/draco/v1/decoders/');
loader.setDRACOLoader(dracoLoader);

let loadedRoot = null;

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
});

function applyTransform(obj, transform) {
    const p = transform?.position || [0, 0, 0];
    const q = transform?.quaternion || [0, 0, 0, 1];
    const s = transform?.scale || [1, 1, 1];

    obj.position.set(p[0], p[1], p[2]);
    obj.quaternion.set(q[0], q[1], q[2], q[3]);
    obj.scale.set(s[0], s[1], s[2]);
}

const whiteMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });

function applyFlatWhiteStyle(object) {
    object.traverse((child) => {
        if (child.isMesh) {
            child.material = whiteMaterial;
        }
    });
}

async function buildNode(node, gltfCache) {
    const obj = new THREE.Group();
    obj.name = node?.name || '';
    applyTransform(obj, node?.transform);
    if (node?.userData) obj.userData = { ...node.userData };

    // Support nodes that have both an asset and children.
    if (node?.asset) {
        const assetUrl = SCENE_BASE_URL + node.asset;

        let gltfPromise = gltfCache.get(assetUrl);
        if (!gltfPromise) {
            gltfPromise = loader.loadAsync(assetUrl);
            gltfCache.set(assetUrl, gltfPromise);
        }

        const gltf = await gltfPromise;
        // Clone for per-instance transforms; SkeletonUtils handles skinned meshes better.
        const model = SkeletonUtils.clone(gltf.scene);
        applyFlatWhiteStyle(model);
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

    const gltfCache = new Map();

    const nodes = Array.isArray(sceneJson?.nodes) ? sceneJson.nodes : [];
    const rootNode = nodes[0];
    if (!rootNode) throw new Error('No root node in scene.json');

    loadedRoot = await buildNode(rootNode, gltfCache);
    scene.add(loadedRoot);
}

(async function init() {
    try {
        const resp = await fetch(SCENE_JSON_URL);
        if (!resp.ok) throw new Error(`Failed to load scene (${resp.status})`);
        const sceneJson = await resp.json();
        await rebuildFromSceneJson(sceneJson);
    } catch (e) {
        console.error(e);
        alert(`Error: ${e.message}`);
    }
})();
