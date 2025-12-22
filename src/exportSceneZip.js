import JSZip from 'jszip';

function sanitizeFileName(name) {
    const safe = String(name || 'file')
        .replace(/[^a-zA-Z0-9._-]+/g, '_')
        .replace(/^_+/, '')
        .replace(/_+$/, '');
    return safe || 'file';
}

function djb2Hash(str) {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
    }
    return (hash >>> 0).toString(16);
}

function pickAssetFileName(url) {
    try {
        const u = new URL(url, window.location.origin);
        const base = u.pathname.split('/').filter(Boolean).pop() || 'model.glb';
        return sanitizeFileName(base);
    } catch {
        const base = String(url).split('/').filter(Boolean).pop() || 'model.glb';
        return sanitizeFileName(base);
    }
}

function toSerializableTransform(object3d) {
    return {
        position: [object3d.position.x, object3d.position.y, object3d.position.z],
        quaternion: [object3d.quaternion.x, object3d.quaternion.y, object3d.quaternion.z, object3d.quaternion.w],
        scale: [object3d.scale.x, object3d.scale.y, object3d.scale.z],
    };
}

function serializeNode(object3d, assetMap) {
    const node = {
        name: object3d.name || '',
        type: object3d.type,
        transform: toSerializableTransform(object3d),
        userData: {
            entityId: object3d.userData?.entityId,
            catalogRef: object3d.userData?.catalogRef,
        },
        children: [],
    };

    const sourceUrl = object3d.userData?.sourceUrl;
    if (typeof sourceUrl === 'string' && sourceUrl.length > 0) {
        const assetFileName = assetMap.get(sourceUrl);
        node.asset = assetFileName || undefined;
        node.assetOriginalUrl = sourceUrl;

        // Important: do not serialize the internal GLTF node hierarchy.
        // The viewer will reconstruct it by loading the asset.
        return node;
    }

    for (const child of object3d.children) {
        node.children.push(serializeNode(child, assetMap));
    }

    return node;
}

function collectModelUrls(root) {
    const urls = new Set();
    root.traverse((o) => {
        const url = o.userData?.sourceUrl;
        if (typeof url !== 'string') return;
        const lower = url.toLowerCase();
        if (lower.endsWith('.glb') || lower.endsWith('.gltf')) {
            urls.add(url);
        }
    });
    return [...urls];
}

function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export async function exportSceneAsZip({ scene, rootName = 'Products' }) {
    if (!scene) throw new Error('exportSceneAsZip: scene is required');

    const root = scene.getObjectByName(rootName) || scene;
    const modelUrls = collectModelUrls(root);

    // Map each source URL to a unique filename inside the ZIP.
    const assetMap = new Map();
    const usedNames = new Set();
    for (const url of modelUrls) {
        const base = pickAssetFileName(url);
        let name = base;
        if (usedNames.has(name)) {
            const extIdx = base.lastIndexOf('.');
            const ext = extIdx >= 0 ? base.slice(extIdx) : '';
            const stem = extIdx >= 0 ? base.slice(0, extIdx) : base;
            name = `${stem}_${djb2Hash(url)}${ext || '.glb'}`;
        }
        usedNames.add(name);
        assetMap.set(url, name);
    }

    const sceneJson = {
        version: 1,
        generator: 'vpc-display-export',
        exportedAt: new Date().toISOString(),
        rootName,
        scene: {
            background: (scene.background && scene.background.isColor)
                ? { type: 'color', hex: scene.background.getHex() }
                : null,
        },
        nodes: [serializeNode(root, assetMap)],
    };

    const zip = new JSZip();
    zip.file('scene.json', JSON.stringify(sceneJson, null, 2));

    const modelsFolder = zip.folder('models');
    if (!modelsFolder) throw new Error('Failed to create models folder in zip');

    // Fetch all assets (unique) and write them into the ZIP.
    for (const url of modelUrls) {
        const targetName = assetMap.get(url);
        if (!targetName) continue;

        const resp = await fetch(url);
        if (!resp.ok) {
            throw new Error(`Failed to fetch model: ${url} (${resp.status})`);
        }
        const buf = await resp.arrayBuffer();
        modelsFolder.file(targetName, buf);
    }

    const blob = await zip.generateAsync({ type: 'blob' });
    downloadBlob(blob, 'vpc-scene-export.zip');

    return { modelCount: modelUrls.length };
}
