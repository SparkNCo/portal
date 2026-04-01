export default function FooterSqareSection() {
  return (
    <div className="relative text-foreground h-[275px] md:h-[300px] lg:h-[475px] w-full">
      <img
        src={"/nbarIcon.png"}
        alt="spark/co"
        className="
          w-40 h-40 object-contain
          absolute
          top-[60%] left-1/2
          -translate-x-1/2 -translate-y-1/2
        "
      />
    </div>
  );
}
