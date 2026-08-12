import { useMemo } from "react";
import * as THREE from "three";
import type { HousePlot } from "@/lib/houses";

/* ---------- geometrias compartilhadas (unitárias, escaladas por mesh) ---------- */
const BOX = new THREE.BoxGeometry(1, 1, 1);
/** prisma triangular deitado no eixo X (telhado de duas águas) */
const PRISM = (() => {
  const g = new THREE.CylinderGeometry(0.5, 0.5, 1, 3, 1);
  g.rotateY(Math.PI / 2);
  g.rotateZ(Math.PI / 2);
  return g;
})();
const PYRAMID = (() => {
  const g = new THREE.ConeGeometry(0.5, 1, 4, 1);
  g.rotateY(Math.PI / 4);
  return g;
})();
const CYL = new THREE.CylinderGeometry(0.5, 0.5, 1, 8);
const SPHERE = new THREE.IcosahedronGeometry(0.5, 0);

/* ---------- materiais compartilhados ---------- */
const mat = (color: string, o?: THREE.MeshStandardMaterialParameters) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...o });

const WALL_COLORS = ["#f3ece1", "#e9e2d4", "#f6f1ea", "#ded6c8", "#eae4dd", "#f0e6d8"];
const ACCENT_COLORS = ["#b0765a", "#7d8b74", "#8c7f6b", "#4c5b63", "#a8542f"];
const ROOF_COLORS = ["#8d4a33", "#a3512f", "#6b4030", "#4e5459", "#7a4a3a"];

const M = {
  wall: WALL_COLORS.map((c) => mat(c, { roughness: 0.9 })),
  accent: ACCENT_COLORS.map((c) => mat(c, { roughness: 0.85 })),
  roof: ROOF_COLORS.map((c) => mat(c, { roughness: 0.9 })),
  glass: mat("#2b4a5e", { roughness: 0.15, metalness: 0.6, emissive: "#0d1b24" }),
  frame: mat("#ffffff", { roughness: 0.6 }),
  door: mat("#5a3a24", { roughness: 0.6 }),
  garage: mat("#cfd3d6", { roughness: 0.5, metalness: 0.2 }),
  slab: mat("#c9c5bc", { roughness: 1 }),
  drive: mat("#b9b6ae", { roughness: 1 }),
  lawn: mat("#79a95a", { roughness: 1 }),
  hedge: mat("#3f6f34", { roughness: 1 }),
  water: mat("#3fa9d6", { roughness: 0.1, metalness: 0.3 }),
  trunk: mat("#6b4a2f", { roughness: 1 }),
  canopy: mat("#3d7032", { roughness: 0.95, flatShading: true }),
  fence: mat("#e6e1d8", { roughness: 0.9 }),
  deck: mat("#a5794c", { roughness: 0.9 }),
};

