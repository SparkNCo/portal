import clsx from "clsx";

export default function Footer({ mode }: { mode: string }) {
  return (
    <footer
      className={clsx(
        "w-full text-background bg-foreground text-title font-semibold",
        {
          fixed: mode === "loading",
          relative: mode !== "loading",
        },
      )}
    >
      <div
        className="
    grid grid-cols-2 gap-y-4 text-center
    lg:flex lg:flex-row lg:justify-around lg:items-center lg:gap-10 lg:text-left py-6
  "
      >
        <a href="/privacy-policy" className="hover:underline">
          Privacy Policy
        </a>

        <a href="/terms-and-conditions" className="hover:underline">
          Terms and Conditions
        </a>

        <a href="/cookie-policy" className="hover:underline">
          Cookie Policy
        </a>

        <a href="/contact" className="hover:underline">
          Contact
        </a>

        <div
          className=" hidden lg:inline
      flex flex-col gap-1 text-smalltext text-center
      col-start-2
      lg:col-auto lg:text-right
    "
        >
          <span>2025 Spark & Co Technologies Inc.</span>
          <span>Registered in Canada. All rights reserved</span>
        </div>
      </div>
      <div
        className="flex flex-col col-start-2 inline lg:hidden
      gap-1 text-smalltext text-center
       lg:text-right w-full pb-4
    "
      >
        <span>2025 Spark & Co Technologies Inc.</span>
        <span>Registered in Canada. All rights reserved</span>
      </div>
    </footer>
  );
} //
