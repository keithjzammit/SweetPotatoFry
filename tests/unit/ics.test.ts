import { describe, expect, test } from "vitest";
import { buildIcs } from "@/lib/ics";

describe("ics", () => {
  test("emits a single event in CRLF lines", () => {
    const ics = buildIcs({
      name: "Test",
      events: [
        {
          uid: "abc",
          start: new Date("2026-05-03T10:00:00Z"),
          end: new Date("2026-05-03T12:00:00Z"),
          summary: "Plumbing visit",
          description: "Leak under the sink",
        },
      ],
    });
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain("UID:abc@sweetpotatofry");
    expect(ics).toContain("DTSTART:20260503T100000Z");
    expect(ics).toContain("DTEND:20260503T120000Z");
    expect(ics).toContain("SUMMARY:Plumbing visit");
    expect(ics).toContain("END:VEVENT");
    expect(ics).toContain("END:VCALENDAR");
    expect(ics).toMatch(/\r\n/);
  });

  test("escapes commas and semicolons in summaries", () => {
    const ics = buildIcs({
      name: "Test",
      events: [
        {
          uid: "abc",
          start: new Date("2026-01-01T00:00:00Z"),
          end: new Date("2026-01-01T01:00:00Z"),
          summary: "Fix sink, replace tap; check drain",
        },
      ],
    });
    expect(ics).toContain("SUMMARY:Fix sink\\, replace tap\\; check drain");
  });

  test("empty event list still emits a valid calendar wrapper", () => {
    const ics = buildIcs({ name: "Empty", events: [] });
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("END:VCALENDAR");
    expect(ics).not.toContain("BEGIN:VEVENT");
  });
});
