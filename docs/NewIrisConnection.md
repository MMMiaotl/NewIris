# NewIris 连接方式（当前可用方案）

本文档记录 **Iris Next** 前端已验证可用的连接路径。连接栏 **Connection type** 支持四种模式：

| Transport | UI 名称 | 发现方式 | API 路径 | 变量树形式 | 典型场景 |
|-----------|---------|----------|----------|------------|----------|
| **smcServer** | SmcServer API | `GET /request` → SmcServer1 | `/SmcServer1/...` | 斜杠对象树 | 与 SmcServerView 相同 |
| **sharedMemory** | Shared Memory | WatchIO 段名（COM） | `WatchIoCom` ActiveX | 点分路径 | 本机 Windows 服务进程共享内存（IrisWeb 同款） |
| **watchIoWs** | WatchIO WebSocket | STOMP `ws://8083` `/request` | STOMP `/watchio` | 点分路径 | 远端或通用 WS 部署 |
| **watchIoHttp** | WatchIO HTTP | `GET /request`（需 `http=1`） | `GET /watchio/{name}:...` | 点分路径 | WatchIoWebServer 同时注册 HTTP 时 |

**Shared Memory** 经 `WatchIoCom.ocx` 读本地 shm；变量树在 `/watchio` HTTP 可用时用于浏览（见 [WatchIoSharedMemory.md](WatchIoSharedMemory.md)）。**不要**与 STOMP/WebSocket 混用为同一连接方式。

**SmcServer** 与 **WatchIO** 是两条独立桥接，不要混用 URL 与命名规则。WS 协议细节与完整故障排查见 **[WatchIoWebSocket.md](WatchIoWebSocket.md)**。

## 架构概览

```
浏览器 (http://localhost:5173)
  │  GET /request          → 发现 SmcServer1 / SmcServer2 等
  │  GET /SmcServerN/...   → 模块树、对象、变量、轮询、写值
  ▼
Vite 开发代理 (:5173 → :8082)
  ▼
HttpWebServer (:8082)
  │  /request、/SmcServer1 等已注册 HTTP 服务
  ▼
SmcFrame / SmcControl1（本地 WatchIO 段）
```

| 地址 | 作用 |
|------|------|
| **http://localhost:5173** | NewIris UI（`npm run dev` / `npm run preview`） |
| **http://localhost:8082** | HttpWebServer API 网关（**不是**静态网站根目录） |
| **/SmcServer1**、**/SmcServer2** | WatchIO 变量树与数据（SmcServer 类服务，NewIris 当前支持） |

**不要**在浏览器直接打开 `http://localhost:8082/`：网关对 `/` 返回 503 且可能长时间挂起，这是预期行为。

## 前置条件

1. **HttpWebServer** 已启动，HTTP 端口 **8082**（示例参数：`http1=1 port1=8082`）。
2. **SmcControl1**（或你的 WatchIO 段）已在运行，SmcServer 能暴露 Control 等模块。
3. **不需要** WatchIoWebServer 向 :8083 注册 `/watchio`（该路径在本环境中常不可用，NewIris 已改为走 SmcServer）。

快速自检（PowerShell 或 `curl`）：

```text
GET http://localhost:8082/request          → type=request，含 SmcServer1
GET http://localhost:8082/SmcServer1       → type=module，含 Control 等模块
```

或在项目内运行：

```powershell
cd frontend
node scripts/verify-smc-api.mjs
```

脚本会验证到 `Control/Control.Filter.Surge.Coefs` 下的 **Kqx1** 及 `varprefix`（默认针对 `/SmcServer1`；`/SmcServer2` 结构相同，见下文）。

## HttpWebServer 上还有哪些服务？

`GET /request` 在本环境典型返回 **5 项**（无 `/watchio`）：

| 名称 | URI | category | NewIris 现状 |
|------|-----|----------|--------------|
| SmcServer1 | `/SmcServer1` | SmcServer | **已支持**，request 后默认选中 |
| SmcServer2 | `/SmcServer2` | SmcServer | **已支持**，Service 下拉可切换 |
| UniConnectCasModel | `/UniConnectCasModel` | UniConnect | 未支持（**不是** CAS WatchIO） |
| UniConnectCasFusion | `/UniConnectCasFusion` | UniConnect | 未支持 |
| UniConnectCasServer | `/UniConnectCasServer` | UniConnect | 未支持 |

**注意**：`UniConnectCas*` 名称里的 `Cas` 表示 UniConnect 与 CAS 产品线的**通信拓扑**（Model/Fusion/Server 实例），`category` 仍是 **UniConnect**，与下文 **CAS WatchIO 段 `CasServer`** 不是同一概念。

### SmcServer1 与 SmcServer2

两者 API **完全相同**，根响应均为 `type=module`（`Root`、`Control`、`Prediction`），对象路径与 `varprefix` 规则一致。例如：

