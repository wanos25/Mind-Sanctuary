import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export default function VolumetricLightBeams() {
  const beam1Ref = useRef<THREE.Mesh>(null);
  const beam2Ref = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (beam1Ref.current) {
      (beam1Ref.current.material as THREE.MeshBasicMaterial).opacity = 0.04 + Math.sin(t * 0.3) * 0.015;
    }
    if (beam2Ref.current) {
      (beam2Ref.current.material as THREE.MeshBasicMaterial).opacity = 0.03 + Math.sin(t * 0.4 + 1) * 0.01;
    }
  });

  return (
    <group>
      {/* Main god ray from overhead light */}
      <mesh ref={beam1Ref} position={[0, 2, -2]} rotation={[0.15, 0, 0.05]}>
        <coneGeometry args={[2.5, 4, 8, 1, true]} />
        <meshBasicMaterial
          color="#e8c878"
          transparent
          opacity={0.04}
          side={THREE.DoubleSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Secondary beam from desk lamp area */}
      <mesh ref={beam2Ref} position={[-0.8, 2, -4]} rotation={[0.1, 0.2, 0]}>
        <coneGeometry args={[1.2, 2.5, 6, 1, true]} />
        <meshBasicMaterial
          color="#e8c060"
          transparent
          opacity={0.03}
          side={THREE.DoubleSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Side light beam */}
      <mesh position={[4, 2.5, -1]} rotation={[0.2, -0.5, 0.1]}>
        <coneGeometry args={[1.5, 3, 6, 1, true]} />
        <meshBasicMaterial
          color="#d4a04c"
          transparent
          opacity={0.025}
          side={THREE.DoubleSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  );
}
