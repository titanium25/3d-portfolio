import { useEffect, useRef } from "react";
import * as THREE from "three";

export default function HeroScene() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x0a0c14, 0.06);

    const camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / container.clientHeight,
      0.1,
      100
    );
    camera.position.set(0, 5, 9);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "low-power",
    });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    container.appendChild(renderer.domElement);

    // ── Hex platform ──
    const hexShape = new THREE.Shape();
    const hexRadius = 3.5;
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i - Math.PI / 6;
      const x = hexRadius * Math.cos(angle);
      const z = hexRadius * Math.sin(angle);
      if (i === 0) hexShape.moveTo(x, z);
      else hexShape.lineTo(x, z);
    }
    hexShape.closePath();

    const hexGeo = new THREE.ExtrudeGeometry(hexShape, {
      depth: 0.25,
      bevelEnabled: false,
    });
    hexGeo.rotateX(-Math.PI / 2);

    const hexMat = new THREE.MeshStandardMaterial({
      color: 0x1a2035,
      emissive: 0x00e5cc,
      emissiveIntensity: 0.03,
      roughness: 0.7,
      metalness: 0.3,
    });
    const hexMesh = new THREE.Mesh(hexGeo, hexMat);
    hexMesh.position.y = -0.5;
    scene.add(hexMesh);

    // ── Hex edge glow — bright cyan wireframe ──
    const edgesGeo = new THREE.EdgesGeometry(hexGeo);
    const edgesMat = new THREE.LineBasicMaterial({
      color: 0x00e5cc,
      transparent: true,
      opacity: 0.7,
    });
    const edgeLines = new THREE.LineSegments(edgesGeo, edgesMat);
    edgeLines.position.y = -0.5;
    scene.add(edgeLines);

    // ── Top face glow ring ──
    const ringGeo = new THREE.RingGeometry(2.8, 3.4, 6);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x00e5cc,
      transparent: true,
      opacity: 0.08,
      side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.rotation.z = Math.PI / 6;
    ring.position.y = -0.36;
    scene.add(ring);

    // ── Center glow disc ──
    const glowDiscGeo = new THREE.CircleGeometry(1.5, 32);
    const glowDiscMat = new THREE.MeshBasicMaterial({
      color: 0x00e5cc,
      transparent: true,
      opacity: 0.06,
      side: THREE.DoubleSide,
    });
    const glowDisc = new THREE.Mesh(glowDiscGeo, glowDiscMat);
    glowDisc.rotation.x = -Math.PI / 2;
    glowDisc.position.y = -0.34;
    scene.add(glowDisc);

    // ── Particles — bigger, brighter, more visible ──
    const particleCount = 150;
    const positions = new Float32Array(particleCount * 3);
    const sizes = new Float32Array(particleCount);
    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 12;
      positions[i * 3 + 1] = Math.random() * 10;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 12;
      sizes[i] = 0.03 + Math.random() * 0.06;
    }
    const particleGeo = new THREE.BufferGeometry();
    particleGeo.setAttribute(
      "position",
      new THREE.BufferAttribute(positions, 3)
    );
    particleGeo.setAttribute("size", new THREE.BufferAttribute(sizes, 1));
    const particleMat = new THREE.PointsMaterial({
      color: 0x00e5cc,
      size: 0.07,
      transparent: true,
      opacity: 0.85,
      sizeAttenuation: true,
    });
    const particles = new THREE.Points(particleGeo, particleMat);
    scene.add(particles);

    // ── Lighting — much brighter ──
    const ambientLight = new THREE.AmbientLight(0x4a6080, 0.8);
    scene.add(ambientLight);

    // Main cyan point light — center, bright
    const pointLight = new THREE.PointLight(0x00e5cc, 4, 20);
    pointLight.position.set(0, 3, 0);
    scene.add(pointLight);

    // Secondary fill light from camera side
    const fillLight = new THREE.PointLight(0x00e5cc, 1.5, 15);
    fillLight.position.set(3, 2, 5);
    scene.add(fillLight);

    // Warm underlight for depth
    const underLight = new THREE.PointLight(0x1a3a5a, 1, 10);
    underLight.position.set(0, -2, 0);
    scene.add(underLight);

    // ── Animation ──
    let frameId: number;
    const clock = new THREE.Clock();

    const animate = () => {
      frameId = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();

      // Slow hex rotation
      hexMesh.rotation.y = t * 0.1;
      edgeLines.rotation.y = t * 0.1;
      ring.rotation.z = Math.PI / 6 + t * 0.1;

      // Camera gentle drift
      camera.position.x = Math.sin(t * 0.15) * 0.4;
      camera.position.y = 5 + Math.sin(t * 0.1) * 0.2;

      // Particle rise
      const posArr = particleGeo.attributes.position.array as Float32Array;
      for (let i = 0; i < particleCount; i++) {
        posArr[i * 3 + 1] += 0.006 + sizes[i] * 0.02;
        if (posArr[i * 3 + 1] > 10) {
          posArr[i * 3 + 1] = -0.5;
          posArr[i * 3] = (Math.random() - 0.5) * 12;
          posArr[i * 3 + 2] = (Math.random() - 0.5) * 12;
        }
      }
      particleGeo.attributes.position.needsUpdate = true;

      // Pulsing light
      pointLight.intensity = 4 + Math.sin(t * 0.8) * 1;

      // Breathing glow disc
      glowDiscMat.opacity = 0.06 + Math.sin(t * 1.2) * 0.03;

      // Edge brightness pulse
      edgesMat.opacity = 0.6 + Math.sin(t * 0.6) * 0.15;

      renderer.render(scene, camera);
    };
    animate();

    // Resize
    const onResize = () => {
      if (!container) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener("resize", onResize);
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0"
      style={{
        maskImage:
          "radial-gradient(ellipse 85% 75% at 60% 50%, black 35%, transparent 75%)",
        WebkitMaskImage:
          "radial-gradient(ellipse 85% 75% at 60% 50%, black 35%, transparent 75%)",
      }}
    />
  );
}
