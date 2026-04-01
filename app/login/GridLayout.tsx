"use client";

interface Square {
  top?: number;
  bottom?: number;
  left?: number;
  right?: number;

  width: number;
  height: number;

  color?: string;
  color2?: string;

  zIndex?: number;

  duration?: number;
  colorDelay?: number;
}

interface Props {
  children: React.ReactNode;

  squares?: Square[];

  width?: string;
  height?: string;

  margin?: string;
  background?: string;

  cellSize?: number;

  indexLayout?: number;
  indexComponent?: number;
  className?: string;
}

export default function SquaresGridLayout({
  children,
  squares = [],
  width = "auto",
  margin = "auto",
  background = "transparent",
  cellSize = 64,
  indexLayout = 10,
  indexComponent = 5,
  className,
}: Props) {
  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={{
        width,
        margin,
        background,
      }}
    >
      {/* CHILDREN LAYER */}
      <div
        className="relative h-full w-full "
        style={{ zIndex: indexComponent }}
      >
        {children}
      </div>

      {/* SQUARES LAYER */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ zIndex: indexLayout }}
      >
        {squares.map((sq, i) => (
          <div
            key={i}
            className="absolute"
            style={{
              top: sq.top !== undefined ? sq.top * cellSize : undefined,
              bottom:
                sq.bottom !== undefined ? sq.bottom * cellSize : undefined,

              left: sq.left !== undefined ? sq.left * cellSize : undefined,
              right: sq.right !== undefined ? sq.right * cellSize : undefined,

              width: sq.width * cellSize,
              height: sq.height * cellSize,

              backgroundColor: sq.color ?? "#000",

              zIndex: sq.zIndex ?? 0,
            }}
          />
        ))}
      </div>
    </div>
  );
}
