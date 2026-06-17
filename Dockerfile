# =====================================================================
# Dockerfile — 纯静态站点，基于 nginx-alpine
# 构建: docker build -t ai-home-design .
# 运行: docker run -d -p 8080:80 ai-home-design
# =====================================================================
FROM nginx:1.27-alpine

# 拷贝站点文件
COPY index.html /usr/share/nginx/html/index.html
COPY assets     /usr/share/nginx/html/assets
COPY vendor     /usr/share/nginx/html/vendor

# 自定义 nginx 配置
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s \
  CMD wget -q --spider http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
