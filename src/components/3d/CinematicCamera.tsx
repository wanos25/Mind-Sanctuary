import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

interface CinematicCameraProps {
  phase: number; // 0-1 representing animation progress
}

// Camera path: starts outside door, moves through, settles at patient position
const CAMERA_PATH = {
  // Starting position (outside, looking at door)
  start: { pos: new THREE.Vector3(0, 1.8, 8), look: new THREE.Vector3(0, 1.5, 0) },
  // At the door
  door: { pos: new THREE.Vector3(0, 1.7, 5.5), look: new THREE.Vector3(0, 1.5, -2) },
  // Inside, looking around
  inside: { pos: new THREE.Vector3(0.5, 1.6, 2), look: new THREE.Vector3(0, 1.2, -3) },
  // Settling into patient position
  seated: { pos: new THREE.Vector3(0, 1.2, 1), look: new THREE.Vector3(0, 1.2, -4) },
};

function lerp3(a: THREE.Vector3, b: THREE.Vector3, t: number): THREE.Vector3 {
  return new THREE.Vector3(
    a.x + (b.x - a.x) * t,
    a.y + (b.y - a.y) * t,
    a.z + (b.z - a.z) * t
  );
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export default function CinematicCamera({ phase }: CinematicCameraProps) {
  const { camera } = useThree();
  const lookTarget = useRef(new THREE.Vector3(0, 1.5, 0));

  useFrame(() => {
    const p = Math.min(1, Math.max(0, phase));

    let pos: THREE.Vector3;
    let look: THREE.Vector3;

    if (p < 0.3) {
      // Phase 1: Approach door
      const t = easeInOutCubic(p / 0.3);
      pos = lerp3(CAMERA_PATH.start.pos, CAMERA_PATH.door.pos, t);
      look = lerp3(CAMERA_PATH.start.look, CAMERA_PATH.door.look, t);
    } else if (p < 0.6) {
      // Phase 2: Enter through door
      const t = easeInOutCubic((p - 0.3) / 0.3);
      pos = lerp3(CAMERA_PATH.door.pos, CAMERA_PATH.inside.pos, t);
      look = lerp3(CAMERA_PATH.door.look, CAMERA_PATH.inside.look, t);
    } else {
      // Phase 3: Settle into seat
      const t = easeInOutCubic((p - 0.6) / 0.4);
      pos = lerp3(CAMERA_PATH.inside.pos, CAMERA_PATH.seated.pos, t);
      look = lerp3(CAMERA_PATH.inside.look, CAMERA_PATH.seated.look, t);
    }

    camera.position.copy(pos);
    lookTarget.current.lerp(look, 0.1);
    camera.lookAt(lookTarget.current);
  });

  return null;
}
