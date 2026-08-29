import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { fetchApi } from "../utils/api";
import AccentColorCard, {
  THEME_COLOR_CARD_DISMISS_STORAGE_KEY,
} from "./AccentColorCard";

jest.mock("../utils/api", () => ({
  fetchApi: jest.fn(),
}));

const palette = [
  {
    id: "assoc-1",
    name: "Association Test 1",
    colorPrimary: "#597ee5",
    colorPrimaryDark: "#4267ce",
    iconUrl: null,
  },
  {
    id: "assoc-2",
    name: "Association Test 2",
    colorPrimary: "#7c5cff",
    colorPrimaryDark: "#6342d9",
    iconUrl: "/api/theme-palette/icon/foo.webp",
  },
];

describe("AccentColorCard", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    fetchApi.mockReset();
  });

  it("loads the palette and shows one option per entry", async () => {
    fetchApi.mockResolvedValueOnce({
      json: async () => ({ success: true, entries: palette }),
    });

    render(<AccentColorCard onSaved={jest.fn()} />);

    expect(await screen.findByText("Association Test 1")).toBeInTheDocument();
    expect(screen.getByText("Association Test 2")).toBeInTheDocument();
    expect(fetchApi).toHaveBeenCalledWith("/api/theme-palette");
  });

  it("hides the card and remembers the dismissal for the session when 'Plus tard' is clicked", async () => {
    fetchApi.mockResolvedValueOnce({
      json: async () => ({ success: true, entries: palette }),
    });

    render(<AccentColorCard onSaved={jest.fn()} />);
    await screen.findByText("Association Test 1");

    fireEvent.click(screen.getByRole("button", { name: "Plus tard" }));

    expect(screen.queryByText("Association Test 1")).not.toBeInTheDocument();
    expect(
      window.sessionStorage.getItem(THEME_COLOR_CARD_DISMISS_STORAGE_KEY)
    ).toBe("true");

    const { container } = render(<AccentColorCard onSaved={jest.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("saves the chosen color and notifies the parent so the card can disappear for good", async () => {
    const onSaved = jest.fn().mockResolvedValue();
    fetchApi
      .mockResolvedValueOnce({
        json: async () => ({ success: true, entries: palette }),
      })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true }) });

    render(<AccentColorCard onSaved={onSaved} />);
    await screen.findByText("Association Test 1");

    fireEvent.click(screen.getByRole("button", { name: /Association Test 2/ }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    expect(fetchApi).toHaveBeenNthCalledWith(
      2,
      "/api/user/theme-color",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          themeColor: "#7c5cff",
          themeColorDark: "#6342d9",
        }),
      })
    );
  });

  it("shows an error and keeps the card visible when saving fails", async () => {
    fetchApi
      .mockResolvedValueOnce({
        json: async () => ({ success: true, entries: palette }),
      })
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: "Erreur serveur" }),
      });

    render(<AccentColorCard onSaved={jest.fn()} />);
    await screen.findByText("Association Test 1");

    fireEvent.click(screen.getByRole("button", { name: /Association Test 1/ }));

    expect(
      await screen.findByText(/une erreur s'est produite/i)
    ).toBeInTheDocument();
    expect(screen.getByText("Association Test 1")).toBeInTheDocument();
  });
});
