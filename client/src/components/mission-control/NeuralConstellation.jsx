import { useCallback } from 'react';
import { CssFallbackCard } from './CssFallbackCard';
import { ThreeScene } from './ThreeScene';

export default function NeuralConstellation({ nodes }) {
  const setup = useCallback(({ THREE, scene, camera, reducedMotion }) => {
    camera.position.set(0, 0, 28);
    scene.fog = new THREE.FogExp2(0x020617, 0.025);
    const group = new THREE.Group();
    scene.add(group);
    const max = Math.max(...nodes.map((node) => node.count), 1);
    const nodeMeshes = nodes.map((node, index) => {
      const angle = (index / nodes.length) * Math.PI * 2;
      const radius = 6 + (index % 3) * 2.2;
      const size = 0.38 + (node.count / max) * 1.2;
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(size, 24, 24), new THREE.MeshBasicMaterial({ color: node.color, transparent: true, opacity: 0.9 }));
      mesh.position.set(Math.cos(angle) * radius, Math.sin(angle * 1.3) * 3.3, Math.sin(angle) * radius);
      mesh.userData.base = mesh.position.clone();
      group.add(mesh);
      return mesh;
    });
    const lineMaterial = new THREE.LineBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.32 });
    const lines = nodeMeshes.map((mesh, index) => {
      const next = nodeMeshes[(index + 2) % nodeMeshes.length];
      const geometry = new THREE.BufferGeometry().setFromPoints([mesh.position, next.position]);
      const line = new THREE.Line(geometry, lineMaterial.clone());
      group.add(line);
      return { line, a: mesh, b: next };
    });
    scene.userData.tick = (elapsed) => {
      nodeMeshes.forEach((mesh, index) => {
        mesh.position.y = mesh.userData.base.y + Math.sin(elapsed * 0.8 + index) * (reducedMotion ? 0.05 : 0.35);
      });
      lines.forEach(({ line, a, b }, index) => {
        line.geometry.setFromPoints([a.position, b.position]);
        line.material.opacity = reducedMotion ? 0.25 : 0.18 + Math.sin(elapsed * 2 + index) * 0.12 + 0.14;
      });
      if (!reducedMotion) {
        group.rotation.y = elapsed * 0.08;
        camera.position.x = Math.sin(elapsed * 0.18) * 2;
        camera.position.y = Math.cos(elapsed * 0.14) * 1.2;
        camera.lookAt(0, 0, 0);
      }
    };
  }, [nodes]);

  return <CssFallbackCard title="Neural Constellation" subtitle="Living map of Brain OS collections.">
    <div className="h-[28rem]"><ThreeScene setup={setup} fallback={<Fallback nodes={nodes} />} /></div>
  </CssFallbackCard>;
}

function Fallback({ nodes }) {
  return <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{nodes.map((node) => <div key={node.label} className="rounded-2xl border border-slate-700 bg-slate-950/70 p-4"><p className="text-sm text-slate-300">{node.label}</p><p className="text-3xl font-bold" style={{ color: node.color }}>{node.count}</p></div>)}</div>;
}
