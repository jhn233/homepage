# jhn233 个人主页

个人主页与实验解析网页版，部署于 GitHub Pages。

- 主页：https://jhn233.github.io/homepage/
- 实验解析：https://jhn233.github.io/homepage/experimentlab/

## 本地预览

在仓库根目录运行 `python3 -m http.server 5188`，打开 `http://localhost:5188/`。实验解析使用 JavaScript 模块，需要通过 HTTP 服务预览。

## 实验解析 ExperimentLab

主页「项目」区提供实验解析入口，网页文件位于 `experimentlab/`，无需构建或后端。

- CSV / TXT / TSV 导入、粘贴和手动编辑，可选择 X / Y 列。
- 线性、2–5 次多项式、指数、对数、幂函数、倒数共六种模型，以及九组示例数据。
- 异常值标记、SVG 图表下载、CSV 导出、完整 HTML 报告与浏览器打印保存 PDF。
- 数据与计算均在当前浏览器中处理，localStorage 自动保存，未加入数据上传接口。重要记录请及时导出 CSV。
- 从 Sites 地址迁移时，请先导出 CSV，再导入新地址。不同网站来源下的本地记录相互隔离。

## 发布与维护

GitHub 仓库 Settings → Pages 已设置为 Deploy from a branch，分支 `main`、目录 `/ (root)`。更新此分支中的主页或 `experimentlab/` 文件后会自动发布。主页中用「［ ］」标记的个人信息与其他项目仍为待填写的占位内容。

原配置中的自定义域名 `jhn233.dpdns.org` 存在 DNS / HTTPS 配置问题，因此目前使用 GitHub 默认 HTTPS 地址。若以后需要重新绑定，请先按 GitHub Pages 文档配置域名 DNS，再到 Pages 设置中保存 Custom domain。