```text
GET /SmcServer2/Control/Control.Filter.Surge.Coefs:?value=1;vartype=1
→ type=variable，含 Draught、Kqx1 等（与 SmcServer1 同结构，数值来自各自后端实例）
```

NewIris 的 `fetchRequestServices` 会列出 **所有** `category=SmcServer` 的条目；在连接栏 **Service** 中选 `SmcServer2` 即可，无需改客户端逻辑。`vite.config.ts` 已代理 `/SmcServer2`。

SmcServerView 里 SmcServer1/2 常对应不同主机（如 STAT-013 / STAT-014）；本地集成时二者都注册在同一 `localhost:8082` 网关下。

### CAS WatchIO（`CasServer`）— 与 UniConnect 无关

CAS 导航套件通过 **WatchIO 段** 发布数据，实例名通常为 **`CasServer`**（见 [reference/WatchIoGuide.md](../reference/WatchIoGuide.md)），变量名带点分路径，例如：

```text
C.Cas.Main.gp.TimeHorizon
```

这与 SmcControl1（`C.Filter...`）是**不同的 WatchIO 段**；SmcServer1 的 Control 对象树里**不会出现** `C.Cas.*` 前缀（本机实测 SmcServer1/Control 下无 Cas 对象）。

在 HttpWebServer `:8082` 上读取 CAS WatchIO 的常见路径：

| 路径 | 条件 | 示例 |
|------|------|------|
| **`/watchio/CasServer:...`** | WatchIoWebServer 已向网关注册 `/watchio`，且连接了 `watchioname=CasServer` | `GET /watchio/CasServer:vartree?fulltree=1` |
| **SmcServer（若 CAS 进程注册了独立 SmcServer）** | 存在如 `/CasSmcServer` 且对象树含 `C.Cas...` | 与 SmcControl 用法相同（本环境 `/request` **无** 此类条目） |
| **WatchIoService SOAP `:2202`** | 远程/VM，`watchioService.xml` 中配置了 `CasServer` | `POST .../watchIo`（见 WatchIoGuide） |

#### 为何 `/request` 里没有 CAS？

`/request` 只列出**已向 HttpWebServer 注册**的 HTTP/WebSocket 服务，不是“本机所有 WatchIO 段”的清单。

本环境缺失项说明 **CAS 信息尚未注册到网关**（即你说的“没有发送 CAS 信息”），常见原因：

1. **CAS 应用 / `CasServer` WatchIO 段未运行** — 没有可连接的 WatchIO 内存段。
2. **WatchIoWebServer 未启动或未连上 `:8083`** — `/watchio` 不会出现在 `/request`（与 SmcControl1 走 SmcServer 是两条独立桥接；CAS 不会自动出现在 SmcServer1 里）。
3. **WatchIoWebServer 未配置 `watchioname=CasServer`** — 即使起了 WatchIoWebServer，默认可能只连 `SmcControl1` 等，需启动参数或配置显式连接 CAS 段（参见 `reference/WatchIoWebServer` 中 `watchioname` / `watchioname1` 说明）。
4. **误以为 `UniConnectCasServer` = CAS** — 该项是 UniConnect 通信服务，读的是 Fusion 实例计数等，**不是** `C.Cas.Main.*` WatchIO 变量。

排查顺序建议：

```text
1. CAS 进程是否在跑？本地是否有 CasServer WatchIO 段？
2. GET /request — 是否出现 /watchio？（无则 WatchIoWebServer 未注册）
3. GET /watchio/CasServer:open?watchioname=CasServer — 能否打开（需上一步）
4. 或 WatchIoService :2202 — listVariables(CasServer)（SOAP 路径，与 :8082 网关无关）
5. 勿把 UniConnectCasServer 当作 CasServer WatchIO
```

当前 NewIris 通过 **SmcServer** 读的是 **SmcControl1**（`SmcServer1`/`SmcServer2`）。要监视 **`C.Cas.*`**，需先让运维侧把 **CasServer** 注册到 `/watchio`（或独立 SmcServer），再扩展 NewIris 客户端；在 `/watchio` 未注册前，前端无法像 SmcControl 一样直接连 CAS。

### UniConnect（`UniConnectCas*` — 通信层，非 CAS WatchIO）

参考 `Web/UniConnectView.html`：`category=UniConnect`，管理 instance/port/ioport，与 WatchIO 变量树无关。NewIris 当前未集成。

## UI 连接步骤

1. 启动前端：

   ```powershell
   cd frontend
   npm install
   npm run dev
   ```

2. 浏览器打开 **http://localhost:5173**（不要用 :8082）。

