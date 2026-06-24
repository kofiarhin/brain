import { useCallback } from 'react';
import { CssFallbackCard } from './CssFallbackCard';
import { ThreeScene } from './ThreeScene';

export default function WeeklySkyline({ data }) {
  const setup = useCallback(({ THREE, scene, camera, reducedMotion }) => {
    camera.position.set(0, 8, 18); camera.lookAt(0, 2, 0);
    const max = Math.max(...data.map((day) => day.value), 1);
    const group = new THREE.Group(); scene.add(group);
    data.forEach((day, index) => {
      const height = 1 + (day.value / max) * 7;
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(1.25, height, 1.25), new THREE.MeshBasicMaterial({ color: index === 6 ? 0x22d3ee : 0x8b5cf6, transparent: true, opacity: 0.82 }));
      mesh.position.set((index - 3) * 1.8, height / 2 - 3, 0); group.add(mesh);
      const antenna = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.8, 0.08), new THREE.MeshBasicMaterial({ color: 0x67e8f9 }));
      antenna.position.set(mesh.position.x, mesh.position.y + height / 2 + 0.4, 0); group.add(antenna);
    });
    scene.userData.tick = (elapsed) => { if (!reducedMotion) group.rotation.y = Math.sin(elapsed * 0.18) * 0.22; };
  }, [data]);
  return <CssFallbackCard title="Weekly Skyline" subtitle="Seven days of execution density."><div className="h-80"><ThreeScene setup={setup} fallback={<Fallback data={data} />} /></div></CssFallbackCard>;
}
function Fallback({ data }) { const max = Math.max(...data.map((item) => item.value), 1); return <div className="flex h-56 items-end gap-2">{data.map((item) => <div className="flex flex-1 flex-col items-center gap-2" key={item.label}><div className="w-full rounded-t-xl bg-cyan-400/70" style={{ height: `${Math.max((item.value / max) * 100, 8)}%` }} /><span className="text-xs text-slate-500">{item.label}</span></div>)}</div>; }
