document.addEventListener('DOMContentLoaded', () => {
    // DOM 元素
    const galleryGrid = document.getElementById('galleryGrid');
    const backgroundCarousel = document.getElementById('backgroundCarousel');
    const modal = document.getElementById('imageModal');
    const modalImage = document.getElementById('modalImage');
    const caption = document.getElementById('caption');
    const closeBtn = document.querySelector('.modal .close');
    const loader = document.getElementById('loader');

    // 状态
    let imageMetas = {};
    let allImages = []; // 用于瀑布流网格
    let portraitImages = []; // 用于纵向轮播
    let landscapeImages = []; // 用于横向轮播
    let loadedImageCount = 0;
    let isLoading = false;
    const imagesPerLoad = 8; // 已根据建议降低并发数

    // 瀑布流布局状态
    const targetColumnWidth = 220;
    let actualColumnWidth = 0;
    const gap = 15;
    let columnHeights = [];
    let numColumns = 0;

    let isCurrentlyLandscape = window.innerWidth > window.innerHeight;

    // --- 新增：轮播图懒加载的状态管理器 ---
    let carouselLoader = {
        timer: null,
        currentIndex: 0,
        images: []
    };
    // 定义每张轮播图加载的间隔时间（毫秒），您可以根据轮播速度调整
    const CAROUSEL_LOAD_INTERVAL = 5000; // 5秒加载一张

    // Fisher-Yates 洗牌算法
    function shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }

    // --- 核心修改：重写轮播图设置和懒加载逻辑 ---

    /**
     * 实际执行加载的函数，将 data-src 替换为 src
     */
    function loadNextCarouselImage() {
        if (carouselLoader.images.length === 0) return;

        // 使用模运算(%)来实现无限循环加载
        const imgElement = carouselLoader.images[carouselLoader.currentIndex % carouselLoader.images.length];

        // 如果图片有 data-src 属性（意味着还没被加载），就加载它
        if (imgElement.dataset.src) {
            imgElement.src = imgElement.dataset.src;
            // 移除 data-src 防止重复加载
            imgElement.removeAttribute('data-src');
        }

        carouselLoader.currentIndex++;

        // 设置定时器，在指定间隔后加载下一张图片
        carouselLoader.timer = setTimeout(loadNextCarouselImage, CAROUSEL_LOAD_INTERVAL);
    }

    /**
     * 设置轮播图的初始结构，并启动懒加载
     */
    function setupCarousel() {
        // 停止并清除旧的定时器，防止窗口大小改变时产生多个定时器
        if (carouselLoader.timer) {
            clearTimeout(carouselLoader.timer);
        }
        backgroundCarousel.innerHTML = '';

        isCurrentlyLandscape = window.innerWidth > window.innerHeight;
        const carouselSource = isCurrentlyLandscape ? landscapeImages : portraitImages;
        const imagesForCarousel = carouselSource.length > 0 ? carouselSource : (isCurrentlyLandscape ? portraitImages : landscapeImages);

        if (imagesForCarousel.length === 0) return;

        // 为了动画无缝衔接，如果图片少于20张，就复制一份
        let displayList = [...imagesForCarousel];
        if (displayList.length > 0 && displayList.length < 20) {
            displayList = [...displayList, ...displayList];
        }

        // 1. 创建所有 img 标签，但不设置 src，而是设置 data-src
        displayList.forEach(imageInfo => {
            const bgImg = document.createElement('img');
            // 将真实的图片地址存放在 data-src 中
            bgImg.dataset.src = `assets/${imageInfo.type}/${imageInfo.id}.${imageInfo.ext}`;
            backgroundCarousel.appendChild(bgImg);
        });

        // 2. 准备启动懒加载
        carouselLoader.images = Array.from(backgroundCarousel.children);
        carouselLoader.currentIndex = 0;

        if (carouselLoader.images.length > 0) {
            // 3. 立即加载前两张图片，满足您的启动需求
            // 加载第一张
            loadNextCarouselImage();
            // 立即加载第二张 (通过手动调用并清除定时器，然后再重新启动定时器)
            if (carouselLoader.images.length > 1) {
                clearTimeout(carouselLoader.timer); // 清除第一次调用产生的定时器
                loadNextCarouselImage(); // 这会加载第二张，并为第三张设置新的定时器
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


    // 图片加载
    async function fetchAndCombineData() {
        try {
            const dataSources = ['portrait', 'landscape'];
            const promises = dataSources.flatMap(type => [
                fetch(`assets/${type}/index.json`),
                fetch(`assets/${type}/meta.json`)
            ]);

            const responses = await Promise.all(promises);
            for (const res of responses) {
                if (!res.ok) throw new Error('无法从服务器加载图片数据。');
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
            img.src = `assets/${imageInfo.type}/${imageInfo.id}.${imageInfo.ext}`;
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

            img.onerror = () => {
                console.error(`图片加载失败: ${img.src}`);
                onImageProcessed();
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

    // 初始化加载
    async function initialize() {
        setupMasonry();
        await fetchAndCombineData();
        setupCarousel(); // 设置轮播并启动懒加载
        loadMoreImages();
    }

    initialize();
});