3. 连接栏操作：

   **SmcServer API（默认，与 SmcServerView 相同）**
   - **Transport**：`SmcServer API`
   - **Server**：`localhost:8082`
   - 点击 **request** — `GET /request`，列出 SmcServer 并默认 **SmcServer1**
   - **Service**：`SmcServer1` 或 `SmcServer2`
   - **Instance**：`SmcControl1`（树顶显示名，不参与 API 路径）
   - 工具栏 **Connect**

   **WatchIO WebSocket（点分 vartree，WS-only 部署）**
   - **Transport**：`WatchIO WebSocket`
   - **HTTP gateway**：`localhost:8082`（仅用于显示；WS 连 `:8083`）
   - 点击 **request** — 通过 `ws://8083` STOMP `/request` 发现 `/watchio`（HTTP `/request` 为空属正常）
   - **Instance**：`SmcControl1`（SUBSCRIBE 的 `id` / `watchioname`）
   - 工具栏 **Connect** — 成功后自动 `{"type":"vartree"}`

4. 浏览变量：
   - 左侧树展开：`Control` → `Control.Filter` → `Control.Filter.Surge` → 选中 `Control.Filter.Surge.Coefs`
   - 右侧参数表应出现 `Kqx1`、`Draught` 等变量及数值

5. 页脚状态应为：`localhost:8082/SmcServer1 · SmcControl1 · connected`

## 默认配置

| 项 | 默认值 | 说明 |
|----|--------|------|
| HTTP URL | 留空 | 开发时走 Vite 代理，避免 CORS |
| serverPath | `/SmcServer1` | 来自 `/request` 中 SmcServer 条目的 `value` |
| watchIoName | `SmcControl1` | 树顶虚拟根节点标签 |
| sampleInterval | `500` ms | 已选对象轮询间隔 |

可在 **Settings** 中修改 HTTP URL、SmcServer 路径、实例名与采样间隔。

环境变量（可选，见 `frontend/.env`）：

- `VITE_HTTP_URL` — 留空即可
- `VITE_HOST_ADDRESS` — 默认 `localhost:8082`
- `VITE_WATCHIO_NAME` — 默认 `SmcControl1`

## HTTP API 说明（SmcServerClient）

实现参考 `Web/SmcServerView.js` 与 `frontend/src/api/smcServerClient.ts`。

### 1. 服务发现

```http
GET /request
```

响应 `type=request`，NewIris 只保留 **SmcServer** 类条目（如 `SmcServer1` → `/SmcServer1`）。

### 2. 连接与模块列表

```http
GET /SmcServer1
```

响应 `type=module`，`entries` 为顶层模块名，例如：`Root`、`Control`、`Prediction`。

### 3. 懒加载对象树

展开模块或子对象时，按 **slash 路径** 请求子节点，逻辑与 SmcServerView 的 `InitModuleObj` 一致：

```http
GET /SmcServer1/Control
```

在对象列表中推导下一级路径，例如：

- `Control/Control.Filter`
- `Control/Control.Filter.Surge`
- `Control/Control.Filter.Surge.Coefs`

树节点 `key` / `fullPath` 使用上述 **module/object** 形式（含 `/`），不是 WatchIO 点分名。

### 4. 读取变量（varleaves）

选中对象后：

```http
GET /SmcServer1/Control/Control.Filter.Surge.Coefs:?value=1;vartype=1;description=1;override=1
GET /SmcServer1/Control/Control.Filter.Surge.Coefs:info
```

`:info` 中的 **varprefix** 将短名拼成 WatchIO 全名，例如：

| SmcServer 短名 | varprefix | 表格/绘图用全名 |
|----------------|-----------|-----------------|
| `Kqx1` | `C.Filter.Surge.Coefs.` | `C.Filter.Surge.Coefs.Kqx1` |

参数表按 `varprefix` 过滤当前分支变量；显示名去掉前缀（如 `Kqx1`）。

### 5. 轮询更新

对已加载或已注册绘图的对象路径周期性：

```http
GET /SmcServer1/{module}/{object.path}
```

将返回值合并为 `update` 消息，刷新表格与曲线。

### 6. 写值

```http
POST /SmcServer1/Control/Control.Filter.Surge.Coefs/Kqx1
Content-Type: application/json

{"type":"variable","value":"..."}\r\n
```

UI 使用 WatchIO 全名（如 `C.Filter.Surge.Coefs.Kqx1`），客户端内部映射为上述 POST 路径。

## 开发代理

`frontend/vite.config.ts` 将下列路径代理到 `http://localhost:8082`：

- `/request`
- `/SmcServer1`
- `/SmcServer2`
- `/watchio`（watchIoHttp 时使用）

WebSocket `:8083` 由浏览器直连（或 Settings 中的 WS URL）；开发时 **不要** 把 HTTP URL 设为 `http://localhost:8082`（会 CORS）。

## 与 SmcServerView 的对应关系

