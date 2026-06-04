import { useRef, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

interface TherapistCharacterProps {
  isSpeaking?: boolean;
  emotionPrimary?: string;
}

/** Map emotion to facial expression params */
function getExpressionParams(emotion?: string) {
  if (!emotion) return { browTilt: 0, mouthCurve: 0, eyeOpenness: 1 };
  const e = emotion.toLowerCase();
  if (e.includes('sadness') || e.includes('depress')) return { browTilt: 0.12, mouthCurve: -0.008, eyeOpenness: 0.9 };
  if (e.includes('anxiety') || e.includes('stress')) return { browTilt: 0.08, mouthCurve: 0, eyeOpenness: 1.05 };
  if (e.includes('calm') || e.includes('positive')) return { browTilt: -0.04, mouthCurve: 0.01, eyeOpenness: 1 };
  if (e.includes('burnout')) return { browTilt: 0.1, mouthCurve: -0.005, eyeOpenness: 0.85 };
  return { browTilt: 0, mouthCurve: 0, eyeOpenness: 1 };
}

export default function TherapistCharacter({ isSpeaking = false, emotionPrimary }: TherapistCharacterProps) {
  const groupRef = useRef<THREE.Group>(null);
  const headRef = useRef<THREE.Group>(null);
  const leftHandRef = useRef<THREE.Mesh>(null);
  const rightHandRef = useRef<THREE.Mesh>(null);
  const chestRef = useRef<THREE.Mesh>(null);
  const leftEyelidRef = useRef<THREE.Mesh>(null);
  const rightEyelidRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.PointLight>(null);
  const leftPupilRef = useRef<THREE.Mesh>(null);
  const rightPupilRef = useRef<THREE.Mesh>(null);
  const leftBrowRef = useRef<THREE.Mesh>(null);
  const rightBrowRef = useRef<THREE.Mesh>(null);
  const mouthRef = useRef<THREE.Mesh>(null);

  const { camera } = useThree();
  const expr = useMemo(() => getExpressionParams(emotionPrimary), [emotionPrimary]);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;

    // Breathing
    if (chestRef.current) {
      chestRef.current.scale.x = 1 + Math.sin(t * 0.8) * 0.015;
      chestRef.current.scale.z = 1 + Math.sin(t * 0.8) * 0.01;
    }

    // Head subtle movement + lean when speaking
    if (headRef.current) {
      headRef.current.rotation.y = Math.sin(t * 0.3) * 0.04;
      headRef.current.rotation.x = Math.sin(t * 0.5) * 0.02 + (isSpeaking ? -0.05 : 0);
      // Subtle nod
      if (isSpeaking) {
        headRef.current.rotation.x += Math.sin(t * 1.8) * 0.015;
      }
    }

    // Eye tracking — pupils follow camera direction
    if (leftPupilRef.current && rightPupilRef.current && groupRef.current) {
      const worldPos = new THREE.Vector3();
      groupRef.current.getWorldPosition(worldPos);
      const dir = camera.position.clone().sub(worldPos).normalize();
      const eyeTrackX = THREE.MathUtils.clamp(dir.x * 0.004, -0.005, 0.005);
      const eyeTrackY = THREE.MathUtils.clamp(dir.y * 0.003, -0.003, 0.003);
      // Add micro-saccades
      const saccadeX = Math.sin(t * 3.7) * 0.001;
      const saccadeY = Math.cos(t * 4.3) * 0.0008;
      leftPupilRef.current.position.x = -0.04 + eyeTrackX + saccadeX;
      leftPupilRef.current.position.y = 0.02 + eyeTrackY + saccadeY;
      rightPupilRef.current.position.x = 0.04 + eyeTrackX + saccadeX;
      rightPupilRef.current.position.y = 0.02 + eyeTrackY + saccadeY;
    }

    // Blinking
    const blinkCycle = t % 4;
    const blinkAmount = blinkCycle > 3.8 && blinkCycle < 4.0 ? 1 : 0;
    if (leftEyelidRef.current) {
      leftEyelidRef.current.scale.y = blinkAmount > 0 ? 0.01 : 0.001;
      leftEyelidRef.current.visible = blinkAmount > 0;
    }
    if (rightEyelidRef.current) {
      rightEyelidRef.current.scale.y = blinkAmount > 0 ? 0.01 : 0.001;
      rightEyelidRef.current.visible = blinkAmount > 0;
    }

    // Facial expressions — eyebrows
    if (leftBrowRef.current) {
      leftBrowRef.current.rotation.z = 0.1 + expr.browTilt;
      leftBrowRef.current.position.y = 0.055 + (isSpeaking ? Math.sin(t * 1.5) * 0.003 : 0);
    }
    if (rightBrowRef.current) {
      rightBrowRef.current.rotation.z = -0.1 - expr.browTilt;
      rightBrowRef.current.position.y = 0.055 + (isSpeaking ? Math.sin(t * 1.5 + 0.5) * 0.003 : 0);
    }

    // Mouth expression
    if (mouthRef.current) {
      mouthRef.current.scale.x = 1 + expr.mouthCurve * 10;
      if (isSpeaking) {
        mouthRef.current.scale.y = 1 + Math.abs(Math.sin(t * 3)) * 0.8;
      } else {
        mouthRef.current.scale.y = 1;
      }
    }

    // Hand gestures
    if (leftHandRef.current) {
      leftHandRef.current.position.y = 0.72 + (isSpeaking ? Math.sin(t * 1.5) * 0.03 : 0);
      leftHandRef.current.rotation.z = isSpeaking ? Math.sin(t * 1.2) * 0.1 : 0;
    }
    if (rightHandRef.current) {
      rightHandRef.current.position.y = 0.72 + (isSpeaking ? Math.sin(t * 1.3 + 1) * 0.025 : 0);
      rightHandRef.current.rotation.z = isSpeaking ? Math.sin(t * 1.1 + 0.5) * -0.08 : 0;
    }

    // Speaking glow
    if (glowRef.current) {
      glowRef.current.intensity = isSpeaking ? 0.6 + Math.sin(t * 2) * 0.2 : 0.2;
    }
  });

  const skinColor = '#c4956a';
  const hairColor = '#2a1a10';
  const shirtColor = '#3a4a5a';
  const pantsColor = '#2a2a30';

  return (
    <group ref={groupRef} position={[0, 0, -5]} rotation={[0, 0, 0]}>
      <pointLight ref={glowRef} position={[0, 1.5, 0.5]} intensity={0.2} color="#e8c878" distance={3} />

      {/* Legs */}
      <mesh position={[-0.12, 0.35, 0.15]} rotation={[0.8, 0, 0]}>
        <capsuleGeometry args={[0.07, 0.35, 4, 8]} />
        <meshStandardMaterial color={pantsColor} roughness={0.8} />
      </mesh>
      <mesh position={[0.12, 0.35, 0.15]} rotation={[0.8, 0, 0]}>
        <capsuleGeometry args={[0.07, 0.35, 4, 8]} />
        <meshStandardMaterial color={pantsColor} roughness={0.8} />
      </mesh>
      <mesh position={[-0.12, 0.25, 0.45]} rotation={[0.1, 0, 0]}>
        <capsuleGeometry args={[0.06, 0.3, 4, 8]} />
        <meshStandardMaterial color={pantsColor} roughness={0.8} />
      </mesh>
      <mesh position={[0.12, 0.25, 0.45]} rotation={[0.1, 0, 0]}>
        <capsuleGeometry args={[0.06, 0.3, 4, 8]} />
        <meshStandardMaterial color={pantsColor} roughness={0.8} />
      </mesh>

      {/* Torso */}
      <mesh ref={chestRef} position={[0, 0.85, 0]} castShadow>
        <capsuleGeometry args={[0.18, 0.35, 4, 8]} />
        <meshStandardMaterial color={shirtColor} roughness={0.7} />
      </mesh>

      {/* Shoulders */}
      <mesh position={[-0.22, 1.05, 0]}>
        <sphereGeometry args={[0.08, 8, 8]} />
        <meshStandardMaterial color={shirtColor} roughness={0.7} />
      </mesh>
      <mesh position={[0.22, 1.05, 0]}>
        <sphereGeometry args={[0.08, 8, 8]} />
        <meshStandardMaterial color={shirtColor} roughness={0.7} />
      </mesh>

      {/* Arms */}
      <mesh position={[-0.28, 0.88, 0.05]} rotation={[0.3, 0, 0.2]}>
        <capsuleGeometry args={[0.05, 0.25, 4, 8]} />
        <meshStandardMaterial color={shirtColor} roughness={0.7} />
      </mesh>
      <mesh position={[0.28, 0.88, 0.05]} rotation={[0.3, 0, -0.2]}>
        <capsuleGeometry args={[0.05, 0.25, 4, 8]} />
        <meshStandardMaterial color={shirtColor} roughness={0.7} />
      </mesh>
      <mesh position={[-0.32, 0.72, 0.18]} rotation={[0.8, 0, 0.1]}>
        <capsuleGeometry args={[0.04, 0.2, 4, 8]} />
        <meshStandardMaterial color={skinColor} roughness={0.8} />
      </mesh>
      <mesh position={[0.32, 0.72, 0.18]} rotation={[0.8, 0, -0.1]}>
        <capsuleGeometry args={[0.04, 0.2, 4, 8]} />
        <meshStandardMaterial color={skinColor} roughness={0.8} />
      </mesh>

      {/* Hands */}
      <mesh ref={leftHandRef} position={[-0.32, 0.72, 0.35]}>
        <sphereGeometry args={[0.04, 6, 6]} />
        <meshStandardMaterial color={skinColor} roughness={0.8} />
      </mesh>
      <mesh ref={rightHandRef} position={[0.32, 0.72, 0.35]}>
        <sphereGeometry args={[0.04, 6, 6]} />
        <meshStandardMaterial color={skinColor} roughness={0.8} />
      </mesh>

      {/* Neck */}
      <mesh position={[0, 1.15, 0]}>
        <cylinderGeometry args={[0.05, 0.06, 0.08, 8]} />
        <meshStandardMaterial color={skinColor} roughness={0.8} />
      </mesh>

      {/* Head group */}
      <group ref={headRef} position={[0, 1.32, 0]}>
        <mesh castShadow>
          <sphereGeometry args={[0.13, 12, 12]} />
          <meshStandardMaterial color={skinColor} roughness={0.7} />
        </mesh>

        {/* Hair */}
        <mesh position={[0, 0.06, -0.02]}>
          <sphereGeometry args={[0.135, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
          <meshStandardMaterial color={hairColor} roughness={0.9} />
        </mesh>

        {/* Eyes */}
        <mesh position={[-0.04, 0.02, 0.12]}>
          <sphereGeometry args={[0.018, 8, 8]} />
          <meshStandardMaterial color="#f0f0f0" roughness={0.3} />
        </mesh>
        <mesh position={[0.04, 0.02, 0.12]}>
          <sphereGeometry args={[0.018, 8, 8]} />
          <meshStandardMaterial color="#f0f0f0" roughness={0.3} />
        </mesh>

        {/* Pupils — tracked via refs */}
        <mesh ref={leftPupilRef} position={[-0.04, 0.02, 0.135]}>
          <sphereGeometry args={[0.008, 6, 6]} />
          <meshStandardMaterial color="#3a2a1a" roughness={0.5} />
        </mesh>
        <mesh ref={rightPupilRef} position={[0.04, 0.02, 0.135]}>
          <sphereGeometry args={[0.008, 6, 6]} />
          <meshStandardMaterial color="#3a2a1a" roughness={0.5} />
        </mesh>

        {/* Eyelids */}
        <mesh ref={leftEyelidRef} position={[-0.04, 0.035, 0.125]} visible={false}>
          <boxGeometry args={[0.04, 0.02, 0.015]} />
          <meshStandardMaterial color={skinColor} roughness={0.7} />
        </mesh>
        <mesh ref={rightEyelidRef} position={[0.04, 0.035, 0.125]} visible={false}>
          <boxGeometry args={[0.04, 0.02, 0.015]} />
          <meshStandardMaterial color={skinColor} roughness={0.7} />
        </mesh>

        {/* Eyebrows — reactive */}
        <mesh ref={leftBrowRef} position={[-0.04, 0.055, 0.12]} rotation={[0, 0, 0.1]}>
          <boxGeometry args={[0.04, 0.006, 0.01]} />
          <meshStandardMaterial color={hairColor} roughness={0.9} />
        </mesh>
        <mesh ref={rightBrowRef} position={[0.04, 0.055, 0.12]} rotation={[0, 0, -0.1]}>
          <boxGeometry args={[0.04, 0.006, 0.01]} />
          <meshStandardMaterial color={hairColor} roughness={0.9} />
        </mesh>

        {/* Nose */}
        <mesh position={[0, -0.01, 0.13]}>
          <coneGeometry args={[0.015, 0.03, 4]} />
          <meshStandardMaterial color={skinColor} roughness={0.7} />
        </mesh>

        {/* Mouth — reactive */}
        <mesh ref={mouthRef} position={[0, -0.04, 0.125]}>
          <boxGeometry args={[0.04, 0.005, 0.01]} />
          <meshStandardMaterial color="#a07050" roughness={0.8} />
        </mesh>

        {/* Glasses */}
        <mesh position={[-0.04, 0.02, 0.14]}>
          <ringGeometry args={[0.02, 0.024, 12]} />
          <meshStandardMaterial color="#8a7030" metalness={0.5} roughness={0.3} side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[0.04, 0.02, 0.14]}>
          <ringGeometry args={[0.02, 0.024, 12]} />
          <meshStandardMaterial color="#8a7030" metalness={0.5} roughness={0.3} side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[0, 0.02, 0.14]}>
          <boxGeometry args={[0.02, 0.003, 0.003]} />
          <meshStandardMaterial color="#8a7030" metalness={0.5} roughness={0.3} />
        </mesh>
      </group>
    </group>
  );
}
