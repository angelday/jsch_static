import React, { useEffect, useState, useRef } from 'react';
import { useThree, useFrame } from '@react-three/fiber';

export default function CameraInfo() {
    return (
        <div style={{ fontSize: '12px', marginTop: '8px', color: '#333' }}>
            <div id="fps-info" style={{ marginBottom: '4px', fontWeight: 'bold' }}>FPS: -</div>
            <div id="camera-info">Waiting for camera...</div>
        </div>
    );
}

export function FpsTracker() {
    const frames = useRef(0);
    const prevTime = useRef(performance.now());
    const el = useRef(null);

    useEffect(() => {
        el.current = document.getElementById('fps-info');
    }, []);

    useFrame(() => {
        if (!el.current) {
            el.current = document.getElementById('fps-info');
            if (!el.current) return;
        }

        frames.current++;
        const time = performance.now();

        if (time >= prevTime.current + 500) {
            const fps = Math.round((frames.current * 1000) / (time - prevTime.current));
            el.current.innerText = `FPS: ${fps}`;
            frames.current = 0;
            prevTime.current = time;
        }
    });

    return null;
}

export function CameraTracker() {
    const { camera } = useThree();

    useEffect(() => {
        const el = document.getElementById('camera-info');
        if (!el) return;

        const update = () => {
            el.innerHTML = `
                <div><strong>Camera:</strong> ${camera.position.x.toFixed(2)}, ${camera.position.y.toFixed(2)}, ${camera.position.z.toFixed(2)}</div>
                `;
            requestAnimationFrame(update);
        };

        const handle = requestAnimationFrame(update);
        return () => cancelAnimationFrame(handle);
    }, [camera]);

    return null;
}
