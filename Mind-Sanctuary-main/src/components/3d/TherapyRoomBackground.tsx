import { useRef, useEffect, useState, Suspense, lazy } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { getGpuProfile } from '@/lib/gpu/quality';
import { gpuDiag } from '@/lib/gpu/diagnostics';


const TherapyRoom = lazy(() => import('@/components/3d/TherapyRoom'));
const DustParticles = lazy(() => import('@/components/3d/DustParticles'));
const TherapistCharacter = lazy(() => import('@/components/3d/TherapistCharacter'));
const VolumetricLightBeams = lazy(() => import('@/components/3d/VolumetricLightBeams'));

/** Enhanced parallax camera with drift and deeper depth separation */
function ParallaxCamera() {
  const { camera } = useThree();
  const mouse = useRef({ x: 0, y: 0 });
  const target = useRef(new THREE.Vector3(0, 1.2, -4));
  const driftOffset = useRef(0);

  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      mouse.current.x = (e.clientX / window.innerWidth - 0.5) * 2;
      mouse.current.y = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener('mousemove', handleMove);
    return () => window.removeEventListener('mousemove', handleMove);
  }, []);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    driftOffset.current = Math.sin(t * 0.15) * 0.08;

    const tx = mouse.current.x * 0.25 + driftOffset.current;
    const ty = -mouse.current.y * 0.12 + Math.sin(t * 0.2) * 0.03;

    camera.position.x += (tx - camera.position.x) * 0.025;
    camera.position.y += (1.2 + ty - camera.position.y) * 0.025;
    camera.position.z += (1.5 - camera.position.z) * 0.025;

    target.current.x += (mouse.current.x * 0.15 + Math.sin(t * 0.1) * 0.05 - target.current.x) * 0.025;
    target.current.y += (1.2 - mouse.current.y * 0.08 - target.current.y) * 0.025;

    camera.lookAt(target.current);
  });

  return null;
}

interface TherapyRoomBackgroundProps {
  opacity?: number;
  isSpeaking?: boolean;
  emotionPrimary?: string;
}

const TherapyRoomBackground = ({ opacity = 0.35, isSpeaking = false, emotionPrimary }: TherapyRoomBackgroundProps) => {
  const [mounted, setMounted] = useState(false);
  const [canvasReady, setCanvasReady] = useState(false);
  const [visible, setVisible] = useState(() => typeof document === 'undefined' || !document.hidden);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glRef = useRef<THREE.WebGLRenderer | null>(null);
  const profile = getGpuProfile();

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 1000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    gpuDiag.registerScene('TherapyRoomBackground');
    const onVis = () => setVisible(!document.hidden);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      gpuDiag.unregisterScene('TherapyRoomBackground');
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

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleContextLost = (e: Event) => {
      e.preventDefault();
      gpuDiag.noteContextLost();
      console.warn('WebGL context lost — will restore automatically');
    };
    const handleContextRestored = () => {
      gpuDiag.noteContextRestored();
      console.info('WebGL context restored');
    };

    canvas.addEventListener('webglcontextlost', handleContextLost);
    canvas.addEventListener('webglcontextrestored', handleContextRestored);
    return () => {
      canvas.removeEventListener('webglcontextlost', handleContextLost);
      canvas.removeEventListener('webglcontextrestored', handleContextRestored);
    };
  }, [mounted]);

  return (
    <div
      className="fixed inset-0 z-0 pointer-events-none"
      style={{ opacity }}
    >
      {/* Shimmer placeholder while waiting for Canvas */}
      {!canvasReady && (
        <div className="absolute inset-0 overflow-hidden" style={{ background: '#0d0a07' }}>
          <div
            className="absolute inset-0"
            style={{
              background: 'radial-gradient(ellipse at 50% 40%, rgba(180,140,80,0.08) 0%, transparent 70%)',
            }}
          />
          <div
            className="absolute inset-0 animate-shimmer-sweep"
            style={{
              background: 'linear-gradient(90deg, transparent 0%, rgba(180,140,80,0.06) 50%, transparent 100%)',
              backgroundSize: '200% 100%',
            }}
          />
        </div>
      )}

      {mounted && (
        <div
          className="absolute inset-0 transition-opacity duration-1000"
          style={{ opacity: canvasReady ? 1 : 0 }}
        >
          <Canvas
            ref={canvasRef}
            shadows={profile.tier === 'high'}
            camera={{ fov: 55, near: 0.1, far: 50 }}
            gl={{ antialias: false, alpha: false, powerPreference: 'low-power' }}
            style={{ background: '#0d0a07' }}
            frameloop={profile.reducedMotion || !visible ? 'demand' : 'always'}
            onCreated={({ gl }) => {
              glRef.current = gl;
              gpuDiag.registerRenderer();
              gl.setPixelRatio(Math.min(window.devicePixelRatio, profile.maxDpr));
              setTimeout(() => setCanvasReady(true), 200);
            }}
          >
            <Suspense fallback={null}>
              <TherapyRoom doorOpen={0} />
              <TherapistCharacter isSpeaking={isSpeaking} emotionPrimary={emotionPrimary} />
              <VolumetricLightBeams />
              {profile.tier !== 'low' && <DustParticles />}
              <ParallaxCamera />
            </Suspense>
          </Canvas>
        </div>
      )}
    </div>
  );
};

export default TherapyRoomBackground;
