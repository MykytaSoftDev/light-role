// Paddle.js v2 integration — overlay checkout

// ── Minimal Paddle global type ─────────────────────────────────────────────

declare global {
  interface Window {
    Paddle?: {
      Environment: {
        set: (env: 'sandbox' | 'production') => void;
      };
      Setup: (options: { token: string; eventCallback?: (event: PaddleEvent) => void }) => void;
      Checkout: {
        open: (options: PaddleCheckoutOptions) => void;
      };
    };
  }
}

interface PaddleEvent {
  name: string;
  data?: {
    transaction_id?: string;
    [key: string]: unknown;
  };
}

interface PaddleCheckoutOptions {
  items: Array<{ priceId: string; quantity: number }>;
  customer?: { email: string };
  customData?: Record<string, string>;
}

// ── Script loading ─────────────────────────────────────────────────────────

let scriptLoaded = false;
let scriptLoading = false;
const onLoadCallbacks: Array<() => void> = [];

function loadPaddleScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (scriptLoaded) {
      resolve();
      return;
    }

    onLoadCallbacks.push(resolve);

    if (scriptLoading) return;
    scriptLoading = true;

    const script = document.createElement('script');
    script.src = 'https://cdn.paddle.com/paddle/v2/paddle.js';
    script.async = true;

    script.onload = () => {
      scriptLoaded = true;
      scriptLoading = false;
      onLoadCallbacks.forEach((cb) => cb());
      onLoadCallbacks.length = 0;
    };

    script.onerror = () => {
      scriptLoading = false;
      onLoadCallbacks.length = 0;
      reject(new Error('Failed to load Paddle.js'));
    };

    document.head.appendChild(script);
  });
}

// ── Initialization ─────────────────────────────────────────────────────────

let paddleInitialized = false;

export async function initPaddle(): Promise<void> {
  if (typeof window === 'undefined') return;
  if (paddleInitialized) return;

  const token = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN;
  const environment = process.env.NEXT_PUBLIC_PADDLE_ENVIRONMENT as 'sandbox' | 'production' | undefined;

  if (!token) {
    console.warn('Paddle client token is not configured.');
    return;
  }

  try {
    await loadPaddleScript();

    if (!window.Paddle) {
      console.warn('Paddle global not found after script load.');
      return;
    }

    if (environment === 'sandbox') {
      window.Paddle.Environment.set('sandbox');
    }

    window.Paddle.Setup({ token });
    paddleInitialized = true;
  } catch (err) {
    console.error('Paddle initialization failed:', err);
  }
}

// ── Checkout ───────────────────────────────────────────────────────────────

export function openCheckout(
  priceId: string,
  userEmail: string,
  userId: string,
  onSuccess?: () => void,
): void {
  if (typeof window === 'undefined' || !window.Paddle) {
    console.error('Paddle is not initialized. Call initPaddle() first.');
    return;
  }

  window.Paddle.Checkout.open({
    items: [{ priceId, quantity: 1 }],
    customer: { email: userEmail },
    customData: { user_id: userId },
  });

  // Paddle.js v2 fires window events for checkout lifecycle.
  // We listen once for a successful transaction event and call onSuccess.
  if (onSuccess) {
    function handlePaddleEvent(event: MessageEvent) {
      if (
        event.data &&
        typeof event.data === 'object' &&
        event.data.event_name === 'checkout.completed'
      ) {
        onSuccess?.();
        window.removeEventListener('message', handlePaddleEvent);
      }
    }

    window.addEventListener('message', handlePaddleEvent);
  }
}
