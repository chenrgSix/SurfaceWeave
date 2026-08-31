# Operations Center

SurfaceWeave 的旗舰交互 demo 默认是**对话式应用实验室**：十条固定模板或使用者临时配置的模型，驱动自定义配色、四向导航、布局、业务组件和共享视图变化，也可以用注册的展示组件重建整个页面树。原始供应链业务流程保留在 `?demo=operations`。

直接体验：[在线 Playground](https://chenrgsix.github.io/SurfaceWeave/playground/)。文档站和 Demo 同属一个 Pages 构建产物，页面、脚本和样式使用项目子路径。

## Run

在仓库根目录运行：

```bash
nvm use 22
pnpm install --frozen-lockfile
pnpm dev
```

默认监听 `http://127.0.0.1:5175`。`pnpm dev` 会先构建所需的工作区 SDK。默认不需要 Key 或后台，没有外部字体或图片请求。可选模型模式才会请求使用者填写的接口。新会话会销毁旧运行时、订阅和未完成的模拟任务，并中止模型请求、清除临时 Key；刷新不保留数据和配置。

## 对话式实验室

建议按「午夜紫 → 菜单到顶部 → 表单变决策卡 → 打开双视图 → 变成简报 → 撤销上一条」体验。先填一句备注，再观察它跨变更与撤销保留。

页面外壳与业务表单是两份独立 Surface。`StudioApplication` 接受四个主题预设与任意合法六位颜色令牌；`moveNode` 实际移动导航节点，`setVisibility` 和 `setLayout` 重组工作区。`replaceSurface` 撤销时使用**当前 data**，只恢复之前的结构。

模板可以连续组合；模型重建后若所需旧面板被删除，对应模板会拒绝并提示恢复布局，不会偷偷重置。未接入模型时，未知文字不会被猜测执行；接入后输入框调用真实 API，模板按钮仍固定映射。撤销最多保留 40 步、对话最多 80 条，都只保存在当前会话内存。业务确认期间不能重组或撤销表单结构，页面外壳变更不改确认参数。

点击“接入模型”，配置支持 function calling 的 OpenAI 兼容 Chat Completions 地址、模型 ID 和临时 Key。在线 Pages 不提供模型代理或共享 Key；接口需要允许 `https://chenrgsix.github.io` 来源的 CORS，并使用 HTTPS；仅用可撤销、低额度测试 Key，生产应使用服务端代理。Key 仅在本页内存，API 请求包含页面树、标签、组件描述和最近对话，不包含表单 data。模型每次最多四轮，每批一份 Surface、24 操作或一次完整页面树替换；错误/取消不会执行迟到响应或自动回退模板。原始参数与 SDK 前后树可以展开核查。详细风险、权限和真实模型验收边界见[模型接入指南](../../docs/guide/conversation-playground.md#临时接入模型)。

动态重建通过 `ui_replace_page` → `AgentUIToolRuntime.replaceSurface` → Store → Renderer 执行。`StudioCard`、`StudioStat` 与 Text/Badge/Section/Stack/Grid 支持新增展示内容；生成文案和指标明确标记为展示内容，不能伪装业务证据。页面保留五个可见的骨架/工作台节点，限制 150 个节点和 12 层嵌套；业务 Surface 不能被这个工具替换。

新增源文件：`src/studio-runtime.ts` 定义模板和可逆变更；`src/Studio.tsx` 注册整页 React 组件并呈现对话；`src/studio-schema.ts` 声明动态颜色与展示组件能力；`src/studio.css` 提供受信任主题映射。详细说明见[对话指南](../../docs/guide/conversation-playground.md)。

模型接入保持在示例内：`model-client.ts` 处理临时浏览器协议；`model-policy.ts` 复用 SDK 工具 schema 并限制宿主授权；`ModelSettings.tsx` 提供配置与发送范围提示。无新增 Core 依赖或协议变更。

## 两分钟演示

以下步骤针对右上角「业务流程案例」入口。

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
pnpm exec vitest run examples/operations-center/tests
pnpm --filter @surfaceweave/operations-center build
```

浏览器演示验收与当前实现边界见 [使用指南](../../docs/guide/operations-center.md)。茶叶和 Tauri 验收例保留，分别用 `pnpm dev:tea` 和 `pnpm dev:tauri` 启动。

文档站集成：`pnpm docs:build` 构建 `/SurfaceWeave/playground/`，`pnpm docs:preview` 本地预览完整产物。`pnpm docs:dev` 只运行文档开发服务，不代理此 Demo。
