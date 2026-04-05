import { Providers as TanstackQueryProvider, ThemeProvider } from "@/providers/query.provider";
import type { Metadata } from "next";
import { EB_Garamond, IBM_Plex_Mono, Karla } from "next/font/google";
import { Toaster } from "sonner";

import "@/styles/globals.css";

const eb_garamond = EB_Garamond({
  subsets: ["latin"],
  weight: ["700"],
  variable: "--display-family",
});
const karla = Karla({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--body-family",
});
const ibm_plex_mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "Light Role",
  description: "AI-powered job search management platform",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${eb_garamond.variable} ${karla.variable} ${ibm_plex_mono.variable} antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          <TanstackQueryProvider>
            {children}
            <Toaster expand theme="light" richColors position="top-right" duration={6000} />
          </TanstackQueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
