import { render, screen } from "@testing-library/react";
import ReglagesPage from "./ReglagesPage";
import { fetchApi } from "../utils/api";

jest.mock("../utils/api", () => ({
  fetchApi: jest.fn(),
}));

const user = {
  userName: "jdupont",
  icalLink: "https://e-cal.example.com/abc.ics",
  has_mail_password: true,
  has_cekilui_photo: false,
  has_read_mail: false,
  has_used_links: false,
  has_viewed_calendar_event: false,
  has_played_ceki_round: false,
  support_bds: null,
  theme_color: null,
  theme_color_dark: null,
};

describe("ReglagesPage", () => {
  beforeEach(() => {
    fetchApi.mockReset();
    fetchApi.mockImplementation((url) => {
      if (url === "/api/user/setup-stats") {
        return Promise.resolve({ json: async () => ({ success: true, percentage: 12 }) });
      }
      if (url === "/api/theme-palette") {
        return Promise.resolve({ json: async () => ({ success: true, entries: [] }) });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });
  });

  it("renders getSetupStatus's output as a progress list, without re-deriving the logic", async () => {
    render(<ReglagesPage user={user} onUserRefresh={jest.fn()} />);

    expect(screen.getByText(/3\/8\s*étapes terminées/)).toBeInTheDocument();
    expect(await screen.findByText(/Tu es dans les 12%/)).toBeInTheDocument();
    expect(screen.getByText("Emploi du temps ajouté")).toBeInTheDocument();
  });
});
