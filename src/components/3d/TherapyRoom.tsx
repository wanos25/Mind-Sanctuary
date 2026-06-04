import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import DustParticles from '@/components/3d/DustParticles';

// Warm color palette matching the app theme
const COLORS = {
  floor: '#2a1f17',
  floorAccent: '#3d2e22',
  wall: '#1e1510',
  wallAccent: '#2a1f17',
  ceiling: '#1a130e',
  desk: '#3d2e22',
  deskTop: '#4a3828',
  chair: '#2d2118',
  chairCushion: '#4a3525',
  lounge: '#3a2a1e',
  loungeCushion: '#5a4030',
  plant: '#2d4a2d',
  plantDark: '#1e3a1e',
  plantPot: '#4a3525',
  gold: '#c9a84c',
  goldDark: '#8a7030',
  bookshelf: '#3a2a1e',
  book1: '#6b3a3a',
  book2: '#3a4a6b',
  book3: '#5a6b3a',
  rug: '#4a3020',
  rugBorder: '#6a4830',
  frame: '#5a4530',
  lamp: '#2a2018',
  lampShade: '#c9a84c',
};

// Floor with wooden plank effect
function Floor() {
  return (
    <group>
      {/* Main floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[12, 12]} />
        <meshStandardMaterial color={COLORS.floor} roughness={0.7} />
      </mesh>
      {/* Floor planks (subtle lines) */}
      {Array.from({ length: 12 }).map((_, i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[-5.5 + i, 0.001, 0]}>
          <planeGeometry args={[0.02, 12]} />
          <meshStandardMaterial color={COLORS.floorAccent} roughness={0.5} />
        </mesh>
      ))}
      {/* Decorative rug */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0.5]} receiveShadow>
        <planeGeometry args={[4, 3]} />
        <meshStandardMaterial color={COLORS.rug} roughness={0.9} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.006, 0.5]}>
        <ringGeometry args={[1.2, 1.5, 64]} />
        <meshStandardMaterial color={COLORS.rugBorder} roughness={0.8} />
      </mesh>
    </group>
  );
}

