(function () {
    // --- 配置 ---
    const predefinedRepos = [
        {name: '禁漫', repo: 'hect0x7/JMComic-APK'},
        {name: 'EhViewer', repo: 'xiaojieonly/Ehviewer_CN_SXJ'},
        {name: 'Clash_PC端', repo: 'clash-verge-rev/clash-verge-rev'},
        {name: 'Clash_Android端', repo: 'MetaCubeX/ClashMetaForAndroid'},
        {name: '哔咔 (PC端)', repo: 'tonquer/picacg-qt'},
        {name: '禁漫 (PC端)', repo: 'tonquer/JMComic-qt'},
        {name: 'venera(整合多个漫画平台)', repo: 'venera-app/venera'}
    ];

    // --- DOM 元素 ---
    const predefinedReposContainer = document.getElementById('predefinedRepos'); // 预定义仓库容器
    const customRepoInput = document.getElementById('customRepoInput'); // 自定义仓库输入框
    const repoDropdown = document.getElementById('repoDropdown'); // 自定义仓库下拉菜单
    const fetchCustomRepoBtn = document.getElementById('fetchCustomRepoBtn'); // 获取自定义仓库按钮
    const spinner = document.getElementById('spinner'); // 加载指示器（旋转动画）
    const statusTitle = document.getElementById('statusTitle'); // 状态标题
    const statusText = document.getElementById('statusText'); // 状态文本
    const releaseInfoContainer = document.getElementById('releaseInfo'); // 发布信息容器
    const releaseBody = document.getElementById('releaseBody'); // 发布正文
    const downloadAssetsContainer = document.getElementById('downloadAssets'); // 下载资源容器
    const assetList = document.getElementById('assetList'); // 资源列表
    const historyBtn = document.getElementById('historyBtn'); // 历史版本按钮
    const historyContainer = document.getElementById('historyContainer'); // 历史版本容器
    const releaseSelector = document.getElementById('releaseSelector'); // 历史版本选择器
    const viewOnGithubBtn = document.getElementById('viewOnGithubBtn'); // 打开GitHub官方列表按钮
    let timeoutId;
    let errorDisplayed = false; // 控制错误信息是否已显示
    let selectedIndex = -1; // 记录选中项的索引

    let currentRepo = null; // 用于跟踪当前激活的仓库按钮
    let currentRepoInfo = { owner: null, repo: null }; // 用于存储当前仓库的所有者和名称

    // --- 辅助函数 ---

    // 将字节数格式化为可读的字符串（KB、MB、GB）
    function formatBytes(bytes, decimals = 2) {
        if (bytes === 0) return '0 字节';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['字节', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }

    // 将 ISO 日期字符串格式化为 YYYY-MM-DD HH:MM
    function formatDate(dateString) {
        if (!dateString) return 'N/A';
        try {
            const date = new Date(dateString);
            // 调整时区偏移以显示本地时间
            // const offset = date.getTimezoneOffset() * 60000; // 偏移量，单位为毫秒
            // const localDate = new Date(date.getTime() - offset);
            // return localDate.toISOString().slice(0, 16).replace('T', ' ');
            // 简化的本地时间格式化：
            return date.toLocaleString('sv-SE', { // 使用提供 YYYY-MM-DD HH:MM 格式的区域设置
                year: 'numeric', month: '2-digit', day: '2-digit',
                hour: '2-digit', minute: '2-digit', hour12: false
            });
        } catch (e) {
            return dateString; // 如果解析失败，则返回原始字符串
        }
    }

    function markdownToHtml(md, repoIdentifier) {
        if (!md) return '';

        // 转换图片链接
        const convertImageLinks = (text, repo) => {
            return text.replace(/!\[(.*?)\]\(\.\/docs\/(.*?)\)/g, (match, alt, src) => {
                const baseUrl = `https://raw.githubusercontent.com/${repo}/dev/docs/`;
                return `<img src="${baseUrl}${src}" alt="${alt}">`;
            });
        };

        let html = marked.parse(md);
        // 直接在 marked.parse 结果上进行替换
        html = html.replace(/<img src="\.\/docs\/(.*?)" alt="(.*?)">/g, (match, src, alt) => {
            const baseUrl = `https://raw.githubusercontent.com/${repoIdentifier}/dev/docs/`;
            return `<img src="${baseUrl}${src}" alt="${alt}">`;
        });

        return html;
    }


    // 解析 "owner/repo" 字符串
    function parseRepoString(repoString) {
        if (!repoString || !repoString.includes('/')) {
            return null;
        }
        const parts = repoString.split('/');
        if (parts.length !== 2 || !parts[0].trim() || !parts[1].trim()) {
            return null;
        }
        return {owner: parts[0].trim(), repo: parts[1].trim()};
    }

    // --- UI 更新函数 ---

    function showLoading(message = '正在获取信息...', keepReleaseInfoVisible = false) {
        spinner.style.display = 'block';
        statusTitle.textContent = message;
        statusText.textContent = '';
        statusText.className = 'status-text'; // 重置错误类
        if (!keepReleaseInfoVisible) {
            releaseInfoContainer.style.display = 'none';
        }
        downloadAssetsContainer.style.display = 'none';
        assetList.innerHTML = ''; // 清除之前的资源
        releaseBody.innerHTML = ''; // 清除之前的说明
    }

    function showError(title, message) {
        spinner.style.display = 'none';
        statusTitle.textContent = `⚠️ ${title}`;
        statusText.textContent = message;
        statusText.className = 'status-text error'; // 添加错误类
        releaseInfoContainer.style.display = 'none';
        downloadAssetsContainer.style.display = 'none';
        historyBtn.style.display = 'none';
        historyContainer.style.display = 'none';
        viewOnGithubBtn.style.display = 'none';
    }

    function showSuccess(repoIdentifier, data) {
        spinner.style.display = 'none'; // 隐藏加载指示器
        statusTitle.textContent = `✅ ${repoIdentifier} - ${data.tag_name}`; // 设置状态标题，显示仓库标识和标签名称
        statusText.textContent = `版本发布于: ${formatDate(data.published_at)}`; // 设置状态文本，显示最新版本发布日期
        statusText.className = 'status-text'; // 设置状态文本的CSS类名

        // 设置历史版本按钮
        historyBtn.style.display = 'inline-block';
        historyContainer.style.display = 'none';

        // 设置 GitHub 官方页面链接
        const releasesUrl = `https://github.com/${repoIdentifier}/releases`;
        viewOnGithubBtn.href = releasesUrl;
        viewOnGithubBtn.style.display = 'inline-block';

        if (data.body) {
            releaseBody.innerHTML = markdownToHtml(data.body, repoIdentifier);
            releaseInfoContainer.style.display = 'block';
        } else {
            releaseInfoContainer.style.display = 'none';
        }


        // 显示下载资源
        assetList.innerHTML = ''; // 清空之前的资源列表
        if (data.assets && data.assets.length > 0) {
            data.assets.forEach(asset => {
                const assetItem = document.createElement('div'); // 创建资源项的div
                assetItem.className = 'asset-item'; // 设置资源项的CSS类名

                const infoDiv = document.createElement('div'); // 创建资源信息的div
                infoDiv.className = 'asset-info'; // 设置资源信息的CSS类名

                const nameP = document.createElement('p'); // 创建资源名称的段落
                nameP.className = 'asset-name'; // 设置资源名称的CSS类名
                nameP.textContent = asset.name; // 设置资源名称文本

                const detailsP = document.createElement('p'); // 创建资源详细信息的段落
                detailsP.className = 'asset-details'; // 设置资源详细信息的CSS类名
                detailsP.innerHTML = `
                <span>${formatBytes(asset.size)}</span> |
                <span>更新于: ${formatDate(asset.updated_at)}</span> |
                <span>下载次数: ${asset.download_count}</span>
            `; // 设置资源详细信息文本

                infoDiv.appendChild(nameP); // 将资源名称添加到信息div
                infoDiv.appendChild(detailsP); // 将资源详细信息添加到信息div

                const downloadLink = document.createElement('a'); // 创建下载链接
                downloadLink.href = asset.browser_download_url; // 设置下载链接的href
                downloadLink.className = 'btn download-btn'; // 设置下载链接的CSS类名
                downloadLink.textContent = '下载'; // 设置下载链接的文本
                // downloadLink.download = asset.name; // 可选：建议文件名（通常由浏览器处理）
                downloadLink.target = '_blank'; // 在新标签页打开下载/触发下载
                downloadLink.rel = 'noopener noreferrer'; // 安全链接属性

                assetItem.appendChild(infoDiv); // 将资源信息添加到资源项
                assetItem.appendChild(downloadLink); // 将下载链接添加到资源项
                assetList.appendChild(assetItem); // 将资源项添加到资源列表
            });
            downloadAssetsContainer.style.display = 'block'; // 显示下载资源容器
        } else {
            assetList.innerHTML = '<p style="text-align: center; color: var(--dark-gray);">此版本未提供可下载文件。</p>'; // 显示没有可下载文件的消息
            downloadAssetsContainer.style.display = 'block'; // 即使为空也显示容器
        }
    }

    // --- 核心逻辑 ---

    function fetchLatestRelease(owner, repoName) {
        const repoIdentifier = `${owner}/${repoName}`;
        currentRepoInfo = { owner: owner, repo: repoName };
        showLoading(`正在获取 ${repoIdentifier} 的最新版本...`);

        const apiUrl = `https://api.github.com/repos/${owner}/${repoName}/releases/latest`;

        fetch(apiUrl)
            .then(response => {
                if (response.status === 404) {
                    throw new Error(`仓库 "${repoIdentifier}" 未找到或没有发布版本。`);
                }
                if (response.status === 403) {
                    throw new Error('GitHub API 访问频率限制。请稍后再试。');
                }
                if (!response.ok) {
                    throw new Error(`网络响应错误: ${response.status} ${response.statusText}`);
                }
                return response.json();
            })
            .then(data => {
                console.log('API 响应:', data);
                if (!data.tag_name) {
                    throw new Error('获取版本信息失败，未找到 tag_name。');
                }
                showSuccess(repoIdentifier, data);
            })
            .catch(error => {
                console.error('Fetch 错误:', error);
                showError('获取失败', error.message);
            });
    }

    function fetchReleaseHistory(owner, repo) {
        const repoIdentifier = `${owner}/${repo}`;
        showLoading(`正在获取 ${repoIdentifier} 的历史版本...`, true);

        const apiUrl = `https://api.github.com/repos/${owner}/${repo}/releases`;

        fetch(apiUrl)
            .then(response => {
                if (response.status === 404) {
                    throw new Error(`仓库 "${repoIdentifier}" 未找到或没有发布版本。`);
                }
                if (response.status === 403) {
                    throw new Error('GitHub API 访问频率限制。请稍后再试。');
                }
                if (!response.ok) {
                    throw new Error(`网络响应错误: ${response.status} ${response.statusText}`);
                }
                return response.json();
            })
            .then(releases => {
                if (releases && releases.length > 0) {
                    populateReleaseHistory(releases);
                } else {
                    showError('未找到历史版本', '该仓库没有发布任何版本。');
                }
            })
            .catch(error => {
                console.error('Fetch History 错误:', error);
                showError('获取历史版本失败', error.message);
            });
    }

    function populateReleaseHistory(releases) {
        releaseSelector.innerHTML = ''; // 清空之前的选项
        historyContainer.style.display = 'block';

        const defaultOption = document.createElement('option');
        defaultOption.textContent = '--- 请选择一个历史版本 ---';
        defaultOption.disabled = true;
        defaultOption.selected = true;
        releaseSelector.appendChild(defaultOption);

        releases.forEach(release => {
            const option = document.createElement('option');
            option.value = release.tag_name;
            option.textContent = `${release.tag_name} - 发布于: ${formatDate(release.published_at)}`;
            releaseSelector.appendChild(option);
        });

        spinner.style.display = 'none';
        releaseInfoContainer.style.display = 'block';
        downloadAssetsContainer.style.display = 'none';
        releaseBody.innerHTML = ''; // 清空发布说明
        statusTitle.textContent = `✅ 找到 ${releases.length} 个历史版本`;
        statusText.textContent = '请从下拉列表中选择一个版本进行查看。';
    }

    function fetchReleaseByTag(owner, repo, tagName) {
        const repoIdentifier = `${owner}/${repo}`;
        showLoading(`正在获取版本 ${tagName}...`, true);

        const apiUrl = `https://api.github.com/repos/${owner}/${repo}/releases/tags/${tagName}`;

        fetch(apiUrl)
            .then(response => {
                if (response.status === 404) {
                    throw new Error(`版本 "${tagName}" 未找到。`);
                }
                if (response.status === 403) {
                    throw new Error('GitHub API 访问频率限制。请稍后再试。');
                }
                if (!response.ok) {
                    throw new Error(`网络响应错误: ${response.status} ${response.statusText}`);
                }
                return response.json();
            })
            .then(data => {
                showSuccess(repoIdentifier, data);
                // 修改说明:
                // 此处原有的 historyContainer.style.display = 'block'; 和 releaseSelector.value = tagName; 已被移除。
                // showSuccess 函数会自动隐藏历史版本选择框，从而实现您的需求。
            })
            .catch(error => {
                console.error('Fetch by Tag 错误:', error);
                showError(`获取版本 ${tagName} 失败`, error.message);
            });
    }

    // --- 事件监听器 ---

    // 获取预定义仓库
    function handlePredefinedRepoClick(event) {
        const button = event.target; // 获取触发事件的按钮
        const repoString = button.dataset.repo; // 从按钮的 data-repo 属性中获取仓库字符串
        const repoData = parseRepoString(repoString); // 解析仓库字符串，获取仓库所有者和仓库名称

        // 停用之前激活的按钮
        if (currentRepo) {
            currentRepo.classList.remove('active'); // 移除之前激活按钮的 'active' 类
        }
        // 激活当前按钮
        button.classList.add('active'); // 给当前按钮添加 'active' 类
        currentRepo = button; // 更新当前激活的按钮

        if (repoData) {
            fetchLatestRelease(repoData.owner, repoData.repo); // 获取最新发布版本
            customRepoInput.value = repoString; // 同时更新输入框的值
        }
    }

    // 获取自定义仓库
    function handleCustomRepoFetch() {
        const repoString = customRepoInput.value;
        const repoData = parseRepoString(repoString);

        if (currentRepo) {
            currentRepo.classList.remove('active');
            currentRepo = null;
        }

        if (repoData) {
            fetchLatestRelease(repoData.owner, repoData.repo);
            // 添加这一行来隐藏下拉列表
            repoDropdown.style.display = 'none';
        } else {
            showError('输入无效', '请输入有效的 "owner/repo" 格式，例如 "octocat/Spoon-Knife"。');
        }
    }

    // 监听自定义仓库输入框输入
    customRepoInput.addEventListener('input', function () {
        const inputValue = this.value;
        clearTimeout(timeoutId); // 清除之前的定时器
        if (inputValue.includes('/')) {
            // 获取仓库列表（无需停顿）
            const owner = inputValue.split('/')[0];
            fetch(`https://api.github.com/users/${owner}/repos`)
                .then(response => {
                    if (!response.ok) {
                        throw new Error('获取仓库列表失败');
                    }
                    return response.json();
                })
                .then(data => {
                    displayRepos(data);
                })
                .catch(error => {
                    displayError(error.message);
                });
        } else {
            // 搜索用户（需要停顿）
            timeoutId = setTimeout(() => {
                fetch(`https://api.github.com/search/users?q=${inputValue}`)
                    .then(response => {
                        if (!response.ok) {
                            throw new Error('搜索用户失败');
                        }
                        return response.json();
                    })
                    .then(data => {
                        displayUsers(data.items);
                    })
                    .catch(error => {
                        displayError(error.message);
                    });
            }, 2500); // 停顿 2.5 秒
        }
    });

    // 监听自定义仓库下拉列表选择
    customRepoInput.addEventListener('keydown', function (event) {
        const items = repoDropdown.querySelectorAll('div');
        if (event.key === 'ArrowDown') {
            event.preventDefault(); // 阻止默认的滚动行为
            selectedIndex = Math.min(selectedIndex + 1, items.length - 1);
        } else if (event.key === 'ArrowUp') {
            event.preventDefault(); // 阻止默认的滚动行为
            selectedIndex = Math.max(selectedIndex - 1, -1);
        } else if (event.key === 'Enter' && selectedIndex !== -1) {
            event.preventDefault(); // 阻止默认的表单提交
            items[selectedIndex].click(); // 触发选中项的点击事件
            selectedIndex = -1; // 重置选中索引
            return;
        } else {
            selectedIndex = -1;
        }
        updateSelection(items);
    });

    // 监听自定义仓库下拉列表点击
    function updateSelection(items) {
        items.forEach((item, index) => {
            if (index === selectedIndex) {
                item.style.backgroundColor = '#e0e0e0'; // 设置选中项的背景色
                item.scrollIntoView({block: 'nearest'}); // 将选中项滚动到可见区域
            } else {
                item.style.backgroundColor = ''; // 移除其他项的背景色
            }
        });
    }

    // 显示用户列表
    function displayUsers(users) {
        repoDropdown.innerHTML = '';
        if (users && users.length > 0) {
            users.forEach(user => {
                const userItem = document.createElement('div');
                userItem.innerHTML = `<img src="${user.avatar_url}" width="20" height="20"> ${user.login}`;
                userItem.style.padding = '5px';
                userItem.style.cursor = 'pointer';
                userItem.addEventListener('click', function () {
                    customRepoInput.value = user.login;
                    repoDropdown.style.display = 'block';
                });
                repoDropdown.appendChild(userItem);
            });
            repoDropdown.style.display = 'block';
            errorDisplayed = false; // 重置错误显示标志
        } else {
            repoDropdown.style.display = 'none';
        }
    }

    // 显示仓库列表
    function displayRepos(repos) {
        const filter = customRepoInput.value.split('/')[1]; // 获取用户输入的过滤条件
        repoDropdown.innerHTML = '';
        if (repos && repos.length > 0) {
            const filteredRepos = repos.filter(repo => {
                return repo.name.toLowerCase().startsWith(filter.toLowerCase()); // 过滤仓库名称（不区分大小写）
            });
            if (filteredRepos.length > 0) {
                filteredRepos.forEach(repo => {
                    const repoItem = document.createElement('div');
                    repoItem.textContent = repo.full_name;
                    repoItem.style.padding = '5px';
                    repoItem.style.cursor = 'pointer';
                    repoItem.addEventListener('click', function () {
                        customRepoInput.value = this.textContent;
                        repoDropdown.style.display = 'none';
                        handleCustomRepoFetch();
                    });
                    repoDropdown.appendChild(repoItem);
                });
                repoDropdown.style.display = 'block';
                errorDisplayed = false; // 重置错误显示标志
            } else {
                repoDropdown.style.display = 'none';
            }
        } else {
            repoDropdown.style.display = 'none';
        }
    }

    // 显示错误信息
    function displayError(errorMessage) {
        if (!errorDisplayed) {
            repoDropdown.innerHTML = `<div style="color: red;">${errorMessage}</div>`;
            repoDropdown.style.display = 'block';
            errorDisplayed = true; // 设置错误显示标志
            setTimeout(() => {
                repoDropdown.style.display = 'none'; // 3秒后隐藏错误信息
                errorDisplayed = false;
            }, 3000)
        }
    }

    // 监听自定义仓库按钮点击
    fetchCustomRepoBtn.addEventListener('click', handleCustomRepoFetch);
    customRepoInput.addEventListener('keypress', function (event) {
        if (event.key === 'Enter') {
            if (customRepoInput.value.includes('/')) {
                handleCustomRepoFetch();
            } else {
                //当悬浮框显示时，点击回车，选中第一个选项，并填充。
                if (repoDropdown.style.display === "block") {
                    let firstChild = repoDropdown.firstChild;
                    if (firstChild) {
                        customRepoInput.value = firstChild.textContent;
                        repoDropdown.style.display = "none";
                        handleCustomRepoFetch();
                    }
                }
            }
        }
    });

    historyBtn.addEventListener('click', () => {
        if (currentRepoInfo.owner && currentRepoInfo.repo) {
            fetchReleaseHistory(currentRepoInfo.owner, currentRepoInfo.repo);
        } else {
            showError('错误', '无法确定当前仓库。');
        }
    });

    releaseSelector.addEventListener('change', (event) => {
        const selectedTag = event.target.value;
        if (selectedTag && currentRepoInfo.owner && currentRepoInfo.repo) {
            fetchReleaseByTag(currentRepoInfo.owner, currentRepoInfo.repo, selectedTag);
        }
    });

    // 在页面加载完成后为 QQ 群按钮添加点击事件
    document.addEventListener("DOMContentLoaded", function() {
        const qqGroupBtn = document.getElementById("qqGroupBtn");
        if (!qqGroupBtn) return;

        // --- 1. 配置中心：将链接和参数集中管理 ---
        const qqLinkConfig = {
            groupUin: "895166848",
            // 【重要】PC链接，保留了您提供的authKey，但请阅读下方关于它的说明
            pc: "https://qm.qq.com/cgi-bin/qm/qr?k=8RSIIQ7Nb5x9ZsAX_r5fd6qNVYC3RkEZ&jump_from=webapi&authKey=n4nN5cC6tJ7PBr1vVQG4XZon7dynMUyhWfbVAcCu2slbUQv+QUnjmaoNIvRaaqaJ",
            // 移动端scheme，使用模板字符串动态生成
            mobileScheme: `mqqapi://card/show_pslcard?src_type=app&version=1&uin=895166848&card_type=group&source=webapi`,
            // 失败后备的下载链接
            appstore: "itms-apps://itunes.apple.com/cn/app/qq-2011/id444934666?mt=8",
            androidDownload: "//im.qq.com" // 通用下载页
        };

        // --- 2. 环境侦测：精确识别方法 ---
        function getEnvironment() {
            const ua = navigator.userAgent;
            if (/MicroMessenger/i.test(ua)) {
                return 'wechat';
            }
            if (/Android/i.test(ua)) {
                return 'android';
            }
            if (/iPhone|iPad|iPod/i.test(ua)) {
                return 'ios';
            }
            return 'pc';
        }

        // --- 3. 核心跳转逻辑：综合多种方案 ---
        qqGroupBtn.addEventListener("click", function() {
            const env = getEnvironment();

            switch (env) {
                case 'wechat':
                    // 在微信中，不尝试跳转，而是弹出提示层
                    const overlay = document.getElementById("wechatOverlay");
                    if (overlay) {
                        overlay.style.display = "block";
                        overlay.onclick = function() { this.style.display = "none"; };
                    }
                    break;

                case 'android':
                case 'ios':
                    // “超时判断”后备方案
                    const downloadUrl = (env === 'ios') ? qqLinkConfig.appstore : qqLinkConfig.androidDownload;

                    // 1. 设置一个后备定时器，并保存其ID
                    const timer = setTimeout(() => {
                        // 这个定时器只有在跳转失败、用户仍停留在页面时才会执行
                        window.location.href = downloadUrl;
                    }, 2500);

                    // 2. 监听 visibilitychange 事件
                    const visibilityChangeHandler = () => {
                        // 当页面变为不可见（用户切换到QQ或其他应用），
                        // 我们就认为跳转成功了，并立即清除后备定时器。
                        if (document.hidden) {
                            clearTimeout(timer);
                            window.removeEventListener('visibilitychange', visibilityChangeHandler);
                        }
                    };
                    window.addEventListener('visibilitychange', visibilityChangeHandler);

                    // 3. 执行跳转
                    window.location.href = qqLinkConfig.mobileScheme;

                    break;

                case 'pc':
                default:
                    // 电脑端，直接在新标签页打开
                    window.open(qqLinkConfig.pc, "_blank");
                    break;
            }
        });
    });


    // --- 初始化 ---
    function initialize() {
        predefinedRepos.forEach(repoInfo => {
            const button = document.createElement('button'); // 创建按钮元素
            button.className = 'btn repo-btn'; // 设置按钮样式类
            button.textContent = repoInfo.name; // 设置按钮文本
            button.dataset.repo = repoInfo.repo; // 将 owner/repo 存储在 data 属性中
            button.addEventListener('click', handlePredefinedRepoClick); // 监听预定义仓库按钮点击事件
            predefinedReposContainer.appendChild(button); // 将按钮添加到容器中
        });
        // 可选：在加载时获取第一个仓库：
        // if (predefinedRepos.length > 0) {
        //     const firstRepo = parseRepoString(predefinedRepos[0].repo);
        //     if (firstRepo) fetchLatestRelease(firstRepo.owner, firstRepo.repo);
        //     // 标记第一个按钮为激活状态
        //     predefinedReposContainer.firstChild.classList.add('active');
        //     currentRepo = predefinedReposContainer.firstChild;
        // }
    }

    initialize(); // 运行初始化函数

})();