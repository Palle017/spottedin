// Explicit HTTP status handling: every error thrown by a function carries its
// status. No inference from message prefixes.

export class HttpError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function json(body: unknown, status = 200, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

export function errorResponse(error: unknown, headers: HeadersInit = {}): Response {
  if (error instanceof HttpError) return json({ error: error.message }, error.status, headers);
  console.error('Unhandled function error', error);
  return json({ error: 'Unexpected server error' }, 500, headers);
}

export function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get('origin') ?? '';
  const allowed = (Deno.env.get('APP_ORIGINS') ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  return {
    ...(allowed.includes(origin) ? { 'access-control-allow-origin': origin } : {}),
    'access-control-allow-headers': 'authorization, apikey, content-type, x-client-info',
    'access-control-allow-methods': 'POST, OPTIONS',
    'vary': 'origin',
  };
}

export function handleOptions(request: Request): Response | null {
  if (request.method !== 'OPTIONS') return null;
  return new Response(null, { status: 204, headers: corsHeaders(request) });
}
