---
id: PB-20260908-003
type: playbook
title: 用 Dockge 部署 Sub2API（compose.yaml + 环境变量 + 坑点）
tags: [sub2api, dockge, docker-compose, selfhosted]
status: draft
source: web-collected:2026-09-08
created: 2026-09-08
updated: 2026-09-08
---

# 用 Dockge 部署 Sub2API

一句话：Dockge 只管 `compose.yaml` 文件，所以「Dockge 部署 Sub2API」= **手写一份三件套（sub2api + postgres + redis）的 compose.yaml 丢进 stacks 目录**，在 UI 里点 Start。没有官方一键模板，也没有特殊适配。

关联：[PB-20260907-001](ai-gateway-selection-comparison.md) AI 网关选型对比（Sub2API 服务器开销基线）。

## 0. 前置

- Linux + Docker 20.10+ / Compose v2（Dockge 官方不支持原生 Windows，WSL2 属非官方路径）。
- Sub2API 强制依赖 PostgreSQL 15+ 与 Redis 7+，三件套常驻 800MB-1G，**2C2G 起步**。
- 端口：Sub2API 容器内 `8080`；宿主机别硬用 8080（太常见必撞），示例用 `6780`。

## 1. 装 Dockge（官方 compose）

```bash
mkdir -p /opt/stacks /opt/dockge && cd /opt/dockge
curl https://raw.githubusercontent.com/louislam/dockge/master/compose.yaml --output compose.yaml
docker compose up -d
```

官方 `compose.yaml` 内容（`louislam/dockge:1`，端口 5001）：

```yaml
services:
  dockge:
    image: louislam/dockge:1
    restart: unless-stopped
    ports:
      - 5001:5001
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - ./data:/app/data
      - /opt/stacks:/opt/stacks          # 左右路径必须完全相同且为绝对路径
    environment:
      - DOCKGE_STACKS_DIR=/opt/stacks
```

浏览器开 `http://<IP>:5001`，首次访问创建管理员账号（无默认密码）。

## 2. 生成密钥（必做，别留空）

```bash
openssl rand -hex 32   # → JWT_SECRET
openssl rand -hex 32   # → TOTP_ENCRYPTION_KEY
```

`JWT_SECRET` / `TOTP_ENCRYPTION_KEY` 一旦变动：已登录会话全部失效、已绑定 2FA 全部作废。**先定死再上线。**

## 3. 建 stack 目录并写 compose.yaml

```bash
mkdir -p /opt/stacks/sub2api && cd /opt/stacks/sub2api
```

**文件名必须是 `compose.yaml`**（Dockge 的扫描约定）。相对路径卷 `./data/...` 会解析到 `/opt/stacks/sub2api/data/...`，迁移时整目录打包即可。

```yaml
services:
  sub2api:
    image: weishaw/sub2api:latest
    container_name: sub2api
    restart: unless-stopped
    ports:
      - "6780:8080"
    volumes:
      - ./data/sub2api:/app/data
    environment:
      - AUTO_SETUP=true                  # 首次启动自动初始化
      - TZ=Asia/Shanghai
      - SERVER_MODE=release
      - DATABASE_HOST=postgres
      - DATABASE_PORT=5432
      - DATABASE_USER=sub2api
      - DATABASE_PASSWORD=<改我>
      - DATABASE_DBNAME=sub2api
      - REDIS_HOST=redis
      - REDIS_PORT=6379
      - REDIS_PASSWORD=<改我>
      - ADMIN_EMAIL=admin@sub2api.local
      - ADMIN_PASSWORD=<改我>
      - JWT_SECRET=<openssl rand -hex 32>
      - TOTP_ENCRYPTION_KEY=<openssl rand -hex 32>
      - SECURITY_URL_ALLOWLIST_ENABLED=false
      - SECURITY_URL_ALLOWLIST_ALLOW_INSECURE_HTTP=true
    depends_on:
      postgres: { condition: service_healthy }
      redis: { condition: service_healthy }
    networks:
      - sub2api-network

  postgres:
    image: postgres:18-alpine
    container_name: sub2api-postgres
    restart: unless-stopped
    volumes:
      - ./data/postgres:/var/lib/postgresql/data
    environment:
      - POSTGRES_USER=sub2api
      - POSTGRES_PASSWORD=<同上>
      - POSTGRES_DB=sub2api
      - PGDATA=/var/lib/postgresql/data
      - TZ=Asia/Shanghai
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U sub2api -d sub2api"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - sub2api-network

  redis:
    image: redis:8-alpine
    container_name: sub2api-redis
    restart: unless-stopped
    volumes:
      - ./data/redis:/data
    command: ["redis-server", "--requirepass", "<同上 Redis 密码>", "--appendonly", "yes"]
    environment:
      - REDISCLI_AUTH=<同上 Redis 密码>
      - TZ=Asia/Shanghai
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - sub2api-network

networks:
  sub2api-network:
    driver: bridge
```

