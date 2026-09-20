# TODO

画廊（`gallery.html`）的已知问题与待办。按优先级排列，每条尽量附实测数据，
免得下次还要重新调查一遍。

最后更新：2026-09-20

---

## P0 · CDN 依赖 jsDelivr，而这种用法被它的条款明文禁止

国内访客的加速完全依赖 `gcore.jsdelivr.net`（见 `script/gallery.js` 的
`GCORE_CDN_PREFIX`）。但 jsDelivr 的 Terms of Use（生效日 2026-05-30）第 6 节
*Prohibited Use* 里写着：

> Abusing the Service and its resources or using jsDelivr CDN as a general-purpose
> file or media hosting service. This includes, for example, in the case of jsDelivr CDN:
> **running an image hosting website and using jsDelivr CDN as a storage for all
> uploaded images**, hosting videos, file backups, or other files in large quantities.

本仓库把约 1 GB 壁纸放在 `gh-pages` 并经 jsDelivr 分发，基本就是它举的这个例子。
同节还写明，违规时可以 "withdraw or restrict the availability of all or any part of
jsDelivr CDN"。条款另有一条禁止 "sexually explicit" 内容——当前抓取用的是
`purity=100`（仅 SFW），但判定权在对方。

需要平衡看待的是，同节紧接着留了余地：

> We recognize that there are legitimate projects that consist of a large number of
> files, and these are not considered abuse. For example: icons packs, apps, or games
> with a large number of assets.

一个壁纸画廊能不能算进这个范畴，条款没给明确答案。所以这条应当读作"有实质风险、
值得提前准备退路"，而不是"确定会被封"。真正的判断依据是上面那句对图床的举例，
以及实际使用量（当前每目录 100 张、总量约 1 GB）。

**一旦被处置的后果**：国内访客失去 CDN 路径，回落到 GitHub Pages 直连。
实测差距（同一批 6 个文件、共 26.88 MB，各跑两轮）：

| 路径 | 耗时 | 速率 |
| --- | --- | --- |
| `gcore.jsdelivr.net` | 9.17s / 11.13s | 2.93 / 2.42 MB/s |
| `hfugghg.github.io` 直连 | 25.65s / 23.54s | 1.05 / 1.14 MB/s |

**可选方向**：

* 换用允许此类用途的 CDN 或对象存储（例如 Cloudflare R2 + 自有域名）
* 大幅缩小图片体积，让直连也可接受（见下一条，可与本条一并解决）
* 接受直连速度，干脆去掉 CDN 逻辑

---

## P1 · 图片体积过大

CDN 正常工作时首屏仍需约 10 秒，瓶颈是数据量而不是路径。

**实测**：

* 单张 **0.4 – 11.7 MB**，中位数约 1.65 MB（抽样 12 张竖屏）
* 普遍是 4K 原图：实测到 4000x2250、4192x2706、4096x2900
* `script/gallery.js` 里 `imagesPerLoad = 8`，一次滚动批次最坏几十 MB；
  背景轮播（`setupCarousel`）还会另外预加载一批

**根因**：`.github/workflows/update-wallpaper.yml` 抓的是 wallhaven API 返回的
`.path`，也就是原图。按 wallhaven API 文档，同一响应里还有 `thumbs` 字段提供
小尺寸变体，目前没用上。（调查时 wallhaven 正好宕机，未能实测确认该字段现值，
动手前建议先验一次。）

**障碍**：存量约 200 张（横竖各 100）已经是原图，需要批量替换。按当前每天一次、
每轮最多新增几张的节奏，靠自然轮换要几个月。

---

## P1 · gh-pages 体积已超过 GitHub Pages 上限

**站点的发布来源**（`gh api repos/Hfugghg/GitHub_Release_Download/pages` 实测）：

    "build_type": "legacy",
    "source": { "branch": "gh-pages", "path": "/" }

