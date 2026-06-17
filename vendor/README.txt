此目录存放本地化的前端依赖（React、ReactDOM、Three.js）。

在线模式：可留空，index.html 会自动从 CDN 加载。
离线模式：在项目根目录执行  bash fetch-vendor.sh  下载以下文件到本目录：
  - react.production.min.js
  - react-dom.production.min.js
  - three.min.js
之后即可完全离线运行（Docker / 内网 Nginx 推荐）。
