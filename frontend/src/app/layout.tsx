import { Providers as TanstackQueryProvider, ThemeProvider } from "@/providers/query.provider";
import type { Metadata } from "next";
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
