import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import MoodleCourses from "./MoodleCourses";
import { fetchApi } from "../utils/api";

vi.mock("../utils/api", () => ({ fetchApi: vi.fn() }));

beforeEach(() => vi.clearAllMocks());

test("loads courses without asking again for an ENT password", async () => {
  fetchApi.mockResolvedValue({ ok: true, json: async () => ({ courses: [
    { name: "Analyse", url: "https://moodle.centralelille.fr/course/view.php?id=1" },
  ] }) });
  render(<MemoryRouter><MoodleCourses /></MemoryRouter>);
  fireEvent.click(screen.getByRole("button", { name: "Afficher mes cours" }));
  expect(await screen.findByRole("link", { name: "Analyse" })).toHaveAttribute("href", "https://moodle.centralelille.fr/course/view.php?id=1");
  expect(fetchApi).toHaveBeenCalledWith("/api/moodle/courses", { method: "POST" });
  expect(document.querySelector('input[type="password"]')).toBeNull();
});

test("uses the existing ENT setup screen when credentials are missing", async () => {
  fetchApi.mockResolvedValue({ ok: false, json: async () => ({ error: "Compte ENT manquant", action: "prompt_ent_password" }) });
  render(<MemoryRouter><MoodleCourses /></MemoryRouter>);
  fireEvent.click(screen.getByRole("button", { name: "Afficher mes cours" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Compte ENT manquant");
  expect(screen.getByRole("link", { name: "Configurer mon compte ENT dans Mails" })).toHaveAttribute("href", "/communication");
});

test("shows sections and downloads the original file as a blob", async () => {
  fetchApi.mockResolvedValueOnce({ ok: true, json: async () => ({ courses: [
    { name: "Analyse", url: "https://moodle.centralelille.fr/course/view.php?id=12" },
  ] }) }).mockResolvedValueOnce({ ok: true, json: async () => ({ sections: [
    { id: "section-0", name: "Chapitre 1", resources: [
      { id: "module-7", moduleId: 7, name: "Support PDF", type: "resource", available: true, url: "https://moodle.centralelille.fr/mod/resource/view.php?id=7" },
    ] },
  ] }) }).mockResolvedValueOnce({ ok: true, headers: { get: () => "attachment; filename*=UTF-8''cours.pdf" }, blob: async () => new Blob(["original"]) });
  const originalCreate = URL.createObjectURL;
  const originalRevoke = URL.revokeObjectURL;
  URL.createObjectURL = vi.fn(() => "blob:original");
  URL.revokeObjectURL = vi.fn();
  const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  try {
    render(<MemoryRouter><MoodleCourses /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: "Afficher mes cours" }));
    fireEvent.click(await screen.findByRole("button", { name: "Voir les ressources de Analyse" }));
    expect(await screen.findByText("Chapitre 1")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Télécharger Support PDF" }));
    await screen.findByRole("status");
    await require("@testing-library/react").waitFor(() => expect(click).toHaveBeenCalled());
    expect(fetchApi).toHaveBeenLastCalledWith("/api/moodle/courses/12/resources/7/file", { method: "POST" });
  } finally {
    click.mockRestore();
    URL.createObjectURL = originalCreate;
    URL.revokeObjectURL = originalRevoke;
  }
});