// Walls
function Walls() {
  return (
    <group>
      {/* Back wall */}
      <mesh position={[0, 2, -6]} receiveShadow>
        <planeGeometry args={[12, 4]} />
        <meshStandardMaterial color={COLORS.wall} roughness={0.8} />
      </mesh>
      {/* Left wall */}
      <mesh position={[-6, 2, 0]} rotation={[0, Math.PI / 2, 0]} receiveShadow>
        <planeGeometry args={[12, 4]} />
        <meshStandardMaterial color={COLORS.wallAccent} roughness={0.8} />
      </mesh>
      {/* Right wall */}
      <mesh position={[6, 2, 0]} rotation={[0, -Math.PI / 2, 0]} receiveShadow>
        <planeGeometry args={[12, 4]} />
        <meshStandardMaterial color={COLORS.wallAccent} roughness={0.8} />
      </mesh>
      {/* Ceiling */}
      <mesh position={[0, 4, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[12, 12]} />
        <meshStandardMaterial color={COLORS.ceiling} roughness={0.9} />
      </mesh>
      {/* Baseboard trim */}
      <mesh position={[0, 0.1, -5.98]}>
        <boxGeometry args={[12, 0.2, 0.05]} />
        <meshStandardMaterial color={COLORS.deskTop} roughness={0.6} />
      </mesh>
    </group>
  );
}

// Therapist desk
function Desk() {
  return (
    <group position={[0, 0, -4]}>
      {/* Desktop */}
      <mesh position={[0, 0.85, 0]} castShadow>
        <boxGeometry args={[2.4, 0.06, 1]} />
        <meshStandardMaterial color={COLORS.deskTop} roughness={0.4} metalness={0.1} />
      </mesh>
      {/* Front panel */}
      <mesh position={[0, 0.42, 0.48]}>
        <boxGeometry args={[2.3, 0.8, 0.04]} />
        <meshStandardMaterial color={COLORS.desk} roughness={0.7} />
      </mesh>
      {/* Legs */}
      {[[-1.1, 0.42, -0.45], [1.1, 0.42, -0.45], [-1.1, 0.42, 0.45], [1.1, 0.42, 0.45]].map((pos, i) => (
        <mesh key={i} position={pos as [number, number, number]} castShadow>
          <boxGeometry args={[0.08, 0.84, 0.08]} />
          <meshStandardMaterial color={COLORS.desk} roughness={0.6} />
        </mesh>
      ))}
      {/* Desk items - small lamp */}
      <mesh position={[-0.8, 1.1, -0.2]} castShadow>
        <cylinderGeometry args={[0.12, 0.15, 0.5, 8]} />
        <meshStandardMaterial color={COLORS.lamp} roughness={0.5} />
      </mesh>
      <mesh position={[-0.8, 1.4, -0.2]}>
        <coneGeometry args={[0.2, 0.15, 8, 1, true]} />
        <meshStandardMaterial color={COLORS.lampShade} roughness={0.3} metalness={0.3} emissive={COLORS.gold} emissiveIntensity={0.3} side={THREE.DoubleSide} />
      </mesh>
      {/* Notepad */}
      <mesh position={[0.3, 0.89, 0]}>
        <boxGeometry args={[0.3, 0.02, 0.4]} />
        <meshStandardMaterial color="#e8e0d0" roughness={0.9} />
      </mesh>
      {/* Pen */}
      <mesh position={[0.55, 0.9, 0]} rotation={[0, 0.3, 0]}>
        <cylinderGeometry args={[0.01, 0.01, 0.18, 6]} />
        <meshStandardMaterial color={COLORS.goldDark} metalness={0.5} roughness={0.3} />
      </mesh>
    </group>
  );
}

// Therapist chair
function TherapistChair() {
  return (
    <group position={[0, 0, -5]}>
      {/* Seat */}
      <mesh position={[0, 0.5, 0]} castShadow>
        <boxGeometry args={[0.6, 0.08, 0.6]} />
        <meshStandardMaterial color={COLORS.chairCushion} roughness={0.8} />
      </mesh>
      {/* Backrest */}
      <mesh position={[0, 0.9, -0.28]}>
        <boxGeometry args={[0.6, 0.7, 0.08]} />
        <meshStandardMaterial color={COLORS.chairCushion} roughness={0.8} />
      </mesh>
      {/* Legs */}
      {[[-0.25, 0.24, -0.25], [0.25, 0.24, -0.25], [-0.25, 0.24, 0.25], [0.25, 0.24, 0.25]].map((pos, i) => (
        <mesh key={i} position={pos as [number, number, number]}>
          <cylinderGeometry args={[0.025, 0.025, 0.48, 6]} />
          <meshStandardMaterial color={COLORS.chair} roughness={0.6} />
        </mesh>
      ))}
      {/* Armrests */}
      {[-0.33, 0.33].map((x, i) => (
        <mesh key={i} position={[x, 0.72, 0]}>
          <boxGeometry args={[0.06, 0.06, 0.5]} />
          <meshStandardMaterial color={COLORS.chair} roughness={0.6} />
        </mesh>
      ))}
    </group>
  );
}

// Patient chaise lounge
function ChaiseLonge() {
  return (
    <group position={[0, 0, 0.5]} rotation={[0, 0, 0]}>
      {/* Base */}
      <mesh position={[0, 0.25, 0]} castShadow>
        <boxGeometry args={[1, 0.12, 2.2]} />
        <meshStandardMaterial color={COLORS.lounge} roughness={0.7} />
      </mesh>
      {/* Cushion */}
      <mesh position={[0, 0.36, 0]} castShadow>
        <boxGeometry args={[0.9, 0.1, 2.1]} />
        <meshStandardMaterial color={COLORS.loungeCushion} roughness={0.9} />
      </mesh>
      {/* Headrest (elevated end) */}
      <mesh position={[0, 0.5, -1]} castShadow>
        <boxGeometry args={[0.9, 0.3, 0.4]} />
        <meshStandardMaterial color={COLORS.loungeCushion} roughness={0.9} />
      </mesh>
      {/* Legs */}
      {[[-0.4, 0.1, -1], [0.4, 0.1, -1], [-0.4, 0.1, 1], [0.4, 0.1, 1]].map((pos, i) => (
        <mesh key={i} position={pos as [number, number, number]}>
          <cylinderGeometry args={[0.035, 0.04, 0.2, 8]} />
          <meshStandardMaterial color={COLORS.lounge} roughness={0.6} />
        </mesh>
      ))}
      {/* Pillow */}
      <mesh position={[0, 0.55, -0.8]}>
        <boxGeometry args={[0.5, 0.12, 0.3]} />
        <meshStandardMaterial color={COLORS.rugBorder} roughness={0.95} />
      </mesh>
    </group>
  );
}

// Potted plant
function Plant({ position, scale = 1 }: { position: [number, number, number]; scale?: number }) {
  const plantRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (plantRef.current) {
      plantRef.current.rotation.z = Math.sin(clock.elapsedTime * 0.5) * 0.02;
    }
  });

  return (
    <group position={position} scale={scale} ref={plantRef}>
      {/* Pot */}
      <mesh position={[0, 0.2, 0]} castShadow>
        <cylinderGeometry args={[0.18, 0.14, 0.4, 8]} />
        <meshStandardMaterial color={COLORS.plantPot} roughness={0.8} />
      </mesh>
      {/* Soil */}
      <mesh position={[0, 0.41, 0]}>
        <cylinderGeometry args={[0.16, 0.16, 0.02, 8]} />
        <meshStandardMaterial color="#2a1a10" roughness={1} />
      </mesh>
      {/* Leaves (multiple cones for bushy look) */}
      {[
        [0, 0.7, 0, 0],
        [0.08, 0.65, 0.08, 0.2],
        [-0.08, 0.68, -0.05, -0.15],
        [0.05, 0.62, -0.08, 0.3],
        [-0.06, 0.66, 0.06, -0.25],
      ].map(([x, y, z, rot], i) => (
        <mesh key={i} position={[x, y, z] as [number, number, number]} rotation={[rot * 0.3, rot, 0]}>
          <coneGeometry args={[0.12, 0.35, 6]} />
          <meshStandardMaterial color={i % 2 === 0 ? COLORS.plant : COLORS.plantDark} roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
}

// Bookshelf
function Bookshelf() {
  const bookColors = [COLORS.book1, COLORS.book2, COLORS.book3, COLORS.goldDark, COLORS.book1];
  return (
    <group position={[-5.5, 0, -3]}>
      {/* Shelf frame */}
      <mesh position={[0, 1.5, 0]}>
        <boxGeometry args={[0.8, 2.8, 0.35]} />
        <meshStandardMaterial color={COLORS.bookshelf} roughness={0.7} />
      </mesh>
      {/* Shelves */}
      {[0.5, 1.2, 1.9, 2.6].map((y, i) => (
        <mesh key={i} position={[0, y, 0.02]}>
          <boxGeometry args={[0.72, 0.04, 0.32]} />
          <meshStandardMaterial color={COLORS.deskTop} roughness={0.6} />
        </mesh>
      ))}
      {/* Books */}
      {[0.5, 1.2, 1.9].map((shelfY, si) =>
        Array.from({ length: 5 }).map((_, bi) => (
          <mesh key={`${si}-${bi}`} position={[-0.25 + bi * 0.12, shelfY + 0.17, 0.02]}>
            <boxGeometry args={[0.08, 0.28 - bi * 0.02, 0.2]} />
            <meshStandardMaterial color={bookColors[(si + bi) % bookColors.length]} roughness={0.8} />
          </mesh>
        ))
      )}
    </group>
  );
}

// Wall art / frame
function WallFrame({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      {/* Frame */}
      <mesh>
        <boxGeometry args={[0.8, 0.6, 0.04]} />
        <meshStandardMaterial color={COLORS.frame} roughness={0.5} metalness={0.1} />
      </mesh>
      {/* Canvas */}
      <mesh position={[0, 0, 0.025]}>
        <planeGeometry args={[0.65, 0.45]} />
        <meshStandardMaterial color="#2a3a2a" roughness={0.9} />
      </mesh>
    </group>
  );
}

// Side table with flower vase
function SideTable({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      {/* Table top */}
      <mesh position={[0, 0.55, 0]} castShadow>
        <cylinderGeometry args={[0.3, 0.3, 0.04, 12]} />
        <meshStandardMaterial color={COLORS.deskTop} roughness={0.5} />
      </mesh>
      {/* Leg */}
      <mesh position={[0, 0.27, 0]}>
        <cylinderGeometry args={[0.04, 0.06, 0.54, 8]} />
        <meshStandardMaterial color={COLORS.desk} roughness={0.6} />
      </mesh>
      {/* Base */}
      <mesh position={[0, 0.02, 0]}>
        <cylinderGeometry args={[0.2, 0.2, 0.04, 12]} />
        <meshStandardMaterial color={COLORS.desk} roughness={0.6} />
      </mesh>
      {/* Vase */}
      <mesh position={[0, 0.72, 0]}>
        <cylinderGeometry args={[0.06, 0.08, 0.3, 8]} />
        <meshStandardMaterial color={COLORS.gold} roughness={0.3} metalness={0.4} />
      </mesh>
      {/* Flowers */}
      {[0, 1.2, 2.4, 3.6, 5].map((angle, i) => (
        <mesh key={i} position={[Math.cos(angle) * 0.05, 0.92 + i * 0.02, Math.sin(angle) * 0.05]}>
          <sphereGeometry args={[0.04, 6, 6]} />
          <meshStandardMaterial color={i % 2 === 0 ? '#c95a5a' : '#e8a0a0'} roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
}

// Clinic door
function Door({ openAmount }: { openAmount: number }) {
  return (
    <group position={[0, 0, 5.9]}>
      {/* Door frame */}
      <mesh position={[0, 2, 0]}>
        <boxGeometry args={[2.2, 4, 0.15]} />
        <meshStandardMaterial color={COLORS.deskTop} roughness={0.6} />
      </mesh>
      {/* Left door */}
      <group position={[-0.95, 0, 0]}>
        <group rotation={[0, -openAmount * Math.PI * 0.4, 0]}>
          <mesh position={[0.475, 2, 0]} castShadow>
            <boxGeometry args={[0.95, 3.8, 0.1]} />
            <meshStandardMaterial color={COLORS.desk} roughness={0.6} />
          </mesh>
          {/* Handle */}
          <mesh position={[0.85, 2, 0.08]}>
            <sphereGeometry args={[0.04, 8, 8]} />
            <meshStandardMaterial color={COLORS.gold} metalness={0.6} roughness={0.3} />
          </mesh>
        </group>
      </group>
      {/* Right door */}
      <group position={[0.95, 0, 0]}>
        <group rotation={[0, openAmount * Math.PI * 0.4, 0]}>
          <mesh position={[-0.475, 2, 0]} castShadow>
            <boxGeometry args={[0.95, 3.8, 0.1]} />
            <meshStandardMaterial color={COLORS.desk} roughness={0.6} />
          </mesh>
          <mesh position={[-0.85, 2, 0.08]}>
            <sphereGeometry args={[0.04, 8, 8]} />
            <meshStandardMaterial color={COLORS.gold} metalness={0.6} roughness={0.3} />
          </mesh>
        </group>
      </group>
    </group>
  );
}

// Lighting setup
function Lighting() {
  return (
    <>
      <ambientLight intensity={0.15} color="#c9a84c" />
      {/* Main warm overhead */}
      <pointLight position={[0, 3.8, -2]} intensity={1.5} color="#e8c878" distance={12} castShadow shadow-mapSize={[512, 512]} />
      {/* Desk lamp glow */}
      <pointLight position={[-0.8, 1.6, -4.2]} intensity={0.8} color="#e8c060" distance={5} />
      {/* Soft fill from the side */}
      <pointLight position={[4, 2.5, 0]} intensity={0.4} color="#d4a04c" distance={8} />
      {/* Back wall accent */}
      <spotLight position={[0, 3.5, -4]} angle={0.5} penumbra={0.8} intensity={0.6} color="#c9a84c" target-position={[0, 1.5, -5.5]} />
      {/* Door light */}
      <pointLight position={[0, 3, 5]} intensity={0.3} color="#e8d0a0" distance={6} />
    </>
  );
}

export default function TherapyRoom({ doorOpen, showParticles = true }: { doorOpen: number; showParticles?: boolean }) {
  return (
    <>
      <Lighting />
      <fog attach="fog" args={['#1a130e', 6, 16]} />
      <Floor />
      <Walls />
      <Door openAmount={doorOpen} />
      <Desk />
      <TherapistChair />
      <ChaiseLonge />
      <Bookshelf />
      <Plant position={[-4.5, 0, -4.5]} scale={1.3} />
      <Plant position={[4.5, 0, -4]} scale={1} />
      <Plant position={[3, 0, -5]} scale={0.8} />
      <SideTable position={[2, 0, 0.5]} />
      <SideTable position={[-2, 0, -1]} />
      <WallFrame position={[0, 2.8, -5.95]} />
      <WallFrame position={[-2, 2.5, -5.95]} />
      {showParticles && <DustParticles />}
    </>
  );
}
