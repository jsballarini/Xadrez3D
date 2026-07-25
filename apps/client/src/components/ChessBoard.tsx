import { useMemo } from 'react';
import { Html, OrbitControls } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { squareToCoords } from '@xadrez3d/shared';
import { fenToPieces, getLegalTargets, type BoardPiece } from '../lib/chessLocal';
import { ChessPiece } from './ChessPiece';

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

interface ChessBoardProps {
  fen: string;
  orientation?: 'w' | 'b';
  interactive?: boolean;
  selected?: string | null;
  lastMove?: { from: string; to: string } | null;
  onSquareClick?: (square: string) => void;
}

export function ChessBoardCanvas(props: ChessBoardProps) {
  return (
    <div className="board-canvas">
      <Canvas
        camera={{ position: [0, 11, 9], fov: 38 }}
        dpr={[1, 1.75]}
        gl={{ antialias: true }}
      >
        <color attach="background" args={['#0c1210']} />
        <ambientLight intensity={0.55} />
        <directionalLight position={[6, 12, 4]} intensity={1.2} castShadow />
        <directionalLight position={[-5, 6, -4]} intensity={0.35} />
        <ChessBoardScene {...props} />
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
          <circleGeometry args={[7.5, 48]} />
          <meshStandardMaterial color="#070b09" transparent opacity={0.55} />
        </mesh>
        <OrbitControls
          enablePan={false}
          minPolarAngle={0.35}
          maxPolarAngle={1.25}
          minDistance={8}
          maxDistance={18}
          target={[0, 0, 0]}
        />
      </Canvas>
    </div>
  );
}

function ChessBoardScene({
  fen,
  orientation = 'w',
  interactive = true,
  selected = null,
  lastMove = null,
  onSquareClick,
}: ChessBoardProps) {
  const pieces = useMemo(() => fenToPieces(fen), [fen]);
  const legal = useMemo(
    () => (selected ? getLegalTargets(fen, selected) : []),
    [fen, selected],
  );

  const flip = orientation === 'b';

  return (
    <group rotation={[0, flip ? Math.PI : 0, 0]}>
      <mesh position={[0, -0.18, 0]} receiveShadow>
        <boxGeometry args={[9.2, 0.35, 9.2]} />
        <meshStandardMaterial color="#2a1c12" roughness={0.7} metalness={0.05} />
      </mesh>
      {FILES.map((file, fi) =>
        Array.from({ length: 8 }, (_, ri) => {
          const square = `${file}${ri + 1}`;
          const dark = (fi + ri) % 2 === 0;
          const isSelected = selected === square;
          const isLegal = legal.includes(square);
          const isLast = lastMove?.from === square || lastMove?.to === square;
          return (
            <SquareMesh
              key={square}
              square={square}
              file={fi}
              rank={ri}
              dark={dark}
              selected={isSelected}
              legal={isLegal}
              last={!!isLast}
              interactive={interactive}
              onClick={onSquareClick}
            />
          );
        }),
      )}
      {pieces.map((p) => (
        <PieceOnBoard key={`${p.square}-${p.type}-${p.color}`} piece={p} />
      ))}
      <Html position={[-4.6, 0.1, 0]} center style={{ pointerEvents: 'none', opacity: 0.35 }}>
        <span style={{ fontSize: 11, color: '#f3ebe0' }}>Xadrez3D</span>
      </Html>
    </group>
  );
}

function SquareMesh({
  square,
  file,
  rank,
  dark,
  selected,
  legal,
  last,
  interactive,
  onClick,
}: {
  square: string;
  file: number;
  rank: number;
  dark: boolean;
  selected: boolean;
  legal: boolean;
  last: boolean;
  interactive: boolean;
  onClick?: (square: string) => void;
}) {
  const x = file - 3.5;
  const z = 3.5 - rank;
  let color = dark ? '#5c4030' : '#c4a574';
  if (last) color = dark ? '#7a5a28' : '#d8b86a';
  if (selected) color = '#d4a017';

  return (
    <group position={[x, 0, z]}>
      <mesh
        receiveShadow
        onClick={(e) => {
          e.stopPropagation();
          if (interactive) onClick?.(square);
        }}
        onPointerOver={(e) => {
          if (!interactive) return;
          e.stopPropagation();
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          document.body.style.cursor = 'default';
        }}
      >
        <boxGeometry args={[1, 0.12, 1]} />
        <meshStandardMaterial color={color} roughness={0.85} />
      </mesh>
      {legal && (
        <mesh position={[0, 0.08, 0]}>
          <cylinderGeometry args={[0.18, 0.18, 0.04, 24]} />
          <meshStandardMaterial color="#6f9f78" emissive="#6f9f78" emissiveIntensity={0.4} />
        </mesh>
      )}
    </group>
  );
}

function PieceOnBoard({ piece }: { piece: BoardPiece }) {
  const { file, rank } = squareToCoords(piece.square);
  return (
    <group position={[file - 3.5, 0.08, 3.5 - rank]}>
      <ChessPiece type={piece.type} color={piece.color} />
    </group>
  );
}
