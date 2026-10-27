# 项目部署约定

用户说“部署”“部署最新版本”“更新服务器”时，在当前项目执行 `powershell -ExecutionPolicy Bypass -File scripts/deploy.ps1`，然后验证 HTTPS 页面、无需登录访问及 `/api/health`。

- SSH：`pingpop-prod`（62.234.114.47，ubuntu），使用本机已有 SSH 密钥。
- 网站：`https://lexpilot.mizki.online`。
- 细节见 `docs/服务器部署.md`。
- 不输出密钥或密码；不上传本地数据库、材料或 node_modules。
- 线上配置和数据存放于 `/opt/qingdun/shared`，更新时保留。
- 不修改该服务器上其他项目的服务或端口。

- 用户要求网站公开访问，不添加全站 Basic Auth 弹窗；保留接口限速与来源校验。
