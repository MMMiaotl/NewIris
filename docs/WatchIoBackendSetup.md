# WatchIO 后端架构与启动说明

> **NewIris** 支持三种连接方式：**SmcServer API**（`/SmcServer1`，与 SmcServerView 相同）、**WatchIO HTTP**（`/watchio`，需 `http=1` 注册）、**WatchIO WebSocket**（STOMP `ws://8083`，WS-only 部署下推荐）。UI 步骤见 **[NewIrisConnection.md](NewIrisConnection.md)**；WS 协议与故障排查见 **[WatchIoWebSocket.md](WatchIoWebSocket.md)**。

## 你的部署配置（标准集成模式）

根据启动器配置，典型组合如下：

| 启动器名称 | 实际 exe | 参数（示例） | 角色 |
|-----------|---------|-------------|------|
| **HttpWebServer** | `HttpWebServer.exe` | `http1=1 port1=8082 websocket2=1 port2=8083` | **网关**：对外 HTTP :8082、WebSocket :8083 |
| **WatchIoServer** | `WatchIoWebServer.exe` | `websocket=1 port=8083` | **WatchIO 后端**：作为 WS 客户端连到网关 :8083，注册 `/watchio` |

```
浏览器
  │  HTTP  GET  http://localhost:8082/watchio/...
  │  WS    STOMP ws://localhost:8083  destination=/watchio
  ▼
HttpWebServer (:8082 HTTP 宿主, :8083 WebSocket 宿主)
  │  内部桥接：已注册的 /watchio 服务
  ▼
WatchIoWebServer.exe  （启动器里叫 WatchIoServer）
  │  WatchIoTcp 或本地共享内存（hostaddress 为空时）
  ▼
SmcControl1 WatchIO 段
```

**要点**：`WatchIoWebServer` 的 `websocket=1 port=8083` **不是**在 8083 上再开一个对外监听，而是**主动连接** `HttpWebServer` 的 WebSocket 宿主（`:8083`），并把 `destination=/watchio` 注册进去。浏览器始终连 **HttpWebServer**，不直连 WatchIoWebServer 进程。

因此 `http://localhost:8082/watchio/SmcControl1:vartree?fulltree=1` **路径是对的**；一直转圈说明网关或注册链某处卡住，而不是「没起 WatchIoWebServer」。

## 不要打开 http://localhost:8082/

HttpWebServer 在 `:8082` 上是 **API 网关**，只处理已注册路径，例如：

| URL | 结果 |
|-----|------|
| `/request` | 200 — 服务列表 |
| `/SmcServer1` | 200 — SmcServer API |
| `/watchio/...` | 需 WatchIoServer 注册后才有数据 |
| `/`、`/index.html`、`/SmcServerView.html` | **503 且不关闭连接** → 浏览器一直转圈 |

SmcServerView 页面一般**不是**从 `http://localhost:8082/SmcServerView.html` 打开的，而是本地 HTML 文件 + JS 调 `:8082` API。

**NewIris UI** 请用 Vite：**http://localhost:5173**（`cd frontend && npm run dev`）。

## 与 SmcServerView / NewIris 的关系

| | SmcServerView | NewIris（当前） | WatchIO 直连（未用于 NewIris） |
|--|---------------|-----------------|--------------------------------|
| 入口 | `http://:8082/SmcServer1` | 同上 | `http://:8082/watchio/...` 或 `ws://:8083` |
| 后端注册 | SmcFrameWebServer → `/SmcServer1` | 同上 | WatchIoWebServer → `/watchio` |
| `/request` | 列出 SmcServer1 等 | 只选用 SmcServer 条目 | `/watchio` 可能不出现 |

## WatchIoWebServer 默认参数

见 `WatchIoWeb.h`：

```cpp
defaultcmdparams     = "websocket=1";
wiotcpdefaultport    = 8084;   // 仅当需要 TCP 连远端 WatchIO 时
```

本地同机 SmcControl1 时，`hostaddress` 常为空，走本地 WatchIO，不一定需要 :8084。

## NewIris connection

See **[NewIrisConnection.md](NewIrisConnection.md)** (request → SmcServer1 → Connect; leave HTTP URL empty).

## 转圈 / 无响应时的排查（/watchio 路径）

按顺序检查：

1. **启动顺序**：先 `HttpWebServer`，再 `WatchIoWebServer`（WatchIoServer）。
2. **WatchIoWebServer 控制台**应出现：
   - `create websocket watchio server`
   - `connect watchio SmcControl1`
3. **WebSocket 注册**：连 `ws://localhost:8083`，STOMP `SUBSCRIBE` `destination:/request`，看是否出现 `/watchio` 条目。  
   **注意**：`GET http://localhost:8082/request` 在仅 `websocket=1` 时**不会**列出 `/watchio`，需用 WS `/request` 或 NewIris **watchIoWs** 的 request 按钮。
4. **HTTP 快速失败 vs 挂起**：
   - 立即 **503** → `/watchio` 未注册到 HttpWebServer（WatchIoWebServer 未连上 :8083）。
   - **长时间挂起** → 已转发到 WatchIoWebServer，但 WatchIO 段（SmcControl1）无响应或 `watchioname` 不对。
5. **SmcControl1 在跑** 只保证段存在；还需确认 WatchIoWebServer 日志里没有 WatchIoTcp 连接失败。
6. **STOMP 已连接但 vartree 无响应**：常见原因为出站帧带 **`\0`** 导致服务端 JSON 解析失败（静默丢弃）。NewIris 已修复；自建客户端勿在 body 后加 `\0`。详见 [WatchIoWebSocket.md — Troubleshooting summary](WatchIoWebSocket.md#troubleshooting-summary-lessons-from-newiris-integration)。
7. **vartree 仍空**：WatchIO 段 `dataok=false` 时服务端不返回 MESSAGE；先发 `{"type":"status"}` 看 `dataok`，或等待数秒后重试 vartree。

## 与 WatchIoService（SOAP :2202）的区别

`WatchIoGuide.md` 中的 **WatchIoService**（HTTP SOAP `/watchIo`）是另一套远程访问方式，**不是** NewIris 当前用的 `WatchIoWebServer` + `/watchio` 协议。不要混用端口和 URL。
