import test from "node:test";
import assert from "node:assert/strict";
import {
  formatReportMonthLong,
  formatReportWeekdayLong,
  reportChannelLabel,
} from "@/lib/report-display-labels";

test("reportChannelLabel respects panel locale", () => {
  assert.equal(reportChannelLabel("dine_in", "fr"), "Sur place");
  assert.equal(reportChannelLabel("takeaway", "de"), "Takeaway");
});

test("weekday formatting is not English when locale is French", () => {
  assert.equal(formatReportWeekdayLong("2026-11-08", "fr"), "dimanche");
});

test("month formatting is not English when locale is German", () => {
  assert.equal(formatReportMonthLong(3, "de"), "März");
});
