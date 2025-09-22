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
    const assetSearchInput = document.getElementById('assetSearchInput'); // 文件搜索框
    const historyBtn = document.getElementById('historyBtn'); // 历史版本按钮
    const historyContainer = document.getElementById('historyContainer'); // 历史版本容器
    const releaseSelector = document.getElementById('releaseSelector'); // 历史版本选择器
    const viewOnGithubBtn = document.getElementById('viewOnGithubBtn'); // 打开GitHub官方列表按钮
    const themeToggleButton = document.getElementById('theme-toggle-btn'); // 主题切换按钮
    const themeIcon = document.getElementById('theme-icon'); // 主题图标
    const downloadPromptOverlay = document.getElementById('download-prompt-overlay');
    const promptConfirmBtn = document.getElementById('prompt-confirm-btn');
    const promptDontShowAgain = document.getElementById('prompt-dont-show-again');

    let timeoutId;
    let errorDisplayed = false; // 控制错误信息是否已显示
    let selectedIndex = -1; // 记录选中项的索引

    let currentRepo = null; // 用于跟踪当前激活的仓库按钮
    let currentRepoInfo = { owner: null, repo: null }; // 用于存储当前仓库的所有者和名称
    let currentAssets = []; // 用于存储当前版本的完整文件列表
    let pendingDownloadUrl = null; // 用于存储待下载的链接

    // --- 主题切换 ---
    const sunIcon = 'https://www.svgrepo.com/show/527250/moon-sleep.svg';
    const moonIcon = 'https://www.svgrepo.com/show/449918/sun.svg';

    function setTheme(theme, savePreference = false) {
        if (theme === 'dark') {
            document.documentElement.setAttribute('data-theme', 'dark');
            themeIcon.src = moonIcon;
        } else {
            document.documentElement.setAttribute('data-theme', 'light');
            themeIcon.src = sunIcon;
        }
        if (savePreference) {
            localStorage.setItem('theme', theme);
        }
    }

    // 主题切换按钮点击事件
    themeToggleButton.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        // 用户手动切换，保存其偏好
        setTheme(currentTheme === 'dark' ? 'light' : 'dark', true);
    });


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
            return date.toLocaleString('sv-SE', {
                year: 'numeric', month: '2-digit', day: '2-digit',
                hour: '2-digit', minute: '2-digit', hour12: false
            });
        } catch (e) {
            return dateString;
        }
    }

    function markdownToHtml(md, repoIdentifier) {
        if (!md) return '';
        let html = marked.parse(md);
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
        statusText.className = 'status-text';
        if (!keepReleaseInfoVisible) {
            releaseInfoContainer.style.display = 'none';
        }
        downloadAssetsContainer.style.display = 'none';
        assetList.innerHTML = '';
        releaseBody.innerHTML = '';
    }

    function showError(title, message) {
        spinner.style.display = 'none';
        statusTitle.textContent = `⚠️ ${title}`;
        statusText.textContent = message;
        statusText.className = 'status-text error';
        releaseInfoContainer.style.display = 'none';
        downloadAssetsContainer.style.display = 'none';
        historyBtn.style.display = 'none';
        historyContainer.style.display = 'none';
        viewOnGithubBtn.style.display = 'none';
    }

    //
    function displayAssets(assets) {
        assetList.innerHTML = '';
        if (assets && assets.length > 0) {
            assets.forEach(asset => {
                const assetItem = document.createElement('div');
                assetItem.className = 'asset-item';

                const infoDiv = document.createElement('div');
                infoDiv.className = 'asset-info';

                const nameP = document.createElement('p');
                nameP.className = 'asset-name';
                nameP.textContent = asset.name;

                const detailsP = document.createElement('p');
                detailsP.className = 'asset-details';
                detailsP.innerHTML = `
                <span>${formatBytes(asset.size)}</span> |
                <span>更新于: ${formatDate(asset.updated_at)}</span> |
                <span>下载次数: ${asset.download_count}</span>
            `;

                infoDiv.appendChild(nameP);
                infoDiv.appendChild(detailsP);

                const downloadLink = document.createElement('a');
                downloadLink.href = asset.browser_download_url;
                downloadLink.className = 'btn download-btn';
                downloadLink.textContent = '下载';
                downloadLink.target = '_blank';
                downloadLink.rel = 'noopener noreferrer';

                assetItem.appendChild(infoDiv);
                assetItem.appendChild(downloadLink);
                assetList.appendChild(assetItem);
            });
            downloadAssetsContainer.style.display = 'block';
        } else {
            assetList.innerHTML = '<p style="text-align: center; color: var(--dark-gray);">此版本未提供可下载文件或无匹配搜索结果。</p>';
            downloadAssetsContainer.style.display = 'block';
        }
    }

    function showSuccess(repoIdentifier, data) {
        spinner.style.display = 'none';
        statusTitle.textContent = `✅ ${repoIdentifier} - ${data.tag_name}`;
        statusText.textContent = `版本发布于: ${formatDate(data.published_at)}`;
        statusText.className = 'status-text';

        historyBtn.style.display = 'inline-block';
        historyContainer.style.display = 'none';

        const releasesUrl = `https://github.com/${repoIdentifier}/releases`;
        viewOnGithubBtn.href = releasesUrl;
        viewOnGithubBtn.style.display = 'inline-block';

        if (data.body) {
            releaseBody.innerHTML = markdownToHtml(data.body, repoIdentifier);
            releaseInfoContainer.style.display = 'block';
        } else {
            releaseInfoContainer.style.display = 'none';
        }

        currentAssets = data.assets || [];
        assetSearchInput.value = '';
        displayAssets(currentAssets);
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
        releaseSelector.innerHTML = '';
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
        releaseBody.innerHTML = '';
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
            })
            .catch(error => {
                console.error('Fetch by Tag 错误:', error);
                showError(`获取版本 ${tagName} 失败`, error.message);
            });
    }

    // --- 事件监听器 ---

    function handlePredefinedRepoClick(event) {
        const button = event.target;
        const repoString = button.dataset.repo;
        const repoData = parseRepoString(repoString);

        if (currentRepo) {
            currentRepo.classList.remove('active');
        }
        button.classList.add('active');
        currentRepo = button;

        if (repoData) {
            fetchLatestRelease(repoData.owner, repoData.repo);
            customRepoInput.value = repoString;
        }
    }

    function handleCustomRepoFetch() {
        const repoString = customRepoInput.value;
        const repoData = parseRepoString(repoString);

        if (currentRepo) {
            currentRepo.classList.remove('active');
            currentRepo = null;
        }

        if (repoData) {
            fetchLatestRelease(repoData.owner, repoData.repo);
            repoDropdown.style.display = 'none';
        } else {
            showError('输入无效', '请输入有效的 "owner/repo" 格式，例如 "octocat/Spoon-Knife"。');
        }
    }

    customRepoInput.addEventListener('input', function () {
        const inputValue = this.value;
        clearTimeout(timeoutId);
        if (inputValue.includes('/')) {
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
            }, 2500);
        }
    });

    customRepoInput.addEventListener('keydown', function (event) {
        const items = repoDropdown.querySelectorAll('div');
        if (event.key === 'ArrowDown') {
            event.preventDefault();
            selectedIndex = Math.min(selectedIndex + 1, items.length - 1);
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            selectedIndex = Math.max(selectedIndex - 1, -1);
        } else if (event.key === 'Enter' && selectedIndex !== -1) {
            event.preventDefault();
            items[selectedIndex].click();
            selectedIndex = -1;
            return;
        } else {
            selectedIndex = -1;
        }
        updateSelection(items);
    });

    function updateSelection(items) {
        items.forEach((item, index) => {
            if (index === selectedIndex) {
                item.style.backgroundColor = '#e0e0e0';
                item.scrollIntoView({block: 'nearest'});
            } else {
                item.style.backgroundColor = '';
            }
        });
    }

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
            errorDisplayed = false;
        } else {
            repoDropdown.style.display = 'none';
        }
    }

    function displayRepos(repos) {
        const filter = customRepoInput.value.split('/')[1];
        repoDropdown.innerHTML = '';
        if (repos && repos.length > 0) {
            const filteredRepos = repos.filter(repo => {
                return repo.name.toLowerCase().startsWith(filter.toLowerCase());
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
                errorDisplayed = false;
            } else {
                repoDropdown.style.display = 'none';
            }
        } else {
            repoDropdown.style.display = 'none';
        }
    }

    function displayError(errorMessage) {
        if (!errorDisplayed) {
            repoDropdown.innerHTML = `<div style="color: red;">${errorMessage}</div>`;
            repoDropdown.style.display = 'block';
            errorDisplayed = true;
            setTimeout(() => {
                repoDropdown.style.display = 'none';
                errorDisplayed = false;
            }, 3000)
        }
    }

    fetchCustomRepoBtn.addEventListener('click', handleCustomRepoFetch);
    customRepoInput.addEventListener('keypress', function (event) {
        if (event.key === 'Enter') {
            if (customRepoInput.value.includes('/')) {
                handleCustomRepoFetch();
            } else {
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

    assetSearchInput.addEventListener('input', (event) => {
        const searchTerm = event.target.value.toLowerCase();
        const filteredAssets = currentAssets.filter(asset =>
            asset.name.toLowerCase().includes(searchTerm)
        );
        displayAssets(filteredAssets);
    });

    // --- 下载提示弹窗逻辑 ---
    assetList.addEventListener('click', function(event) {
        const target = event.target;
        const downloadButton = target.closest('.download-btn');

        if (downloadButton) {
            event.preventDefault(); // 阻止链接的默认跳转行为

            const downloadUrl = downloadButton.href;
            const hidePrompt = localStorage.getItem('hideDownloadPrompt') === 'true';

            if (hidePrompt) {
                // 如果用户选择不再提示，则直接打开下载链接
                window.open(downloadUrl, '_blank');
            } else {
                // 否则，显示提示弹窗
                pendingDownloadUrl = downloadUrl;
                downloadPromptOverlay.style.display = 'flex';
            }
        }
    });

    promptConfirmBtn.addEventListener('click', function() {
        // 隐藏弹窗
        downloadPromptOverlay.style.display = 'none';

        // 如果用户勾选了“不再提示”，则保存到本地存储
        if (promptDontShowAgain.checked) {
            localStorage.setItem('hideDownloadPrompt', 'true');
        }

        // 继续下载
        if (pendingDownloadUrl) {
            window.open(pendingDownloadUrl, '_blank');
            pendingDownloadUrl = null; // 清除已保存的链接
        }
    });

    document.addEventListener("DOMContentLoaded", function() {
        const qqGroupBtn = document.getElementById("qqGroupBtn");
        if (!qqGroupBtn) return;

        const qqLinkConfig = {
            groupUin: "895166848",
            pc: "https://qm.qq.com/cgi-bin/qm/qr?k=8RSIIQ7Nb5x9ZsAX_r5fd6qNVYC3RkEZ&jump_from=webapi&authKey=n4nN5cC6tJ7PBr1vVQG4XZon7dynMUyhWfbVAcCu2slbUQv+QUnjmaoNIvRaaqaJ",
            mobileScheme: `mqqapi://card/show_pslcard?src_type=app&version=1&uin=895166848&card_type=group&source=webapi`,
            appstore: "itms-apps://itunes.apple.com/cn/app/qq-2011/id444934666?mt=8",
            androidDownload: "//im.qq.com"
        };

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

        qqGroupBtn.addEventListener("click", function() {
            const env = getEnvironment();
            switch (env) {
                case 'wechat':
                    const overlay = document.getElementById("wechatOverlay");
                    if (overlay) {
                        overlay.style.display = "block";
                        overlay.onclick = function() { this.style.display = "none"; };
                    }
                    break;
                case 'android':
                case 'ios':
                    const downloadUrl = (env === 'ios') ? qqLinkConfig.appstore : qqLinkConfig.androidDownload;
                    const timer = setTimeout(() => {
                        window.location.href = downloadUrl;
                    }, 2500);
                    const visibilityChangeHandler = () => {
                        if (document.hidden) {
                            clearTimeout(timer);
                            window.removeEventListener('visibilitychange', visibilityChangeHandler);
                        }
                    };
                    window.addEventListener('visibilitychange', visibilityChangeHandler);
                    window.location.href = qqLinkConfig.mobileScheme;
                    break;
                case 'pc':
                default:
                    window.open(qqLinkConfig.pc, "_blank");
                    break;
            }
        });
    });

    // --- 初始化 ---
    function initialize() {
        predefinedRepos.forEach(repoInfo => {
            const button = document.createElement('button');
            button.className = 'btn repo-btn';
            button.textContent = repoInfo.name;
            button.dataset.repo = repoInfo.repo;
            button.addEventListener('click', handlePredefinedRepoClick);
            predefinedReposContainer.appendChild(button);
        });

        // 初始化主题
        const savedTheme = localStorage.getItem('theme'); // 检查本地是否存有用户偏好
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');

        if (savedTheme) {
            // 如果用户已手动设置主题，则应用该主题
            setTheme(savedTheme);
        } else {
            // 否则，跟随操作系统的深色模式设置
            setTheme(prefersDark.matches ? 'dark' : 'light');
        }

        // 监听操作系统主题变化
        if (prefersDark.addEventListener) {
            prefersDark.addEventListener('change', (event) => {
                // 仅当用户未手动设置主题时，才跟随系统主题变化
                if (!localStorage.getItem('theme')) {
                    setTheme(event.matches ? 'dark' : 'light');
                }
            });
        }
    }

    initialize();

})();
