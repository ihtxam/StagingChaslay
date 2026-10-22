import { describe, expect, it } from "vitest";
import { canSwitchPanelLocation } from "@/lib/panel-location-switch";

describe("canSwitchPanelLocation", () => {
  it("allows merchant owners and manager-class staff", () => {
    expect(canSwitchPanelLocation({ authRole: "merchant", isOwner: true })).toBe(true);
    expect(
      canSwitchPanelLocation({ authRole: "staff", roleName: "Manager", isOwner: false })
    ).toBe(true);
    expect(canSwitchPanelLocation({ authRole: "staff", roleName: "Admin" })).toBe(true);
    expect(canSwitchPanelLocation({ authRole: "staff", roleName: "HQ" })).toBe(true);
  });

  it("denies floor and register staff", () => {
    expect(
      canSwitchPanelLocation({ authRole: "staff", roleName: "Waiter + menu editor" })
    ).toBe(false);
    expect(canSwitchPanelLocation({ authRole: "staff", roleName: "Cashier" })).toBe(false);
    expect(canSwitchPanelLocation({ authRole: "staff", roleName: "Waiter" })).toBe(false);
  });
});
