import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Text, Sky } from "@react-three/drei";
import { useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { Database } from "@/integrations/supabase/types";

export type Lot = Database["public"]["Tables"]["lots"]["Row"];

const STATUS_COLORS: Record<Lot["status"], string> = {
  available: "#22c55e",
  reserved: "#f59e0b",
  sold: "#ef4444",
};

function LotMesh({
  lot,
  onSelect,
  selected,
}: {
  lot: Lot;
  onSelect: (l: Lot) => void;
  selected: boolean;
}) {
  const [hover, setHover] = useState(false);
  const meshRef = useRef<THREE.Mesh>(null);
  const color = STATUS_COLORS[lot.status];

  const spacing = 1.2;
  const x = lot.grid_x * lot.width * spacing;
  const z = lot.grid_z * lot.depth * spacing;
  const height = 0.3;

  useFrame(() => {
    if (!meshRef.current) return;
    const targetY = hover || selected ? height / 2 + 0.4 : height / 2;
    meshRef.current.position.y += (targetY - meshRef.current.position.y) * 0.15;
  });

  return (
    <group position={[x, 0, z]}>
      <mesh
        ref={meshRef}
        position={[0, height / 2, 0]}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(lot);
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHover(true);
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          setHover(false);
          document.body.style.cursor = "auto";
        }}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[lot.width, height, lot.depth]} />
        <meshStandardMaterial
          color={color}
          emissive={selected ? color : "#000"}
          emissiveIntensity={selected ? 0.4 : 0}
          roughness={0.6}
          metalness={0.1}
        />
      </mesh>
      <Text
        position={[0, height + 0.05, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={0.9}
        color="#0b1220"
        anchorX="center"
        anchorY="middle"
      >
        {lot.number}
      </Text>
    </group>
  );
}

function Ground({ width, depth }: { width: number; depth: number }) {
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <planeGeometry args={[width * 1.6, depth * 1.6]} />
        <meshStandardMaterial color="#2a3547" />
      </mesh>
      {/* Streets */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[width * 1.4, 2]} />
        <meshStandardMaterial color="#1a2130" />
      </mesh>
    </>
  );
}

export function Loteamento3D({
  lots,
  selectedId,
  onSelect,
}: {
  lots: Lot[];
  selectedId: string | null;
  onSelect: (l: Lot) => void;
}) {
  const bounds = useMemo(() => {
    if (lots.length === 0) return { cx: 0, cz: 0, w: 40, d: 40 };
    const spacing = 1.2;
    const xs = lots.map((l) => l.grid_x * l.width * spacing);
    const zs = lots.map((l) => l.grid_z * l.depth * spacing);
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
    const cz = (Math.min(...zs) + Math.max(...zs)) / 2;
    const w = Math.max(...xs) - Math.min(...xs) + 30;
    const d = Math.max(...zs) - Math.min(...zs) + 30;
    return { cx, cz, w, d };
  }, [lots]);

  return (
    <Canvas
      shadows
      camera={{ position: [bounds.cx + 30, 35, bounds.cz + 40], fov: 45 }}
      style={{ background: "linear-gradient(to bottom, #0f172a, #1e293b)" }}
    >
      <Sky sunPosition={[100, 40, 100]} distance={450000} />
      <ambientLight intensity={0.5} />
      <directionalLight
        position={[30, 50, 20]}
        intensity={1.1}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />
      <group position={[-bounds.cx, 0, -bounds.cz]}>
        <Ground width={bounds.w} depth={bounds.d} />
        {lots.map((lot) => (
          <LotMesh
            key={lot.id}
            lot={lot}
            selected={selectedId === lot.id}
            onSelect={onSelect}
          />
        ))}
      </group>
      <OrbitControls
        enableDamping
        maxPolarAngle={Math.PI / 2.1}
        minDistance={10}
        maxDistance={120}
      />
    </Canvas>
  );
}
