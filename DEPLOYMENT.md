# AI 全屋装修设计平台 · 部署文档

> 版本：v2.1 · 纯静态前端（免构建）
> 适用：本演示站点为纯前端应用，无后端、无数据库，部署即静态托管。

---

## 1. 项目结构

```
ai-home-design-site/
├── index.html              # 入口（依赖加载链 + 失败兜底）
├── assets/
│   ├── css/styles.css      # 浅色设计系统
│   └── js/
│       ├── data.js         # Mock 数据 + 布局/报价引擎 + 产品库（含真实图片URL）
│       ├── canvas.js       # 2D CAD 渲染器（门窗、墙、家具、拖拽命中）
│       ├── scene3d.js      # Three.js 3D 场景（门窗洞、多楼层堆叠）
│       └── app.js          # React 应用（8 步流程 + 引导 + 编辑 + 全景）
├── vendor/                 # 本地依赖（离线用，默认空，含说明）
│   └── README.txt
├── fetch-vendor.sh         # 一键下载依赖到 vendor/（离线部署用）
├── serve.sh                # 本地预览脚本
├── nginx.conf              # Nginx 站点配置
├── Dockerfile              # Docker 镜像构建
├── docker-compose.yml      # 一键容器编排
└── DEPLOYMENT.md           # 本文档
```

**依赖加载策略**：`index.html` 优先加载本地 `vendor/` 下的 React 与 Three.js；若本地缺失，自动回退到公共 CDN（unpkg）。因此：

| 环境 | 处理 |
|------|------|
| 服务器可访问外网 | 无需处理，直接部署即可（走 CDN） |
| 内网 / 离线 / 追求稳定 | 先执行 `bash fetch-vendor.sh` 下载依赖到 `vendor/`，再部署 |

---

## 2. 本地预览（部署前自测）

任选一种，需要 Python3 或 Node：

```bash
# 方式 A：脚本
bash serve.sh          # 默认 8080 端口
bash serve.sh 9000     # 指定端口

# 方式 B：Python
python3 -m http.server 8080

# 方式 C：Node（如装了 serve）
npx serve -l 8080 .
```

打开 `http://localhost:8080`，点「用演示户型开始」走完 8 步即验证通过。

> ⚠ 不要直接双击 `index.html`（`file://` 协议下浏览器会阻止跨文件脚本加载）。务必通过 HTTP 服务访问。

---

## 3. 方式一：Nginx 部署（推荐用于生产/内网）

### 3.1 前置

一台装有 Nginx 的 Linux 服务器（Ubuntu/CentOS 均可）。

```bash
# Ubuntu/Debian
sudo apt update && sudo apt install -y nginx
# CentOS/RHEL
sudo yum install -y nginx
```

### 3.2 上传站点文件

把整个 `ai-home-design-site/` 目录上传到服务器，例如 `/var/www/ai-home/`：

```bash
# 本地执行（scp 上传）
scp -r ai-home-design-site/* user@服务器IP:/var/www/ai-home/
```

### 3.3 （可选）离线依赖

若服务器不便访问外网，在站点目录执行：

```bash
cd /var/www/ai-home
bash fetch-vendor.sh        # 需服务器临时联网一次，或在能联网的机器下载后一并上传
```

### 3.4 配置 Nginx

把仓库里的 `nginx.conf` 内容写入站点配置，并把 `root` 指向你的目录：

```bash
sudo cp /var/www/ai-home/nginx.conf /etc/nginx/conf.d/ai-home.conf
# 编辑 root 路径
sudo sed -i 's#/usr/share/nginx/html#/var/www/ai-home#' /etc/nginx/conf.d/ai-home.conf
```

`nginx.conf` 已内置：SPA 路由 fallback、静态资源 7 天缓存、`index.html` 不缓存、gzip、基础安全头。

### 3.5 校验并启动

```bash
sudo nginx -t                 # 校验配置语法
sudo systemctl reload nginx   # 重载
sudo systemctl enable nginx   # 开机自启
```

访问 `http://服务器IP/` 即可。

### 3.6 绑定域名 + HTTPS（可选）

