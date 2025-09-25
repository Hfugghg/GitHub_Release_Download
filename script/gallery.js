document.addEventListener('DOMContentLoaded', () => {
    // DOM 元素
    const galleryGrid = document.getElementById('galleryGrid');
    const backgroundCarousel = document.getElementById('backgroundCarousel');
    const modal = document.getElementById('imageModal');
    const modalImage = document.getElementById('modalImage');
    const caption = document.getElementById('caption');
    const closeBtn = document.querySelector('.modal .close');
    const loader = document.getElementById('loader');

    // --- CDN 配置 ---
    const GCORE_CDN_PREFIX = 'https://gcore.jsdelivr.net/gh/hfugghg/GitHub_Release_Download@gh-pages/';
    let CDN_PREFIX = ''; // 默认禁用 CDN，将通过 IP 检测动态设置

    // --- IP 地理位置检测与 CDN 设置 ---
    async function checkAndSetCDN() {
        try {
            // 使用 sessionStorage 缓存检测结果，避免每次刷新都请求 API
            const cachedStatus = sessionStorage.getItem('cdnStatus');
            if (cachedStatus) {
                if (cachedStatus === 'enabled') {
                    CDN_PREFIX = GCORE_CDN_PREFIX;
                    console.log("使用缓存的 CDN 设置：启用");
                } else {
                    console.log("使用缓存的 CDN 设置：禁用");
                }
                return;
            }

            const response = await fetch('https://ipapi.co/json/');
            if (!response.ok) {
                throw new Error('IP API request failed');
            }
            const data = await response.json();
            if (data.country_code === 'CN') {
                console.log("检测到中国IP，启用 Gcore CDN");
                CDN_PREFIX = GCORE_CDN_PREFIX;
                sessionStorage.setItem('cdnStatus', 'enabled');
            } else {
                console.log("非中国IP，使用本地资源");
                sessionStorage.setItem('cdnStatus', 'disabled');
            }
        } catch (error) {
            console.warn("IP地理位置检测失败，将使用本地资源。", error);
            sessionStorage.setItem('cdnStatus', 'disabled'); // 检测失败也缓存状态，避免重试
        }
    }

    // 状态
    let imageMetas = {};
    let allImages = []; // 用于瀑布流网格
    let portraitImages = []; // 用于纵向轮播
    let landscapeImages = []; // 用于横向轮播
    let loadedImageCount = 0;
    let isLoading = false;
    const imagesPerLoad = 8;

    // 瀑布流布局状态
    const targetColumnWidth = 220;
    let actualColumnWidth = 0;
    const gap = 15;
    let columnHeights = [];
    let numColumns = 0;

    let isCurrentlyLandscape = window.innerWidth > window.innerHeight;

    // 轮播图懒加载的状态管理器
    let carouselLoader = {
        timer: null,
        currentIndex: 0,
        images: []
    };
    const CAROUSEL_LOAD_INTERVAL = 5000;

    // Fisher-Yates 洗牌算法
    function shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }

    // --- 修改：背景轮播图加载逻辑 ---
    function loadNextCarouselImage() {
        if (carouselLoader.images.length === 0) return;

        const imgElement = carouselLoader.images[carouselLoader.currentIndex % carouselLoader.images.length];

        if (imgElement.dataset.primarySrc) {
            const primarySrc = imgElement.dataset.primarySrc;
            const fallbackSrc = imgElement.dataset.fallbackSrc;

            // 仅当存在备用资源时才设置复杂的 onerror 回退逻辑
            if (fallbackSrc) {
                imgElement.onerror = () => {
                    console.warn(`轮播图 CDN 资源加载失败: ${primarySrc}, 尝试备用资源...`);
                    imgElement.src = fallbackSrc;
                    imgElement.onerror = null; // 清除处理器，防止备用资源也失败时无限循环
                };
            } else {
                imgElement.onerror = () => {
                    console.error(`轮播图资源加载失败: ${primarySrc}`);
                    imgElement.onerror = null;
                };
            }

            imgElement.src = primarySrc;

            imgElement.removeAttribute('data-primary-src');
            imgElement.removeAttribute('data-fallback-src');
        }

        carouselLoader.currentIndex++;
        carouselLoader.timer = setTimeout(loadNextCarouselImage, CAROUSEL_LOAD_INTERVAL);
    }

    // --- 修改：Carousel 设置逻辑 ---
    function setupCarousel() {
        if (carouselLoader.timer) {
            clearTimeout(carouselLoader.timer);
        }
        backgroundCarousel.innerHTML = '';

        isCurrentlyLandscape = window.innerWidth > window.innerHeight;
        const carouselSource = isCurrentlyLandscape ? landscapeImages : portraitImages;
        const imagesForCarousel = carouselSource.length > 0 ? carouselSource : (isCurrentlyLandscape ? portraitImages : landscapeImages);

        if (imagesForCarousel.length === 0) return;

        let displayList = [...imagesForCarousel];
        if (displayList.length > 0 && displayList.length < 20) {
            displayList = [...displayList, ...displayList];
        }

        displayList.forEach(imageInfo => {
            const bgImg = document.createElement('img');
            const relativePath = `assets/${imageInfo.type}/${imageInfo.id}.${imageInfo.ext}`;
            
            // 根据是否启用 CDN 设置图片源
            if (CDN_PREFIX) {
                bgImg.dataset.primarySrc = `${CDN_PREFIX}${relativePath}`;
                bgImg.dataset.fallbackSrc = relativePath;
            } else {
                bgImg.dataset.primarySrc = relativePath;
            }
            backgroundCarousel.appendChild(bgImg);
        });

        carouselLoader.images = Array.from(backgroundCarousel.children);
        carouselLoader.currentIndex = 0;

        if (carouselLoader.images.length > 0) {
            loadNextCarouselImage();
            if (carouselLoader.images.length > 1) {
                clearTimeout(carouselLoader.timer);
                loadNextCarouselImage();
            }
        }
    }

    // 瀑布流布局计算
    function setupMasonry() {
        const containerWidth = galleryGrid.offsetWidth;
        numColumns = Math.max(1, Math.floor((containerWidth + gap) / (targetColumnWidth + gap)));
        actualColumnWidth = (containerWidth - (numColumns - 1) * gap) / numColumns;
        columnHeights = new Array(numColumns).fill(0);
        galleryGrid.style.height = '0px';
    }

    function positionItem(item) {
        const img = item.querySelector('img');
        const imgAspectRatio = img.naturalWidth / img.naturalHeight;
        const isDoubleColumnCandidate = imgAspectRatio > 1.6 && img.naturalWidth > 1200 && numColumns > 1;

        if (isDoubleColumnCandidate) {
            let bestColumnIndex = -1;
            let minHeight = Infinity;
            const heightDifferenceThreshold = targetColumnWidth / 2;

            for (let i = 0; i < numColumns - 1; i++) {
                if (Math.abs(columnHeights[i] - columnHeights[i+1]) < heightDifferenceThreshold) {
                    const currentHeight = Math.max(columnHeights[i], columnHeights[i+1]);
                    if (currentHeight < minHeight) {
                        minHeight = currentHeight;
                        bestColumnIndex = i;
                    }
                }
            }

            if (bestColumnIndex !== -1) {
                const columnIndex = bestColumnIndex;
                const top = Math.max(columnHeights[columnIndex], columnHeights[columnIndex + 1]);
                const left = columnIndex * (actualColumnWidth + gap);
                const itemWidth = (actualColumnWidth * 2) + gap;

                item.style.position = 'absolute';
                item.style.left = `${left}px`;
                item.style.top = `${top}px`;
                item.style.width = `${itemWidth}px`;

                const itemHeight = (img.naturalHeight / img.naturalWidth) * itemWidth;
                const newHeight = top + itemHeight + gap;
                columnHeights[columnIndex] = newHeight;
                columnHeights[columnIndex + 1] = newHeight;
            } else {
                positionSingleColumnItem(item);
            }
        } else {
            positionSingleColumnItem(item);
        }

        const newContainerHeight = Math.max(...columnHeights);
        galleryGrid.style.height = `${newContainerHeight}px`;
    }

    function positionSingleColumnItem(item) {
        const minHeight = Math.min(...columnHeights);
        const columnIndex = columnHeights.indexOf(minHeight);
        const top = minHeight;
        const left = columnIndex * (actualColumnWidth + gap);

        item.style.position = 'absolute';
        item.style.left = `${left}px`;
        item.style.top = `${top}px`;
        item.style.width = `${actualColumnWidth}px`;

        const itemHeight = (item.querySelector('img').naturalHeight / item.querySelector('img').naturalWidth) * actualColumnWidth;
        columnHeights[columnIndex] += itemHeight + gap;
    }

    // --- 修改：带回退逻辑的 fetch 函数 ---
    async function fetchWithFallback(relativePath) {
        // 仅当 CDN 启用时才使用回退逻辑
        if (CDN_PREFIX) {
            const primaryUrl = `${CDN_PREFIX}${relativePath}`;
            try {
                const response = await fetch(primaryUrl);
                if (!response.ok) {
                    throw new Error(`CDN resource not available: ${response.statusText}`);
                }
                return response;
            } catch (error) {
                console.warn(`从 CDN (${primaryUrl}) 获取失败, 正在尝试备用路径 (${relativePath})...`, error);
                return fetch(relativePath);
            }
        }
        // 否则直接使用相对路径
        return fetch(relativePath);
    }

    // --- 修改：使用新的 fetchWithFallback 函数加载数据 ---
    async function fetchAndCombineData() {
        try {
            const dataSources = ['portrait', 'landscape'];
            const promises = dataSources.flatMap(type => [
                fetchWithFallback(`assets/${type}/index.json`),
                fetchWithFallback(`assets/${type}/meta.json`)
            ]);

            const responses = await Promise.all(promises);
            for (const res of responses) {
                if (!res.ok) throw new Error('无法从服务器加载图片数据（首选和备用路径均失败）。');
            }
            const jsonData = await Promise.all(responses.map(res => res.json()));

            const portraitMeta = jsonData[1].data;
            const landscapeMeta = jsonData[3].data;
            const combinedMeta = [...portraitMeta, ...landscapeMeta];
            imageMetas = combinedMeta.reduce((acc, meta) => {
                acc[meta.id] = meta;
                return acc;
            }, {});

            const portraitIndex = jsonData[0].map(filename => {
                const lastDot = filename.lastIndexOf('.');
                const id = filename.substring(0, lastDot);
                const ext = filename.substring(lastDot + 1);
                return { id, ext, type: 'portrait' };
            });

            const landscapeIndex = jsonData[2].map(filename => {
                const lastDot = filename.lastIndexOf('.');
                const id = filename.substring(0, lastDot);
                const ext = filename.substring(lastDot + 1);
                return { id, ext, type: 'landscape' };
            });

            portraitImages = [...portraitIndex];
            landscapeImages = [...landscapeIndex];
            shuffleArray(portraitImages);
            shuffleArray(landscapeImages);

            allImages = [...portraitIndex, ...landscapeIndex];
            shuffleArray(allImages);

        } catch (error) {
            galleryGrid.innerHTML = `<p style="color: red;">${error.message}</p>`;
            console.error('获取画廊数据时出错:', error);
        }
    }

    // --- 修改：图片加载逻辑 ---
    function loadMoreImages() {
        if (isLoading || loadedImageCount >= allImages.length) return;
        isLoading = true;
        loader.style.display = 'block';

        const imagesToLoad = allImages.slice(loadedImageCount, loadedImageCount + imagesPerLoad);

        let imagesProcessed = 0;
        const onImageProcessed = () => {
            imagesProcessed++;
            if (imagesProcessed === imagesToLoad.length) {
                isLoading = false;
                loader.style.display = 'none';
            }
        };

        imagesToLoad.forEach(imageInfo => {
            const img = new Image();
            const relativePath = `assets/${imageInfo.type}/${imageInfo.id}.${imageInfo.ext}`;

            img.alt = `Image ${imageInfo.id}`;
            img.dataset.id = imageInfo.id;

            img.onload = () => {
                const gridItem = document.createElement('div');
                gridItem.className = 'grid-item';
                gridItem.appendChild(img);

                const meta = imageMetas[imageInfo.id];
                const tooltip = document.createElement('div');
                tooltip.className = 'tooltip';
                tooltip.textContent = (meta && meta.source) ? meta.source : '无简介';
                gridItem.appendChild(tooltip);

                gridItem.addEventListener('click', () => openModal(img.src, img.dataset.id));
                galleryGrid.appendChild(gridItem);
                positionItem(gridItem);

                onImageProcessed();
            };

            // 根据是否启用 CDN 设置图片源和错误处理
            if (CDN_PREFIX) {
                const primarySrc = `${CDN_PREFIX}${relativePath}`;
                img.onerror = () => {
                    console.warn(`CDN 主资源加载失败: ${primarySrc}, 正在尝试备用资源...`);
                    img.src = relativePath;
                    img.onerror = () => {
                        console.error(`备用资源也加载失败: ${relativePath}`);
                        onImageProcessed();
                    };
                };
                img.src = primarySrc;
            } else {
                img.onerror = () => {
                    console.error(`资源加载失败: ${relativePath}`);
                    onImageProcessed();
                };
                img.src = relativePath;
            }
        });

        loadedImageCount += imagesPerLoad;
    }

    // 模态框逻辑
    function openModal(src, id) {
        modal.style.display = 'block';
        modalImage.src = src;
        const meta = imageMetas[id];
        caption.innerHTML = (meta?.source) ? `<a href="${meta.source}" target="_blank" rel="noopener noreferrer">查看来源</a>` : '无来源信息';
        document.body.style.overflow = 'hidden';
    }

    function closeModal() {
        modal.style.display = 'none';
        document.body.style.overflow = '';
    }

    closeBtn.onclick = closeModal;
    window.onclick = (event) => {
        if (event.target === modal) {
            closeModal();
        }
    }

    // 事件监听器
    window.addEventListener('scroll', () => {
        if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 500 && !isLoading) {
            loadMoreImages();
        }
    });

    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            console.log("窗口大小改变，重新布局");
            setupMasonry();
            const items = Array.from(galleryGrid.children);
            items.forEach(item => positionItem(item));

            const newIsLandscape = window.innerWidth > window.innerHeight;
            if (newIsLandscape !== isCurrentlyLandscape) {
                console.log("屏幕方向改变，重新加载背景轮播");
                setupCarousel();
            }
        }, 200);
    });

    // --- 修改：初始化加载 ---
    async function initialize() {
        setupMasonry();
        await checkAndSetCDN(); // 在获取数据前执行 CDN 检测
        await fetchAndCombineData();
        setupCarousel();
        loadMoreImages();
    }

    initialize();
});
