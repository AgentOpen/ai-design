# AI 全屋装修设计平台 · 前端 Demo

按《AI 全屋装修设计平台需求文档 v2.1》构建的纯前端应用，跑通 8 步设计闭环。
**免构建，可一键部署到 GitHub Pages。**

## 🚀 一键部署到 GitHub Pages

### ⚠️ 部署前必做：启用 GitHub Pages

**这一步不做，Actions 会失败并报「Get Pages site failed: Not Found」。**

1. 仓库页面右上：`Settings` → 左侧菜单 `Pages`
2. **Source** 下拉框选 **`GitHub Actions`**（不是 "Deploy from a branch"）
3. 自动保存（没有保存按钮）

### 部署步骤

1. **创建仓库并推送代码**
   ```bash
   cd ai-home-design-site
   git init
   git add .
   git commit -m "initial commit"
   git branch -M main
   git remote add origin https://github.com/<你的用户名>/<仓库名>.git
   git push -u origin main
   ```

2. **启用 GitHub Pages**（见上方 ⚠️）

3. **等待 Actions 自动跑**（约 1-2 分钟）
   - `Actions` 标签页 → 看 `Deploy to GitHub Pages` 是否绿色 ✓
   - 成功后访问：`https://<你的用户名>.github.io/<仓库名>/`

之后每次 `git push` 都会自动重新部署。

### 如果 Actions 报错怎么办？

| 报错信息 | 原因 | 修复 |
|---------|------|------|
| `Get Pages site failed: Not Found` | Pages 未启用 | 按上面 ⚠️ 操作 → Re-run failed jobs |
| `Resource not accessible by integration` | workflow 权限不够 | Settings → Actions → General → Workflow permissions 选 "Read and write permissions" |
| `Pages site failed. Please verify enablement` | 同上 | 同上 |

修复后回到 Actions 页面，点失败的 run，右上角 **"Re-run all jobs"** 即可。

## 📂 项目结构

```
.
├── .github/workflows/deploy.yml   GitHub Actions 部署配置
├── .nojekyll                      禁用 Jekyll 处理（必需）
├── .gitignore
├── index.html                     入口（含依赖加载链 + 错误诊断）
├── assets/
│   ├── css/styles.css             浅色 CAD 风格设计系统
│   └── js/
│       ├── data.js                Mock 数据 + 布局/报价引擎 + 23 件产品库
│       ├── canvas.js              2D CAD 渲染器（门、窗、墙、家具、拖拽）
│       ├── scene3d.js             Three.js 3D 场景（门窗洞、多楼层堆叠）
│       └── app.js                 React 应用（8 步流程 + 引导 + 编辑 + 全景）
├── vendor/                        本地依赖（可选，离线兜底）
├── fetch-vendor.sh                离线依赖下载脚本
├── nginx.conf, Dockerfile, ...    其它部署方式（见 DEPLOYMENT.md）
└── README.md
```

## 🖥 本地预览（开发用）

```bash
# 方式 A：用项目自带脚本
bash serve.sh                # → http://localhost:8080

# 方式 B：Python
python3 -m http.server 8080

# 方式 C：Node
npx serve -l 8080 .
```

> ⚠️ **不要双击 index.html**：浏览器在 `file://` 协议下会阻止脚本加载。
> 新版会自动检测并显示提示，但走 HTTP 才能正常运行。

## ✨ 功能亮点

| 步骤 | 内容 |
|------|------|
| 0 需求问询 | 预算/风格图片选择/人口/功能 → 需求画像 |
| 1 户型上传 | 2D 户型、比例标定、楼层属性（**先导入 CAD 才能下一步**） |
| 2 3D 墙体 | Three.js 实时 3D，**门窗洞自动挖切**，多楼层堆叠 |
| 3 AI 布局 | 布局引擎生成 2 套方案 + 编辑布局（**素材库添加家具**） |
| 4 手动编辑 | **鼠标拖动家具** / 旋转 / 删除 / 添加 |
| 5 效果图 | 每个房间一张真实参考效果图（Unsplash 公开图库） |
| 5.5 全景 | 720° 全景查看器（Three.js 实时渲染） |
| 6 换品 | 效果图热区点击换 SKU，2D/3D/报价联动 |
| 7 报价 | 报价引擎实时计算，多楼层分组，可导出 CSV |

## 🛠 技术栈

- **React 18** UMD（CDN 加载，自带多源回退：unpkg → jsdelivr → cdnjs）
- **Three.js 0.160**（3D 墙体 + 720° 全景）
- **纯 React.createElement**：无需 Babel/构建，浏览器直跑
- **2D 渲染**：原生 Canvas API（性能高，可鼠标拖拽家具）
- **路由**：hash 路由（兼容 GitHub Pages 子路径）
- **所有 AI 能力**：前端 Mock；接入真实后端见 DEPLOYMENT.md

## ❓ 故障排查

打不开站点？新版 index.html 会**直接在屏幕上显示**具体哪一步出错。常见情况：

| 屏幕提示 | 原因 | 修复 |
|---------|------|------|
| 「请通过 HTTP 服务访问」 | 双击了 index.html | 用 `bash serve.sh` 或 `python3 -m http.server` |
| 「加载失败」+ 日志全是 ✗ | CDN 被墙 | 运行 `bash fetch-vendor.sh` 把依赖放到 `vendor/` 后提交 |
| 「应用未正确渲染」 | 脚本错误 | 打开 F12 控制台看红色报错 |
| 完全白屏 | css 也没加载 | 检查 GitHub Pages 是否已启用，访问 URL 是否正确 |

## 🌐 其它部署方式

详见 [DEPLOYMENT.md](./DEPLOYMENT.md)，覆盖 Nginx、Docker、HTTPS、内网部署、CDN 故障排查。

## 📷 图片来源

风格图、效果图、产品图均通过 URL 引用自 **Unsplash 公开图库**。
如所在网络无法访问 Unsplash，可：
1. 把图片下到 `assets/img/`，改 `data.js` 里的 URL
2. 或接入企业自有产品图 CDN

## 📝 演示边界

- 效果图为同风格示意（真实图库），非用户户型真渲染——生产版需接 AI 生图（SDXL）
- CAD 导入按钮为 Mock——真解析 DXF/图片需后端 OpenCV/AI
- 拖动家具不做碰撞检测——演示重点是交互
