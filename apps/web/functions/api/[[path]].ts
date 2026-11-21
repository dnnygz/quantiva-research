/**
 * Cloudflare Pages Function: forwards /api/* to the API Worker through a
 * Service Binding. This keeps the frontend and API on the same origin, so the
 * admin session cookie can be HttpOnly + Secure + SameSite=Lax without relying
 * on third-party cookies between *.pages.dev and *.workers.dev.
 */
interface Env {
  API: { fetch: (request: Request) => Promise<Response> };
}

export const onRequest = async ({ request, env }: { request: Request; env: Env }) =>
  env.API.fetch(request);
