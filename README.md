# GitHub Release Downloader | GitHub 最新 Release 下载器

一个简洁的网页工具，用于快速查找、浏览和下载任何 GitHub 公开仓库的最新或历史 Release 版本。

## ✨ 功能

* **常用仓库预设**：为常用项目预设了快捷按钮，一键加载最新版本。
* **自定义仓库查询**：支持输入 `用户名/仓库名` 来获取任何公开仓库的 Release。
* **历史版本浏览**：轻松查看并切换仓库的所有历史发布版本。
* **清晰的发布信息**：完整展示版本号、发布时间以及由 Markdown 解析的官方更新日志。
* **直观的下载列表**：清晰列出每个 Release 版本的所有可下载文件及其大小、更新时间和下载次数。
* **文件筛选与搜索**：内置搜索框，帮助您在众多文件中快速定位所需资源。

## 🚀 如何使用

1.  **选择仓库**
    * **预设仓库**：直接点击页面上预设的按钮，如 “禁漫”、“EhViewer” 等，即可加载其最新 Release。
    * **自定义仓库**：在输入框中输入目标仓库，格式为 `用户名/仓库名` (例如: `venera-app/venera`)，然后点击“获取”。

2.  **浏览 Release**
    * 默认会显示**最新**的 Release 版本。
    * 点击“查看历史版本”按钮，可以从下拉列表中选择并加载任一历史版本。

3.  **下载文件**
    * 在文件列表中找到您需要的文件。
    * 使用列表上方的搜索框可以快速筛选文件。
    * 点击“下载”按钮即可从 GitHub 服务器直接下载文件。

## 🛠️ 技术栈

* **前端**: HTML5, CSS3, JavaScript (ES6)
* **API**: GitHub REST API
* **库**: [Marked.js](https://github.com/markedjs/marked) (用于解析 Release Notes)

## 💻 本地开发

如果你希望克隆本项目进行二次开发或贡献代码，请使用以下命令。
**⚠️ 重要提示**：本仓库的 `gh-pages` 分支用于存放部署后的网页和图片资源，体积较大。开发时仅需要 `main` 分支的源代码即可。
请使用下面的命令只克隆 `main` 分支，以避免下载不必要的数据：

```bash
git clone --branch main [https://github.com/Hfugghg/GitHub_Release_Download.git](https://github.com/Hfugghg/GitHub_Release_Download.git)
```

## 💬 交流与反馈

欢迎加入我们的 QQ 交流群，反馈问题或提出建议。

<a href="https://qm.qq.com/cgi-bin/qm/qr?k=8RSIIQ7Nb5x9ZsAX_r5fd6qNVYC3RkEZ&jump_from=webapi&authKey=n4nN5cC6tJ7PBr1vVQG4XZon7dynMUyhWfbVAcCu2slbUQv+QUnjmaoNIvRaaqaJ" target="_blank">
  <img src="https://img.shields.io/badge/QQ%E7%BE%A4-点击加入-blue" alt="加入QQ群">
</a>

你也可以通过 [GitHub Issues](https://github.com/Hfugghg/GitHub_Release_Download/issues) 提交 Bug 或功能请求。

## ⚠️ 注意事项

* 本工具仅为方便下载而制作，所有文件均直接从 GitHub 的官方服务器下载。
* 请确保您下载的文件来自可信的开发者和仓库。
* 本工具的作者不对您下载的任何文件及其可能产生的后果负责。