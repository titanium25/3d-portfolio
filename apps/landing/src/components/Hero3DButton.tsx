import { useEffect, useRef, useState, useCallback } from "react";
import { motion } from "framer-motion";
import * as THREE from "three";

/**
 * Inline 3D CTA button — a pill-shaped container with a live Three.js scene
 * rendering a rotating crystalline wireframe + orbiting energy particles.
 * Completely different from the floating portal button.
 */
export default function Hero3DButton() {
  const canvasRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef(0);
  const hovRef = useRef(false);
  const [hovered, setHovered] = useState(false);

  const initScene = useCallback((el: HTMLDivElement) => {
    const w = el.clientWidth;
    const h = el.clientHeight;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, w / h, 0.1, 30);
    camera.position.set(0, 0, 4.2);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "low-power",
    });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.4;
    el.appendChild(renderer.domElement);

    // ── Wireframe icosahedron (crystal) ──
    const icoGeo = new THREE.IcosahedronGeometry(0.7, 1);
    const wireMat = new THREE.MeshBasicMaterial({
      color: 0x00e5cc,
      wireframe: true,
      transparent: true,
      opacity: 0.5,
    });
    const crystal = new THREE.Mesh(icoGeo, wireMat);
    scene.add(crystal);

    // ── Solid inner core ──
    const coreGeo = new THREE.IcosahedronGeometry(0.35, 2);
    const coreMat = new THREE.MeshStandardMaterial({
      color: 0x00e5cc,
      emissive: 0x00e5cc,
      emissiveIntensity: 0.8,
      roughness: 0.2,
      metalness: 0.9,
      transparent: true,
      opacity: 0.6,
    });
    const core = new THREE.Mesh(coreGeo, coreMat);
    scene.add(core);

    // ── Orbiting energy dots ──
    const dotCount = 24;
    const dotPos = new Float32Array(dotCount * 3);
    const dotGeo = new THREE.BufferGeometry();
    dotGeo.setAttribute("position", new THREE.BufferAttribute(dotPos, 3));
    const dotMat = new THREE.PointsMaterial({
      color: 0x00e5cc,
      size: 0.045,
      transparent: true,
      opacity: 0.9,
      sizeAttenuation: true,
      blending: THREE.AdditiveBlending,
    });
    scene.add(new THREE.Points(dotGeo, dotMat));

    // ── Trailing ring (flat ellipse) ──
    const ringGeo = new THREE.RingGeometry(0.9, 0.94, 64);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x00e5cc,
      transparent: true,
      opacity: 0.12,
      side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2.5;
    scene.add(ring);

    // ── Lighting ──
    scene.add(new THREE.AmbientLight(0x102030, 0.4));
    const pl = new THREE.PointLight(0x00e5cc, 3, 10);
    pl.position.set(0, 0, 3);
    scene.add(pl);

    const clock = new THREE.Clock();

    const animate = () => {
      frameRef.current = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();
      const fast = hovRef.current;
      const spd = fast ? 2.5 : 1;

      // Crystal rotates on 2 axes
      crystal.rotation.y = t * 0.4 * spd;
      crystal.rotation.x = t * 0.25 * spd;

      // Core spins opposite, slower
      core.rotation.y = -t * 0.6 * spd;
      core.rotation.z = t * 0.15 * spd;

      // Hover: expand crystal, brighten
      const targetScale = fast ? 1.15 : 1;
      crystal.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.1);
      coreMat.emissiveIntensity = (fast ? 1.4 : 0.8) + Math.sin(t * 1.5) * 0.3;
      wireMat.opacity = fast ? 0.7 : 0.45 + Math.sin(t * 0.8) * 0.08;
      ringMat.opacity = (fast ? 0.2 : 0.1) + Math.sin(t * 1.2) * 0.04;

      // Ring orbits
      ring.rotation.z = t * 0.3 * spd;

      // Orbiting dots — 3 separate orbit planes
      const dArr = dotGeo.attributes.position.array as Float32Array;
      for (let i = 0; i < dotCount; i++) {
        const orbit = i % 3;
        const angle = (i / dotCount) * Math.PI * 2 + t * (0.8 + orbit * 0.3) * spd;
        const r = 0.95 + Math.sin(t * 2 + i) * 0.08;
        if (orbit === 0) {
          dArr[i * 3] = Math.cos(angle) * r;
          dArr[i * 3 + 1] = Math.sin(angle) * r;
          dArr[i * 3 + 2] = Math.sin(angle * 0.5) * 0.2;
        } else if (orbit === 1) {
          dArr[i * 3] = Math.cos(angle) * r * 0.3;
          dArr[i * 3 + 1] = Math.sin(angle) * r;
          dArr[i * 3 + 2] = Math.cos(angle) * r * 0.8;
        } else {
          dArr[i * 3] = Math.sin(angle) * r * 0.8;
          dArr[i * 3 + 1] = Math.cos(angle) * r * 0.3;
          dArr[i * 3 + 2] = Math.cos(angle) * r;
        }
      }
      dotGeo.attributes.position.needsUpdate = true;

      pl.intensity = (fast ? 4 : 3) + Math.sin(t * 0.8) * 0.6;
      renderer.render(scene, camera);
    };
    animate();

    const onResize = () => {
      const nw = el.clientWidth;
      const nh = el.clientHeight;
      camera.aspect = nw / nh;
      camera.updateProjectionMatrix();
      renderer.setSize(nw, nh);
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(frameRef.current);
      window.removeEventListener("resize", onResize);
      renderer.dispose();
      if (el.contains(renderer.domElement)) {
        el.removeChild(renderer.domElement);
      }
    };
  }, []);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    return initScene(el);
  }, [initScene]);

  useEffect(() => {
    hovRef.current = hovered;
  }, [hovered]);

  return (
    <motion.a
      href="/explore"
      className="relative flex items-center gap-3 rounded-xl overflow-hidden cursor-pointer group"
      style={{
        height: 48,
        paddingRight: 20,
        border: "1px solid rgba(0,229,204,0.2)",
        background: "rgba(0,229,204,0.03)",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      whileHover={{
        borderColor: "rgba(0,229,204,0.45)",
        boxShadow: "0 0 24px rgba(0,229,204,0.1), 0 8px 32px rgba(0,229,204,0.06)",
      }}
      whileTap={{ scale: 0.97 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
    >
      {/* 3D canvas — square, left side of the button */}
      <div
        ref={canvasRef}
        className="w-[48px] h-[48px] shrink-0"
      />

      {/* Text */}
      <span className="font-semibold text-sm text-accent-cyan whitespace-nowrap group-hover:text-white transition-colors duration-300">
        Explore 3D World
      </span>
      <motion.span
        className="text-accent-cyan/60 text-xs group-hover:text-accent-cyan transition-colors duration-300"
        animate={{ x: [0, 3, 0] }}
        transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
      >
        →
      </motion.span>
    </motion.a>
  );
}
