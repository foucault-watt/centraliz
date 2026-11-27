import moment from "./momentFr";

test("la semaine commence le lundi, en français", () => {
  const d = moment("2026-11-04").startOf("week");
  expect(d.format("ddd DD/MM")).toBe("lun. 02/11");
  expect(moment("2026-11-04").format("MMMM")).toBe("novembre");
});
