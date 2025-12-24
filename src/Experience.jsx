import React, { useEffect, useState, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import { OrbitControls, useGLTF } from '@react-three/drei';
import * as THREE from 'three';

const SCENE_JSON_URL = 'scene/scene_V3TMF8.json';
const SCENE_BASE_URL = 'scene/';
const DRACO_URL = 'https://www.gstatic.com/draco/v1/decoders/';

function Model({ url }) {
    // Load the GLTF model
    const { scene } = useGLTF(SCENE_BASE_URL + url, DRACO_URL);

    // Clone the scene so we can have multiple instances with independent materials
    const clonedScene = useMemo(() => {
        const clone = scene.clone(true);

        // Apply flat white style initially
        clone.traverse((child) => {
            if (child.isMesh) {
                // Create a new material for each mesh to allow independent color changes
                child.material = new THREE.MeshBasicMaterial({ color: 0xffffff });
            }
        });
        return clone;
    }, [scene]);

    const [hovered, setHover] = useState(false);

    // Handle hover state changes
    useEffect(() => {
        const color = hovered ? 0x0058A3 : 0xffffff;
        clonedScene.traverse((child) => {
            if (child.isMesh) {
                child.material.color.setHex(color);
            }
        });
    }, [hovered, clonedScene]);

    return (
        <primitive
            object={clonedScene}
            onPointerOver={(e) => {
                e.stopPropagation();
                setHover(true);
            }}
            onPointerOut={(e) => {
                e.stopPropagation();
                setHover(false);
            }}
        />
    );
}

function Node({ node }) {
    const { name, transform, children, asset } = node;

    return (
        <group
            name={name}
            position={transform?.position}
            quaternion={transform?.quaternion}
            scale={transform?.scale}
        >
            {asset && <Model url={asset} />}
            {children && children.map((child, i) => (
                <Node key={i} node={child} />
            ))}
        </group>
    );
}

export default function Experience() {
    const { scene } = useThree();
    const [sceneData, setSceneData] = useState(null);

    useEffect(() => {
        // Set background color
        scene.background = new THREE.Color(0xFFDB00);

        // Fetch scene structure
        fetch(SCENE_JSON_URL)
            .then(res => res.json())
            .then(data => setSceneData(data))
            .catch(err => console.error('Failed to load scene JSON:', err));
    }, [scene]);

    if (!sceneData) return null;

    return (
        <>
            <OrbitControls
                target={[0.415, 0.257, -0.262]}
                enableDamping
                autoRotate
                autoRotateSpeed={1.0}
            />
            {sceneData.nodes.map((node, i) => (
                <Node key={i} node={node} />
            ))}
        </>
    );
}
