import React, { useEffect, useState, useRef } from 'react';
import { useThree, useFrame } from '@react-three/fiber';

// This component needs to be inside the Canvas to access useThree, 
// but we want to render the info outside in the HTML overlay.
// We can use a portal or just a simple event/state sharing mechanism.
// For simplicity here, we'll create a component that updates a global store or 
// dispatches events, but since the request is to put it "below the toggles",
// we can make a component that lives inside Canvas but renders nothing 
// and updates a state passed from the parent? 
// Actually, simpler: The parent (App) has the UI. The Canvas has the camera.
// We can't easily pass data UP from Canvas to App on every frame without performance hit.
// 
// Better approach: A component inside Canvas that writes to a ref or DOM element directly.

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
