import { useCallback } from 'react';
import { CssFallbackCard } from './CssFallbackCard';
import { ThreeScene } from './ThreeScene';

export default function BrainHealthReactor({ score, signals }) {
  const setup = useCallback(({ THREE, scene, camera, reducedMotion }) => {
    camera.position.z = 13;
    const group = new THREE.Group(); scene.add(group);
    const core = new THREE.Mesh(new THREE.SphereGeometry(1.8, 48, 48), new THREE.MeshBasicMaterial({ color: score > 70 ? 0x34d399 : 0xf59e0b, transparent: true, opacity: 0.78 })); group.add(core);
    [3, 4.2, 5.4].forEach((radius, index) => {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.025, 8, 128), new THREE.MeshBasicMaterial({ color: index === 0 ? 0x22d3ee : 0xa78bfa, transparent: true, opacity: 0.55 }));
      ring.rotation.x = index * 0.75; ring.rotation.y = index * 0.45; group.add(ring);
    });
    scene.userData.tick = (elapsed) => {
      const pulse = reducedMotion ? 1 : 1 + Math.sin(elapsed * 2.2) * 0.08;
      core.scale.setScalar(pulse);
      group.children.forEach((child, index) => { if (!reducedMotion && index > 0) child.rotation.z = elapsed * (0.08 + index * 0.025); });
    };
  }, [score]);
  return <CssFallbackCard title="Brain Health Reactor" subtitle={`${score}% maintenance health across inputs, reviews, and open loops.`}><div className="grid gap-4 lg:grid-cols-[1fr_0.8fr]"><div className="h-80"><ThreeScene setup={setup} fallback={<div className="flex h-full items-center justify-center text-6xl font-black text-cyan-300">{score}%</div>} /></div><div className="space-y-2 self-center">{signals.map((item) => <div key={item.label} className="rounded-xl bg-slate-950/70 p-3"><p className="text-xs uppercase tracking-[0.16em] text-slate-500">{item.label}</p><p className="mt-1 text-xl font-bold text-slate-100">{item.value}</p></div>)}</div></div></CssFallbackCard>;
}
