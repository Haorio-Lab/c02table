import assert from "node:assert/strict";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    {
      ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
    },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("renders the focused CO2 training experience", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>BREATHLINE \| 프리다이버 CO₂ 테이블<\/title>/);
  assert.match(html, /오늘의 CO₂ 훈련/);
  assert.match(html, /30초 테이블/);
  assert.match(html, /훈련 시작/);
  assert.match(html, /라운드 구성/);
});

test("keeps the dry-training safety gate in the rendered UI", async () => {
  const response = await render();
  const html = await response.text();

  assert.match(html, /DRY ONLY/);
  assert.match(html, /안전한 장소에 있으며 과호흡하지 않겠습니다/);
  assert.match(html, /물 안·물가, 운전·이동 중 사용 금지/);
  assert.match(html, /공인 프리다이빙 교육이나 의료 조언을 대신하지 않습니다/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|react-loading-skeleton/i);
});
