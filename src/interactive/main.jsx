import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import { Canvas } from '@react-three/fiber';
import Experience from './Experience.jsx';
import CameraInfo, { CameraTracker, FpsTracker } from './CameraInfo.jsx';

function App() {
    const [showTextures, setShowTextures] = useState(false);
    const [autoRotate, setAutoRotate] = useState(true);
    const [resetKey, setResetKey] = useState(0);

    return (
        <>
            <div style={{
                position: 'absolute',
                top: '20px',
                left: '20px',
                zIndex: 1000,
                background: 'rgba(255, 255, 255, 1.0)',
                padding: '10px',
                borderRadius: '8px',
                fontFamily: 'sans-serif',
                boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                width: '150px',
                userSelect: 'none',
                WebkitUserSelect: 'none'
            }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input
                        type="checkbox"
                        checked={showTextures}
                        onChange={(e) => setShowTextures(e.target.checked)}
                    />
                    Textures
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input
                        type="checkbox"
                        checked={autoRotate}
                        onChange={(e) => setAutoRotate(e.target.checked)}
                    />
                    Auto rotation
                </label>
                <button
                    onClick={() => setResetKey(prev => prev + 1)}
                    style={{
                        padding: '5px 10px',
                        cursor: 'pointer',
                        background: '#f0f0f0',
                        border: '1px solid #ccc',
                        borderRadius: '4px',
                        fontSize: '14px'
                    }}
                >
                    Reset scene
                </button>
                <CameraInfo />
            </div>
            <Canvas
                flat
                camera={{
                    fov: 60,
                    near: 0.01,
                    far: 2000,
                    position: [4.275, 1.657, 1.320]
                }}
                gl={{ antialias: true }}
            >
                <FpsTracker />
                <CameraTracker />
                <Experience key={resetKey} showTextures={showTextures} autoRotate={autoRotate} />
            </Canvas>
        </>
    );
}

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
);