```bash
# 用 certbot 自动签发 Let's Encrypt 证书
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

修改 `server_name _;` 为 `server_name your-domain.com;` 后重载。

---

## 4. 方式二：Docker 部署（推荐用于快速交付/隔离）

### 4.1 前置

安装 Docker（含 Compose 插件）：

```bash
curl -fsSL https://get.docker.com | sh
```

### 4.2 （可选）离线依赖

如需镜像内自带依赖、彻底不依赖外网：

```bash
cd ai-home-design-site
bash fetch-vendor.sh    # 把 React/Three 下到 vendor/，会被打进镜像
```

### 4.3 构建并运行

**用 docker compose（最简）：**

```bash
cd ai-home-design-site
docker compose up -d --build
# 访问 http://localhost:8080
```

**或手动 docker 命令：**

```bash
docker build -t ai-home-design .
docker run -d --name ai-home-design -p 8080:80 --restart unless-stopped ai-home-design
```

### 4.4 常用运维

```bash
docker compose logs -f          # 看日志
docker compose ps               # 看状态
docker compose down             # 停止并移除
docker compose up -d --build    # 更新后重建
```

镜像基于 `nginx:1.27-alpine`，体积约 50MB，内置健康检查（`HEALTHCHECK`）。

### 4.5 改端口

编辑 `docker-compose.yml` 的 `ports`，如对外用 80：

```yaml
ports:
  - "80:80"
```

---

## 5. 更新发布

无论哪种方式，更新只需替换静态文件：

```bash
# Nginx：覆盖文件即可，无需重启（index.html 已设 no-cache）
scp -r ai-home-design-site/* user@服务器IP:/var/www/ai-home/

# Docker：重建镜像
docker compose up -d --build
```

> 若用户浏览器缓存了旧 `assets/js/*.js`，因配置了 7 天缓存可能未即时更新。生产环境建议给静态资源加版本号（如 `app.js?v=2.1.1`）或文件名 hash。

---

## 6. 排错

| 现象 | 原因 | 解决 |
|------|------|------|
| 页面停在「正在加载…」 | React/Three 未加载成功 | 检查外网能否访问 unpkg；或执行 `fetch-vendor.sh` 走本地依赖 |
| 弹出「资源加载失败」 | CDN 与本地依赖都不可用 | 联网执行 `fetch-vendor.sh` 后重新部署 |
| 双击打开白屏 | `file://` 协议限制 | 必须通过 HTTP 服务访问（见第 2 节） |
| 3D / 全景空白，其余正常 | Three.js 未加载 | 同第 1 行；其余功能不受影响（已做降级） |
| `nginx -t` 报错 | 配置路径或语法 | 检查 `root` 是否指向真实目录、是否有重复 server 块 |
| Docker `COPY vendor` 报错 | vendor 目录缺失 | 确认 `vendor/` 存在（含 README.txt 即可） |
| 404 刷新某页 | 服务器未配 SPA fallback | 本应用用 hash 路由通常无此问题；如改 history 路由，确认 `try_files ... /index.html` |

---

## 7. 安全与性能建议（生产）

- **HTTPS**：生产务必启用（第 3.6 节）。
- **离线依赖**：生产建议走本地 `vendor/`，避免 CDN 不稳定或被墙。
- **资源版本化**：更新前给 JS/CSS 加 hash 或 query 版本，避免缓存问题。
- **CDN/对象存储**：若并发高，可把 `assets/` 与 `vendor/` 放到对象存储 + CDN，`index.html` 留在源站。
- **访问日志**：Nginx 默认记录在 `/var/log/nginx/`，按需配置切割。

---

## 8. 接入真实后端（后续）

当前为纯前端 Mock。接入需求文档 §6 定义的 FastAPI 后端时：

1. 在 `assets/js/data.js` 中把引擎调用替换为 `fetch('/api/v1/...')`。
2. Nginx 增加反向代理：
   ```nginx
   location /api/ {
       proxy_pass http://后端地址:8000/api/;
       proxy_set_header Host $host;
       proxy_set_header X-Real-IP $remote_addr;
   }
   ```
3. AI 能力（效果图生成、换品）按文档接 Replicate / 自建推理服务。

至此前端静态站点保持不变，只新增后端容器即可演进为前后端分离架构。
