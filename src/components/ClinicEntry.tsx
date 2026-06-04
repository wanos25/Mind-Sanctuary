import { useEffect, useState, useRef, Suspense, lazy } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Canvas } from '@react-three/fiber';
import { useApp } from '@/context/AppContext';
import { useSound } from '@/context/SoundContext';


const TherapyRoom = lazy(() => import('@/components/3d/TherapyRoom'));
const CinematicCamera = lazy(() => import('@/components/3d/CinematicCamera'));
const TherapistCharacter = lazy(() => import('@/components/3d/TherapistCharacter'));
const VolumetricLightBeams = lazy(() => import('@/components/3d/VolumetricLightBeams'));

const SCENES = [
  { text: "Approaching the clinic...", duration: 2500 },
  { text: "The door opens slowly...", duration: 3000 },
  { text: "Warm light fills the room...", duration: 2500 },
  { text: "Walking toward the therapist's office...", duration: 3000 },
  { text: "Taking a seat...", duration: 2500 },
  { text: "The session is about to begin...", duration: 2500 },
];

const TOTAL_DURATION = SCENES.reduce((sum, s) => sum + s.duration, 0);

const ClinicEntry = () => {
  const { setStage, profile, cinematicPending, setCinematicPending } = useApp();
  const sound = useSound();
  const [started, setStarted] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [sceneIndex, setSceneIndex] = useState(0);
  const [showSkip, setShowSkip] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);

  // Cinematic gating — if no replay is queued (deep link, stage refresh, or
  // a non-cinematic open path), jump straight to `session` without mounting
  // the 3D Canvas. Preserves the approved cinematic rules.
  useEffect(() => {
    if (!cinematicPending) setStage('session');
  }, [cinematicPending, setStage]);

  // Cinematic timeline
  useEffect(() => {
    if (!started) return;

    const start = Date.now();
    const interval = setInterval(() => {
      const ms = Date.now() - start;
      setElapsed(ms);

      let acc = 0;
      for (let i = 0; i < SCENES.length; i++) {
        acc += SCENES[i].duration;
        if (ms < acc) {
          setSceneIndex(i);
          return;
        }
      }
      setFadeOut(true);
      clearInterval(interval);
      setTimeout(() => { setCinematicPending(false); setStage('interview'); }, 1200);
    }, 50);

    return () => clearInterval(interval);
  }, [started, setStage, setCinematicPending]);

  // Trigger sounds at specific scene phases
  useEffect(() => {
    if (!started) return;

    console.log(`Scene ${sceneIndex}: ${SCENES[sceneIndex]?.text}`);

    // Scene 1 (door): play door open sound
    if (sceneIndex === 1) {
      console.log("Triggering door open sound (scene 1)");
      sound.playDoorOpen();
    }
    // Scene 3 (walking): play footsteps
    if (sceneIndex === 3) {
      console.log("Triggering footsteps sound (scene 3)");
      sound.playFootsteps(4);
    }
  }, [sceneIndex, started, sound]);

  useEffect(() => {
    if (!started) return;
    const t = setTimeout(() => setShowSkip(true), 2000);
    return () => clearTimeout(t);
  }, [started]);

  const skip = () => {
    sound.playClick();
    setFadeOut(true);
    setTimeout(() => { setCinematicPending(false); setStage('interview'); }, 600);
  };

  const handleStart = () => {
    console.log("Entering clinic - unlocking sound and starting animation");
    sound.unlock();
    sound.playClick();
    setStarted(true);
  };

  const phase = Math.min(1, elapsed / TOTAL_DURATION);
  const doorOpen = Math.min(1, Math.max(0, (phase - 0.1) / 0.25));
  const progressPercent = phase * 100;

  // Dispose WebGL renderer on unmount to free context before next Canvas mounts
  const glRef = useRef<any>(null);
  useEffect(() => {
    return () => {
      if (glRef.current) {
        glRef.current.dispose();
        glRef.current.forceContextLoss();
        glRef.current = null;
        console.log('ClinicEntry: WebGL context disposed');
      }
    };
  }, []);

  if (!cinematicPending) {
    return <div className="min-h-screen bg-background" aria-hidden />;
  }

  return (
    <div className="min-h-screen relative overflow-hidden">

      {/* 3D Canvas */}
      <div className="absolute inset-0">
        <Canvas
          shadows
          camera={{ fov: 55, near: 0.1, far: 50 }}
          gl={{ antialias: false, alpha: false, powerPreference: 'low-power' }}
          style={{ background: '#0d0a07' }}
          onCreated={({ gl }) => {
            glRef.current = gl;
            gl.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
          }}
        >
          <Suspense fallback={null}>
            <TherapyRoom doorOpen={doorOpen} />
            <TherapistCharacter />
            <VolumetricLightBeams />
            {started && <CinematicCamera phase={phase} />}
          </Suspense>
        </Canvas>
      </div>


      {/* Warm vignette overlay */}
      <div className="absolute inset-0 pointer-events-none warm-vignette" />

      {/* Start screen */}
      <AnimatePresence>
        {!started && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8 }}
            className="absolute inset-0 z-20 flex flex-col items-center justify-center"
          >
            <motion.div
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.5, duration: 0.8 }}
              className="text-center"
            >
              <h1 className="text-3xl md:text-5xl font-display gold-text text-glow tracking-widest mb-4">
                MIND SENTINEL
              </h1>
              <p className="text-sm font-ui text-muted-foreground mb-10 tracking-wider">
                Your psychological sanctuary awaits
              </p>
              <motion.button
                onClick={handleStart}
                className="sentinel-btn gold-glow text-base px-12 py-4"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.98 }}
              >
                Enter Clinic
              </motion.button>
              <p className="text-[10px] text-muted-foreground/50 mt-4 font-ui">
                🔊 Click to enable immersive audio
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Text overlay */}
      {started && (
        <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
          <AnimatePresence mode="wait">
            {!fadeOut && sceneIndex < SCENES.length && (
              <motion.div
                key={sceneIndex}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.6 }}
                className="text-center"
              >
                <p className="text-2xl md:text-3xl font-display text-foreground text-glow tracking-wider">
                  {SCENES[sceneIndex].text}
                </p>
                {profile && (
                  <p className="text-sm font-ui text-muted-foreground mt-4">
                    Welcome, {profile.nickname || 'traveler'}
                  </p>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Progress bar */}
      {started && (
        <div className="absolute bottom-12 left-1/2 -translate-x-1/2 w-64 z-10">
          <div className="h-0.5 bg-secondary rounded-full overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{ background: 'var(--gradient-gold)' }}
              animate={{ width: `${progressPercent}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </div>
      )}

      {/* Skip button */}
      <AnimatePresence>
        {showSkip && !fadeOut && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={skip}
            className="absolute bottom-6 right-6 sentinel-btn-outline text-xs py-2 px-4 z-10"
          >
            Skip →
          </motion.button>
        )}
      </AnimatePresence>

      {/* Fade out overlay */}
      <AnimatePresence>
        {fadeOut && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1 }}
            className="absolute inset-0 z-20 bg-background"
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default ClinicEntry;
