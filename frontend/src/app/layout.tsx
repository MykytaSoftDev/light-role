import { Providers as TanstackQueryProvider, ThemeProvider } from "@/providers/query.provider";
import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { Toaster } from "sonner";

import "@/styles/globals.css";
import { Space_Grotesk } from "next/font/google";
import localFont from "next/font/local";
import { allResumeFontVariables } from "@/lib/fonts/resume-fonts";

const space_grotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  preload: true,
  adjustFontFallback: true,
  variable: "--font-display",
});

const jetbrains_mono = localFont({
  src: [
    {
      path: "../../public/fonts/JetBrainsMono-VariableFont_wght.ttf",
      weight: "100 900",
      style: "normal",
    },
    {
      path: "../../public/fonts/JetBrainsMono-Italic-VariableFont_wght.ttf",
      weight: "100 900",
      style: "italic",
    },
  ],
  display: "swap",
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "Light Role",
  description: "AI-powered job search management platform",
  icons: {
    icon: [
      { url: "/assets/favicon/favicon.svg", type: "image/svg+xml" },
      { url: "/assets/favicon/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/assets/favicon/favicon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/assets/favicon/favicon-48.png", sizes: "48x48", type: "image/png" },
    ],
    apple: [
      { url: "/assets/favicon/apple-touch-icon-180.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: "#FFFFFF",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html
      lang={locale}
      className={`${space_grotesk.variable} ${jetbrains_mono.variable} ${allResumeFontVariables}`}
      style={{
        ["--font-body" as string]: "var(--font-display)",
        ["--display-family" as string]: "var(--font-display)",
        ["--body-family" as string]: "var(--font-display)",
      }}
      suppressHydrationWarning
    >
      <body className={`antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          <NextIntlClientProvider messages={messages}>
            <TanstackQueryProvider>
              {children}
              <Toaster expand theme="light" richColors position="top-right" duration={6000} />
            </TanstackQueryProvider>
          </NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
