import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

const canvas = document.getElementById('canvas');

const SCENE_JSON_URL = 'scene/scene_V3TMF8.json';
const SCENE_BASE_URL = 'scene/';

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio || 1);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xFFDB00);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.01, 2000);
camera.position.set(4.275, 1.657, 1.320);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0.415, 0.257, -0.262);
controls.enableDamping = true;
controls.autoRotate = true;
controls.autoRotateSpeed = 0.5;
controls.update();

const loader = new GLTFLoader();
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('https://www.gstatic.com/draco/v1/decoders/');
loader.setDRACOLoader(dracoLoader);

let loadedRoot = null;
let revealInterval = null;
const fadingObjects = [];

function startFadeIn(object) {
    object.visible = true;
    fadingObjects.push({
        object,
        startTime: performance.now(),
        duration: 500
    });
}

function animate() {
    requestAnimationFrame(animate);

    const now = performance.now();
    for (let i = fadingObjects.length - 1; i >= 0; i--) {
        const item = fadingObjects[i];
        const elapsed = now - item.startTime;
        const t = Math.min(elapsed / item.duration, 1);

        item.object.traverse((child) => {
            if (child.isMesh) {
                child.material.opacity = t;
            }
        });

        if (t >= 1) {
            fadingObjects.splice(i, 1);
        }
    }

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

function applyFlatWhiteStyle(object) {
    object.traverse((child) => {
        if (child.isMesh) {
            child.material = new THREE.MeshBasicMaterial({
                color: 0xffffff,
                transparent: true,
                opacity: 0
            });
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
        // Clone for per-instance transforms.
        const model = gltf.scene.clone();
        applyFlatWhiteStyle(model);

        // Hide initially for staggered reveal
        model.visible = false;
        model.userData.isAnimatable = true;
        // Propagate entityId to the model so we can find it later
        if (node?.userData?.entityId) {
            model.userData.entityId = node.userData.entityId;
        }

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
    if (revealInterval) {
        clearInterval(revealInterval);
        revealInterval = null;
    }

    const gltfCache = new Map();

    const nodes = Array.isArray(sceneJson?.nodes) ? sceneJson.nodes : [];
    const rootNode = nodes[0];
    if (!rootNode) throw new Error('No root node in scene.json');

    loadedRoot = await buildNode(rootNode, gltfCache);
    scene.add(loadedRoot);

    // Staggered reveal
    const itemsToReveal = [];
    loadedRoot.traverse((child) => {
        if (child.userData.isAnimatable) {
            itemsToReveal.push(child);
        }
    });

    let index = 0;
    revealInterval = setInterval(() => {
        if (index >= itemsToReveal.length) {
            clearInterval(revealInterval);
            revealInterval = null;
            return;
        }
        startFadeIn(itemsToReveal[index]);
        index++;
    }, 250);
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
