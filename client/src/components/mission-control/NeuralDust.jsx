import { useCallback } from 'react';
import { ThreeScene } from './ThreeScene';

export default function NeuralDust() {
  const setup = useCallback(({ THREE, scene, camera, reducedMotion }) => {
    camera.position.z = 32;
    const count = reducedMotion ? 90 : 240;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      positions[i * 3] = (Math.random() - 0.5) * 70;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 38;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 45;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({ color: 0x67e8f9, size: 0.065, transparent: true, opacity: 0.45, depthWrite: false });
    const dust = new THREE.Points(geometry, material);
    scene.add(dust);
    scene.userData.tick = (elapsed) => {
      if (!reducedMotion) {
        dust.rotation.y = elapsed * 0.018;
        dust.rotation.x = Math.sin(elapsed * 0.12) * 0.04;
      }
    };
  }, []);

  return <div className="pointer-events-none absolute inset-0 -z-10 opacity-70"><ThreeScene setup={setup} /></div>;
}
