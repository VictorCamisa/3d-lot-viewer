import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Billboard, Html } from "@react-three/drei";
import { useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { Database } from "@/integrations/supabase/types";
import {
  GREEN_AREAS,
  INSTITUTIONAL,
  QUADRA_LABELS,
  SITE,
  STREETS,
  type LayoutLot,
  type Rect,
} from "@/lib/loteamento";

/**
 * Rótulos em HTML (drei <Html/>) em vez de troika <Text/>: o troika cria um
 * segundo contexto WebGL para gerar as fontes SDF, o que fazia o navegador
 * descartar o contexto principal ("Context Lost") e a cena ficar em branco.
 */
function Text({
  position,
  fontSize = 3,
  color = "#ffffff",
  outlineColor,
  children,
}: {
  position?: [number, number, number];
  fontSize?: number;
  color?: string;
  outlineColor?: string;
  children: React.ReactNode;
  // props aceitas por compatibilidade e ignoradas
  font?: string;
  rotation?: [number, number, number];
  anchorX?: string;
  anchorY?: string;
  outlineWidth?: number;
}) {
  return (
    <Html position={position} center distanceFactor={160} style={{ pointerEvents: "none" }}>
      <span
        style={{
          color,
          fontSize: `${fontSize * 5}px`,
          fontWeight: 700,
          whiteSpace: "nowrap",
          letterSpacing: "0.02em",
          textShadow: outlineColor
            ? `0 0 6px ${outlineColor}, 0 1px 2px ${outlineColor}`
            : "0 1px 2px rgba(0,0,0,0.35)",
        }}
      >
        {children}
      </span>
    </Html>
  );
}


export type Lot = Database["public"]["Tables"]["lots"]["Row"];

/** Lote da planta (PDF) combinado com os dados do banco, quando existirem. */
export interface LotView extends LayoutLot {
  id: string | null;
  status: Lot["status"];
  price: number | null;
  whatsapp: string | null;
  notes: string | null;
}

const STATUS_COLORS: Record<Lot["status"], string> = {
  available: "#22c55e",
  reserved: "#f59e0b",
  sold: "#ef4444",
};

/** fonte local — evita depender do CDN padrão do troika-three-text */
const FONT_URL = "/fonts/inter-600.woff";

const COLORS = {
  grass: "#6f9e4f",
  quadra: "#cdbd97",
  street: "#4a5058",
  streetLine: "#e8e6df",
  green: "#4d8a3d",
  institutional: "#9db4c0",
  trunk: "#6b4a2f",
  canopy: "#3d7032",
};

function LotMesh({
  lot,
  onSelect,
  selected,
}: {
  lot: LotView;
  onSelect: (l: LotView) => void;
  selected: boolean;
}) {
  const [hover, setHover] = useState(false);
  const groupRef = useRef<THREE.Group>(null);
  const color = STATUS_COLORS[lot.status];
  const height = 0.14;
  const fontSize = Math.min(Math.min(lot.width, lot.depth) * 0.42, lot.width * 0.28);

  useFrame(() => {
    if (!groupRef.current) return;
    const targetY = hover || selected ? 0.35 : 0;
    groupRef.current.position.y += (targetY - groupRef.current.position.y) * 0.15;
  });

  return (
    <group position={[lot.x, 0, lot.z]}>
      <group ref={groupRef}>
        <mesh
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
        >
          <boxGeometry args={[lot.width - 0.6, height, lot.depth - 0.6]} />
          <meshStandardMaterial
            color={color}
            emissive={selected || hover ? color : "#000"}
            emissiveIntensity={selected ? 0.5 : hover ? 0.25 : 0}
            roughness={0.65}
            metalness={0.05}
          />
        </mesh>
        {hover || selected ? (
          <Text
            font={FONT_URL}
            position={[0, height + 0.06, 0]}
            rotation={[-Math.PI / 2, 0, 0]}
            fontSize={fontSize}
            color="#14261a"
            anchorX="center"
            anchorY="middle"
          >
            {String(lot.number)}
          </Text>
        ) : null}
      </group>
    </group>
  );
}

function FlatRect({ rect, color, y = 0.02 }: { rect: Rect; color: string; y?: number }) {
  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[rect.x + rect.width / 2, y, rect.z + rect.depth / 2]}
    >
      <planeGeometry args={[rect.width, rect.depth]} />
      <meshStandardMaterial color={color} roughness={1} />
    </mesh>
  );
}

