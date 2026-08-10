/**
 * Aclas OS6X (and CH340 USB serial) AUTO COMMUNICATE protocol.
 * Frame: SOH STX Status Sign Weight(6) Units(2) BCC ETX EOT Status2 (16 bytes).
 */

const FRAME_SIZE = 16;
const SOH = 0x01;
const STX = 0x02;
const ETX = 0x03;
const EOT = 0x04;

function calculateBcc(frame) {
  let bcc = 0;
  for (let i = 0; i < 12; i++) bcc ^= frame[i] & 0xff;
  return bcc ^ ETX;
}

function normalizeToKg(value, units) {
  const u = String(units || "").toUpperCase();
  if (u === "KG" || u === "K") return value;
  if (u === "G") return value / 1000;
  if (u === "LB") return value * 0.45359237;
  if (u === "OZ") return value * 0.0283495231;
  return value;
}

function parseFrame(frame) {
  if (!frame || frame.length < FRAME_SIZE) return null;
  if (
    (frame[0] & 0xff) !== SOH ||
    (frame[1] & 0xff) !== STX ||
    (frame[13] & 0xff) !== ETX ||
    (frame[14] & 0xff) !== EOT
  ) {
    return null;
  }
  if (calculateBcc(frame) !== (frame[12] & 0xff)) return null;

  const statusByte = frame[2] & 0xff;
  const signByte = frame[3] & 0xff;
  const weightRaw = Buffer.from(frame.slice(4, 10)).toString("ascii").trim();
  const units = Buffer.from(frame.slice(10, 12)).toString("ascii").trim();
  const status2 = frame[15] & 0xff;

  const status =
    statusByte === 0x53
      ? "STABLE"
      : statusByte === 0x55
        ? "UNSTABLE"
        : statusByte === 0x46
          ? "OVERLOAD"
          : "UNKNOWN";

  const numeric = Number(weightRaw.replace(/\s/g, ""));
  if (!Number.isFinite(numeric)) return null;
  const signed = signByte === 0x2d ? -numeric : numeric;
  const weightKg = normalizeToKg(signed, units);

  return {
    weightKg,
    rawWeight: weightRaw,
    units,
    status,
    isZero: status2 === 0x10,
    isTare: status2 === 0x20,
  };
}

function findLatestReading(buffer) {
  if (!buffer || buffer.length < FRAME_SIZE) return null;
  let latest = null;
  let index = 0;
  while (index <= buffer.length - FRAME_SIZE) {
    if ((buffer[index] & 0xff) === SOH && (buffer[index + 1] & 0xff) === STX) {
      const frame = buffer.subarray(index, index + FRAME_SIZE);
      const parsed = parseFrame(frame);
      if (parsed) latest = parsed;
      index += FRAME_SIZE;
    } else {
      index += 1;
    }
  }
  return latest;
}

module.exports = {
  FRAME_SIZE,
  parseFrame,
  findLatestReading,
};