即站点直接由 `gh-pages` 分支根目录发布。Actions 里那个
`pages build and deployment` 是 GitHub 为这种 legacy 分支源执行的发布流程，
**不是另一个分支**。所以「发布出去的站点」就等于「`gh-pages` 分支的内容」。

**实测体积**：

| 对象 | 数值 |
| --- | --- |
| `assets/landscape` | 100 张图 + `index.json`/`meta.json`，604 MB |
| `assets/portrait` | 100 张图 + `index.json`/`meta.json`，431 MB |
| `gh-pages` 分支内容（＝发布出的站点） | **约 1.03 GB** |
| 仓库总体积（含全部历史） | **约 20.3 GB** |

**官方限制**（GitHub Pages limits）——原文是**两条不同的限制，针对不同对象**，
强度也不同，不要混为一谈：

| 官方原文 | 针对对象 | 本仓库 |
| --- | --- | --- |
| "Published GitHub Pages sites may be **no larger than 1 GB**."（硬性） | 发布出的站点，即 `gh-pages` 内容 | 约 1.03 GB，**已超** |
| "GitHub Pages source repositories have a **recommended limit** of 1 GB."（建议值） | 作为 Pages 源的整个仓库 | 约 20.3 GB，远超 |

同页另列：带宽软限制 100 GB/月、部署超过 10 分钟会超时、每小时 10 次构建
（用自定义 Actions 工作流发布的不受此限）。

超限后果的原文是："we may not be able to serve your site, or you may receive a
polite email from GitHub Support suggesting strategies for reducing your site's
impact on our servers, **including putting a third-party content distribution
network (CDN) in front of your site**"。注意 GitHub 自己就建议挂第三方 CDN——
画廊做的正是这件事，问题出在选的 jsDelivr 不允许这种用法（见 P0）。

**补充说明**：`update-wallpaper.yml` 的 FIFO 清理只从工作区删掉旧图，
**被删文件的 blob 仍留在 git 历史里**，所以仓库总体积只增不减——20.3 GB 就是
这么累积出来的。

**可选方向**：

* 缩小图片（与上一条同一方案，一次解决两个问题）
* 定期重建 `gh-pages` 历史（例如新开分支后强推，丢弃旧 blob）以回收空间
* 图片移出 git，改用外部存储

---

## 已知但暂不处理

* 抓取范围固定为 `topRange=6M`（最近六个月），想扩展图库需要调这个参数。
* `EXISTING_IDS=$(jq -s ... assets/*/meta.json)` 假定 meta.json 是合法 JSON。
  该文件由脚本自己写出，正常情况下不会坏；但若某次运行正好在写它的过程中被
  中断，可能留下半截 JSON，导致此后每一轮都卡在这一行。属低概率隐患。

---

## 已修复（备查）

* **2026-09-20**：wallhaven 返回 503 导致每次调度报红。根因不是站点故障本身，
  而是 `run` 步骤等价于 `bash -e`，`VAR=$(curl ... | jq ...)` 的退出码取管道
  最后一个命令，jq 解析 HTML 错误页失败即以 exit 5 终止脚本，写好的兜底判断
  永远执行不到。共修四处同源问题（首页请求、翻页请求、ratio 解析），另有：

  * 总页数小于目标页数时随机选页循环永远凑不齐（`LAST_PAGE=1` 会死循环）
  * 下载无校验，错误页会被存成 `.jpg` 且 id 写入 meta 后永不重试
  * 全部下载失败时仍重写 meta 并推送只有时间戳变化的空提交
  * 调度由每 12 小时改为每天一次（`0 0 * * *`）

* **2026-09-20**：CDN 从未被启用过——决定是否启用 CDN 的 IP 归属地检测原本只依赖
  `ipapi.co`，该接口已失效（返回 Cloudflare 403 挑战页），检测必然抛错，且失败
  结果还被写进 `sessionStorage` 把整个会话钉死在慢路径上。改为三个接口
  （`api.country.is` / `ipinfo.io` / `ipwho.is`）并发探测取最先成功者，加 3 秒超时
  中止，检测失败不再写缓存。
