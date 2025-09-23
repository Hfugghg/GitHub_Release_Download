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
    const imagesPerLoad = 15;

    // 瀑布流布局状态
    const targetColumnWidth = 220;
    let actualColumnWidth = 0;
    const gap = 15;
    let columnHeights = [];
    let numColumns = 0;

    // --- 新增：追踪当前屏幕方向的状态 ---
    let isCurrentlyLandscape = window.innerWidth > window.innerHeight;

    // Fisher-Yates 洗牌算法
    function shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }

    // --- 新增：设置和加载背景轮播的函数 ---
    function setupCarousel() {
        // 清空现有的背景图片
        backgroundCarousel.innerHTML = '';

        // 判断当前屏幕方向
        isCurrentlyLandscape = window.innerWidth > window.innerHeight;
        const carouselSource = isCurrentlyLandscape ? landscapeImages : portraitImages;

        // 如果对应的图片列表为空，则使用另一个列表作为备用
        const imagesForCarousel = carouselSource.length > 0 ? carouselSource : (isCurrentlyLandscape ? portraitImages : landscapeImages);

        if (imagesForCarousel.length === 0) return; // 如果没有任何图片，则不执行

        // 加载图片到背景轮播
        imagesForCarousel.forEach(imageInfo => {
            const bgImg = new Image();
            bgImg.src = `assets/${imageInfo.type}/${imageInfo.id}.${imageInfo.ext}`;
            backgroundCarousel.appendChild(bgImg);
        });

        // 如果图片数量较少，复制一份以确保动画无缝衔接
        if (imagesForCarousel.length < 15) {
            imagesForCarousel.forEach(imageInfo => {
                const bgImg = new Image();
                bgImg.src = `assets/${imageInfo.type}/${imageInfo.id}.${imageInfo.ext}`;
                backgroundCarousel.appendChild(bgImg);
            });
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

            // --- 修改：为不同的用途创建和随机化独立的图片列表 ---
            // 1. 用于背景轮播的图片列表
            portraitImages = [...portraitIndex];
            landscapeImages = [...landscapeIndex];
            shuffleArray(portraitImages);
            shuffleArray(landscapeImages);

            // 2. 用于画廊内容的混合图片列表
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

                // --- 修改：移除此处向背景添加图片的代码 ---
                // const bgImg = img.cloneNode();
                // backgroundCarousel.appendChild(bgImg);

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

            // --- 新增：检查屏幕方向是否改变，如果改变则重新加载背景轮播 ---
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
        // --- 修改：在初次加载时独立设置背景轮播 ---
        setupCarousel();
        loadMoreImages();
    }

    initialize();
});