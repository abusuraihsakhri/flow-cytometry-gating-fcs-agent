"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { readFCS, rectangleGate, boundsFor, csvForGate } = require("../web/fcs.js");

function fixture({ datatype = "F", little = true, width = 32, values = [[1, 10], [3, 20], [5, 30]], name = "FSC-A" } = {}) {
  const enc = new TextEncoder();
  const keywords = [
    "$MODE", "L", "$TOT", String(values.length), "$PAR", "2",
    "$DATATYPE", datatype, "$BYTEORD", little ? "1,2,3,4" : "4,3,2,1",
    "$P1B", String(width), "$P2B", String(width),
    "$P1N", name, "$P2N", "SSC-A", "$NEXTDATA", "0"
  ];
  const escaped = keywords.map(x => x.replaceAll("/", "//"));
  const txt = enc.encode("/" + escaped.join("/") + "/");
  const dataStart = 58 + txt.length;
  const stride = width / 8 * 2;
  const dataEnd = dataStart + values.length * stride - 1;
  const buffer = new ArrayBuffer(dataEnd + 1);
  const bytes = new Uint8Array(buffer);
  function writeField(offset, text) {
    bytes.set(enc.encode(text), offset);
  }
  function field(n) { return String(n).padStart(8, " "); }
  writeField(0, "FCS3.1");
  writeField(10, field(58));
  writeField(18, field(dataStart - 1));
  writeField(26, field(dataStart));
  writeField(34, field(dataEnd));
  bytes.set(txt, 58);
  const view = new DataView(buffer);
  for (let i = 0; i < values.length; i++) {
    for (let j = 0; j < 2; j++) {
      const offset = dataStart + (2 * i + j) * (width / 8);
      if (datatype === "F") view.setFloat32(offset, values[i][j], little);
      else if (datatype === "D") view.setFloat64(offset, values[i][j], little);
      else if (width === 8) view.setUint8(offset, values[i][j]);
      else if (width === 16) view.setUint16(offset, values[i][j], little);
      else view.setUint32(offset, values[i][j], little);
    }
  }
  return buffer;
}

test("reads FCS3.1 floating point events and gates all observations", () => {
  const d = readFCS(fixture());
  assert.equal(d.total, 3);
  assert.deepEqual(d.channels, ["FSC-A","SSC-A"]);
  assert.deepEqual(Array.from(d.events[0]), [1,3,5]);
  assert.deepEqual(rectangleGate(d,0,1,{xmin:2,xmax:5,ymin:20,ymax:30}),[1,2]);
  assert.deepEqual(boundsFor(d.events[1]),{min:10,max:30});
});
test("reads FCS double and big-endian integer events", () => {
  for (const datatype of ["D","I"]) {
    const d=readFCS(fixture({datatype,width:datatype==="D"?64:16,little:false}));
    assert.deepEqual(Array.from(d.events[1]),[10,20,30]);
  }
});
test("decodes escaped FCS TEXT delimiters",()=>{
  const d=readFCS(fixture({name:"FSC/A"}));
  assert.equal(d.channels[0],"FSC/A");
});
test("rejects truncated DATA and missing or invalid gate bounds", () => {
  const b=fixture();
  assert.throws(()=>readFCS(b.slice(0,-2)),/Invalid DATA end/);
  const d=readFCS(b);
  assert.throws(()=>rectangleGate(d,0,1,{xmin:8,xmax:2,ymin:1,ymax:4}),/minimum/);
  assert.throws(()=>rectangleGate(d,12,1,{xmin:1,xmax:2,ymin:1,ymax:4}),/valid channels/);
});
test("escapes potentially executable CSV column labels", () => {
  const d=readFCS(fixture({name:"=1+1"}));
  const csv=csvForGate(d,[0]);
  assert.match(csv,/^"'=1\+1","SSC-A"/);
  assert.match(csv,/\r\n1,10\r\n$/);
});