function Street({ rect }: { rect: Rect }) {
  const horizontal = rect.width >= rect.depth;
  const length = horizontal ? rect.width : rect.depth;
  const dashes = useMemo(() => {
    const step = 9;
    const count = Math.floor((length - 4) / step);
    return Array.from({ length: count }, (_, i) => 4 + i * step + step / 2);
  }, [length]);

  return (
    <group>
      <FlatRect rect={rect} color={COLORS.street} y={0.04} />
      {dashes.map((d, i) => (
        <mesh
          key={i}
          rotation={[-Math.PI / 2, 0, 0]}
          position={
            horizontal
              ? [rect.x + d, 0.06, rect.z + rect.depth / 2]
              : [rect.x + rect.width / 2, 0.06, rect.z + d]
          }
        >
          <planeGeometry args={horizontal ? [3.2, 0.35] : [0.35, 3.2]} />
          <meshStandardMaterial color={COLORS.streetLine} roughness={1} />
        </mesh>
      ))}
    </group>
  );
}

/** gerador determinístico p/ espalhar árvores sempre no mesmo lugar */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function Tree({ x, z, scale }: { x: number; z: number; scale: number }) {
  return (
    <group position={[x, 0, z]} scale={scale}>
      <mesh position={[0, 1.1, 0]}>
        <cylinderGeometry args={[0.25, 0.35, 2.2, 5]} />
        <meshStandardMaterial color={COLORS.trunk} roughness={1} />
      </mesh>
      <mesh position={[0, 3.1, 0]}>
        <icosahedronGeometry args={[1.8, 0]} />
        <meshStandardMaterial color={COLORS.canopy} roughness={0.9} flatShading />
      </mesh>
    </group>
  );
}

function GreenArea({ rect, seed }: { rect: Rect; seed: number }) {
  const trees = useMemo(() => {
    const rand = mulberry32(seed * 7919 + 13);
    const count = Math.max(2, Math.round((rect.width * rect.depth) / 900));
    return Array.from({ length: count }, () => ({
      x: rect.x + 2.5 + rand() * (rect.width - 5),
      z: rect.z + 2.5 + rand() * (rect.depth - 5),
      scale: 0.8 + rand() * 0.9,
    }));
  }, [rect, seed]);

  return (
    <group>
      <FlatRect rect={rect} color={COLORS.green} y={0.03} />
      {trees.map((t, i) => (
        <Tree key={i} {...t} />
      ))}
      {rect.label ? (
        <Text
          font={FONT_URL}
          position={[rect.x + rect.width / 2, 0.12, rect.z + rect.depth - 3]}
          rotation={[-Math.PI / 2, 0, 0]}
          fontSize={2.4}
          color="#dcefd2"
          anchorX="center"
          anchorY="middle"
        >
          {rect.label}
        </Text>
      ) : null}
    </group>
  );
}

