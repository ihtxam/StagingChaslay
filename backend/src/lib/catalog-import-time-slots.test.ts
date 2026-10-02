import { describe, expect, it } from "vitest";
import {
  parseProductTimeSlotPricesFromImportRow,
  slotPriceColumnName,
  workbookHasSlotPriceColumns,
} from "./catalog-import-time-slots";

const slots = [
  { id: "night", start: "21:00", end: "06:00", label: "Night menu" },
  { id: "day", start: "06:00", end: "21:00", label: "Day" },
];

describe("catalog-import-time-slots", () => {
  it("parses price_slot_<id> columns", () => {
    const { prices, errors } = parseProductTimeSlotPricesFromImportRow(
      { name: "Burger", price_slot_night: 9.5, price_slot_day: "" },
      slots
    );
    expect(errors).toEqual([]);
    expect(prices).toEqual({ night: { price: 9.5 } });
  });

  it("parses price_<label> alias columns", () => {
    const { prices, errors } = parseProductTimeSlotPricesFromImportRow(
      { price_night: 8, price_day: 10 },
      slots
    );
    expect(errors).toEqual([]);
    expect(prices.night?.price).toBe(8);
    expect(prices.day?.price).toBe(10);
  });

  it("reports invalid numbers", () => {
    const { errors } = parseProductTimeSlotPricesFromImportRow(
      { price_slot_night: "abc" },
      slots
    );
    expect(errors.length).toBe(1);
    expect(errors[0]).toContain("price_slot_night");
  });

  it("detects slot columns in workbook", () => {
    expect(workbookHasSlotPriceColumns([{ name: "x", price: 1 }], slots)).toBe(false);
    expect(workbookHasSlotPriceColumns([{ price_slot_night: 5 }], slots)).toBe(true);
  });

  it("uses canonical column name for export helper", () => {
    expect(slotPriceColumnName(slots[0])).toBe("price_slot_night");
  });
});
