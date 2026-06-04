import { Suspense, useEffect, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, Sphere, MeshDistortMaterial, Stars, Environment } from '@react-three/drei';
import * as THREE from 'three';
import { getGpuProfile } from '@/lib/gpu/quality';
import { gpuDiag } from '@/lib/gpu/diagnostics';


function NeuralOrb() {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.getElapsedTime();
    ref.current.rotation.y = t * 0.15;
    ref.current.rotation.x = Math.sin(t * 0.2) * 0.2;
    // Subtle mouse parallax
    const { x, y } = state.pointer;
    ref.current.position.x += (x * 0.6 - ref.current.position.x) * 0.04;
    ref.current.position.y += (y * 0.4 - ref.current.position.y) * 0.04;
  });

  return (
    <Float speed={1.4} rotationIntensity={0.6} floatIntensity={1.2}>
      <Sphere ref={ref} args={[1.4, 96, 96]}>
        <MeshDistortMaterial
          color="#caa45a"
          attach="material"
          distort={0.45}
          speed={1.6}
          roughness={0.1}
          metalness={0.85}
          emissive="#7b3fe4"
          emissiveIntensity={0.35}
        />
      </Sphere>
    </Float>
  );
}

function FloatingShards() {
  const group = useRef<THREE.Group>(null);
  useFrame((s) => {
    if (group.current) group.current.rotation.y = s.clock.getElapsedTime() * 0.05;
  });
  return (
    <group ref={group}>
      {Array.from({ length: 18 }).map((_, i) => {
        const a = (i / 18) * Math.PI * 2;
        const r = 3 + (i % 3) * 0.4;
        return (
          <Float key={i} speed={1 + (i % 3) * 0.3} floatIntensity={1.5}>
            <mesh position={[Math.cos(a) * r, Math.sin(a * 0.8) * 1.6, Math.sin(a) * r]}>
              <icosahedronGeometry args={[0.08, 0]} />
              <meshStandardMaterial
                color="#caa45a"
                emissive="#caa45a"
                emissiveIntensity={1.2}
                roughness={0.3}
              />
            </mesh>
          </Float>
        );
      })}
    </group>
  );
}

export default function DashboardScene() {
  const profile = getGpuProfile();
  const glRef = useRef<THREE.WebGLRenderer | null>(null);
  const [visible, setVisible] = useState(() => typeof document === 'undefined' || !document.hidden);

  useEffect(() => {
    gpuDiag.registerScene('DashboardScene');
    const onVis = () => setVisible(!document.hidden);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      gpuDiag.unregisterScene('DashboardScene');
      const gl = glRef.current;
      if (gl) {
        try {
          gl.dispose();
          gl.forceContextLoss();
        } catch {}
        gpuDiag.noteDispose();
        gpuDiag.unregisterRenderer();
        glRef.current = null;
      }
    };
  }, []);

  const starCount = Math.round(1200 * profile.densityScale);
  const frameloop = profile.reducedMotion || !visible ? 'demand' : 'always';

  return (
    <Canvas
      dpr={[1, profile.maxDpr]}
      camera={{ position: [0, 0, 5.5], fov: 50 }}
      gl={{ antialias: profile.antialias, alpha: true, powerPreference: profile.tier === 'low' ? 'low-power' : 'high-performance' }}
      style={{ background: 'transparent' }}
      frameloop={frameloop}
      onCreated={({ gl }) => {
        glRef.current = gl;
        gpuDiag.registerRenderer();
      }}
    >
      <Suspense fallback={null}>
        <ambientLight intensity={0.35} />
        <pointLight position={[5, 5, 5]} intensity={1.5} color="#caa45a" />
        <pointLight position={[-5, -3, -5]} intensity={1.2} color="#7b3fe4" />
        <Stars radius={50} depth={30} count={starCount} factor={3} saturation={0} fade speed={0.5} />
        <NeuralOrb />
        <FloatingShards />
        {profile.tier !== 'low' && <Environment preset="night" />}
      </Suspense>
    </Canvas>
  );
}
