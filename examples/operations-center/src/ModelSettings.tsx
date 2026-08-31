import { useEffect, useRef, useState } from "react";
import type { StudioRuntime } from "./studio-runtime.js";
import { normalizeModelConfig } from "./model-client.js";

export function ModelSettings({
  runtime,
  close,
}: {
  runtime: StudioRuntime;
  close: () => void;
}) {
  const current = runtime.getSnapshot().model;
  const [endpoint, setEndpoint] = useState(
    current?.endpoint ?? "https://api.openai.com/v1",
  );
  const [model, setModel] = useState(current?.model ?? "");
  const [apiKey, setApiKey] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
    const element = dialog.current;
    return () => element?.close();
  }, []);
  let destination = "填写有效地址后显示";
  try {
    destination = normalizeModelConfig({
      endpoint,
      model: model || "preview",
      apiKey: "",
    }).endpoint;
  } catch {
    /* Invalid input remains editable. */
  }
  return (
    <dialog
      className="model-settings"
      ref={dialog}
      aria-labelledby="model-settings-title"
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!accepted) {
            setError("请先阅读并确认临时浏览器调用的风险与发送范围。");
            return;
          }
          try {
            runtime.configureModel({ endpoint, model, apiKey });
            setApiKey("");
            close();
          } catch (error) {
            setError(error instanceof Error ? error.message : "配置无效。");
          }
        }}
      >
        <div className="model-settings-heading">
          <div>
            <p>BRING YOUR OWN MODEL</p>
            <h2 id="model-settings-title">让模型，真正改变界面。</h2>
          </div>
          <button type="button" aria-label="关闭模型配置" onClick={close}>
            ×
          </button>
        </div>
        <p className="model-settings-intro">
          OpenAI 兼容 Chat Completions · 需支持 function
          calling。模型生成操作，SurfaceWeave 决定能否执行。
        </p>
        <label>
          API Base URL
          <input
            type="url"
            value={endpoint}
            onChange={(event) => setEndpoint(event.target.value)}
            required
            autoComplete="off"
            spellCheck={false}
            placeholder="https://你的服务商/v1"
          />
        </label>
        <p className="model-endpoint">
          实际发送到：<code>{destination}</code>
        </p>
        <div className="model-settings-fields">
          <label>
            模型 ID
            <input
              value={model}
              onChange={(event) => setModel(event.target.value)}
              required
              maxLength={160}
              autoComplete="off"
              spellCheck={false}
              placeholder="服务商提供的模型 ID"
            />
          </label>
          <label>
            临时 API Key
            <input
              type="password"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              maxLength={4096}
              autoComplete="off"
              spellCheck={false}
              placeholder={
                current
                  ? "重新填写；不回显原 Key"
                  : "仅本页内存；无鉴权本机服务可留空"
              }
            />
          </label>
        </div>
        <div className="model-risk">
          <strong>仅用于你自己的临时体验</strong>
          <p>
            浏览器中的 Key
            可被扩展、开发者工具或恶意脚本读取。只使用可撤销、低额度的测试
            Key；生产环境应改为服务端代理。不要填写生产密钥。
          </p>
          <p>
            请求由浏览器直接发给上面的地址，Key 放在 Authorization
            头中。服务商须允许 CORS。我们不保存到
            localStorage、sessionStorage、Cookie 或仓库。
          </p>
          <p>
            发送内容：你的指令、最近 10
            条对话、页面树、文字标签和组件描述。不发送表单
            data（备注、负责人等输入值），但请勿在对话或页面标题里填写秘密。
          </p>
          <p>
            每次对话最多 4
            次模型请求，可能产生服务商费用。可随时停止；清除配置不能撤回已发送的数据或费用。
          </p>
        </div>
        <label className="model-consent">
          <input
            type="checkbox"
            checked={accepted}
            onChange={(event) => setAccepted(event.target.checked)}
          />
          我信任此接口，并理解临时 Key 风险与上述发送范围
        </label>
        {error && (
          <p className="model-settings-error" role="alert">
            {error}
          </p>
        )}
        <div className="model-settings-actions">
          {current && (
            <button
              type="button"
              onClick={() => {
                runtime.disconnectModel();
                setApiKey("");
                close();
              }}
            >
              断开并清除配置
            </button>
          )}
          <button type="button" onClick={close}>
            取消
          </button>
          <button type="submit" className="model-connect">
            启用临时模型
          </button>
        </div>
        <p className="model-settings-footnote">
          保存不会发送请求。新会话、刷新或断开后配置清除，不宣称安全擦除浏览器内存。
        </p>
      </form>
    </dialog>
  );
}
