/** Shows a toast from outside the UI provider (e.g. when the server refuses a save). */
export const notify = (message) => window.dispatchEvent(new CustomEvent("bs:toast", { detail: message }));

// Calls the BrighterStep API. The session is an HttpOnly cookie, so requests just include credentials.

/** GET when body is undefined, otherwise POST JSON. Returns the JSON body; throws the server's message on failure. */
export async function api(path, body) {
  const init = body === undefined
    ? { credentials: "same-origin" }
    : { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
  let res;
  try { res = await fetch(`/api/${path}`, init); } catch {
    throw Object.assign(new Error("Can't reach the server. Check your connection and try again."), { status: 0 });
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) {
    // A 401 on a data call means the session ended (expired, signed out elsewhere, or deactivated).
    if (res.status === 401 && !path.startsWith("auth/")) window.dispatchEvent(new Event("bs:signed-out"));
    throw Object.assign(new Error(data.error || "Something went wrong. Please try again."), { status: res.status });
  }
  return data;
}
