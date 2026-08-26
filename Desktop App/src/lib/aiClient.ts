/**
 * RimChronicle — unified AI client.
 *
 * Inside the Electron desktop app all "/api/ai/..." calls travel over IPC to
 * the local backend in the main process. Outside Electron (plain `vite dev` or
 * `vite preview` in a browser) it falls back to HTTP fetch, preserving the
 * exact same call signature and response shape as fetch().
 */

export interface AiResponseLike {
  ok: boolean;
  status: number;
  json: () => Promise<any>;
}

declare global {
  interface Window {
    rimchronicle?: {
      aiRequest: (
        method: string,
        path: string,
        options?: { query?: Record<string, string>; body?: unknown }
      ) => Promise<{ status: number; data: any }>;
    };
  }
}

export async function aiFetch(url: string, init?: RequestInit): Promise<AiResponseLike> {
  const bridge = typeof window !== "undefined" ? window.rimchronicle : undefined;

  if (bridge && typeof bridge.aiRequest === "function") {
    const method = (init?.method || "GET").toUpperCase();

    // Resolve relative URLs ("/api/ai/x") against the current location.
    let pathname = url;
    const query: Record<string, string> = {};
    try {
      const parsed = new URL(url, window.location.href);
      pathname = parsed.pathname;
      parsed.searchParams.forEach((value, key) => {
        query[key] = value;
      });
    } catch {
      /* Keep raw path if URL parsing fails */
    }

    // JSON bodies are passed as structured clones over IPC; strings are
    // decoded so handlers always receive plain objects.
    let body: unknown;
    if (typeof init?.body === "string") {
      try {
        body = JSON.parse(init.body);
      } catch {
        body = init.body;
      }
    } else if (init?.body) {
      body = init.body;
    }

    const result = await bridge.aiRequest(method, pathname, { query, body });
    const status = typeof result?.status === "number" ? result.status : 500;
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => result?.data,
    };
  }

  return fetch(url, init);
}
