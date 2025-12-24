import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import { OrbitControls, useGLTF } from '@react-three/drei';
import * as THREE from 'three';

const SCENE_JSON_URL = 'scene/scene_V3TMF8.json';
const SCENE_BASE_URL = 'scene/';
const DRACO_URL = 'https://www.gstatic.com/draco/v1/decoders/';

function Model({ url, showTextures }) {
    // Load the GLTF model
    const { scene } = useGLTF(SCENE_BASE_URL + url, DRACO_URL);

    // Clone the scene so we can have multiple instances with independent materials
    const clonedScene = useMemo(() => {
        const clone = scene.clone(true);

        clone.traverse((child) => {
            if (child.isMesh) {
                // Save original material
                child.userData.originalMaterial = child.material;
                // Create flat material
                child.userData.flatMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
                // Default to flat
                child.material = child.userData.flatMaterial;
            }
        });
        return clone;
    }, [scene]);

    const [hovered, setHover] = useState(false);

    // Handle material switching and hover state
    useEffect(() => {
        clonedScene.traverse((child) => {
            if (child.isMesh) {
                if (showTextures) {
                    child.material = child.userData.originalMaterial;
                } else {
                    child.material = child.userData.flatMaterial;
                    const color = hovered ? 0x0058A3 : 0xffffff;
                    child.material.color.setHex(color);
                }
            }
        });
    }, [showTextures, hovered, clonedScene]);

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

function Node({ node, showTextures }) {
    const { name, transform, children, asset } = node;

    // State for position to allow dragging
    const [position, setPosition] = useState(() => {
        const p = transform?.position;
        return p ? new THREE.Vector3(p[0], p[1], p[2]) : new THREE.Vector3(0, 0, 0);
    });

    const [isDragging, setIsDragging] = useState(false);
    const controls = useThree((state) => state.controls);

    // Dragging logic helpers
    const plane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), []);
    const offset = useRef(new THREE.Vector3());
    const intersection = useRef(new THREE.Vector3());

    const handlePointerDown = (e) => {
        // Only drag if this node has an asset (is an object)
        if (!asset) return;

        e.stopPropagation();
        setIsDragging(true);

        // Disable OrbitControls while dragging
        if (controls) controls.enabled = false;

        // Calculate intersection with the floor plane at the object's current height
        plane.constant = -position.y;
        e.ray.intersectPlane(plane, intersection.current);

        // Store offset between intersection point and object center
        offset.current.copy(intersection.current).sub(position);

        e.target.setPointerCapture(e.pointerId);
    };

    const handlePointerUp = (e) => {
        if (!isDragging) return;

        e.stopPropagation();
        setIsDragging(false);

        // Re-enable OrbitControls
        if (controls) controls.enabled = true;

        e.target.releasePointerCapture(e.pointerId);
    };

    const handlePointerMove = (e) => {
        if (!isDragging) return;

        e.stopPropagation();

        // Calculate new position
        e.ray.intersectPlane(plane, intersection.current);
        const newPos = new THREE.Vector3().copy(intersection.current).sub(offset.current);

        // Constrain Y to initial height (lateral movement only)
        newPos.y = position.y;

        setPosition(newPos);
    };

    return (
        <group
            name={name}
            position={position}
            quaternion={transform?.quaternion}
            scale={transform?.scale}
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            onPointerMove={handlePointerMove}
        >
            {asset && <Model url={asset} showTextures={showTextures} />}
            {children && children.map((child, i) => (
                <Node key={i} node={child} showTextures={showTextures} />
            ))}
        </group>
    );
}

export default function Experience({ showTextures, autoRotate }) {
    const { scene } = useThree();
    const [sceneData, setSceneData] = useState(null);

    useEffect(() => {
        // Set background color based on showTextures
        if (showTextures) {
            scene.background = new THREE.Color(0xcccccc); // Generic gray
        } else {
            scene.background = new THREE.Color(0xFFDB00); // Original yellow
        }
    }, [scene, showTextures]);

    useEffect(() => {
        // Fetch scene structure
        fetch(SCENE_JSON_URL)
            .then(res => res.json())
            .then(data => setSceneData(data))
            .catch(err => console.error('Failed to load scene JSON:', err));
    }, []);

    if (!sceneData) return null;

    return (
        <>
            <ambientLight intensity={0.8} />
            <directionalLight position={[5, 10, 7.5]} intensity={1} />

            {showTextures && (
                <gridHelper args={[20, 40]} />
            )}

            <OrbitControls
                makeDefault
                target={[0.415, 0.257, -0.262]}
                enableDamping
                autoRotate={autoRotate}
                autoRotateSpeed={1.0}
            />
            {sceneData.nodes.map((node, i) => (
                <Node key={i} node={node} showTextures={showTextures} />
            ))}
        </>
    );
}
