import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import EntBrowserMigration from "./EntBrowserMigration";
import { fetchApi } from "../utils/api";
import {
  confirmBrowserEntMigration,
  saveBrowserEntCredentials,
} from "../utils/browserEntCredentials";

vi.mock("../utils/api", () => ({ fetchApi: vi.fn() }));
vi.mock("../utils/browserEntCredentials", () => ({
  saveBrowserEntCredentials: vi.fn(),
  confirmBrowserEntMigration: vi.fn(),
}));

const user = { userName: "alice", canMigrateEntPassword: true };
const password = "test-password";
const prepared = {
  ok: true,
  json: async () => ({ id: "receipt", entUsername: "ent-alice" }),
};

const submit = () => {
  fireEvent.change(screen.getByLabelText("Mot de passe ENT"), { target: { value: password } });
  fireEvent.click(screen.getByRole("button", { name: "Continuer" }));
};

it("validates the supplied password and confirms the server migration after saving locally", async () => {
  const onMigrated = vi.fn();
  fetchApi.mockResolvedValueOnce(prepared).mockImplementationOnce(async () => {
    expect(saveBrowserEntCredentials).toHaveBeenCalledWith(
      "alice", { ent_username: "ent-alice", password }, "receipt",
    );
    return { ok: true };
  });
  saveBrowserEntCredentials.mockResolvedValue(true);

  render(<EntBrowserMigration user={user} onMigrated={onMigrated}><p>Mails</p></EntBrowserMigration>);
  submit();
  await waitFor(() => expect(onMigrated).toHaveBeenCalledTimes(1));
  expect(fetchApi.mock.calls).toEqual([
    ["/api/auth/ent-browser-migration/prepare", { method: "POST", body: JSON.stringify({ password }) }],
    ["/api/auth/ent-browser-migration/commit", { method: "POST", body: JSON.stringify({ id: "receipt" }) }],
  ]);
  expect(confirmBrowserEntMigration).toHaveBeenCalledWith("alice", "receipt");
});

it("leaves the server copy in place if the browser cannot save the password", async () => {
  const onMigrated = vi.fn();
  fetchApi.mockResolvedValueOnce(prepared);
  saveBrowserEntCredentials.mockResolvedValue(false);

  render(<EntBrowserMigration user={user} onMigrated={onMigrated}><p>Mails</p></EntBrowserMigration>);
  submit();
  expect(await screen.findByRole("alert")).toHaveTextContent("La migration est reportée.");
  expect(fetchApi).toHaveBeenCalledTimes(1);
  expect(onMigrated).not.toHaveBeenCalled();
});
