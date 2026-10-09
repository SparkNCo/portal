import "./globals.css";
import type { Viewport } from "next";
import { Nunito_Sans } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Providers } from "@/lib/tanstack/providers";
import { UserProvider } from "../context/UserContext";
import { SelectedProjectProvider } from "@/lib/selected-project-context";
import { ResetZoomOnNavigate } from "@/components/shared/reset-zoom-on-navigate";

const defaultUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

export const metadata = {
  metadataBase: new URL(defaultUrl),
  title: "S&C Software Monitoring",
  description: "",
  icons: {
    icon: "/icon.svg",
  },
};

// resizes-content: on Android/Chrome the on-screen keyboard shrinks the page
// instead of covering it, so inputs at the bottom (chat) stay visible. iOS
// ignores it — see hooks/use-visual-viewport-fit.ts for the modal side.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  interactiveWidget: "resizes-content",
};

const nunitoSans = Nunito_Sans({
  variable: "--font-body",
  display: "swap",
  subsets: ["latin"],
});

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={nunitoSans.variable} suppressHydrationWarning>
      <body className="bg-background text-foreground min-h-dvh">
        <ResetZoomOnNavigate />
        <script
          type="text/javascript"
          src="https://unpkg.com/@cometchat/chat-sdk-javascript/CometChat.js"
        ></script>

        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          forcedTheme="dark"
          disableTransitionOnChange
        >
          <Providers>
            <UserProvider>
              {/* Root-level so developers keep their "Working on" project
                  across /{slug} pages, /dev/chat and the login redirect. */}
              <SelectedProjectProvider>
                <main className="flex flex-col min-h-dvh w-full">
                  {children}
                </main>
              </SelectedProjectProvider>

              <Suspense>
                <Toaster expand={false} closeButton />
              </Suspense>
            </UserProvider>
          </Providers>
        </ThemeProvider>
      </body>
    </html>
  );
}
