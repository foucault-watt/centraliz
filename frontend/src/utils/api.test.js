import { fetchApi, storeUserSecretSalt, syncUserSecretSalt, getStoredUserSecretSalt } from "./api";

test('auth refresh preserves the account-local key and cannot replace it with the old server key', () => {
  try {
    window.localStorage.setItem('centraliz.entKey:alice', 'client-held-alice-key');
    syncUserSecretSalt({ userName: 'alice', userKeyMode: 'client', userSecretSalt: 'stale-server-key' });
    expect(getStoredUserSecretSalt()).toBe('client-held-alice-key');
    syncUserSecretSalt({ userName: 'bob', userKeyMode: 'client' });
    expect(getStoredUserSecretSalt()).toBe('');
    syncUserSecretSalt({ userName: 'legacy', userKeyMode: 'legacy', userSecretSalt: 'legacy-key' });
    expect(getStoredUserSecretSalt()).toBe('legacy-key');
  } finally { window.localStorage.clear(); }
});

test("Moodle receives the same local user key and session cookies as ENT services", async () => {
  const originalFetch = global.fetch;
  global.fetch = vi.fn().mockResolvedValue({ ok: true });
  try {
    storeUserSecretSalt("test-local-key");
    await fetchApi("/api/moodle/courses", { method: "POST" });
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining("/api/moodle/courses"), expect.objectContaining({
      credentials: "include", headers: expect.objectContaining({ "X-User-Key": "test-local-key" }),
    }));
  } finally {
    window.localStorage.clear();
    global.fetch = originalFetch;
  }
});
