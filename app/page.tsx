"use client";
import LoginForm from "./login/Login";
import SquaresGridLayout from "./login/GridLayout";
import { FooterLeftRightSquares } from "./login/SquareFooterGrid";
import { useResponsiveCellSize } from "./login/useResponsiveCellSize";
import Footer from "./login/Footer";

export default function HomePage() {
  const cellSize = useResponsiveCellSize();

  return (
    <div>
      <SquaresGridLayout
        squares={FooterLeftRightSquares}
        background="#111111"
        width="100%"
        cellSize={cellSize}
        className="h-[350px] md:h-[350px] lg:h-auto "
        indexLayout={0}
        indexComponent={1}
      >
        <LoginForm
          onLoginSuccess={(email) => console.log("Logged in:", email)}
        />
      </SquaresGridLayout>
      <Footer />
    </div>
  );
}
