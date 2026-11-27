import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import ActivityPanel from "./ActivityPanel";
import { fetchApi } from "../../utils/api";

vi.mock("../../utils/api", () => ({ fetchApi: vi.fn() }));

const json = (data, ok = true, status = 200) => ({ ok, status, json: async () => data });
const message = (id, text, author = "Alice") => ({
  id,
  kind: "chat",
  type: "message",
  author,
  username: author.toLowerCase(),
  text,
  createdAt: "2026-11-27T12:00:00.000Z",
});

// Faux serveur : `feed` est la fin du fil telle que le backend la renverrait.
function fakeServer(feed, { postResponse } = {}) {
  fetchApi.mockImplementation(async (url, options = {}) => {
    if (url === "/api/pokemon/summary") return json({ firstVisit: true, total: 0 });
    if (url.startsWith("/api/pokemon/activity")) {
      const after = Number(new URLSearchParams(url.split("?")[1]).get("after") || 0);
      return json({ items: feed.filter((item) => item.id > after) });
    }
    if (url === "/api/pokemon/chat" && options.method === "POST") {
      return postResponse ? postResponse(JSON.parse(options.body)) : json({ item: message(99, "?") }, true, 201);
    }
    if (url.startsWith("/api/pokemon/chat/") && options.method === "DELETE") return json({ success: true });
    return json({});
  });
}

const flush = () => act(async () => { await vi.advanceTimersByTimeAsync(10); });

beforeEach(() => {
  vi.useFakeTimers();
  fetchApi.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("ActivityPanel (chat)", () => {
  it("affiche les messages existants et annonce un fil vide", async () => {
    fakeServer([]);
    const { unmount } = render(<ActivityPanel />);
    await flush();
    expect(screen.getByText("Aucun message pour l'instant.")).toBeInTheDocument();
    unmount();

    fakeServer([message(1, "Salut tout le monde")]);
    render(<ActivityPanel />);
    await flush();
    expect(screen.getByText("Salut tout le monde")).toBeInTheDocument();
    expect(screen.getByText("Alice")).toBeInTheDocument();
  });

  it("envoie un message, l'affiche et vide la saisie", async () => {
    const feed = [];
    fakeServer(feed, {
      postResponse: ({ text }) => {
        const item = message(1, text, "Moi");
        feed.push(item);
        return json({ item }, true, 201);
      },
    });
    render(<ActivityPanel />);
    await flush();

    const input = screen.getByLabelText("Message");
    fireEvent.change(input, { target: { value: "On va à Jadielle ?" } });
    fireEvent.click(screen.getByLabelText("Envoyer"));
    await flush();

    expect(screen.getByText("On va à Jadielle ?")).toBeInTheDocument();
    expect(input).toHaveValue("");
    const posted = fetchApi.mock.calls.find(([url]) => url === "/api/pokemon/chat");
    expect(JSON.parse(posted[1].body)).toEqual({ text: "On va à Jadielle ?" });

    // L'actualisation suivante ne duplique pas le message déjà affiché.
    await act(async () => { await vi.advanceTimersByTimeAsync(3000); });
    expect(screen.getAllByText("On va à Jadielle ?")).toHaveLength(1);
  });

  it("montre l'erreur du serveur et garde le texte saisi", async () => {
    fakeServer([], {
      postResponse: () => json({ message: "Un message toutes les 2 secondes au maximum." }, false, 429),
    });
    render(<ActivityPanel />);
    await flush();

    const input = screen.getByLabelText("Message");
    fireEvent.change(input, { target: { value: "trop vite" } });
    fireEvent.click(screen.getByLabelText("Envoyer"));
    await flush();

    expect(screen.getByRole("alert")).toHaveTextContent("Un message toutes les 2 secondes au maximum.");
    expect(input).toHaveValue("trop vite");
  });

  it("reçoit les nouveaux messages des autres joueurs", async () => {
    const feed = [message(1, "Premier")];
    fakeServer(feed);
    render(<ActivityPanel />);
    await flush();

    feed.push(message(2, "Deuxième", "Bob"));
    await act(async () => { await vi.advanceTimersByTimeAsync(3000); });
    expect(screen.getByText("Deuxième")).toBeInTheDocument();
    expect(fetchApi.mock.calls.some(([url]) => url === "/api/pokemon/activity?after=1")).toBe(true);
  });

  it("retire un message supprimé par un admin depuis un autre poste", async () => {
    const feed = [message(1, "Gardé"), message(2, "Message supprimé")];
    fakeServer(feed);
    render(<ActivityPanel />);
    await flush();
    expect(screen.getByText("Message supprimé")).toBeInTheDocument();

    feed.splice(1, 1);
    await act(async () => { await vi.advanceTimersByTimeAsync(3000 * 10); });
    expect(screen.queryByText("Message supprimé")).not.toBeInTheDocument();
    expect(screen.getByText("Gardé")).toBeInTheDocument();
  });

  it("admin : le bouton supprime le message après confirmation", async () => {
    fakeServer([message(1, "À modérer")]);
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<ActivityPanel isAdmin />);
    await flush();

    fireEvent.click(screen.getByLabelText("Supprimer le message"));
    await flush();
    expect(confirm).toHaveBeenCalledWith("Supprimer le message de Alice pour tous les joueurs ?");
    expect(screen.queryByText("À modérer")).not.toBeInTheDocument();
    expect(fetchApi).toHaveBeenCalledWith("/api/pokemon/chat/1", { method: "DELETE" });
    confirm.mockRestore();
  });

  it("admin : rien n'est supprimé si la confirmation est refusée", async () => {
    fakeServer([message(1, "Gardé")]);
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<ActivityPanel isAdmin />);
    await flush();

    fireEvent.click(screen.getByLabelText("Supprimer le message"));
    await flush();
    expect(screen.getByText("Gardé")).toBeInTheDocument();
    expect(fetchApi.mock.calls.some(([, options]) => options?.method === "DELETE")).toBe(false);
    confirm.mockRestore();
  });

  it("admin : un échec de suppression est signalé et le message reste", async () => {
    fakeServer([message(1, "Toujours là")]);
    const base = fetchApi.getMockImplementation();
    fetchApi.mockImplementation(async (url, options = {}) =>
      options.method === "DELETE" ? json({ message: "Accès non autorisé." }, false, 403) : base(url, options),
    );
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<ActivityPanel isAdmin />);
    await flush();

    fireEvent.click(screen.getByLabelText("Supprimer le message"));
    await flush();
    expect(screen.getByText("Toujours là")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Message non supprimé. Réessayer.");
    confirm.mockRestore();
  });

  it("joueur : pas de bouton de suppression", async () => {
    fakeServer([message(1, "Bonjour")]);
    render(<ActivityPanel />);
    await flush();
    expect(screen.queryByLabelText("Supprimer le message")).not.toBeInTheDocument();
  });
});
