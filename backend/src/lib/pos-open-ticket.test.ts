import assert from "node:assert/strict";
import test from "node:test";
import {
  decideOpenTicketClose,
  isFullyPaidTicket,
  nextOpenTicketStatus,
} from "./pos-open-ticket.ts";

test("kitchen ticket stays after partial pay", () => {
  assert.equal(
    decideOpenTicketClose({
      status: "sent_to_kitchen",
      cartTotal: 44,
      paidTotal: 9.9,
      identityMatched: true,
    }),
    "keep"
  );
});

test("kitchen ticket stays when paid amount is unknown", () => {
  assert.equal(
    decideOpenTicketClose({
      status: "sent_to_kitchen",
      cartTotal: 44,
      identityMatched: true,
    }),
    "keep"
  );
});

test("kitchen ticket stays when identity does not match", () => {
  assert.equal(
    decideOpenTicketClose({
      status: "sent_to_kitchen",
      cartTotal: 44,
      paidTotal: 44,
      identityMatched: false,
    }),
    "keep"
  );
});

test("kitchen ticket closes only when fully paid", () => {
  assert.equal(
    decideOpenTicketClose({
      status: "sent_to_kitchen",
      cartTotal: 44,
      paidTotal: 44,
      identityMatched: true,
    }),
    "close"
  );
});

test("kitchen ticket closes on explicit settle", () => {
  assert.equal(
    decideOpenTicketClose({
      status: "sent_to_kitchen",
      cartTotal: 0,
      settleKitchen: true,
      identityMatched: true,
    }),
    "close"
  );
});

test("plain hold closes only when fully paid", () => {
  assert.equal(
    decideOpenTicketClose({
      status: "held",
      cartTotal: 12,
      paidTotal: 5,
      identityMatched: true,
    }),
    "keep"
  );
  assert.equal(
    decideOpenTicketClose({
      status: "held",
      cartTotal: 12,
      paidTotal: 12,
      identityMatched: true,
    }),
    "close"
  );
});

test("cancel always closes a matched ticket", () => {
  assert.equal(
    decideOpenTicketClose({
      status: "sent_to_kitchen",
      cartTotal: 44,
      explicitCancel: true,
      identityMatched: true,
    }),
    "close"
  );
});

test("kitchen status never downgrades", () => {
  assert.equal(nextOpenTicketStatus("sent_to_kitchen", false), "sent_to_kitchen");
  assert.equal(nextOpenTicketStatus("held", true), "sent_to_kitchen");
  assert.equal(nextOpenTicketStatus("held", false), "held");
});

test("fully paid requires a positive cart and covering amount", () => {
  assert.equal(isFullyPaidTicket(0, 10), false);
  assert.equal(isFullyPaidTicket(10, 0), false);
  assert.equal(isFullyPaidTicket(10, 9.94), false);
  assert.equal(isFullyPaidTicket(10, 9.96), true);
});
