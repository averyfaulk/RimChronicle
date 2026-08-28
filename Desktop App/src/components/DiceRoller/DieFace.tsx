import React, { useId } from "react";

interface DieFaceProps {
  id: string;
  value: number | null;
  color: string;
}

const CX = 80;
const CY = 90;

/** Lighten (factor > 1) or darken (factor < 1) a #rrggbb hex color. */
function tint(hex: string, factor: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.round(((n >> 16) & 255) * factor));
  const g = Math.min(255, Math.round(((n >> 8) & 255) * factor));
  const b = Math.min(255, Math.round((n & 255) * factor));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

/** Vertices of a regular n-gon centered at (CX,CY). */
function polygonPoints(n: number, r: number, rotationDeg: number): string {
  const pts: string[] = [];
  for (let i = 0; i < n; i += 1) {
    const angle = ((rotationDeg + (i * 360) / n) * Math.PI) / 180;
    pts.push(`${(CX + r * Math.cos(angle)).toFixed(2)},${(CY + r * Math.sin(angle)).toFixed(2)}`);
  }
  return pts.join(" ");
}

function centroid(points: string): [number, number] {
  const pts = points.split(" ").map((p) => p.split(",").map(Number));
  const n = pts.length;
  return [
    pts.reduce((s, p) => s + p[0], 0) / n,
    pts.reduce((s, p) => s + p[1], 0) / n,
  ];
}

/** Scale polygon points toward their centroid (f < 1 shrinks). */
function scalePoints(points: string, f: number): string {
  const [cx, cy] = centroid(points);
  return points
    .split(" ")
    .map((p) => {
      const [x, y] = p.split(",").map(Number);
      return `${(cx + (x - cx) * f).toFixed(2)},${(cy + (y - cy) * f).toFixed(2)}`;
    })
    .join(" ");
}

/** Shift polygon points by (dx, dy). */
function translatePoints(points: string, dx: number, dy: number): string {
  return points
    .split(" ")
    .map((p) => {
      const [x, y] = p.split(",").map(Number);
      return `${(x + dx).toFixed(2)},${(y + dy).toFixed(2)}`;
    })
    .join(" ");
}

/** Real polyhedral face shapes (not silhouettes): triangle (d4/d8/d20),
 *  square (d6), kite (d10), pentagon (d12), decagon (d100). */
function facePoints(id: string): string {
  switch (id) {
    case "d2":
      return ""; // circle (coin)
    case "d3":
    case "d4":
    case "d8":
      return polygonPoints(3, 58, -90);
    case "d6":
      return polygonPoints(4, 58, -45);
    case "d10":
      return "80,34 108,104 80,152 52,104";
    case "d12":
      return polygonPoints(5, 58, -90);
    case "d20":
      return polygonPoints(3, 60, -90);
    case "d100":
      return polygonPoints(10, 56, -90);
    default:
      return polygonPoints(3, 58, -90);
  }
}

/** Standard dice-pip layouts on a 3x3 grid — used for the d6 face. */
const PIPS: Record<number, [number, number][]> = {
  1: [[0, 0]],
  2: [
    [-1, -1],
    [1, 1],
  ],
  3: [
    [-1, -1],
    [0, 0],
    [1, 1],
  ],
  4: [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ],
  5: [
    [-1, -1],
    [1, -1],
    [0, 0],
    [-1, 1],
    [1, 1],
  ],
  6: [
    [-1, -1],
    [0, -1],
    [1, -1],
    [-1, 1],
    [0, 1],
    [1, 1],
  ],
};

