---
id: PB-20260908-001
type: playbook
title: Dockge 部署（Docker Compose 管理面板）标准步骤
tags: [docker, dockge, compose, self-host]
status: draft
source: conversation:2026-09-08
created: 2026-09-08
updated: 2026-09-08
---

# Dockge 部署（Docker Compose 管理面板）标准步骤

Dockge（louislam/dockge）是 compose.yaml 导向的可视化栈管理器：创建/编辑/启停/重启/删除 stack，支持 `docker run` 命令转 compose。适合作为自部署 AI 网关（如 New API）等多 stack 的统一管理面板。

## 1. Linux 服务器标准部署（compose 方式）

```bash
mkdir -p /opt/stacks /opt/dockge && cd /opt/dockge
```

新建 `compose.yaml`：

```yaml
services:
  dockge:
    image: louislam/dockge:1
    restart: unless-stopped
    ports:
      - "5001:5001"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - ./data:/app/data
      - /opt/stacks:/opt/stacks
    environment:
      - DOCKGE_STACKS_DIR=/opt/stacks
```

启动：`docker compose up -d`，访问 `http://服务器IP:5001`，首次进入设置管理员账号密码。

## 2. 关键点（踩坑点）

- **`DOCKGE_STACKS_DIR` 必须与挂载的 stacks 目录一致**，否则看不到已有 stack。
- `/var/run/docker.sock` 是必须项，Dockge 靠它控制本机 Docker。
- 端口冲突：改 `ports` 左侧映射端口即可，右侧 5001 不动。
- Windows / 群晖 / NAS：用同一 compose 文件，把 `docker.sock` 与 stacks 路径换成对应平台路径（NAS 通常在 Docker UI 里勾选「高权限/挂载 docker.sock」）。

## 3. 备选方式

一键脚本安装（等价上面的 compose，默认装到 `/opt/dockge`）：

```bash
curl -fsSL https://get.dockge.io | bash
```

## 4. 多机管理（远程 Docker）

Dockge 本身管本机 Docker；要管理远程机器需在远程机器部署 dockge agent 并配置 SSH 连接，仅多机场景才需要。

## 5. 部署后建议

把业务 stack 的 compose 文件放进 `$DOCKGE_STACKS_DIR/<stack-name>/compose.yaml`（如 `/opt/stacks/newapi/compose.yaml`），Dockge 自动发现并可管理。

## See Also

- `playbooks/ai-gateway-selection-comparison.md`（New API 等网关选型，常部署于 Dockge 管理下）
- `playbooks/new-api-token-usage-stats.md`（New API 部署后的用量统计配置）
