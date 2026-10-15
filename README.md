# jhn233 个人主页

个人主页站点，部署于 GitHub Pages，绑定域名 `jhn233.dpdns.org`。

## 本地预览

直接用浏览器打开 `index.html` 即可预览。

## 如何替换内容

页面中所有用 `［ ］` 包裹的文字都是占位内容，用真实信息替换即可：

- 姓名、一句话介绍、自我介绍 → `index.html` 的 hero 与「关于我」区块
- 基本信息（坐标 / 学校 / 专业 / 邮箱）→「关于我」右侧列表
- 经历时间轴 →「经历」区块的 4 个示例条目
- 项目卡片 →「项目」区块的 3 张卡片
- 技能标签 →「技能与兴趣」区块
- 邮箱、GitHub 链接 →「联系我」区块（`mailto:` 与 `https://github.com/` 两处）

## 部署到 GitHub Pages

1. 在 GitHub 新建仓库（公开仓库），把本目录下的 `index.html`、`README.md`、`CNAME` 上传到仓库根目录。
2. 仓库 **Settings → Pages**，Source 选择 **Deploy from a branch**，分支选 `main`，目录选 `/ (root)`，保存。
3. 等待几分钟，站点会先以 `https://<你的用户名>.github.io/<仓库名>/` 上线。
4. 绑定自定义域名：**Settings → Pages → Custom domain** 填入 `jhn233.dpdns.org` 并保存。
5. 在域名服务商处为 `jhn233.dpdns.org` 添加一条 **CNAME** 记录，指向 `<你的用户名>.github.io`。

> 注意：`CNAME` 文件已包含 `jhn233.dpdns.org`。如果该域名由 DDNS 服务商托管且不支持自定义 DNS 解析，则无法绑定到 GitHub Pages，站点将以默认的 `<用户名>.github.io` 地址访问。
