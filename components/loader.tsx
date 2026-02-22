export const LoadingDataPanel = () => {
  return (
    <div className="w-full flex items-center justify-center py-24 animate-fade-in min-h-[90vh] ">
      <div className="flex flex-col items-center gap-6 ">
        <div className="relative flex items-center justify-center ">
          {/* Outer ring (bigger, thinner) */}
          <div className="absolute w-28 h-28 rounded-full border-2 border-transparent border-t-primary border-background border-r-primary animate-spin [animation-duration:1.2s]" />

          {/* Inner ring (smaller, thicker) */}
          <div className="w-14 h-14 rounded-full border-4 border-transparent border-background border-t-primary border-r-primary animate-spin [animation-duration:1.6s]" />
        </div>

        {/* Text */}
        <div className="mt-8 text-center space-y-1">
          <p className="text-xl font-semibold text-primary">
            Loading Data
          </p>
          <p className="text-sm text-foreground">Please wait a moment</p>
        </div>
      </div>
    </div>
  );
};
