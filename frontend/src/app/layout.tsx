import { Providers as TanstackQueryProvider, ThemeProvider } from "@/providers/query.provider";
import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { Toaster } from "sonner";

import "@/styles/globals.css";
import { JetBrains_Mono, Space_Grotesk } from "next/font/google";
const space_grotesk_display = Space_Grotesk({
  subsets: ["latin"],
  weight: ["700"],
  variable: "--display-family",
});
const space_grotesk_body = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--body-family",
});
const jetbrains_mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400"],
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
      className={`${space_grotesk_display.variable} ${space_grotesk_body.variable} ${jetbrains_mono.variable}`}
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
