# Operations Center

SurfaceWeave 的旗舰交互 demo：一批关键 MCU 延误，运营人员与 Agent 一起生成、调整、审批并执行供应链恢复计划。

## Run

在仓库根目录运行：

```bash
nvm use 22
pnpm install --frozen-lockfile
pnpm dev
```

默认监听 `http://127.0.0.1:5175`。`pnpm dev` 会先构建所需的工作区 SDK。无 API Key、无远程模型、无业务后台、无外部字体或图片请求。重置演示会销毁旧运行时、订阅和未完成的模拟任务；刷新不保留数据。

## 两分钟演示

1. 点击「生成处置工作台」。表单来自 `logistics.recovery.create` 的 JSON Schema，而不是 App 中写死的 JSX 字段。
2. 修改交接备注，打开「共享会话视图」，从另一侧再改一次。两个 `SurfaceRenderer` 订阅同一 Store；这不代表跨设备协作。
3. 点击「把表单重组为决策界面」。Agent 用一个批次执行 `replaceComponent`、`groupNodes`、`moveNode`、`setProps`：下拉框变成业务方案卡，审批区前置，输入和绑定保留。
4. 点击「隐藏强制审批」。这批操作同时包含一项合法修改；硬约束使整批失败。再点击「发送过期版本」，查看 `REVISION_CONFLICT`。两者都不会调用宿主。
5. 勾选审批并提交。查看生成的确认 Surface，宿主请求数仍为 0。可返回修改，再次提交会生成新的确认快照；旧快照不能用于执行新参数。
6. 确认后模拟宿主首次返回暂时失败。点击「使用原幂等键重试」，收到模拟运单。展开「结果 Surface」和运行时事件，核查 2 次宿主请求、1 个幂等键、1 张模拟运单。

## 什么是真的，什么是模拟的

| 层           | 实现与边界                                                                                                   |
| ------------ | ------------------------------------------------------------------------------------------------------------ |
| 业务场景     | 虚构物流数据与方案估算，不是实际物流查询或成本建议                                                           |
| Agent        | 按钮触发预定义的语义工具调用，没有 LLM 推理或自动规划                                                        |
| SurfaceWeave | 真实注册、Schema 生成、组件解析、Store 订阅、原子操作、约束、revision、确认快照、ActionIntent 和调用生命周期 |
| 业务组件     | 本例注册 `RouteComparison`，可信 React 实现独立于可序列化 manifest；UI Wire 不含任意 JSX、DOM 或 CSS         |
| Host         | 本例用定时器模拟失败与成功，并以幂等键保存回执；真实系统仍需服务端鉴权与持久幂等存储                         |
| 状态共享     | 只在当前页面同一个 Store 的两个视图间共享，不使用 WebSocket，不跨窗口或设备同步                              |
| 证据         | 从实际工具返回与运行时事件生成，内存保留最近 40 条；不是持久审计系统                                         |

顶部事件图、Copilot 引导和指标是演示宿主的界面；生成表单、替换后的决策组件、确认和结果 Surface 均由 SDK renderer 渲染。业务流程编排不进入 Core。

## Source map

- `src/scenario.ts`：Tool Definition、业务 fixtures、组件 manifest。
- `src/demo-runtime.ts`：脚本化 Agent、SDK 调用、模拟 Host、证据投影与资源清理。
- `src/component-pack.tsx`：可信 React 绑定；保留标准组件语义约定。
- `src/App.tsx`：宿主工作台、双视图、原生确认对话框与演示引导。
- `tests/demo-runtime.test.ts`：生成与数据保留、整批拒绝、确认失效、幂等重试、重置清理。

```bash
pnpm exec vitest run examples/operations-center/tests/demo-runtime.test.ts
pnpm --filter @surfaceweave/operations-center build
```

浏览器演示验收与当前实现边界见 [使用指南](../../docs/guide/operations-center.md)。茶叶和 Tauri 验收例保留，分别用 `pnpm dev:tea` 和 `pnpm dev:tauri` 启动。
