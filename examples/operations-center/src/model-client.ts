/** Temporary, user-configured browser transport. No storage, telemetry, or SDK credentials. */
export interface ModelConfig {
  endpoint: string;
  model: string;
  apiKey: string;
}

export interface ModelMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: ModelToolCall[];
  tool_call_id?: string;
}
export interface ModelToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}
export interface ModelReply {
  content: string;
  toolCalls: ModelToolCall[];
}

export class ModelRequestError extends Error {}
const responseLimit = 256_000;

export function normalizeModelConfig(input: ModelConfig): ModelConfig {
  let url: URL;
  try {
    url = new URL(input.endpoint.trim());
  } catch {
    throw new ModelRequestError(
      "请填写完整的 API Base URL，例如 https://api.openai.com/v1。",
    );
  }
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && local))
    throw new ModelRequestError(
      "远程接口必须使用 HTTPS；HTTP 仅允许本机 localhost / 127.0.0.1 / [::1]。",
    );
  if (url.username || url.password || url.search || url.hash)
    throw new ModelRequestError(
      "接口地址不能包含账号、密码、查询参数或片段。Key 只能填在独立密码框中。",
    );
  let path = url.pathname.replace(/\/+$/, "");
  if (!path) path = "/v1";
  if (!path.endsWith("/chat/completions")) path += "/chat/completions";
  url.pathname = path;
  const model = input.model.trim();
  const apiKey = input.apiKey.trim();
  if (!model || model.length > 160 || /[\r\n]/.test(model))
    throw new ModelRequestError(
      "请填写服务商提供的模型 ID（最多 160 个字符）。",
    );
  if (apiKey.length > 4096 || /[\r\n]/.test(apiKey))
    throw new ModelRequestError("API Key 格式无效。");
  return { endpoint: url.href, model, apiKey };
}

/** Never echo an untrusted provider's error body or the configured credential. */
export function redactModelText(text: string, apiKey: string): string {
  return (apiKey ? text.replaceAll(apiKey, "[凭据已隐藏]") : text).slice(
    0,
    32_000,
  );
}

export async function requestModel(
  config: ModelConfig,
  messages: ModelMessage[],
  tools: unknown[],
  signal: AbortSignal,
  fetcher: typeof fetch = fetch,
): Promise<ModelReply> {
  const timeout = new AbortController();
  const abort = () => timeout.abort();
  signal.addEventListener("abort", abort, { once: true });
  if (signal.aborted) timeout.abort();
  const timer = setTimeout(() => timeout.abort(), 60_000);
  try {
    if (timeout.signal.aborted)
      throw new ModelRequestError("请求已停止，未应用新的操作。");
    const response = await fetcher(config.endpoint, {
      method: "POST",
      mode: "cors",
      credentials: "omit",
      redirect: "error",
      cache: "no-store",
      referrerPolicy: "no-referrer",
      headers: {
        "Content-Type": "application/json",
        ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: config.model,
        messages,
        tools,
        tool_choice: "auto",
        parallel_tool_calls: false,
        stream: false,
      }),
      signal: timeout.signal,
    });
    if (!response.ok) {
      await response.body?.cancel();
      const hint =
        response.status === 401 || response.status === 403
          ? "请检查 Key 和访问权限。"
          : response.status === 429
            ? "请检查服务商额度或限流，稍后手动重试。"
            : "请检查模型 ID、Chat Completions 路径和 function calling 支持。";
      throw new ModelRequestError(
        `模型接口 HTTP ${response.status}。${hint}没有自动重试或改走模板。`,
      );
    }
    const reader = response.body?.getReader();
    if (!reader) throw new ModelRequestError("模型接口返回了空响应。");
    let size = 0;
    let text = "";
    const decoder = new TextDecoder();
    try {
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        size += chunk.value.byteLength;
        if (size > responseLimit) {
          await reader.cancel();
          throw new ModelRequestError("模型响应超过 256 KB，已拒绝处理。");
        }
        text += decoder.decode(chunk.value, { stream: true });
      }
      text += decoder.decode();
    } finally {
      reader.releaseLock();
    }
    if (timeout.signal.aborted)
      throw new ModelRequestError("请求已停止或超时，未应用新的操作。");
    let value: unknown;
    try {
      value = JSON.parse(text);
    } catch {
      throw new ModelRequestError(
        "接口未返回有效的 Chat Completions JSON。未应用任何响应操作。",
      );
    }
    const root = object(value);
    const choice = Array.isArray(root?.choices)
      ? object(root.choices[0])
      : undefined;
    const message = object(choice?.message);
    if (
      !message ||
      !["stop", "tool_calls"].includes(String(choice?.finish_reason))
    )
      throw new ModelRequestError(
        "模型回复不完整、被过滤或协议不兼容；本轮操作未执行。",
      );
    const content = typeof message.content === "string" ? message.content : "";
    const calls = message.tool_calls ?? [];
    if (!Array.isArray(calls) || calls.length > 1)
      throw new ModelRequestError(
        "每轮只接受一个原子操作批次；模型返回多个工具调用，本轮全部拒绝。",
      );
    const toolCalls = calls.map((item): ModelToolCall => {
      const call = object(item);
      const fn = object(call?.function);
      if (
        call?.type !== "function" ||
        typeof call.id !== "string" ||
        !call.id ||
        call.id.length > 256 ||
        typeof fn?.name !== "string" ||
        typeof fn.arguments !== "string" ||
        fn.arguments.length > 32_000
      )
        throw new ModelRequestError("模型工具调用格式无效，本轮未执行。");
      return {
        id: call.id,
        type: "function",
        function: { name: fn.name, arguments: fn.arguments },
      };
    });
    if (!toolCalls.length && !content.trim())
      throw new ModelRequestError("模型没有返回文本或工具调用；没有界面变更。");
    return { content: redactModelText(content, config.apiKey), toolCalls };
  } catch (error) {
    if (error instanceof ModelRequestError) throw error;
    if (timeout.signal.aborted)
      throw new ModelRequestError(
        signal.aborted
          ? "请求已停止，未应用新的操作。"
          : "模型请求超过 60 秒，已停止；未自动重试。",
      );
    throw new ModelRequestError(
      "无法读取模型接口。请检查网络、HTTPS 和服务商 CORS（需允许本站来源与 Authorization / Content-Type）。没有自动重试或改走模板。",
    );
  } finally {
    clearTimeout(timer);
    signal.removeEventListener("abort", abort);
  }
}

function object(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}
