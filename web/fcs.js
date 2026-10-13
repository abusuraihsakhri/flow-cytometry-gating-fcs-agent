/* FCS 2.0/3.0/3.1 reader and rectangular gating. No network or dependencies. */
(function (root) {
  "use strict";
  const MAX_FILE_BYTES = 128 * 1024 * 1024;
  const MAX_EVENTS = 250000;
  const MAX_PARAMETERS = 64;

  function integer(value, name, min, max) {
    const n = Number(value);
    if (!Number.isSafeInteger(n) || n < min || n > max) {
      throw new Error("Invalid " + name + ": " + String(value));
    }
    return n;
  }

  function parseText(bytes) {
    if (!bytes.length) throw new Error("Empty FCS TEXT segment");
    const raw = new TextDecoder("latin1").decode(bytes);
    const delimiter = raw[0];
    const tokens = [];
    let token = "";
    for (let i = 1; i < raw.length; i++) {
      if (raw[i] === delimiter) {
        if (raw[i + 1] === delimiter) { token += delimiter; i++; }
        else { tokens.push(token); token = ""; }
      } else token += raw[i];
    }
    if (token) tokens.push(token);
    if (tokens.length % 2) throw new Error("Malformed FCS TEXT keyword/value pairs");
    const metadata = Object.create(null);
    for (let i = 0; i < tokens.length; i += 2) {
      metadata[tokens[i].toUpperCase()] = tokens[i + 1];
    }
    return metadata;
  }

  function readFCS(buffer) {
    if (!(buffer instanceof ArrayBuffer)) throw new TypeError("Expected ArrayBuffer");
    if (buffer.byteLength < 58 || buffer.byteLength > MAX_FILE_BYTES) {
      throw new Error("FCS file must be between 58 bytes and 128 MiB");
    }
    const view = new DataView(buffer);
    const header = new TextDecoder("ascii").decode(new Uint8Array(buffer, 0, 58));
    const version = header.slice(0, 6).trim();
    if (!/^FCS(2\.0|3\.0|3\.1)$/.test(version)) throw new Error("Unsupported FCS version: " + version);
    const number = (a, b) => Number(header.slice(a, b).trim());
    const textStart = integer(number(10, 18), "TEXT start", 58, buffer.byteLength - 1);
    const textEnd = integer(number(18, 26), "TEXT end", textStart, buffer.byteLength - 1);
    const metadata = parseText(new Uint8Array(buffer, textStart, textEnd - textStart + 1));
    if (metadata.$MODE !== "L") throw new Error("Only list-mode ($MODE=L) FCS data is supported");
    if (metadata.$NEXTDATA && metadata.$NEXTDATA !== "0") throw new Error("Multi-dataset FCS is not supported");
    const total = integer(metadata.$TOT, "$TOT", 1, MAX_EVENTS);
    const count = integer(metadata.$PAR, "$PAR", 1, MAX_PARAMETERS);
    const datatype = (metadata.$DATATYPE || "").toUpperCase();
    if (!["F", "D", "I"].includes(datatype)) throw new Error("Only $DATATYPE F, D and I are supported");
    const order = metadata.$BYTEORD;
    if (!["1,2,3,4", "4,3,2,1"].includes(order)) throw new Error("Unsupported $BYTEORD: " + order);
    const little = order === "1,2,3,4";
    const channels = [];
    const widths = [];
    for (let i = 1; i <= count; i++) {
      channels.push(metadata["$P" + i + "N"] || "P" + i);
      const bits = integer(metadata["$P" + i + "B"], "$P" + i + "B", 8, 64);
      if (datatype === "F" && bits !== 32 || datatype === "D" && bits !== 64 ||
          datatype === "I" && ![8, 16, 32].includes(bits)) {
        throw new Error("Unsupported channel width for parameter " + i);
      }
      widths.push(bits / 8);
    }
    const stride = widths.reduce((a, b) => a + b, 0);
    let start = number(26, 34);
    let end = number(34, 42);
    if (!start) start = Number(metadata.$BEGINDATA);
    if (!end) end = Number(metadata.$ENDDATA);
    start = integer(start, "DATA start", 58, buffer.byteLength - 1);
    end = integer(end, "DATA end", start, buffer.byteLength - 1);
    if (start <= textEnd) throw new Error("FCS DATA overlaps TEXT");
    if (total * stride > end - start + 1) throw new Error("FCS DATA is truncated");
    const events = Array.from({ length: count }, () => new Float64Array(total));
    let offset = start;
    for (let row = 0; row < total; row++) {
      for (let col = 0; col < count; col++) {
        let value;
        if (datatype === "F") value = view.getFloat32(offset, little);
        else if (datatype === "D") value = view.getFloat64(offset, little);
        else if (widths[col] === 1) value = view.getUint8(offset);
        else if (widths[col] === 2) value = view.getUint16(offset, little);
        else value = view.getUint32(offset, little);
        if (!Number.isFinite(value)) throw new Error("Non-finite event at row " + (row + 1));
        events[col][row] = value;
        offset += widths[col];
      }
    }
    return { version, channels, events, total, metadata, compensated: false };
  }

  function boundsFor(column) {
    if (!column.length) throw new Error("No observations");
    let min = Infinity, max = -Infinity;
    for (const v of column) { if (v < min) min = v; if (v > max) max = v; }
    if (min === max) { const d = Math.max(1, Math.abs(min) * .05); min -= d; max += d; }
    return { min, max };
  }

  function rectangleGate(data, xIndex, yIndex, limits) {
    const x = data.events[xIndex], y = data.events[yIndex];
    if (!x || !y) throw new Error("Select valid channels");
    const { xmin, xmax, ymin, ymax } = limits;
    if (![xmin, xmax, ymin, ymax].every(Number.isFinite) || xmin >= xmax || ymin >= ymax) {
      throw new Error("Gate minimum must be below maximum on both axes");
    }
    const indices = [];
    for (let i = 0; i < data.total; i++) {
      if (x[i] >= xmin && x[i] <= xmax && y[i] >= ymin && y[i] <= ymax) indices.push(i);
    }
    return indices;
  }

  function csvForGate(data, indices) {
    const escapeCell = value => {
      let s = String(value);
      if (/^[=+@\-\t\r]/.test(s)) s = "'" + s;
      return '"' + s.replace(/"/g, '""') + '"';
    };
    const rows = [data.channels.map(escapeCell).join(",")];
    for (const i of indices) {
      rows.push(data.events.map(col => String(col[i])).join(","));
    }
    return rows.join("\r\n") + "\r\n";
  }

  const api = { readFCS, boundsFor, rectangleGate, csvForGate };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.FCS = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
