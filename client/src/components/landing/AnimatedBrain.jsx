import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

function prefersReducedMotion() {
  if (typeof window === 'undefined') return true;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function AnimatedBrain() {
  const mountRef = useRef(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;

    const reducedMotion = prefersReducedMotion();
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.set(0, 0.15, 6.2);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);
    mount.appendChild(renderer.domElement);

    const group = new THREE.Group();
    scene.add(group);

    const particleCount = 520;
    const positions = new Float32Array(particleCount * 3);
    const points = [];

    for (let i = 0; i < particleCount; i += 1) {
      const hemisphere = i % 2 === 0 ? -0.52 : 0.52;
      const theta = Math.random() * Math.PI * 2;
      const radius = 1.05 + Math.random() * 0.9;
      const vertical = (Math.random() - 0.5) * 2.1;
      const folded = Math.sin(theta * 3.2 + vertical * 1.5) * 0.18;
      const x = hemisphere + Math.cos(theta) * (radius * 0.58 + folded);
      const y = vertical * (0.72 + Math.random() * 0.25);
      const z = Math.sin(theta) * (radius * 0.72 + folded) - Math.abs(hemisphere) * 0.08;
      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;
      points.push(new THREE.Vector3(x, y, z));
    }

    const particleGeometry = new THREE.BufferGeometry();
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const particleMaterial = new THREE.PointsMaterial({
      color: 0x9bdcff,
      size: 0.032,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const particles = new THREE.Points(particleGeometry, particleMaterial);
    group.add(particles);

    const linePositions = [];
    for (let i = 0; i < 180; i += 1) {
      const start = points[Math.floor(Math.random() * points.length)];
      let closest = points[0];
      let closestDistance = Infinity;
      for (let j = 0; j < 16; j += 1) {
        const candidate = points[Math.floor(Math.random() * points.length)];
        const distance = start.distanceTo(candidate);
        if (distance > 0.18 && distance < closestDistance) {
          closest = candidate;
          closestDistance = distance;
        }
      }
      if (closestDistance < 0.9) {
        linePositions.push(start.x, start.y, start.z, closest.x, closest.y, closest.z);
      }
    }

    const lineGeometry = new THREE.BufferGeometry();
    lineGeometry.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3));
    const lineMaterial = new THREE.LineBasicMaterial({
      color: 0x6bbcff,
      transparent: true,
      opacity: 0.18,
      blending: THREE.AdditiveBlending,
    });
    const lines = new THREE.LineSegments(lineGeometry, lineMaterial);
    group.add(lines);

    const coreGeometry = new THREE.SphereGeometry(0.18, 32, 32);
    const coreMaterial = new THREE.MeshBasicMaterial({ color: 0xdaf5ff, transparent: true, opacity: 0.75 });
    const core = new THREE.Mesh(coreGeometry, coreMaterial);
    group.add(core);

    const haloGeometry = new THREE.SphereGeometry(2.35, 64, 64);
    const haloMaterial = new THREE.MeshBasicMaterial({
      color: 0x164e8f,
      wireframe: true,
      transparent: true,
      opacity: 0.055,
      blending: THREE.AdditiveBlending,
    });
    const halo = new THREE.Mesh(haloGeometry, haloMaterial);
    group.add(halo);

    const resize = () => {
      const { width, height } = mount.getBoundingClientRect();
      renderer.setSize(width, height, false);
      camera.aspect = width / Math.max(height, 1);
      camera.updateProjectionMatrix();
    };
    resize();

    let frameId;
    const clock = new THREE.Clock();
    const render = () => {
      const elapsed = clock.getElapsedTime();
      if (!reducedMotion) {
        group.rotation.y = elapsed * 0.18;
        group.rotation.x = Math.sin(elapsed * 0.45) * 0.08;
        particles.material.size = 0.03 + Math.sin(elapsed * 2.2) * 0.004;
        lineMaterial.opacity = 0.14 + Math.sin(elapsed * 1.7) * 0.06;
        halo.rotation.y = -elapsed * 0.08;
        core.scale.setScalar(1 + Math.sin(elapsed * 3) * 0.14);
      }
      renderer.render(scene, camera);
      frameId = window.requestAnimationFrame(render);
    };
    render();

    window.addEventListener('resize', resize);

    return () => {
      window.removeEventListener('resize', resize);
      window.cancelAnimationFrame(frameId);
      particleGeometry.dispose();
      particleMaterial.dispose();
      lineGeometry.dispose();
      lineMaterial.dispose();
      coreGeometry.dispose();
      coreMaterial.dispose();
      haloGeometry.dispose();
      haloMaterial.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return <div ref={mountRef} className="h-[340px] w-full sm:h-[440px] lg:h-[560px]" aria-hidden="true" />;
}
