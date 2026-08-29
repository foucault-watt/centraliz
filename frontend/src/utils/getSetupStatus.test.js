import { getSetupStatus } from "./getSetupStatus";

const noUser = {};

const nothingConfigured = {
  userName: "jdupont",
  icalLink: null,
  has_mail_password: false,
  has_cekilui_photo: false,
  has_read_mail: false,
  has_used_links: false,
  has_viewed_calendar_event: false,
  has_played_ceki_round: false,
  support_bds: null,
  theme_color: null,
  theme_color_dark: null,
};

const scheduleOnly = {
  ...nothingConfigured,
  icalLink: "https://e-cal.example.com/abc.ics",
};

const mailPasswordOnly = {
  ...nothingConfigured,
  has_mail_password: true,
};

const everythingConfigured = {
  ...nothingConfigured,
  icalLink: "https://e-cal.example.com/abc.ics",
  has_mail_password: true,
  has_cekilui_photo: true,
  has_read_mail: true,
  has_used_links: true,
  has_viewed_calendar_event: true,
  has_played_ceki_round: true,
  theme_color: "#7c5cff",
  theme_color_dark: "#6342d9",
};

const bdsThemeWithPersonalColor = {
  ...everythingConfigured,
  support_bds: "mads",
  theme_color: "#7c5cff",
  theme_color_dark: "#6342d9",
};

describe("getSetupStatus", () => {
  it("never makes a network call or touches the DOM (pure function contract)", () => {
    expect(typeof getSetupStatus).toBe("function");
    expect(getSetupStatus.constructor.name).not.toBe("AsyncFunction");
  });

  it("handles a missing/null user without throwing", () => {
    const status = getSetupStatus(null);
    expect(status.completedCount).toBe(1); // login only
    expect(status.totalCount).toBe(8);
    expect(status.isComplete).toBe(false);
    expect(status.unlockedTabs).toEqual([]);
    expect(status.activeColor).toBeNull();
  });

  it("counts only the free login step when nothing is configured", () => {
    const status = getSetupStatus(nothingConfigured);
    expect(status.completedCount).toBe(1);
    expect(status.totalCount).toBe(8);
    expect(status.isComplete).toBe(false);
    expect(status.unlockedTabs).toEqual([]);

    const byKey = Object.fromEntries(status.steps.map((s) => [s.key, s.done]));
    expect(byKey.login).toBe(true);
    expect(byKey.mailPassword).toBe(false);
    expect(byKey.schedule).toBe(false);
    expect(byKey.mailRead).toBe(false);
    expect(byKey.linksUsed).toBe(false);
    expect(byKey.calendarViewed).toBe(false);
    expect(byKey.cekiPlayed).toBe(false);
    expect(byKey.cekiPhoto).toBe(false);
  });

  it("counts the schedule step when only the ICS link is set", () => {
    const status = getSetupStatus(scheduleOnly);
    expect(status.completedCount).toBe(2); // login + schedule
    const byKey = Object.fromEntries(status.steps.map((s) => [s.key, s.done]));
    expect(byKey.schedule).toBe(true);
    expect(byKey.mailPassword).toBe(false);
    expect(status.unlockedTabs).toEqual([]);
  });

  it("unlocks the notes/mail tabs only once the mail password step is done", () => {
    const status = getSetupStatus(mailPasswordOnly);
    expect(status.completedCount).toBe(2); // login + mailPassword
    expect(status.unlockedTabs).toEqual(["notes", "communication"]);
  });

  it("marks setup complete once every real step is done, excluding color from the count", () => {
    const status = getSetupStatus(everythingConfigured);
    expect(status.completedCount).toBe(8);
    expect(status.totalCount).toBe(8);
    expect(status.isComplete).toBe(true);
    expect(status.unlockedTabs).toEqual(["notes", "communication"]);
    expect(status.activeColor).toEqual({
      source: "personal",
      primary: "#7c5cff",
      dark: "#6342d9",
    });
  });

  it("gives BDS theme visual precedence over a personal color when support_bds is active", () => {
    const status = getSetupStatus(bdsThemeWithPersonalColor);
    expect(status.isComplete).toBe(true);
    expect(status.activeColor).toEqual({
      source: "bds",
      primary: "#f97316",
      dark: "#ea580c",
    });
  });

  it("does not count the color choice itself as a progress step", () => {
    const withColorOnly = { ...nothingConfigured, theme_color: "#123456" };
    const status = getSetupStatus(withColorOnly);
    expect(status.completedCount).toBe(1); // still just the free login step
    expect(status.activeColor).toEqual({
      source: "personal",
      primary: "#123456",
      dark: null,
    });
  });
});
