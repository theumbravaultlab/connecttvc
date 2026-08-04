import type { Metadata, Viewport } from "next";
import { Fredoka, Nunito } from "next/font/google";
import Script from "next/script";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import "./globals.css";

const fredoka = Fredoka({
  variable: "--font-fredoka",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Connect TVC — Home Groups",
  description:
    "Find and manage home groups: coordinator map + directory for Connect TVC.",
  // iOS Safari doesn't read the web manifest (manifest.ts) the way Android
  // Chrome does — these are the iOS-specific equivalents so "Add to Home
  // Screen" still gets a real title/icon/standalone launch there too.
  appleWebApp: {
    title: "Connect TVC",
    statusBarStyle: "default",
    capable: true,
  },
};

// Brand blue regardless of light/dark theme — same "deliberately not
// tokenized" call already made for this color everywhere else in the app
// (see PROJECT_STATUS.md's Dark Mode section).
export const viewport: Viewport = {
  themeColor: "#088df9",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${fredoka.variable} ${nunito.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        {/* Restores an explicit light/dark override before hydration, so
         * there's no flash back to the OS-preference default on load. If
         * there's no stored override, this does nothing on purpose —
         * globals.css's prefers-color-scheme media query already renders
         * the right theme on the very first paint with zero JS needed.
         * beforeInteractive + root layout is required for this to run
         * before hydration — a plain <script> tag renders as inert markup
         * under React and never executes. */}
        <Script
          id="theme-restore"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `try {
  var t = localStorage.getItem("connect-tvc-theme");
  if (t === "light" || t === "dark") document.documentElement.setAttribute("data-theme", t);
} catch (e) {}`,
          }}
        />
        <ThemeProvider>{children}</ThemeProvider>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
