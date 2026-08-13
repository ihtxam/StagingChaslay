/** Aclas OS6X RS232 AUTO COMMUNICATE frame parser (16 bytes). */

const SOH = 0x01;
const STX = 0x02;
const ETX = 0x03;
const EOT = 0x04;
const FRAME_SIZE = 16;

function calculateBcc(frame) {
  let bcc = 0;
  for (let i = 0; i < 12; i++) {
    bcc ^= frame[i] & 0xff;
  }
  return bcc ^ ETX;
}

function normalizeToKg(value, units) {
  switch (String(units || "").toUpperCase()) {
    case "KG":
    case "K":
      return value;
    case "G":
      return value / 1000;
    case "LB":
      return value * 0.45359237;
    case "OZ":
      return value * 0.0283495231;
    default:
      return value;
  }
}

function parseFrame(frame) {
  if (!frame || frame.length < FRAME_SIZE) return null;
  if (
    frame[0] !== SOH ||
    frame[1] !== STX ||
    frame[13] !== ETX ||
    frame[14] !== EOT
  ) {
    return null;
  }
  if (calculateBcc(frame) !== (frame[12] & 0xff)) return null;

  const statusByte = frame[2];
  const signByte = frame[3];
  const weightRaw = Buffer.from(frame.slice(4, 10)).toString("ascii").trim();
  const units = Buffer.from(frame.slice(10, 12)).toString("ascii").trim();
  const status2 = frame[15];

  let status = "UNKNOWN";
  if (statusByte === 0x53) status = "STABLE";
  else if (statusByte === 0x55) status = "UNSTABLE";
  else if (statusByte === 0x46) status = "OVERLOAD";

  const numeric = parseFloat(weightRaw.replace(/\s/g, ""));
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
    if (buffer[index] === SOH && buffer[index + 1] === STX) {
      latest = parseFrame(buffer.slice(index, index + FRAME_SIZE)) || latest;
      index += FRAME_SIZE;
    } else {
      index++;
    }
  }
  return latest;
}

module.exports = { findLatestReading, parseFrame, FRAME_SIZE };
