import { afterEach, expect, it, vi } from "vitest";
import { normalizeModelConfig, requestModel } from "../src/model-client.js";

const config = normalizeModelConfig({
  endpoint: "https://provider.example/v1",
  model: "user-model",
  apiKey: "temporary-test-key",
});
const signal = () => new AbortController().signal;
const response = (message: unknown, finish_reason = "stop") =>
  new Response(JSON.stringify({ choices: [{ message, finish_reason }] }));
afterEach(() => vi.useRealTimers());

it("normalizes provider paths and refuses insecure or credential-bearing destinations", () => {
  expect(config.endpoint).toBe("https://provider.example/v1/chat/completions");
  for (const endpoint of [
    "https://api.openai.com",
    "https://api.openai.com/v1/",
    "https://api.openai.com/v1/chat/completions/",
  ])
    expect(normalizeModelConfig({ ...config, endpoint }).endpoint).toBe(
      "https://api.openai.com/v1/chat/completions",
    );
  expect(
    normalizeModelConfig({
      ...config,
      endpoint: "http://localhost:1234/v1",
      apiKey: "",
    }).apiKey,
  ).toBe("");
  for (const endpoint of [
    "http://provider.example/v1",
    "https://user:key@provider.example",
    "https://provider.example?key=secret",
    "https://provider.example/#key",
    "javascript:alert(1)",
  ])
    expect(() => normalizeModelConfig({ ...config, endpoint })).toThrow();
});

it("sends only explicit config to the selected endpoint and disables redirects, cookies and streaming", async () => {
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValue(response({ content: "ready" }));
  const result = await requestModel(
    config,
    [{ role: "user", content: "hello" }],
    [],
    signal(),
    fetcher,
  );
  expect(result.content).toBe("ready");
  const [url, init] = fetcher.mock.calls[0]!;
  expect(url).toBe(config.endpoint);
  expect(init).toMatchObject({
    credentials: "omit",
    redirect: "error",
    referrerPolicy: "no-referrer",
    cache: "no-store",
    headers: { Authorization: "Bearer temporary-test-key" },
  });
  expect(JSON.parse(String(init?.body))).toMatchObject({
    model: "user-model",
    stream: false,
    parallel_tool_calls: false,
  });
  expect(String(init?.body)).not.toContain(config.apiKey);
});

it("does not expose provider error bodies, credentials or raw fetch errors and never retries", async () => {
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValue(new Response(config.apiKey, { status: 401 }));
  await expect(requestModel(config, [], [], signal(), fetcher)).rejects.toThrow(
    "HTTP 401",
  );
  expect(fetcher).toHaveBeenCalledTimes(1);
  fetcher.mockRejectedValue(new Error(config.apiKey));
  await expect(
    requestModel(config, [], [], signal(), fetcher),
  ).rejects.not.toThrow(config.apiKey);
  fetcher.mockResolvedValue(response({ content: `echo ${config.apiKey}` }));
  expect(
    (await requestModel(config, [], [], signal(), fetcher)).content,
  ).not.toContain(config.apiKey);
});

it("refuses truncated, multi-call, malformed and oversized replies before execution", async () => {
  const call = {
    id: "1",
    type: "function",
    function: { name: "ui_apply_operations", arguments: "{}" },
  };
  for (const value of [
    response({ tool_calls: [call] }, "length"),
    response({ tool_calls: [call, call] }, "tool_calls"),
    response({ tool_calls: [{}] }, "tool_calls"),
    new Response("not-json"),
    new Response("x".repeat(256_001)),
  ]) {
    await expect(
      requestModel(
        config,
        [],
        [],
        signal(),
        vi.fn<typeof fetch>().mockResolvedValue(value),
      ),
    ).rejects.toThrow();
  }
});

it("honors caller cancellation and bounds a hanging provider with a timeout", async () => {
  const controller = new AbortController();
  controller.abort();
  const fetcher = vi.fn<typeof fetch>();
  await expect(
    requestModel(config, [], [], controller.signal, fetcher),
  ).rejects.toThrow("停止");
  expect(fetcher).not.toHaveBeenCalled();
  vi.useFakeTimers();
  fetcher.mockImplementation(
    (_url, init) =>
      new Promise((_resolve, reject) =>
        init?.signal?.addEventListener("abort", () =>
          reject(new Error("aborted")),
        ),
      ),
  );
  const pending = expect(
    requestModel(config, [], [], signal(), fetcher),
  ).rejects.toThrow("5 分钟");
  await vi.advanceTimersByTimeAsync(60_000);
  expect(fetcher.mock.calls[0]![1]?.signal?.aborted).toBe(false);
  await vi.advanceTimersByTimeAsync(239_999);
  expect(fetcher.mock.calls[0]![1]?.signal?.aborted).toBe(false);
  await vi.advanceTimersByTimeAsync(1);
  await pending;
});
