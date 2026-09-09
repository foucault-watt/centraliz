import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { fetchApi } from "../utils/api";
import IcalSetupCard from "./IcalSetupCard";

jest.mock("../utils/api", () => ({
  fetchApi: jest.fn(),
}));

describe("IcalSetupCard", () => {
  beforeEach(() => {
    fetchApi.mockReset();
  });

  it("shows the card and its call-to-action by default, with no way to dismiss it", () => {
    render(<IcalSetupCard userName="jdupont" onSaved={jest.fn()} />);

    expect(screen.getByText("Ajoute ton lien iCal")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Plus tard" })
    ).not.toBeInTheDocument();
  });

  it("shows an error and keeps the card visible when the link is invalid", async () => {
    fetchApi.mockResolvedValueOnce({
      json: async () => ({ isValid: false }),
    });

    render(<IcalSetupCard userName="jdupont" onSaved={jest.fn()} />);
    await userEvent.type(screen.getByLabelText("Lien iCal"), "not-a-link");
    fireEvent.click(screen.getByRole("button", { name: "Valider" }));

    expect(await screen.findByText(/ne semble pas valide/i)).toBeInTheDocument();
    expect(fetchApi).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Ajoute ton lien iCal")).toBeInTheDocument();
  });

  it("shows an error and does not notify the parent when saving the valid link fails", async () => {
    const onSaved = jest.fn();
    fetchApi
      .mockResolvedValueOnce({ json: async () => ({ isValid: true }) })
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: "Erreur serveur" }),
      });

    render(<IcalSetupCard userName="jdupont" onSaved={onSaved} />);
    await userEvent.type(
      screen.getByLabelText("Lien iCal"),
      "https://planning.centralelille.fr/abc.ics"
    );
    fireEvent.click(screen.getByRole("button", { name: "Valider" }));

    expect(
      await screen.findByText(/une erreur s'est produite/i)
    ).toBeInTheDocument();
    expect(onSaved).not.toHaveBeenCalled();
    expect(screen.getByText("Ajoute ton lien iCal")).toBeInTheDocument();
  });

  it("saves a valid link and notifies the parent so the card can disappear for good", async () => {
    const onSaved = jest.fn().mockResolvedValue();
    fetchApi
      .mockResolvedValueOnce({ json: async () => ({ isValid: true }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true }) });

    render(<IcalSetupCard userName="jdupont" onSaved={onSaved} />);
    await userEvent.type(
      screen.getByLabelText("Lien iCal"),
      "https://planning.centralelille.fr/abc.ics"
    );
    fireEvent.click(screen.getByRole("button", { name: "Valider" }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    expect(fetchApi).toHaveBeenNthCalledWith(
      1,
      "/api/validate-ical",
      expect.objectContaining({ method: "POST" })
    );
    expect(fetchApi).toHaveBeenNthCalledWith(
      2,
      "/api/save-user",
      expect.objectContaining({ method: "POST" })
    );
  });
});