三处 `<改我>` 密码必须三份同步（sub2api env / postgres env / redis command+env），不一致直接起不来。

## 4. 在 Dockge 里启动

Dockge UI → 若 stack 未出现，退出到 Compose 列表页点 **Scan Stacks Folder** → 选中 `sub2api` → **Start**。
终端等价：

```bash
cd /opt/stacks/sub2api && docker compose up -d
docker compose logs -f sub2api
```

访问 `http://<IP>:6780`，用 `ADMIN_EMAIL` / `ADMIN_PASSWORD` 登录，走配置向导（分组 → 账号 → API Key）。

## 5. 坑点清单

1. **HTTP 才需要白名单两项**：`SECURITY_URL_ALLOWLIST_ENABLED=false` 与 `SECURITY_URL_ALLOWLIST_ALLOW_INSECURE_HTTP=true` 只在纯 HTTP 场景下保留；上 HTTPS 后**必须删掉**。
2. **Nginx 反代必须加 `underscores_in_headers on;`**（在 `http` 块）。Nginx 默认丢弃含下划线的请求头（如 `session_id`），否则多账号粘性会话失效。
3. **stack 不出现在 Dockge**：只扫 stacks 目录；目录需在 `/opt/stacks` 下、文件名为 `compose.yaml`、容器内外的 stacks 路径必须一致。
4. **端口 5001/6780 被占**：改左侧宿主机端口（如 `7001:5001`、`7780:8080`）后 `docker compose up -d`。
5. **数据管理功能**：Docker 场景默认不可用，需额外部署宿主机进程 `datamanagementd`，并把 `/tmp/sub2api-datamanagement.sock` 挂进容器同路径（见官方 `deploy/DATAMANAGEMENTD_CN.md`）。
6. **简易模式**：`RUN_MODE=simple` 隐藏 SaaS 功能、跳过计费；生产环境用需同时设 `SIMPLE_MODE_CONFIRM=true`。
7. **镜像拉取失败**（国内机器）：配 Docker Hub 加速镜像源，或在 Dockge stack 里改用镜像代理地址。
8. **升级**：Dockge 里点 Update/Pull，或 `docker compose pull && docker compose up -d`；**升级前备份整个 stack 目录**（`.env` + PG + Redis + 应用数据一起决定能否恢复）。
9. **备份/迁移**：

   ```bash
   cd /opt/stacks/sub2api && docker compose down
   cd /opt/stacks && tar czf sub2api-backup.tar.gz sub2api/
   ```

   新机器解压到同样路径再 `up -d` 即可（相对卷保证路径无关）。

## 6. 上线前最小安全检查

- 上 HTTPS，禁止长期明文传 API Key。
- 5001（Dockge，等同 root 权限）与 6780 后台不直接暴露公网，走 VPN / 反代鉴权。
- 配置用户级与账号级并发限制、请求/Token 速率限制。
- 合规：Sub2API 涉及订阅资源共享，可能违反上游服务条款（封号风险），勿公开售卖未授权账号额度。

## 来源

Sub2API 官方仓库 `Wei-Shaw/sub2api`（镜像 `weishaw/sub2api:latest`，`deploy/README.md`、`deploy/DATAMANAGEMENTD_CN.md`）、Dockge 官方 `louislam/dockge/compose.yaml`、第三方部署教程（2026-03 ~ 2026-08，基于 v0.1.84+ 验证）。