function rng(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function B({
  p,
  s,
  m,
  r,
  g = BOX,
}: {
  p: [number, number, number];
  s: [number, number, number];
  m: THREE.Material;
  r?: [number, number, number];
  g?: THREE.BufferGeometry;
}) {
  return <mesh geometry={g} material={m} position={p} scale={s} rotation={r} />;
}

/**
 * Casa procedural detalhada. Local: origem no centro do terreno, frente para +Z.
 */
export function House({ plot }: { plot: HousePlot }) {
  const parts = useMemo(() => {
    const rand = rng(plot.seed);
    const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)];

    const lotW = plot.width;
    const lotD = plot.depth;
    const marginX = Math.min(2.2, lotW * 0.12);
    const marginZ = Math.min(3, lotD * 0.12);

    const bw = Math.max(5, lotW - marginX * 2); // largura da construção
    const bd = Math.max(6, Math.min(lotD * 0.55, lotD - marginZ * 2 - 4));
    const twoFloors = plot.style === "sobrado" || (plot.style === "moderna" && rand() < 0.5);
    const floorH = 3.1;
    const h = twoFloors ? floorH * 2 : floorH;

    // construção recuada para o fundo, jardim na frente
    const bz = lotD / 2 - marginZ - bd / 2 - 3.5;

    const wallM = pick(M.wall);
    const accentM = pick(M.accent);
    const roofM = pick(M.roof);

    const wallColorIdx = M.wall.indexOf(wallM);
    const flatRoof = plot.style === "moderna";

    // janelas do térreo (frente)
    const winCount = Math.max(2, Math.min(4, Math.round(bw / 4)));
    const winStep = bw / (winCount + 1);
    const frontZ = bz + bd / 2 + 0.06;
    const backZ = bz - bd / 2 - 0.06;

    return {
      rand,
      lotW,
      lotD,
      bw,
      bd,
      bz,
      h,
      twoFloors,
      floorH,
      wallM,
      accentM,
      roofM,
      flatRoof,
      winCount,
      winStep,
      frontZ,
      backZ,
      wallColorIdx,
      garageW: Math.min(5.6, bw * 0.38),
      porch: rand() < 0.6,
      chimney: !flatRoof && rand() < 0.5,
      trees: Array.from({ length: 1 + Math.floor(rand() * 3) }, () => ({
        x: (rand() - 0.5) * (lotW - 3),
        z: lotD / 2 - 1.5 - rand() * 4,
        s: 0.7 + rand() * 0.7,
      })),
    };
  }, [plot]);

  const {
    bw,
    bd,
    bz,
    h,
    twoFloors,
    floorH,
    wallM,
    accentM,
    roofM,
    flatRoof,
    winCount,
    winStep,
    frontZ,
    backZ,
    garageW,
    porch,
    chimney,
    trees,
    lotW,
    lotD,
  } = parts;

  const halfW = bw / 2;
  const doorX = -halfW + garageW + 1.6;

  return (
    <group position={[plot.x, 0, plot.z]} rotation={[0, plot.rotationY, 0]}>
      {/* gramado */}
      <B p={[0, 0.08, 0]} s={[lotW - 0.8, 0.16, lotD - 0.8]} m={M.lawn} />

      {/* calçada / entrada de carro */}
      <B p={[-bw / 2 + garageW / 2, 0.18, lotD / 2 - (lotD / 2 - (bz + bd / 2)) / 2]} s={[garageW, 0.06, lotD / 2 - (bz + bd / 2)]} m={M.drive} />
      <B p={[doorX, 0.18, bz + bd / 2 + 1.8]} s={[1.6, 0.06, 3.6]} m={M.slab} />

      {/* base / laje */}
      <B p={[0, 0.22, bz]} s={[bw + 0.6, 0.44, bd + 0.6]} m={M.slab} />

      {/* corpo principal */}
      <B p={[0, 0.44 + h / 2, bz]} s={[bw, h, bd]} m={wallM} />

      {/* faixa de acabamento entre pavimentos */}
      {twoFloors && (
        <B p={[0, 0.44 + floorH, bz]} s={[bw + 0.35, 0.35, bd + 0.35]} m={accentM} />
      )}

      {/* volume de destaque (garagem / ala lateral) */}
      <B
        p={[-bw / 2 + garageW / 2, 0.44 + floorH * 0.85, bz + bd / 2 - 0.6]}
        s={[garageW, floorH * 1.7, 4.2]}
        m={accentM}
      />
      {/* porta de garagem */}
      <B
        p={[-bw / 2 + garageW / 2, 0.44 + 1.35, bz + bd / 2 + 1.55]}
        s={[garageW - 0.9, 2.7, 0.16]}
        m={M.garage}
      />

      {/* telhado */}
      {flatRoof ? (
        <>
          <B p={[0, 0.44 + h + 0.18, bz]} s={[bw + 0.9, 0.36, bd + 0.9]} m={accentM} />
          <B p={[0, 0.44 + h + 0.62, bz]} s={[bw + 0.5, 0.55, bd + 0.5]} m={M.frame} />
          <B p={[0, 0.44 + h + 0.55, bz]} s={[bw - 0.4, 0.42, bd - 0.4]} m={roofM} />
        </>
      ) : (
        <>
          <B
            p={[0, 0.44 + h + (bd * 0.36) / 2, bz]}
            s={[bw + 1.2, bd * 0.36, bd + 1.2]}
            m={roofM}
            g={PRISM}
          />
        </>
      )}

      {chimney && (
        <>
          <B p={[halfW - 1.4, 0.44 + h + bd * 0.3, bz - 1]} s={[0.9, 2.6, 0.9]} m={accentM} />
          <B p={[halfW - 1.4, 0.44 + h + bd * 0.3 + 1.5, bz - 1]} s={[1.2, 0.25, 1.2]} m={M.slab} />
        </>
      )}

      {/* porta de entrada + degraus */}
      <B p={[doorX, 0.44 + 1.15, frontZ]} s={[1.25, 2.3, 0.14]} m={M.door} />
      <B p={[doorX, 0.44 + 2.35, frontZ]} s={[1.55, 0.16, 0.22]} m={M.frame} />
      <B p={[doorX, 0.16, frontZ + 0.55]} s={[2.1, 0.32, 1.1]} m={M.slab} />

      {/* varanda com colunas */}
      {porch && (
        <>
          <B p={[doorX + 0.6, 0.44 + 3.05, frontZ + 1.2]} s={[4.6, 0.24, 2.6]} m={M.frame} />
          {[-1.6, 1.6].map((dx) => (
            <B
              key={dx}
              p={[doorX + 0.6 + dx, 0.44 + 1.5, frontZ + 2.2]}
              s={[0.28, 3, 0.28]}
              m={M.frame}
              g={CYL}
            />
          ))}
        </>
      )}

      {/* janelas — frente (térreo) */}
      {Array.from({ length: winCount }).map((_, i) => {
        const x = -halfW + winStep * (i + 1);
        if (Math.abs(x - doorX) < 1.6 || x < -halfW + garageW + 0.4) return null;
        return (
          <group key={`fw${i}`}>
            <B p={[x, 0.44 + 1.75, frontZ]} s={[1.85, 1.5, 0.1]} m={M.frame} />
            <B p={[x, 0.44 + 1.75, frontZ + 0.05]} s={[1.6, 1.25, 0.08]} m={M.glass} />
            <B p={[x, 0.44 + 0.98, frontZ + 0.12]} s={[2, 0.14, 0.35]} m={M.slab} />
          </group>
        );
      })}

      {/* janelas — frente (2º pavimento) */}
      {twoFloors &&
        Array.from({ length: winCount }).map((_, i) => {
          const x = -halfW + winStep * (i + 1);
          return (
            <group key={`fw2${i}`}>
              <B p={[x, 0.44 + floorH + 1.6, frontZ]} s={[1.6, 1.4, 0.1]} m={M.frame} />
              <B p={[x, 0.44 + floorH + 1.6, frontZ + 0.05]} s={[1.35, 1.15, 0.08]} m={M.glass} />
            </group>
          );
        })}

      {/* fundos — porta de vidro + janelas */}
      <B p={[0, 0.44 + 1.55, backZ]} s={[3.2, 2.4, 0.1]} m={M.frame} />
      <B p={[0, 0.44 + 1.55, backZ - 0.05]} s={[2.9, 2.15, 0.08]} m={M.glass} />
      {twoFloors && (
        <>
          <B p={[-bw * 0.25, 0.44 + floorH + 1.6, backZ]} s={[1.5, 1.3, 0.1]} m={M.glass} />
          <B p={[bw * 0.25, 0.44 + floorH + 1.6, backZ]} s={[1.5, 1.3, 0.1]} m={M.glass} />
        </>
      )}
      {/* deck nos fundos */}
      <B p={[0, 0.2, bz - bd / 2 - 1.8]} s={[Math.min(bw, 7), 0.2, 3]} m={M.deck} />

      {/* janelas laterais */}
      {[-1, 1].map((sgn) => (
        <group key={sgn}>
          <B p={[sgn * (halfW + 0.06), 0.44 + 1.75, bz]} s={[0.1, 1.4, 1.5]} m={M.glass} />
          {twoFloors && (
            <B
              p={[sgn * (halfW + 0.06), 0.44 + floorH + 1.6, bz - 1.5]}
              s={[0.1, 1.2, 1.3]}
              m={M.glass}
            />
          )}
        </group>
      ))}

      {/* muro frontal + portão */}
      <B p={[0, 0.55, lotD / 2 - 0.6]} s={[lotW - 0.8, 1.1, 0.3]} m={M.fence} />
      <B
        p={[-lotW / 2 + garageW / 2 + 0.4, 0.7, lotD / 2 - 0.6]}
        s={[garageW, 1.4, 0.16]}
        m={M.garage}
      />
      {/* cerca viva lateral */}
      {[-1, 1].map((sgn) => (
        <B
          key={`h${sgn}`}
          p={[sgn * (lotW / 2 - 0.5), 0.5, 0]}
          s={[0.6, 1, lotD - 1.6]}
          m={M.hedge}
        />
      ))}

      {/* piscina */}
      {plot.hasPool && (
        <group position={[bw / 2 - 2.5, 0, bz - bd / 2 - 4.5]}>
          <B p={[0, 0.18, 0]} s={[5.4, 0.2, 3.4]} m={M.slab} />
          <B p={[0, 0.24, 0]} s={[4.6, 0.16, 2.6]} m={M.water} />
        </group>
      )}

      {/* árvores no jardim */}
      {trees.map((t, i) => (
        <group key={i} position={[t.x, 0, t.z]} scale={t.s}>
          <B p={[0, 0.9, 0]} s={[0.35, 1.8, 0.35]} m={M.trunk} g={CYL} />
          <B p={[0, 2.4, 0]} s={[2.4, 2.4, 2.4]} m={M.canopy} g={SPHERE} />
        </group>
      ))}
      <B p={[0, 0.14, lotD / 2 - 3]} s={[1.6, 0.28, 1.6]} m={M.hedge} g={PYRAMID} />
    </group>
  );
}
