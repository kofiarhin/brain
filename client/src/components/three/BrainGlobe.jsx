import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';

function supportsWebGL() {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(window.WebGLRenderingContext && (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')));
  } catch {
    return false;
  }
}

export default function BrainGlobe({ nodes = [] }) {
  const mountRef = useRef(null);
  const reducedMotion = useMemo(() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false, []);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount || !supportsWebGL()) return undefined;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, mount.clientWidth / mount.clientHeight, 0.1, 100);
    camera.position.z = 7;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    mount.appendChild(renderer.domElement);

    const group = new THREE.Group();
    scene.add(group);

    const maxCount = Math.max(...nodes.map((node) => node.count), 1);
    const nodeMeshes = nodes.map((node, index) => {
      const angle = (index / Math.max(nodes.length, 1)) * Math.PI * 2;
      const y = ((index % 3) - 1) * 1.05;
      const radius = 2.2 + (index % 2) * 0.45;
      const size = 0.14 + (node.count / maxCount) * 0.28;
      const geometry = new THREE.SphereGeometry(size, 24, 24);
      const material = new THREE.MeshBasicMaterial({ color: node.color || '#22d3ee' });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
      group.add(mesh);
      return mesh;
    });

    const lineMaterial = new THREE.LineBasicMaterial({ color: '#164e63', transparent: true, opacity: 0.45 });
    const lines = [];
    nodeMeshes.forEach((mesh, index) => {
      const next = nodeMeshes[(index + 1) % nodeMeshes.length];
      if (!next) return;
      const geometry = new THREE.BufferGeometry().setFromPoints([mesh.position, next.position]);
      const line = new THREE.Line(geometry, lineMaterial);
      group.add(line);
      lines.push(line);
    });

    const core = new THREE.Mesh(
      new THREE.SphereGeometry(0.48, 32, 32),
      new THREE.MeshBasicMaterial({ color: '#0e7490', transparent: true, opacity: 0.72 })
    );
    group.add(core);

    const handleResize = () => {
      if (!mount.clientWidth || !mount.clientHeight) return;
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    };

    window.addEventListener('resize', handleResize);
    let frameId;
    const animate = () => {
      if (!reducedMotion) {
        group.rotation.y += 0.004;
        core.scale.setScalar(1 + Math.sin(Date.now() * 0.002) * 0.05);
      }
      renderer.render(scene, camera);
      frameId = window.requestAnimationFrame(animate);
    };
    animate();

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener('resize', handleResize);
      mount.removeChild(renderer.domElement);
      nodeMeshes.forEach((mesh) => {
        mesh.geometry.dispose();
        mesh.material.dispose();
      });
      lines.forEach((line) => line.geometry.dispose());
      lineMaterial.dispose();
      core.geometry.dispose();
      core.material.dispose();
      renderer.dispose();
    };
  }, [nodes, reducedMotion]);

  if (typeof window !== 'undefined' && !supportsWebGL()) {
    return <div className="grid gap-2 sm:grid-cols-2">{nodes.map((node) => <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3" key={node.label}>
      <p className="text-sm font-semibold text-slate-100">{node.label}</p>
      <p className="text-xs text-cyan-300">{node.count} items</p>
    </div>)}</div>;
  }

  return <div className="grid gap-4 md:grid-cols-[1fr_180px]">
    <div ref={mountRef} className="h-72 overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/70" />
    <div className="grid content-start gap-2">
      {nodes.map((node) => <div className="flex items-center justify-between rounded-xl bg-slate-950/70 px-3 py-2 text-sm" key={node.label}>
        <span className="flex items-center gap-2 text-slate-300"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: node.color }} />{node.label}</span>
        <span className="font-semibold text-slate-50">{node.count}</span>
      </div>)}
    </div>
  </div>;
}
