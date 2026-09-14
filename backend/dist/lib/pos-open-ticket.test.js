"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = __importDefault(require("node:test"));
const pos_open_ticket_ts_1 = require("./pos-open-ticket.ts");
(0, node_test_1.default)("kitchen ticket stays after partial pay", () => {
    strict_1.default.equal((0, pos_open_ticket_ts_1.decideOpenTicketClose)({
        status: "sent_to_kitchen",
        cartTotal: 44,
        paidTotal: 9.9,
        identityMatched: true,
    }), "keep");
});
(0, node_test_1.default)("kitchen ticket stays when paid amount is unknown", () => {
    strict_1.default.equal((0, pos_open_ticket_ts_1.decideOpenTicketClose)({
        status: "sent_to_kitchen",
        cartTotal: 44,
        identityMatched: true,
    }), "keep");
});
(0, node_test_1.default)("kitchen ticket stays when identity does not match", () => {
    strict_1.default.equal((0, pos_open_ticket_ts_1.decideOpenTicketClose)({
        status: "sent_to_kitchen",
        cartTotal: 44,
        paidTotal: 44,
        identityMatched: false,
    }), "keep");
});
(0, node_test_1.default)("kitchen ticket closes only when fully paid", () => {
    strict_1.default.equal((0, pos_open_ticket_ts_1.decideOpenTicketClose)({
        status: "sent_to_kitchen",
        cartTotal: 44,
        paidTotal: 44,
        identityMatched: true,
    }), "close");
    strict_1.default.equal((0, pos_open_ticket_ts_1.closeReasonForDecision)({
        status: "sent_to_kitchen",
        cartTotal: 44,
        paidTotal: 44,
        identityMatched: true,
    }), "paid");
});
(0, node_test_1.default)("kitchen ticket closes on explicit settle", () => {
    strict_1.default.equal((0, pos_open_ticket_ts_1.decideOpenTicketClose)({
        status: "sent_to_kitchen",
        cartTotal: 0,
        settleKitchen: true,
        identityMatched: true,
    }), "close");
});
(0, node_test_1.default)("pay-later never closes an open ticket", () => {
    strict_1.default.equal((0, pos_open_ticket_ts_1.decideOpenTicketClose)({
        status: "sent_to_kitchen",
        cartTotal: 36.7,
        paidTotal: 36.7,
        identityMatched: true,
        paymentSettled: false,
    }), "keep");
    strict_1.default.equal((0, pos_open_ticket_ts_1.decideOpenTicketClose)({
        status: "held",
        cartTotal: 12,
        paidTotal: 12,
        identityMatched: true,
        paymentSettled: false,
    }), "keep");
});
(0, node_test_1.default)("plain hold closes only when fully paid", () => {
    strict_1.default.equal((0, pos_open_ticket_ts_1.decideOpenTicketClose)({
        status: "held",
        cartTotal: 12,
        paidTotal: 5,
        identityMatched: true,
    }), "keep");
    strict_1.default.equal((0, pos_open_ticket_ts_1.decideOpenTicketClose)({
        status: "held",
        cartTotal: 12,
        paidTotal: 12,
        identityMatched: true,
    }), "close");
});
(0, node_test_1.default)("cancel always closes a matched ticket", () => {
    strict_1.default.equal((0, pos_open_ticket_ts_1.decideOpenTicketClose)({
        status: "sent_to_kitchen",
        cartTotal: 44,
        explicitCancel: true,
        identityMatched: true,
    }), "close");
    strict_1.default.equal((0, pos_open_ticket_ts_1.closeReasonForDecision)({
        status: "sent_to_kitchen",
        cartTotal: 44,
        explicitCancel: true,
        identityMatched: true,
    }), "cancelled");
});
(0, node_test_1.default)("kitchen status never downgrades", () => {
    strict_1.default.equal((0, pos_open_ticket_ts_1.nextOpenTicketStatus)("sent_to_kitchen", false), "sent_to_kitchen");
    strict_1.default.equal((0, pos_open_ticket_ts_1.nextOpenTicketStatus)("held", true), "sent_to_kitchen");
    strict_1.default.equal((0, pos_open_ticket_ts_1.nextOpenTicketStatus)("held", false), "held");
});
(0, node_test_1.default)("fully paid requires a positive cart and covering amount", () => {
    strict_1.default.equal((0, pos_open_ticket_ts_1.isFullyPaidTicket)(0, 10), false);
    strict_1.default.equal((0, pos_open_ticket_ts_1.isFullyPaidTicket)(10, 0), false);
    strict_1.default.equal((0, pos_open_ticket_ts_1.isFullyPaidTicket)(10, 9.94), false);
    strict_1.default.equal((0, pos_open_ticket_ts_1.isFullyPaidTicket)(10, 9.96), true);
});
(0, node_test_1.default)("only held and kitchen statuses are open", () => {
    strict_1.default.equal((0, pos_open_ticket_ts_1.isOpenTicketStatus)("held"), true);
    strict_1.default.equal((0, pos_open_ticket_ts_1.isOpenTicketStatus)("sent_to_kitchen"), true);
    strict_1.default.equal((0, pos_open_ticket_ts_1.isOpenTicketStatus)("closed"), false);
    strict_1.default.equal((0, pos_open_ticket_ts_1.isOpenTicketStatus)("paid"), false);
});
//# sourceMappingURL=pos-open-ticket.test.js.map