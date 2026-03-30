import { Providers as TanstackQueryProvider, ThemeProvider } from "@/providers/query.provider";
import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import { Toaster } from "sonner";

import "@/styles/globals.css";

const outfit = Outfit({
  variable: "--font-outfit-sans",
  weight: ["400", "700"],
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Light Role",
  description: "AI-powered job search management platform",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${outfit.variable} antialiased`}>
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
