import { useEffect, useRef, useState, useCallback } from "react";
import {
  motion,
  AnimatePresence,
  useScroll,
  useTransform,
  useSpring,
} from "framer-motion";
import * as THREE from "three";

export default function ExploreButton() {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [sonarKey, setSonarKey] = useState(0);
  const [hideForContact, setHideForContact] = useState(false);

  // Parallax float
  const { scrollY } = useScroll();
  const floatY = useSpring(useTransform(scrollY, (v) => v * -0.1), {
    stiffness: 60,
    damping: 20,
  });

  // Hide near contact section
  useEffect(() => {
    const contactEl = document.getElementById("contact");
    if (!contactEl) return;
    const observer = new IntersectionObserver(
      ([entry]) => setHideForContact(entry.isIntersecting),
      { threshold: 0.3 }
    );
    observer.observe(contactEl);
    return () => observer.disconnect();
  }, []);

  // Dual sonar pings every 8s
  useEffect(() => {
    const interval = setInterval(() => setSonarKey((k) => k + 1), 8000);
    return () => clearInterval(interval);
  }, []);

  // Three.js portal scene
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const frameRef = useRef(0);
  const speedRef = useRef(1);

  const initScene = useCallback((container: HTMLDivElement) => {
    const size = container.clientWidth;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 20);
    camera.position.set(0, 0, 3);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "low-power",
    });
    renderer.setSize(size, size);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.4;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Main torus
    const torusGeo = new THREE.TorusGeometry(0.75, 0.06, 20, 80);
    const torusMat = new THREE.MeshStandardMaterial({
      color: 0x00e5cc,
      emissive: 0x00e5cc,
      emissiveIntensity: 1.2,
      roughness: 0.2,
      metalness: 0.8,
    });
    const torus = new THREE.Mesh(torusGeo, torusMat);
    scene.add(torus);

    // Inner glow disc
    const discGeo = new THREE.CircleGeometry(0.6, 32);
    const discMat = new THREE.MeshBasicMaterial({
      color: 0x00e5cc,
      transparent: true,
      opacity: 0.08,
      side: THREE.DoubleSide,
    });
    const disc = new THREE.Mesh(discGeo, discMat);
    scene.add(disc);

    // Second inner ring for depth
    const innerRingGeo = new THREE.TorusGeometry(0.45, 0.02, 12, 48);
    const innerRingMat = new THREE.MeshBasicMaterial({
      color: 0x00e5cc,
      transparent: true,
      opacity: 0.3,
    });
    const innerRing = new THREE.Mesh(innerRingGeo, innerRingMat);
    scene.add(innerRing);

    // Orbiting particles
    const pCount = 14;
    const pPositions = new Float32Array(pCount * 3);
    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute("position", new THREE.BufferAttribute(pPositions, 3));
    const pMat = new THREE.PointsMaterial({
      color: 0x00e5cc,
      size: 0.06,
      transparent: true,
      opacity: 0.9,
      sizeAttenuation: true,
    });
    const particles = new THREE.Points(pGeo, pMat);
    scene.add(particles);

    // Lighting
    scene.add(new THREE.AmbientLight(0x1a1d3a, 0.6));
    const pl = new THREE.PointLight(0x00e5cc, 3, 10);
    pl.position.set(0, 0, 2);
    scene.add(pl);
    const backLight = new THREE.PointLight(0x00e5cc, 1, 6);
    backLight.position.set(0, 0, -2);
    scene.add(backLight);

    const clock = new THREE.Clock();
    const animate = () => {
      frameRef.current = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();
      const speed = speedRef.current;

      torus.rotation.y = t * 0.5 * speed;
      torus.rotation.x = Math.sin(t * 0.3) * 0.2;
      disc.rotation.y = t * 0.5 * speed;
      disc.rotation.x = Math.sin(t * 0.3) * 0.2;
      innerRing.rotation.y = -t * 0.3 * speed;
      innerRing.rotation.x = Math.sin(t * 0.25) * 0.15 + 0.3;

      disc.material.opacity = 0.06 + Math.sin(t * 1.5) * 0.04;
      torusMat.emissiveIntensity = 1.0 + Math.sin(t * 0.8) * 0.4;

      const posArr = pGeo.attributes.position.array as Float32Array;
      for (let i = 0; i < pCount; i++) {
        const angle = (i / pCount) * Math.PI * 2 + t * 0.8 * speed;
        const r = 0.85 + Math.sin(t * 2 + i) * 0.12;
        posArr[i * 3] = Math.cos(angle) * r;
        posArr[i * 3 + 1] = Math.sin(angle) * r;
        posArr[i * 3 + 2] = Math.sin(t * 0.7 + i * 0.8) * 0.25;
      }
      pGeo.attributes.position.needsUpdate = true;

      pl.intensity = 3 + Math.sin(t * 0.8) * 0.8;
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(frameRef.current);
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  useEffect(() => {
    const container = canvasRef.current;
    if (!container) return;
    return initScene(container);
  }, [initScene]);

  useEffect(() => {
    speedRef.current = hovered ? 3 : 1;
  }, [hovered]);

  return (
        <motion.div
          className="fixed bottom-6 right-6 z-40"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{
            opacity: hideForContact ? 0 : 1,
            scale: hideForContact ? 0.8 : 1,
            pointerEvents: hideForContact ? "none" as const : "auto" as const,
          }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          style={{ y: floatY }}
        >
          {/* Tooltip */}
          <AnimatePresence>
            {showTooltip && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                className="absolute -top-12 left-1/2 -translate-x-1/2 whitespace-nowrap bg-bg-surface/90 backdrop-blur-xl border border-border-subtle/50 rounded-lg px-3 py-1.5 font-mono text-xs text-accent-cyan shadow-lg shadow-accent-cyan/10"
              >
                Enter 3D World
                {/* Arrow */}
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 rotate-45 bg-bg-surface/90 border-r border-b border-border-subtle/50" />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Hover bloom glow */}
          <motion.div
            className="absolute inset-0 rounded-full bg-accent-cyan/20 blur-2xl pointer-events-none"
            animate={{ scale: hovered ? 2.5 : 1, opacity: hovered ? 1 : 0 }}
            transition={{ duration: 0.4 }}
          />

          {/* Dual sonar pings */}
          <div key={sonarKey} className="absolute inset-0 pointer-events-none">
            <div className="absolute inset-0 rounded-full border border-accent-cyan/30 animate-sonar" />
            <div className="absolute inset-0 rounded-full border border-accent-cyan/20 animate-sonar-delayed" />
          </div>

          {/* Spinning gradient border — dual layer */}
          <div className="absolute -inset-[3px] rounded-full animate-spin-slow">
            <div
              className="w-full h-full rounded-full"
              style={{
                background: `conic-gradient(from 0deg, #00e5cc, transparent 30%, transparent 50%, #00e5cc 70%, transparent 100%)`,
                opacity: hovered ? 0.9 : 0.5,
                transition: "opacity 0.3s",
              }}
            />
          </div>
          <div
            className="absolute -inset-[2px] rounded-full"
            style={{
              animation: "spin-slow 12s linear infinite reverse",
            }}
          >
            <div
              className="w-full h-full rounded-full"
              style={{
                background: `conic-gradient(from 180deg, transparent, #00e5cc 20%, transparent 40%)`,
                opacity: hovered ? 0.6 : 0.25,
                transition: "opacity 0.3s",
                animation: "spin-slow 12s linear infinite reverse",
              }}
            />
          </div>

          {/* Glass ring */}
          <div className="absolute -inset-[1px] rounded-full border border-accent-cyan/10 backdrop-blur-sm pointer-events-none" />

          {/* Button */}
          <a
            href="/explore"
            className="relative block w-[72px] h-[72px] sm:w-[88px] sm:h-[88px] rounded-full overflow-hidden bg-bg-primary border border-border-subtle/60"
            onMouseEnter={() => {
              setHovered(true);
              setShowTooltip(true);
            }}
            onMouseLeave={() => {
              setHovered(false);
              setShowTooltip(false);
            }}
          >
            <div ref={canvasRef} className="w-full h-full" />
          </a>
        </motion.div>
  );
}
