import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

function prefersReducedMotion() {
  if (typeof window === 'undefined') return true;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function createBrainPoint(index) {
  const hemisphere = index % 2 === 0 ? -0.58 : 0.58;
  const theta = Math.random() * Math.PI * 2;
  const radius = 1.12 + Math.random() * 0.94;
  const vertical = (Math.random() - 0.5) * 2.16;
  const folded = Math.sin(theta * 3.4 + vertical * 1.7) * 0.22;
  const x = hemisphere + Math.cos(theta) * (radius * 0.6 + folded);
  const y = vertical * (0.72 + Math.random() * 0.26);
  const z = Math.sin(theta) * (radius * 0.74 + folded) - Math.abs(hemisphere) * 0.08;
  return new THREE.Vector3(x, y, z);
}

function buildLightningSegments(points, boltCount = 9, segmentsPerBolt = 7) {
  const positions = [];

  for (let bolt = 0; bolt < boltCount; bolt += 1) {
    const start = points[Math.floor(Math.random() * points.length)].clone();
    const direction = start.clone().normalize();
    direction.x += (Math.random() - 0.5) * 0.8;
    direction.y += (Math.random() - 0.15) * 0.55;
    direction.z += (Math.random() - 0.5) * 0.5;
    direction.normalize();

    let previous = start.clone();
    const boltLength = 0.72 + Math.random() * 1.2;

    for (let segment = 1; segment <= segmentsPerBolt; segment += 1) {
      const progress = segment / segmentsPerBolt;
      const jitter = new THREE.Vector3(
        (Math.random() - 0.5) * 0.22,
        (Math.random() - 0.5) * 0.22,
        (Math.random() - 0.5) * 0.22,
      );
      const next = start.clone().add(direction.clone().multiplyScalar(boltLength * progress)).add(jitter);
      positions.push(previous.x, previous.y, previous.z, next.x, next.y, next.z);
      previous = next;

      if (Math.random() > 0.58) {
        const branch = next.clone().add(jitter.multiplyScalar(1.7));
        positions.push(next.x, next.y, next.z, branch.x, branch.y, branch.z);
      }
    }
  }

  return new Float32Array(positions);
}

export function AnimatedBrain({ className = '' }) {
  const mountRef = useRef(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;

    const reducedMotion = prefersReducedMotion();
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    camera.position.set(0, 0.05, 5.35);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);
    mount.appendChild(renderer.domElement);

    const group = new THREE.Group();
    scene.add(group);

    const particleCount = 760;
    const positions = new Float32Array(particleCount * 3);
    const points = [];

    for (let i = 0; i < particleCount; i += 1) {
      const point = createBrainPoint(i);
      positions[i * 3] = point.x;
      positions[i * 3 + 1] = point.y;
      positions[i * 3 + 2] = point.z;
      points.push(point);
    }

    const particleGeometry = new THREE.BufferGeometry();
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const particleMaterial = new THREE.PointsMaterial({
      color: 0xbdeeff,
      size: 0.036,
      transparent: true,
      opacity: 0.98,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const particles = new THREE.Points(particleGeometry, particleMaterial);
    group.add(particles);

    const linePositions = [];
    for (let i = 0; i < 310; i += 1) {
      const start = points[Math.floor(Math.random() * points.length)];
      let closest = points[0];
      let closestDistance = Infinity;
      for (let j = 0; j < 22; j += 1) {
        const candidate = points[Math.floor(Math.random() * points.length)];
        const distance = start.distanceTo(candidate);
        if (distance > 0.16 && distance < closestDistance) {
          closest = candidate;
          closestDistance = distance;
        }
      }
      if (closestDistance < 0.82) {
        linePositions.push(start.x, start.y, start.z, closest.x, closest.y, closest.z);
      }
    }

    const lineGeometry = new THREE.BufferGeometry();
    lineGeometry.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3));
    const lineMaterial = new THREE.LineBasicMaterial({
      color: 0x62c6ff,
      transparent: true,
      opacity: 0.26,
      blending: THREE.AdditiveBlending,
    });
    const lines = new THREE.LineSegments(lineGeometry, lineMaterial);
    group.add(lines);

    const lightningGeometry = new THREE.BufferGeometry();
    lightningGeometry.setAttribute('position', new THREE.BufferAttribute(buildLightningSegments(points), 3));
    const lightningMaterial = new THREE.LineBasicMaterial({
      color: 0xdaf7ff,
      transparent: true,
      opacity: reducedMotion ? 0.28 : 0.88,
      blending: THREE.AdditiveBlending,
    });
    const lightning = new THREE.LineSegments(lightningGeometry, lightningMaterial);
    group.add(lightning);

    const coreGeometry = new THREE.SphereGeometry(0.2, 32, 32);
    const coreMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.86, blending: THREE.AdditiveBlending });
    const core = new THREE.Mesh(coreGeometry, coreMaterial);
    group.add(core);

    const haloGeometry = new THREE.SphereGeometry(2.48, 64, 64);
    const haloMaterial = new THREE.MeshBasicMaterial({
      color: 0x0ea5e9,
      wireframe: true,
      transparent: true,
      opacity: 0.075,
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
    let nextDischargeAt = 0;
    const clock = new THREE.Clock();

    const render = () => {
      const elapsed = clock.getElapsedTime();
      if (!reducedMotion) {
        const breath = 1 + Math.sin(elapsed * 1.55) * 0.042;
        group.scale.setScalar(breath);
        group.rotation.y = Math.sin(elapsed * 0.32) * 0.18;
        group.rotation.x = Math.sin(elapsed * 0.48) * 0.055;
        particles.material.size = 0.034 + Math.sin(elapsed * 2.4) * 0.006;
        lineMaterial.opacity = 0.22 + Math.sin(elapsed * 2.1) * 0.08;
        halo.rotation.y = -elapsed * 0.12;
        halo.rotation.x = elapsed * 0.05;
        core.scale.setScalar(1 + Math.sin(elapsed * 3.7) * 0.22);
        coreMaterial.opacity = 0.68 + Math.sin(elapsed * 3.7) * 0.18;

        if (elapsed > nextDischargeAt) {
          lightningGeometry.setAttribute('position', new THREE.BufferAttribute(buildLightningSegments(points), 3));
          lightningGeometry.attributes.position.needsUpdate = true;
          lightningMaterial.opacity = 0.74 + Math.random() * 0.26;
          nextDischargeAt = elapsed + 0.12 + Math.random() * 0.24;
        } else {
          lightningMaterial.opacity = Math.max(0.18, lightningMaterial.opacity * 0.92);
        }
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
      lightningGeometry.dispose();
      lightningMaterial.dispose();
      coreGeometry.dispose();
      coreMaterial.dispose();
      haloGeometry.dispose();
      haloMaterial.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return <div ref={mountRef} className={`h-[54vh] min-h-[380px] w-full sm:h-[68vh] lg:h-[76vh] ${className}`} aria-hidden="true" />;
}
