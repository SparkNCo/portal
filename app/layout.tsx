import "./globals.css";
import { Nunito_Sans } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Providers } from "@/lib/tanstack/providers";
import { UserProvider } from "../context/UserContext";

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
      <body className="bg-background text-foreground min-h-screen">
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
              <main className="flex flex-col min-h-screen w-full">
                {children}
              </main>

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
