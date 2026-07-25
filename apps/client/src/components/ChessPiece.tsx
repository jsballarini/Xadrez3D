import { useMemo } from 'react';
import type { PieceColor } from '@xadrez3d/shared';

interface ChessPieceProps {
  type: string;
  color: PieceColor;
}

export function ChessPiece({ type, color }: ChessPieceProps) {
  const isWhite = color === 'w';
  const body = isWhite ? '#f2e6d4' : '#1b1b1f';
  const trim = isWhite ? '#d4a017' : '#8a8f98';

  const geometry = useMemo(() => buildPiece(type), [type]);

  return (
    <group>
      {geometry.map((part, i) => (
        <mesh key={i} position={part.position} castShadow>
          {part.kind === 'cylinder' && (
            <cylinderGeometry args={part.args as [number, number, number, number]} />
          )}
          {part.kind === 'box' && <boxGeometry args={part.args as [number, number, number]} />}
          {part.kind === 'sphere' && <sphereGeometry args={part.args as [number, number, number]} />}
          {part.kind === 'cone' && (
            <coneGeometry args={part.args as [number, number, number]} />
          )}
          <meshStandardMaterial
            color={part.trim ? trim : body}
            roughness={isWhite ? 0.35 : 0.55}
            metalness={isWhite ? 0.15 : 0.25}
          />
        </mesh>
      ))}
    </group>
  );
}

type Part = {
  kind: 'cylinder' | 'box' | 'sphere' | 'cone';
  args: number[];
  position: [number, number, number];
  trim?: boolean;
};

function buildPiece(type: string): Part[] {
  const base: Part[] = [
    { kind: 'cylinder', args: [0.32, 0.36, 0.12, 24], position: [0, 0.06, 0] },
  ];

  switch (type) {
    case 'p':
      return [
        ...base,
        { kind: 'cylinder', args: [0.18, 0.22, 0.35, 20], position: [0, 0.32, 0] },
        { kind: 'sphere', args: [0.16, 16, 16], position: [0, 0.58, 0] },
      ];
    case 'r':
      return [
        ...base,
        { kind: 'cylinder', args: [0.22, 0.26, 0.55, 20], position: [0, 0.4, 0] },
        { kind: 'box', args: [0.5, 0.16, 0.5], position: [0, 0.72, 0], trim: true },
      ];
    case 'n':
      return [
        ...base,
        { kind: 'box', args: [0.28, 0.55, 0.42], position: [0, 0.42, 0.02] },
        { kind: 'box', args: [0.2, 0.22, 0.28], position: [0.02, 0.72, 0.12], trim: true },
      ];
    case 'b':
      return [
        ...base,
        { kind: 'cylinder', args: [0.16, 0.24, 0.55, 20], position: [0, 0.42, 0] },
        { kind: 'cone', args: [0.2, 0.35, 18], position: [0, 0.82, 0] },
        { kind: 'sphere', args: [0.08, 12, 12], position: [0, 1.05, 0], trim: true },
      ];
    case 'q':
      return [
        ...base,
        { kind: 'cylinder', args: [0.2, 0.28, 0.65, 22], position: [0, 0.45, 0] },
        { kind: 'sphere', args: [0.2, 16, 16], position: [0, 0.88, 0] },
        { kind: 'sphere', args: [0.08, 12, 12], position: [0, 1.12, 0], trim: true },
      ];
    case 'k':
    default:
      return [
        ...base,
        { kind: 'cylinder', args: [0.22, 0.3, 0.7, 22], position: [0, 0.48, 0] },
        { kind: 'box', args: [0.12, 0.28, 0.12], position: [0, 1.0, 0], trim: true },
        { kind: 'box', args: [0.28, 0.12, 0.12], position: [0, 1.05, 0], trim: true },
      ];
  }
}