function Institutional() {
  const r = INSTITUTIONAL;
  return (
    <group>
      <FlatRect rect={r} color={COLORS.institutional} y={0.03} />
      <mesh position={[r.x + r.width / 2, 2.2, r.z + r.depth / 2]}>
        <boxGeometry args={[r.width * 0.45, 4.4, r.depth * 0.4]} />
        <meshStandardMaterial color="#e7e2d5" roughness={0.8} />
      </mesh>
      <mesh position={[r.x + r.width / 2, 5.3, r.z + r.depth / 2]}>
        <boxGeometry args={[r.width * 0.5, 1.4, r.depth * 0.45]} />
        <meshStandardMaterial color="#b0492f" roughness={0.9} />
      </mesh>
      <Text
        font={FONT_URL}
        position={[r.x + r.width / 2, 0.12, r.z + r.depth - 4]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={3}
        color="#243b4a"
        anchorX="center"
        anchorY="middle"
      >
        {r.label}
      </Text>
    </group>
  );
}

function Entrance() {
  const cx = 144; // centro da avenida principal
  const z = SITE.maxZ + 2;
  return (
    <group>
      {[-8, 8].map((dx) => (
        <mesh key={dx} position={[cx + dx, 2.4, z]}>
          <boxGeometry args={[1.6, 4.8, 1.6]} />
          <meshStandardMaterial color="#e7e2d5" roughness={0.8} />
        </mesh>
      ))}
      <mesh position={[cx, 5.1, z]}>
        <boxGeometry args={[19, 1.2, 1.8]} />
        <meshStandardMaterial color="#e7e2d5" roughness={0.8} />
      </mesh>
      <Text
        font={FONT_URL}
        position={[cx, 5.2, z + 1.05]}
        fontSize={1.5}
        color="#243b4a"
        anchorX="center"
        anchorY="middle"
      >
        ENTRADA
      </Text>
    </group>
  );
}

function QuadraLabel({ quadra, x, z }: { quadra: number; x: number; z: number }) {
  return (
    <Billboard position={[x, 9, z]}>
      <Text
        font={FONT_URL}
        fontSize={4}
        color="#ffffff"
        outlineWidth={0.28}
        outlineColor="#1f2937"
        anchorX="center"
        anchorY="middle"
      >
        {`Q${quadra}`}
      </Text>
    </Billboard>
  );
}

export function Loteamento3D({
  lots,
  selectedNumber,
  onSelect,
  showHouses = true,
}: {
  lots: LotView[];
  selectedNumber: number | null;
  onSelect: (l: LotView) => void;
  showHouses?: boolean;
}) {
  const center = useMemo(
    () => new THREE.Vector3((SITE.minX + SITE.maxX) / 2, 0, (SITE.minZ + SITE.maxZ) / 2),
    [],
  );

  const quadraPlates = useMemo(() => {
    // uma placa de terra sob cada quadra, calculada a partir dos lotes
    const byQuadra = new Map<number, LotView[]>();
    for (const l of lots) {
      const arr = byQuadra.get(l.quadra) ?? [];
      arr.push(l);
      byQuadra.set(l.quadra, arr);
    }
    return [...byQuadra.values()].map((ls) => {
      const minX = Math.min(...ls.map((l) => l.x - l.width / 2));
      const maxX = Math.max(...ls.map((l) => l.x + l.width / 2));
      const minZ = Math.min(...ls.map((l) => l.z - l.depth / 2));
      const maxZ = Math.max(...ls.map((l) => l.z + l.depth / 2));
      return {
        x: minX - 1,
        z: minZ - 1,
        width: maxX - minX + 2,
        depth: maxZ - minZ + 2,
      } as Rect;
    });
  }, [lots]);

  return (
    <Canvas
      dpr={[1, 1.5]}
      gl={{ antialias: false, powerPreference: "high-performance" }}
      camera={{
        position: [center.x, 230, SITE.maxZ + 250],
        fov: 45,
        near: 1,
        far: 3000,
      }}
      style={{ background: "linear-gradient(to bottom, #8ec8e8, #d8ecf5)" }}
    >
      <fog attach="fog" args={["#cfe4f2", 400, 1400]} />
      <ambientLight intensity={0.55} />
      <directionalLight position={[220, 260, 60]} intensity={1.2} />
      <directionalLight position={[-160, 180, -120]} intensity={0.35} />

      {/* terreno */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[center.x, 0, center.z]}>
        <planeGeometry args={[1200, 1200]} />
        <meshStandardMaterial color={COLORS.grass} roughness={1} />
      </mesh>

      {quadraPlates.map((r, i) => (
        <FlatRect key={i} rect={r} color={COLORS.quadra} y={0.05} />
      ))}

      {STREETS.map((s, i) => (
        <Street key={i} rect={s} />
      ))}

      {GREEN_AREAS.map((g, i) => (
        <GreenArea key={i} rect={g} seed={i + 1} />
      ))}

      <Institutional />
      <Entrance />

      {QUADRA_LABELS.map((q) => (
        <QuadraLabel key={q.quadra} {...q} />
      ))}

      {showHouses &&
        HOUSE_PLOTS.map((h) => <House key={h.lots.join("-")} plot={h} />)}

      {lots.map((lot) => (
        <LotMesh
          key={lot.number}
          lot={lot}
          selected={selectedNumber === lot.number}
          onSelect={onSelect}
        />
      ))}

      <OrbitControls
        enableDamping
        makeDefault
        target={center}
        maxPolarAngle={Math.PI / 2.05}
        minDistance={8}
        maxDistance={900}
      />

    </Canvas>
  );
}