| SmcServerView | NewIris |
|---------------|---------|
| 选 server `localhost:8082` | ConnectionBar **Server** |
| 点 **request** | 点 **request** |
| 选 **SmcServer1** | **Service** 下拉 |
| 连接应用 | 工具栏 **Connect** |
| 展开 Control 对象树 | 左侧 **Variables** 树 |
| 对象变量表 | 右侧 **Parameters** 表 |

两者共用同一套 `/SmcServer1` JSON API；SmcServerView 能连上时，NewIris 也应能连上。

## WatchIO 路径说明（与 SmcServer 对比）

| 现象 | 原因 | 处理 |
|------|------|------|
| HTTP `GET /request` **无** `/watchio` | WatchIoWebServer 仅 `websocket=1`，未 HTTP 注册 | 用 **watchIoWs** + WS `/request` 发现 |
| `GET /watchio/...` **503** | 网关无 HTTP `/watchio` | 改用 **watchIoWs**，或给 WatchIoWebServer 加 `http=1` |
| WS **connected** 但无 vartree | 出站 STOMP 帧 `\0` 破坏 JSON（已修复）；或 `dataok=false` | 见 [WatchIoWebSocket.md — Troubleshooting](WatchIoWebSocket.md#troubleshooting-summary-lessons-from-newiris-integration) |
| 变量名带 **`C.Filter...`** 点分 | WatchIO 原生树 | 正常；SmcServer 则用 `Control/...` 斜杠路径 |

读 **SmcControl1 / Kqx1** 时 **smcServer** 仍最稳；读 **点分 vartree** 或 **CasServer**（注册到 `/watchio` 后）用 **watchIoWs**。

## 常见问题

**request 后 Service 为空**

- 确认 HttpWebServer 已启动且 `GET /request` 含 SmcServer 条目。

**Connect 后树为空**

- 确认页脚为 `connected`；点击的是工具栏 **Connect**（插头），不是 Plot 的 **Control** 按钮。
- 清空搜索框；搜索 `Kqx1` 会在未加载该分支前把树过滤为空。

**参数表无数据**

- 须在树中**选中**具体对象节点（如 `Control.Filter.Surge.Coefs`），仅展开不够。

**SmcServerView 能连，NewIris 不能**

- 确认使用 **http://localhost:5173**，且 Settings 里 HTTP URL **留空**。
- 打开浏览器开发者工具 Network，确认请求发往 `/SmcServer1` 而非绝对 URL 跨域失败。

**watchIoWs：request 后 Service 为空**

- 确认 `HttpWebServer` 的 WebSocket 宿主 `:8083` 已启动，且 `WatchIoWebServer` 已连上并注册 `/watchio`。
- HTTP `GET /request` 为空 **不代表** WS 发现失败；看控制台 `[WatchIO:discover] WS /request parsed`。

**watchIoWs：Connect 成功但树为空**

- 看 `[WatchIO:ws] raw chunk` / `STOMP MESSAGE` 是否出现；若无 MESSAGE，参考 WatchIoWebSocket 故障排查（`\0`、`dataok`）。
- 确认 Instance 名与后端 `watchioname` 一致（如 `SmcControl1`）。

## 相关文件

| 文件 | 说明 |
|------|------|
| `frontend/src/api/smcServerClient.ts` | SmcServer HTTP 客户端 |
| `frontend/src/api/stompWatchIoClient.ts` | WatchIO WebSocket (STOMP) 客户端 |
| `frontend/src/api/httpWatchIoClient.ts` | WatchIO HTTP 客户端 |
| `frontend/src/api/stompFrame.ts` | STOMP 帧格式（无 outbound `\0`） |
| `frontend/src/api/watchIoWsDiscovery.ts` | WS `/request` 服务发现 |
| `frontend/src/api/smcHttp.ts` | `/request` 发现与 GET 封装 |
| `frontend/src/components/connection/ConnectionBar.tsx` | Transport / request / Connect |
| `frontend/scripts/verify-smc-api.mjs` | SmcServer 冒烟测试 |
| `frontend/scripts/probe-watchio-ws.mjs` | WatchIO WS 冒烟测试 |
| `Web/SmcServerView.js` | SmcServer 参考实现 |

## 参见

- [WatchIoWebSocket.md](WatchIoWebSocket.md) — STOMP 协议、服务发现、**故障排查与经验总结**
- [WatchIoBackendSetup.md](WatchIoBackendSetup.md) — HttpWebServer / WatchIoWebServer 进程架构
- [Web/SmcServerView.html](../Web/SmcServerView.html) — SmcServer / WatchIO 参考客户端
- [reference/WatchIoGuide.md](../reference/WatchIoGuide.md) — CAS `CasServer` WatchIO 与 WatchIoService SOAP
- [Web/UniConnectView.html](../Web/UniConnectView.html) — UniConnect 通信（非 CAS WatchIO）
