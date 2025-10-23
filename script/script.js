(function () {
    // --- 配置 ---
    const predefinedRepos = [
        {name: 'V2rayN', repo: '2dust/v2rayN'},
    {name: 'Clash for Windows (经典PC端)', repo: 'Fndroid/clash_for_windows_pkg'},
    {name: 'Umi-OCR (截图识别)', repo: 'hiroi-sora/Umi-OCR'},
    {name: 'Jellyfin (媒体服务器)', repo: 'jellyfin/jellyfin'},
    {name: 'Siyuan Note (笔记软件)', repo: 'siyuan-note/siyuan'},
    {name: 'Ant-Design (UI组件库)', repo: 'ant-design/ant-design'},
    {name: 'Tencent/wepy (小程序框架)', repo: 'Tencent/wepy'},
    {name: 'Hifini (音乐下载)', repo: '670w/hifini'}
    ];
    const WALLPAPER_CHANGE_INTERVAL = 10000; // 壁纸切换间隔（10秒）

    // --- DOM 元素 ---
    const predefinedReposContainer = document.getElementById('predefinedRepos');
    const customRepoInput = document.getElementById('customRepoInput');
    const repoDropdown = document.getElementById('repoDropdown');
    const fetchCustomRepoBtn = document.getElementById('fetchCustomRepoBtn');
    const spinner = document.getElementById('spinner');
    const statusTitle = document.getElementById('statusTitle');
    const statusText = document.getElementById('statusText');
    const releaseInfoContainer = document.getElementById('releaseInfo');
    const releaseBody = document.getElementById('releaseBody');
    const downloadAssetsContainer = document.getElementById('downloadAssets');
    const assetList = document.getElementById('assetList');
    const assetSearchInput = document.getElementById('assetSearchInput');
    const historyBtn = document.getElementById('historyBtn');
    const historyContainer = document.getElementById('historyContainer');
    const releaseSelector = document.getElementById('releaseSelector');
    const viewOnGithubBtn = document.getElementById('viewOnGithubBtn');
    const themeToggleButton = document.getElementById('theme-toggle-btn');
    const themeIcon = document.getElementById('theme-icon');
    const downloadPromptOverlay = document.getElementById('download-prompt-overlay');
    const promptConfirmBtn = document.getElementById('prompt-confirm-btn');
    const promptDontShowAgain = document.getElementById('prompt-dont-show-again');
    const wallpaperContainer = document.getElementById('wallpaper-container');
    const wallpaperToggleButton = document.getElementById('wallpaper-toggle-btn');

    // --- 状态变量 ---
    let timeoutId;
    let errorDisplayed = false;
    let selectedIndex = -1;
    let currentRepo = null;
    let currentRepoInfo = {owner: null, repo: null};
    let currentAssets = [];
    let pendingDownloadUrl = null;
    let wallpaperList = [];
    let currentWallpaperIndex = -1;
    let wallpaperInterval = null;

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

    themeToggleButton.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        setTheme(currentTheme === 'dark' ? 'light' : 'dark', true);
    });

    // --- 壁纸功能 ---
    function shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }

    function changeWallpaper(isInitial = false) {
        if (wallpaperList.length === 0) return;

        currentWallpaperIndex++;
        if (currentWallpaperIndex >= wallpaperList.length) {
            currentWallpaperIndex = 0;
            shuffleArray(wallpaperList);
        }

        const nextImageSrc = wallpaperList[currentWallpaperIndex];

        const img = new Image();
        img.src = nextImageSrc;

        img.onload = () => {
            if (isInitial) {
                // 首次加载，直接设置图片并淡入
                wallpaperContainer.style.backgroundImage = `url('${nextImageSrc}')`;
                document.body.classList.add('wallpaper-on');
            } else {
                // 后续切换，执行淡出 -> 切换 -> 淡入
                wallpaperContainer.style.opacity = 0;
                setTimeout(() => {
                    wallpaperContainer.style.backgroundImage = `url('${nextImageSrc}')`;
                    wallpaperContainer.style.opacity = 1;
                }, 1000); // 等待1秒，匹配CSS中的 `transition` 时间
            }
        };

        img.onerror = () => {
            console.error(`壁纸加载失败: ${nextImageSrc}`);
        };
    }

    function startWallpaperCycle() {
        if (wallpaperInterval) return;

        const isLandscape = window.innerWidth > window.innerHeight;
        const wallpaperPath = isLandscape ? 'assets/landscape' : 'assets/portrait';
        const indexPath = `${wallpaperPath}/index.json`;

        fetch(indexPath)
            .then(response => {
                if (!response.ok) throw new Error(`无法加载壁纸列表: ${indexPath}`);
                return response.json();
            })
            .then(data => {
                if (data && data.length > 0) {
                    wallpaperList = data.map(file => `${wallpaperPath}/${file}`);
                    shuffleArray(wallpaperList);
                    currentWallpaperIndex = -1;

                    changeWallpaper(true); // 首次加载
                    wallpaperInterval = setInterval(() => changeWallpaper(false), WALLPAPER_CHANGE_INTERVAL);
                } else {
                    // 如果列表为空，则只显示默认背景
                    document.body.classList.add('wallpaper-on');
                }
            })
            .catch(error => {
                console.error('壁纸功能出错:', error);
                // 如果加载失败，也只显示默认背景
                document.body.classList.add('wallpaper-on');
            });
    }

    function stopWallpaperCycle() {
        clearInterval(wallpaperInterval);
        wallpaperInterval = null;
        document.body.classList.remove('wallpaper-on');
    }

    function setWallpaper(isOn, savePreference = false) {
        const isCurrentlyOn = document.body.classList.contains('wallpaper-on');
        if (isOn === isCurrentlyOn) return;

        if (isOn) {
            wallpaperToggleButton.classList.add('active');
            startWallpaperCycle();
        } else {
            wallpaperToggleButton.classList.remove('active');
            stopWallpaperCycle();
        }
        if (savePreference) {
            localStorage.setItem('wallpaperEnabled', isOn ? 'true' : 'false');
        }
    }

    wallpaperToggleButton.addEventListener('click', () => {
        const isCurrentlyOn = document.body.classList.contains('wallpaper-on');
        setWallpaper(!isCurrentlyOn, true);
    });

    // --- 辅助函数 ---
    function formatBytes(bytes, decimals = 2) {
        if (bytes === 0) return '0 字节';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['字节', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }

    function formatDate(dateString) {
        if (!dateString) return 'N/A';
        try {
            return new Date(dateString).toLocaleString('sv-SE', {hour12: false});
        } catch (e) {
            return dateString;
        }
    }

    function markdownToHtml(md, repoIdentifier) {
        if (!md) return '';
        let html = marked.parse(md);
        const baseUrl = `https://raw.githubusercontent.com/${repoIdentifier}/dev/docs/`;
        return html.replace(/<img src="\.\/docs\/(.*?)"/g, `<img src="${baseUrl}$1"`);
    }

    function parseRepoString(repoString) {
        const parts = repoString.split('/');
        if (parts.length !== 2 || !parts[0].trim() || !parts[1].trim()) return null;
        return {owner: parts[0].trim(), repo: parts[1].trim()};
    }

    // --- UI 更新函数 ---
    function showLoading(message = '正在获取信息...', keepReleaseInfoVisible = false) {
        spinner.style.display = 'block';
        statusTitle.textContent = message;
        statusText.textContent = '';
        statusText.className = 'status-text';
        if (!keepReleaseInfoVisible) releaseInfoContainer.style.display = 'none';
        downloadAssetsContainer.style.display = 'none';
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

    function displayAssets(assets) {
        assetList.innerHTML = '';
        if (!assets || assets.length === 0) {
            assetList.innerHTML = '<p style="text-align: center; color: var(--dark-gray);">此版本未提供可下载文件或无匹配搜索结果。</p>';
        } else {
            assets.forEach(asset => {
                const assetItem = document.createElement('div');
                assetItem.className = 'asset-item';
                assetItem.innerHTML = `
                    <div class="asset-info">
                        <p class="asset-name">${asset.name}</p>
                        <p class="asset-details">
                            <span>${formatBytes(asset.size)}</span> |
                            <span>更新于: ${formatDate(asset.updated_at)}</span> |
                            <span>下载次数: ${asset.download_count}</span>
                        </p>
                    </div>
                    <a href="${asset.browser_download_url}" class="btn download-btn" target="_blank" rel="noopener noreferrer">下载</a>
                `;
                assetList.appendChild(assetItem);
            });
        }
        downloadAssetsContainer.style.display = 'block';
    }

    function showSuccess(repoIdentifier, data) {
        spinner.style.display = 'none';
        statusTitle.textContent = `✅ ${repoIdentifier} - ${data.tag_name}`;
        statusText.textContent = `版本发布于: ${formatDate(data.published_at)}`;
        statusText.className = 'status-text';
        historyBtn.style.display = 'inline-block';
        historyContainer.style.display = 'none';
        viewOnGithubBtn.href = `https://github.com/${repoIdentifier}/releases`;
        viewOnGithubBtn.style.display = 'inline-block';
        releaseBody.innerHTML = data.body ? markdownToHtml(data.body, repoIdentifier) : '';
        releaseInfoContainer.style.display = data.body ? 'block' : 'none';
        currentAssets = data.assets || [];
        assetSearchInput.value = '';
        displayAssets(currentAssets);
    }

    // --- 核心逻辑 ---
    function fetchApi(url, loadingMsg, repoIdentifier) {
        showLoading(loadingMsg, repoIdentifier);
        return fetch(url).then(response => {
            if (response.status === 403) throw new Error('GitHub API 访问频率限制。请稍后再试。');
            if (response.status === 404) throw new Error(`仓库 "${repoIdentifier}" 未找到或没有发布版本。`);
            if (!response.ok) throw new Error(`网络响应错误: ${response.statusText}`);
            return response.json();
        });
    }

    function fetchLatestRelease(owner, repoName) {
        const repoIdentifier = `${owner}/${repoName}`;
        currentRepoInfo = {owner, repo: repoName};
        fetchApi(`https://api.github.com/repos/${owner}/${repoName}/releases/latest`, `正在获取 ${repoIdentifier} 的最新版本...`, repoIdentifier)
            .then(data => showSuccess(repoIdentifier, data))
            .catch(error => showError('获取失败', error.message));
    }

    function fetchReleaseHistory(owner, repo) {
        const repoIdentifier = `${owner}/${repo}`;
        fetchApi(`https://api.github.com/repos/${owner}/${repo}/releases`, `正在获取 ${repoIdentifier} 的历史版本...`, repoIdentifier)
            .then(releases => {
                if (releases && releases.length > 0) {
                    populateReleaseHistory(releases);
                } else {
                    showError('未找到历史版本', '该仓库没有发布任何版本。');
                }
            })
            .catch(error => showError('获取历史版本失败', error.message));
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
        statusTitle.textContent = `✅ 找到 ${releases.length} 个历史版本`;
        statusText.textContent = '请从下拉列表中选择一个版本进行查看。';
    }

    function fetchReleaseByTag(owner, repo, tagName) {
        const repoIdentifier = `${owner}/${repo}`;
        fetchApi(`https://api.github.com/repos/${owner}/${repo}/releases/tags/${tagName}`, `正在获取版本 ${tagName}...`, repoIdentifier)
            .then(data => showSuccess(repoIdentifier, data))
            .catch(error => showError(`获取版本 ${tagName} 失败`, error.message));
    }

    // --- 事件监听器 ---
    function handlePredefinedRepoClick(event) {
        const button = event.target;
        const repoData = parseRepoString(button.dataset.repo);
        if (currentRepo) currentRepo.classList.remove('active');
        button.classList.add('active');
        currentRepo = button;
        if (repoData) {
            fetchLatestRelease(repoData.owner, repoData.repo);
            customRepoInput.value = button.dataset.repo;
        }
    }

    function handleCustomRepoFetch() {
        const repoData = parseRepoString(customRepoInput.value);
        if (currentRepo) {
            currentRepo.classList.remove('active');
            currentRepo = null;
        }
        if (repoData) {
            fetchLatestRelease(repoData.owner, repoData.repo);
            repoDropdown.style.display = 'none';
        } else {
            showError('输入无效', '请输入有效的 "owner/repo" 格式。');
        }
    }

    customRepoInput.addEventListener('input', function () {
        const [owner, repoFilter] = this.value.split('/');
        clearTimeout(timeoutId);
        if (owner) {
            timeoutId = setTimeout(() => {
                const url = repoFilter !== undefined
                    ? `https://api.github.com/users/${owner}/repos`
                    : `https://api.github.com/search/users?q=${owner}`;
                fetch(url).then(r => r.ok ? r.json() : Promise.reject(new Error('API请求失败')))
                    .then(data => repoFilter !== undefined ? displayRepos(data, repoFilter) : displayUsers(data.items))
                    .catch(error => displayError(error.message));
            }, 300);
        }
    });

    function displayUsers(users) {
        repoDropdown.innerHTML = '';
        if (!users || users.length === 0) {
            repoDropdown.style.display = 'none';
            return;
        }
        users.slice(0, 10).forEach(user => {
            const userItem = document.createElement('div');
            userItem.innerHTML = `<img src="${user.avatar_url}" width="20" height="20" style="vertical-align: middle; margin-right: 5px;"> ${user.login}`;
            userItem.addEventListener('click', () => {
                customRepoInput.value = user.login + '/';
                repoDropdown.style.display = 'none';
                customRepoInput.focus();
            });
            repoDropdown.appendChild(userItem);
        });
        repoDropdown.style.display = 'block';
    }

    function displayRepos(repos, filter) {
        repoDropdown.innerHTML = '';
        const filtered = repos.filter(r => r.name.toLowerCase().includes(filter.toLowerCase())).slice(0, 10);
        if (filtered.length === 0) {
            repoDropdown.style.display = 'none';
            return;
        }
        filtered.forEach(repo => {
            const repoItem = document.createElement('div');
            repoItem.textContent = repo.full_name;
            repoItem.addEventListener('click', () => {
                customRepoInput.value = repo.full_name;
                repoDropdown.style.display = 'none';
                handleCustomRepoFetch();
            });
            repoDropdown.appendChild(repoItem);
        });
        repoDropdown.style.display = 'block';
    }

    function displayError(message) {
        repoDropdown.innerHTML = `<div style="color: red; padding: 10px;">${message}</div>`;
        repoDropdown.style.display = 'block';
        setTimeout(() => repoDropdown.style.display = 'none', 3000);
    }

    document.addEventListener('click', (e) => {
        if (!customRepoInput.contains(e.target)) repoDropdown.style.display = 'none';
    });

    fetchCustomRepoBtn.addEventListener('click', handleCustomRepoFetch);
    customRepoInput.addEventListener('keypress', e => e.key === 'Enter' && handleCustomRepoFetch());
    historyBtn.addEventListener('click', () => currentRepoInfo.owner && fetchReleaseHistory(currentRepoInfo.owner, currentRepoInfo.repo));
    releaseSelector.addEventListener('change', e => fetchReleaseByTag(currentRepoInfo.owner, currentRepoInfo.repo, e.target.value));
    assetSearchInput.addEventListener('input', e => displayAssets(currentAssets.filter(a => a.name.toLowerCase().includes(e.target.value.toLowerCase()))));

    assetList.addEventListener('click', function (event) {
        const downloadButton = event.target.closest('.download-btn');
        if (downloadButton) {
            event.preventDefault();
            const downloadUrl = downloadButton.href;
            if (localStorage.getItem('hideDownloadPrompt') === 'true') {
                window.open(downloadUrl, '_blank');
            } else {
                pendingDownloadUrl = downloadUrl;
                downloadPromptOverlay.style.display = 'flex';
            }
        }
    });

    promptConfirmBtn.addEventListener('click', function () {
        downloadPromptOverlay.style.display = 'none';
        if (promptDontShowAgain.checked) {
            localStorage.setItem('hideDownloadPrompt', 'true');
        }
        if (pendingDownloadUrl) {
            window.open(pendingDownloadUrl, '_blank');
            pendingDownloadUrl = null;
        }
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

        const savedTheme = localStorage.getItem('theme');
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');
        setTheme(savedTheme || (prefersDark.matches ? 'dark' : 'light'));
        prefersDark.addEventListener('change', e => !localStorage.getItem('theme') && setTheme(e.matches ? 'dark' : 'light'));

        const savedWallpaperPref = localStorage.getItem('wallpaperEnabled');
        if (savedWallpaperPref === 'true') {
            setWallpaper(true);
        }
    }

    initialize();

})();
