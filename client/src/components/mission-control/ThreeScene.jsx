import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { disposeObject, isWebGLAvailable, prefersReducedMotion } from './webgl';

export function ThreeScene({ className = '', setup, fallback }) {
  const mountRef = useRef(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount || !isWebGLAvailable()) return undefined;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);
    mount.appendChild(renderer.domElement);

    let frameId = 0;
    let disposed = false;
    const reducedMotion = prefersReducedMotion();
    const clock = new THREE.Clock();
    const cleanupScene = setup({ THREE, scene, camera, renderer, reducedMotion }) || (() => {});

    const resize = () => {
      if (!mount) return;
      const width = mount.clientWidth || 320;
      const height = mount.clientHeight || 320;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };

    const animate = () => {
      if (disposed) return;
      const elapsed = clock.getElapsedTime();
      scene.userData.tick?.(elapsed, clock.getDelta());
      renderer.render(scene, camera);
      frameId = window.requestAnimationFrame(animate);
    };

    resize();
    window.addEventListener('resize', resize);
    frameId = window.requestAnimationFrame(animate);

    return () => {
      disposed = true;
      window.cancelAnimationFrame(frameId);
      window.removeEventListener('resize', resize);
      cleanupScene();
      disposeObject(scene);
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [setup]);

  if (!isWebGLAvailable()) return fallback;
  return <div ref={mountRef} className={`h-full min-h-[18rem] w-full ${className}`} />;
}
