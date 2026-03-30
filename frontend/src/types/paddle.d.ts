// Supplemental TypeScript declarations for @paddle/paddle-js.
// The npm package covers most types. This file only adds what's missing.

// Augment the Checkout namespace to declare updateCheckout and close,
// which exist at runtime but are not always present in the package's type
// definitions depending on the installed version.
declare module "@paddle/paddle-js" {
  interface PaddleCheckout {
    /** Update items/options on an already-open inline checkout. */
    updateCheckout(options: {
      items?: Array<{ priceId: string; quantity?: number }>;
    }): void;
    /** Close the currently open inline checkout frame. */
    close(): void;
  }
}

export {};
