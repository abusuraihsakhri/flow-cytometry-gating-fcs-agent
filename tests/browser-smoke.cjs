"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const { chromium } = require("playwright-core");

function fcsFixture() {
  const encoder = new TextEncoder();
  const metadata = "/$MODE/L/$TOT/3/$PAR/2/$DATATYPE/F/$BYTEORD/1,2,3,4/$P1B/32/$P2B/32/$P1N/FSC-A/$P2N/SSC-A/$NEXTDATA/0/";
  const txt = encoder.encode(metadata);
  const begin = 58 + txt.length;
  const end = begin + 3 * 2 * 4 - 1;
  const buffer = Buffer.alloc(end + 1);
  buffer.write("FCS3.1", 0, "ascii");
  [[10, 58], [18, begin - 1], [26, begin], [34, end]].forEach(([offset, number]) => {
    buffer.write(String(number).padStart(8, " "), offset, "ascii");
  });
  Buffer.from(txt).copy(buffer, 58);
  [[1,10], [3,20], [5,30]].forEach((pair, i) => {
    buffer.writeFloatLE(pair[0], begin + i * 8);
    buffer.writeFloatLE(pair[1], begin + i * 8 + 4);
  });
  return buffer;
}

(async function () {
  const chrome = ["/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium", "/usr/bin/chromium-browser"].find(fs.existsSync);
  if (!chrome) throw new Error("Chromium/Chrome is required for end-to-end verification");
  const server = http.createServer((req, res) => {
    const pathname = new URL(req.url, "http://localhost").pathname;
    const allowed = pathname === "/" ? "index.html" : pathname === "/web/fcs.js" || pathname === "/web/app.js" ? pathname.slice(1) : null;
    if (!allowed) { res.writeHead(404); res.end("Not found"); return; }
    res.setHeader("Content-Type", allowed.endsWith(".js") ? "text/javascript" : "text/html");
    fs.createReadStream(path.resolve(allowed)).pipe(res);
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  let browser;
  try {
    browser = await chromium.launch({ executablePath: chrome, headless: true, args: ["--no-sandbox"] });
    const page = await browser.newPage({acceptDownloads:true, viewport:{width:1280,height:900}});
    const consoleErrors=[];
    page.on("pageerror", error => consoleErrors.push(error.message));
    await page.goto("http://127.0.0.1:" + server.address().port + "/");
    await page.locator("#demo").click();
    assert.equal(await page.locator("#total").innerText(), "5,000");
    assert.equal(await page.locator("#selected").innerText(), "5,000");
    await page.locator("#xmin").fill("200");
    await page.locator("#xmax").fill("400");
    await page.locator("#ymin").fill("150");
    await page.locator("#ymax").fill("400");
    await page.locator("#apply").click();
    const n=Number((await page.locator("#selected").innerText()).replaceAll(",",""));
    assert.ok(n>0 && n<5000, "Gate should select a non-trivial subset");
    const downloading=page.waitForEvent("download");
    await page.locator("#export").click();
    const download=await downloading;
    assert.equal(download.suggestedFilename(),"gated-events.csv");
    const exported=fs.readFileSync(await download.path(),"utf8").trim().split("\r\n");
    assert.equal(exported.length,n+1);
    assert.equal(exported[0],'"FSC-A (synthetic)","SSC-A (synthetic)"');

    await page.locator("#file").setInputFiles({
      name: "sample.fcs", mimeType: "application/octet-stream", buffer: fcsFixture()
    });
    assert.equal(await page.locator("#total").innerText(), "3");
    assert.equal(await page.locator("#selected").innerText(), "3");
    assert.match(await page.locator("#summary").innerText(), /sample\.fcs/);
    assert.deepEqual(consoleErrors,[]);
    console.log("Browser smoke passed: sample FCS import, demo gating, CSV export; no page errors");
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode=1; });
