import { applyUserTheme, darkenHex } from "./userTheme";

describe("darkenHex", () => {
  it("darkens a hex color by the given amount", () => {
    expect(darkenHex("#597ee5", 0)).toBe("#597ee5");
    expect(darkenHex("#ffffff", 0.5)).toBe("#808080");
  });

  it("defaults to a 15% darken when no amount is given", () => {
    expect(darkenHex("#597ee5")).toBe("#4c6bc3");
  });
});

describe("applyUserTheme", () => {
  beforeEach(() => {
    document.documentElement.style.removeProperty("--color-primary");
    document.documentElement.style.removeProperty("--color-primary-dark");
  });

  it("does nothing when no color is given", () => {
    applyUserTheme(null, null);
    expect(
      document.documentElement.style.getPropertyValue("--color-primary")
    ).toBe("");
  });

  it("writes --color-primary and --color-primary-dark for a given color", () => {
    applyUserTheme("#7c5cff", "#6342d9");
    expect(
      document.documentElement.style.getPropertyValue("--color-primary")
    ).toBe("#7c5cff");
    expect(
      document.documentElement.style.getPropertyValue("--color-primary-dark")
    ).toBe("#6342d9");
  });

  it("derives a dark variant when none is provided", () => {
    applyUserTheme("#597ee5");
    expect(
      document.documentElement.style.getPropertyValue("--color-primary")
    ).toBe("#597ee5");
    expect(
      document.documentElement.style.getPropertyValue("--color-primary-dark")
    ).toBe("#4c6bc3");
  });
});