export const DieFace: React.FC<DieFaceProps> = ({ id, value, color }) => {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const gradId = `dg-${uid}-grad`;
  const blurId = `dg-${uid}-blur`;
  const clipId = `dg-${uid}-clip`;

  const light = tint(color, 1.5);
  const mid = tint(color, 1.08);
  const dark = tint(color, 0.62);
  const darker = tint(color, 0.42);

  const points = facePoints(id);
  const isCircle = id === "d2";
  const isPips = id === "d6";

  // Triangle vertices for the d4/d8/d20 faces (d20 uses a slightly larger radius).
  const triR = id === "d20" ? 60 : 58;
  const sin60 = Math.sin(Math.PI / 3);
  const cos60 = Math.cos(Math.PI / 3);
  const A: [number, number] = [CX, CY - triR];
  const B: [number, number] = [CX - triR * sin60, CY + triR * cos60];
  const C: [number, number] = [CX + triR * sin60, CY + triR * cos60];
  const CENTROID: [number, number] = [CX, CY];

  const show = value ?? "?";
  const text = String(show);
  const fontSize = text.length >= 3 ? 26 : text.length === 2 ? 30 : 34;

  const pipLayout = isPips && value ? PIPS[value] ?? [] : [];

  const renderDeco = () => {
    if (id === "d4") {
      // Tetrahedron apex: small inverted triangle at the center.
      return <polygon points="80,84 70,98 90,98" fill="none" stroke={darker} strokeWidth="3" opacity="0.55" />;
    }
    if (id === "d8") {
      // Octahedron face: three spokes meeting at the centroid.
      return (
        <g stroke={darker} strokeWidth="2.5" strokeLinecap="round" opacity="0.5">
          {[A, B, C].map(([x, y], i) => (
            <line key={i} x1={x} y1={y} x2={CENTROID[0]} y2={CENTROID[1]} />
          ))}
        </g>
      );
    }
    if (id === "d20") {
      // Icosahedron face: medians splitting the face into six triangles.
      const midBC: [number, number] = [(B[0] + C[0]) / 2, (B[1] + C[1]) / 2];
      const midAC: [number, number] = [(A[0] + C[0]) / 2, (A[1] + C[1]) / 2];
      const midAB: [number, number] = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2];
      return (
        <g stroke={darker} strokeWidth="2.5" strokeLinecap="round" opacity="0.5">
          <line x1={A[0]} y1={A[1]} x2={midBC[0]} y2={midBC[1]} />
          <line x1={B[0]} y1={B[1]} x2={midAC[0]} y2={midAC[1]} />
          <line x1={C[0]} y1={C[1]} x2={midAB[0]} y2={midAB[1]} />
        </g>
      );
    }
    return null;
  };

  const content = (
    <>
      {renderDeco()}
      {isPips ? (
        <g>
          {pipLayout.map(([px, py], i) => {
            const x = CX + px * 23;
            const y = CY + py * 23;
            return (
              <g key={i}>
                <circle cx={x + 2} cy={y} r="9" fill={light} opacity="0.45" />
                <circle cx={x} cy={y} r="9" fill={darker} />
                <circle cx={x - 2} cy={y - 2} r="3" fill="#ffffff" opacity="0.35" />
              </g>
            );
          })}
        </g>
      ) : (
        <g>
          <rect
            x={CX - (text.length >= 3 ? 24 : 20)}
            y={CY - 17}
            width={text.length >= 3 ? 48 : 40}
            height="34"
            rx="9"
            fill="#f8fafc"
            opacity={value === null ? 0.55 : 0.95}
          />
          {value !== null && (
            <text
              x={CX + 1.5}
              y={CY + 1.5}
              textAnchor="middle"
              dominantBaseline="central"
              fontFamily="'JetBrains Mono', monospace"
              fontWeight="800"
              fontSize={fontSize}
              fill="#ffffff"
              opacity="0.55"
            >
              {text}
            </text>
          )}
          <text
            x={CX}
            y={CY}
            textAnchor="middle"
            dominantBaseline="central"
            fontFamily="'JetBrains Mono', monospace"
            fontWeight="800"
            fontSize={fontSize}
            fill={darker}
          >
            {text}
          </text>
        </g>
      )}
    </>
  );

  const faceElement = isCircle ? (
    <circle cx={CX} cy={CY} r="58" fill={`url(#${gradId})`} stroke={darker} strokeWidth="3" />
  ) : (
    <polygon
      points={points}
      fill={`url(#${gradId})`}
      stroke={darker}
      strokeWidth="3"
      strokeLinejoin="round"
    />
  );

  return (
    <svg viewBox="0 0 160 160" className="w-full h-full overflow-visible">
      <defs>
        <filter id={blurId} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="3" />
        </filter>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={light} />
          <stop offset="55%" stopColor={mid} />
          <stop offset="100%" stopColor={dark} />
        </linearGradient>
        {!isCircle && (
          <clipPath id={clipId}>
            <polygon points={points} />
          </clipPath>
        )}
      </defs>

      {/* Soft ground shadow */}
      <ellipse cx={CX} cy="148" rx="34" ry="8" fill="#000000" opacity="0.38" filter={`url(#${blurId})`} />

      {isCircle ? (
        <>
          {/* Coin body (edge) */}
          <circle cx={CX + 2} cy={CY + 5} r="62" fill={darker} />
          {faceElement}
          <circle cx={CX} cy={CY} r="44" fill="none" stroke={darker} strokeWidth="2.5" opacity="0.5" />
        </>
      ) : (
        <>
          {/* Die body — offset + oversize edge gives the bevel illusion */}
          <polygon
            points={translatePoints(scalePoints(points, 1.045), 2, 5)}
            fill={darker}
            stroke={darker}
            strokeWidth="6"
            strokeLinejoin="round"
          />
          {faceElement}
        </>
      )}

      {/* Clipped content */}
      {isCircle ? (
        <g>{content}</g>
      ) : (
        <g clipPath={`url(#${clipId})`}>{content}</g>
      )}
    </svg>
  );
};