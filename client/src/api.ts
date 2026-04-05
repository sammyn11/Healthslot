const base = "";

export async function api<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${base}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });

  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text) as T & { error?: string };
    } catch {
      data = null;
    }
  }

  if (!res.ok) {
    const msgFromJson =
      data && typeof data === "object" && data !== null && "error" in data
        ? String((data as { error: string }).error)
        : "";
    const noApiJson = !msgFromJson;
    const proxyOrDown =
      noApiJson && [404, 502, 503, 504].includes(res.status);
    const devHint = `Cannot reach API for ${path}. From the repo root run: npm run dev — wait until the terminal shows the API listening, then open http://127.0.0.1:5173/clinic-login (use 5173, not 4000). If the API uses another port, set VITE_DEV_API_PORT in client/.env and restart Vite.`;
    const err = new Error(msgFromJson || (proxyOrDown ? devHint : res.statusText));
    (err as Error & { status: number }).status = res.status;
    throw err;
  }

  return (data ?? ({} as T)) as T;
}
