import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const PARTICLE_COUNT = 120;

export default function DustParticles() {
  const meshRef = useRef<THREE.Points>(null);

  const { positions, speeds, offsets } = useMemo(() => {
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const speeds = new Float32Array(PARTICLE_COUNT);
    const offsets = new Float32Array(PARTICLE_COUNT);

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      // Spread particles in a volume focused around the light beams
      positions[i * 3] = (Math.random() - 0.5) * 8;       // x
      positions[i * 3 + 1] = Math.random() * 3.5 + 0.3;   // y (floor to near ceiling)
      positions[i * 3 + 2] = (Math.random() - 0.5) * 10;  // z
      speeds[i] = 0.1 + Math.random() * 0.3;
      offsets[i] = Math.random() * Math.PI * 2;
    }

    return { positions, speeds, offsets };
  }, []);

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const geo = meshRef.current.geometry;
    const posAttr = geo.getAttribute('position');
    const t = clock.elapsedTime;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const speed = speeds[i];
      const offset = offsets[i];
      // Gentle floating motion
      posAttr.setY(
        i,
        positions[i * 3 + 1] + Math.sin(t * speed + offset) * 0.15
      );
      posAttr.setX(
        i,
        positions[i * 3] + Math.sin(t * speed * 0.7 + offset * 1.3) * 0.08
      );
      posAttr.setZ(
        i,
        positions[i * 3 + 2] + Math.cos(t * speed * 0.5 + offset) * 0.06
      );
    }
    posAttr.needsUpdate = true;
  });

  return (
    <points ref={meshRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
          count={PARTICLE_COUNT}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.03}
        color="#e8c878"
        transparent
        opacity={0.4}
        sizeAttenuation
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}
