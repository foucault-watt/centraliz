import { webcrypto } from "node:crypto";
import { afterEach, expect, it, vi } from "vitest";
import {
  confirmBrowserEntMigration,
  readBrowserEntCredentials,
  saveBrowserEntCredentials,
} from "./browserEntCredentials";

afterEach(() => vi.unstubAllGlobals());

it("stores only encrypted credentials and binds each record to its Centraliz account", async () => {
  const records = new Map();
  const database = {
    close() {},
    transaction() {
      const transaction = {
        objectStore: () => ({
          get: (account) => {
            const request = { result: records.get(account) };
            queueMicrotask(() => request.onsuccess?.());
            return request;
          },
          put: (record, account) => {
            records.set(account, record);
            return {};
          },
        }),
      };
      setTimeout(() => transaction.oncomplete(), 0);
      return transaction;
    },
  };
  vi.stubGlobal("crypto", webcrypto);
  vi.stubGlobal("indexedDB", {
    open() {
      const request = { result: database };
      queueMicrotask(() => request.onsuccess());
      return request;
    },
  });

  const credentials = { ent_username: "alice", password: "example-password" };
  expect(await saveBrowserEntCredentials("alice", credentials)).toBe(true);
  expect(records.get("alice").key.extractable).toBe(false);
  expect(JSON.stringify(records.get("alice"))).not.toContain(credentials.password);
  expect(await readBrowserEntCredentials("alice")).toEqual(credentials);
  expect(await readBrowserEntCredentials("bob")).toBeNull();
  records.set("bob", records.get("alice"));
  expect(await readBrowserEntCredentials("bob")).toBeNull();

  expect(await saveBrowserEntCredentials("carol", credentials, "receipt")).toBe(true);
  expect(await readBrowserEntCredentials("carol")).toBeNull();
  await confirmBrowserEntMigration("carol", "unrelated-receipt");
  expect(await readBrowserEntCredentials("carol")).toBeNull();
  await confirmBrowserEntMigration("carol", "receipt");
  expect(await readBrowserEntCredentials("carol")).toEqual(credentials);
});

it("allows the form to continue when the browser refuses local storage", async () => {
  vi.stubGlobal("crypto", webcrypto);
  vi.stubGlobal("indexedDB", { open() { throw new Error("storage unavailable"); } });
  expect(await readBrowserEntCredentials("alice")).toBeNull();
  expect(await saveBrowserEntCredentials("alice", { password: "example" })).toBe(false);
});
