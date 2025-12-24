import React from 'react';
import ReactDOM from 'react-dom/client';
import { Canvas } from '@react-three/fiber';
import Experience from './Experience.jsx';

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
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
            <Experience />
        </Canvas>
    </React.StrictMode>
);
