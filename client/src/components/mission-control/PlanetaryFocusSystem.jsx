import { useCallback } from 'react';
import { CssFallbackCard } from './CssFallbackCard';
import { ThreeScene } from './ThreeScene';

export default function PlanetaryFocusSystem({ allocation }) {
  const setup = useCallback(({ THREE, scene, camera, reducedMotion }) => {
    camera.position.set(0, 9, 18);
    camera.lookAt(0, 0, 0);
    const group = new THREE.Group(); scene.add(group);
    group.add(new THREE.Mesh(new THREE.SphereGeometry(1.25, 32, 32), new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.9 })));
    const total = allocation.reduce((sum, item) => sum + item.value, 0) || 1;
    const planets = allocation.map((item, index) => {
      const orbit = 3 + index * 1.25 + (item.value / total) * 2.4;
      const size = 0.28 + (item.value / total) * 1.2;
      const orbitGeometry = new THREE.RingGeometry(orbit - 0.01, orbit + 0.01, 96);
      const orbitMesh = new THREE.Mesh(orbitGeometry, new THREE.MeshBasicMaterial({ color: 0x334155, transparent: true, opacity: 0.48, side: THREE.DoubleSide }));
      orbitMesh.rotation.x = Math.PI / 2; group.add(orbitMesh);
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(size, 24, 24), new THREE.MeshBasicMaterial({ color: item.color }));
      group.add(mesh);
      return { mesh, orbit, speed: 0.16 / (index + 1), phase: index * 1.7 };
    });
    scene.userData.tick = (elapsed) => {
      planets.forEach((planet) => {
        const angle = planet.phase + (reducedMotion ? 0 : elapsed * planet.speed);
        planet.mesh.position.set(Math.cos(angle) * planet.orbit, 0, Math.sin(angle) * planet.orbit);
      });
      if (!reducedMotion) group.rotation.y = Math.sin(elapsed * 0.1) * 0.18;
    };
  }, [allocation]);
  return <CssFallbackCard title="Planetary Focus System" subtitle="Daily schedule allocation rendered as orbital gravity."><div className="h-80"><ThreeScene setup={setup} fallback={<Fallback allocation={allocation} />} /></div></CssFallbackCard>;
}
function Fallback({ allocation }) { return <div className="space-y-3">{allocation.map((item) => <div key={item.label} className="flex items-center justify-between rounded-xl bg-slate-950/70 p-3"><span className="text-slate-300">{item.label}</span><span className="font-bold" style={{ color: item.color }}>{Math.round(item.value / 60)}h</span></div>)}</div>; }
