"use strict";

const zlib = require("node:zlib");

const crcTable = Object.freeze(Array.from({ length: 256 }, (_entry, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = (value & 1) !== 0 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  return value >>> 0;
}));

function crc32(bytes) {
  let value = 0xffffffff;
  for (const byte of bytes) value = crcTable[(value ^ byte) & 0xff] ^ (value >>> 8);
  return (value ^ 0xffffffff) >>> 0;
}

function normalizedEntries(entries) {
  if (!Array.isArray(entries) || entries.length === 0) {
    throw new TypeError("archive fixture entries are required");
  }
  return entries.map((entry) => {
    if (!entry || typeof entry.name !== "string" || entry.name.length === 0 ||
        !Buffer.isBuffer(entry.content)) {
      throw new TypeError("archive fixture entry is invalid");
    }
    const name = Buffer.from(entry.name, "ascii");
    if (name.length !== entry.name.length || name.length > 100 ||
        entry.content.length > 0xffffffff) {
      throw new TypeError("archive fixture entry exceeds its deterministic bounds");
    }
    return Object.freeze({ content: entry.content, name });
  });
}

function createStoredZip(entries) {
  const source = normalizedEntries(entries);
  const localRecords = [];
  const centralRecords = [];
  let localOffset = 0;
  for (const entry of source) {
    const checksum = crc32(entry.content);
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt16LE(0, 10);
    localHeader.writeUInt16LE(0x21, 12);
    localHeader.writeUInt32LE(checksum, 14);
    localHeader.writeUInt32LE(entry.content.length, 18);
    localHeader.writeUInt32LE(entry.content.length, 22);
    localHeader.writeUInt16LE(entry.name.length, 26);
    localHeader.writeUInt16LE(0, 28);
    localRecords.push(localHeader, entry.name, entry.content);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(0x0314, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(0, 12);
    centralHeader.writeUInt16LE(0x21, 14);
    centralHeader.writeUInt32LE(checksum, 16);
    centralHeader.writeUInt32LE(entry.content.length, 20);
    centralHeader.writeUInt32LE(entry.content.length, 24);
    centralHeader.writeUInt16LE(entry.name.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE((0o100644 * 65_536) >>> 0, 38);
    centralHeader.writeUInt32LE(localOffset, 42);
    centralRecords.push(centralHeader, entry.name);
    localOffset += localHeader.length + entry.name.length + entry.content.length;
  }
  const central = Buffer.concat(centralRecords);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(source.length, 8);
  end.writeUInt16LE(source.length, 10);
  end.writeUInt32LE(central.length, 12);
  end.writeUInt32LE(localOffset, 16);
  end.writeUInt16LE(0, 20);
  return Buffer.concat([...localRecords, central, end]);
}

function writeOctal(header, offset, length, value) {
  const encoded = value.toString(8).padStart(length - 1, "0");
  if (encoded.length !== length - 1) throw new RangeError("tar fixture value is too large");
  header.write(encoded, offset, length - 1, "ascii");
  header[offset + length - 1] = 0;
}

function createTarGzip(entries) {
  const source = normalizedEntries(entries);
  const records = [];
  for (const entry of source) {
    const header = Buffer.alloc(512);
    entry.name.copy(header, 0);
    writeOctal(header, 100, 8, 0o644);
    writeOctal(header, 108, 8, 0);
    writeOctal(header, 116, 8, 0);
    writeOctal(header, 124, 12, entry.content.length);
    writeOctal(header, 136, 12, 0);
    header.fill(0x20, 148, 156);
    header[156] = 0x30;
    header.write("ustar\0", 257, 6, "ascii");
    header.write("00", 263, 2, "ascii");
    header.write("tinyrustlm", 265, 10, "ascii");
    header.write("tinyrustlm", 297, 10, "ascii");
    writeOctal(header, 329, 8, 0);
    writeOctal(header, 337, 8, 0);
    const checksum = header.reduce((total, byte) => total + byte, 0);
    header.write(checksum.toString(8).padStart(6, "0"), 148, 6, "ascii");
    header[154] = 0;
    header[155] = 0x20;
    const padding = Buffer.alloc((512 - (entry.content.length % 512)) % 512);
    records.push(header, entry.content, padding);
  }
  records.push(Buffer.alloc(1_024));
  return zlib.gzipSync(Buffer.concat(records), { level: 9, mtime: 0 });
}

module.exports = Object.freeze({ createStoredZip, createTarGzip });
