(function () {
    const gallery = document.querySelector('.gallery[data-gallery-folder]');

    if (!gallery) {
        return;
    }

    const lightbox = document.getElementById('lightbox') || createLightbox();
    const lightboxImage = lightbox.querySelector('#lightbox-image');
    const folder = gallery.dataset.galleryFolder;
    const mode = (gallery.dataset.galleryMode || 'numbered').toLowerCase();
    const prefix = gallery.dataset.galleryPrefix || 'Image';
    const extensions = (gallery.dataset.galleryExtensions || 'jpg')
        .split(',')
        .map((extension) => extension.trim().replace(/^\./, '').toLowerCase())
        .filter(Boolean);
    const explicitImages = (gallery.dataset.galleryImages || '')
        .split(',')
        .map((imageName) => imageName.trim())
        .filter(Boolean);
    const maxSequentialImages = Number.parseInt(gallery.dataset.galleryMax || '250', 10);

    const thumbnails = [];

    function createLightbox() {
        const overlay = document.createElement('div');
        overlay.className = 'lightbox';
        overlay.id = 'lightbox';
        overlay.setAttribute('aria-hidden', 'true');
        overlay.innerHTML = [
            '<div id="lightbox-zoom-container" class="lightbox-zoom-container"><img id="lightbox-image" alt="Expanded image"></div>',
            '<video id="lightbox-video" controls loop playsinline muted preload="metadata" style="display:none; max-width:min(96vw, 1800px); max-height:92vh; width:auto; height:auto; box-shadow:0 10px 40px rgba(0, 0, 0, 0.5);"></video>'
        ].join('');
        document.body.appendChild(overlay);
        return overlay;
    }

    let lightboxZoomLevel = 1;
    let lightboxPanX = 0;
    let lightboxPanY = 0;
    let baseImageWidth = 0;
    let baseImageHeight = 0;
    let isPanning = false;
    let panStartX = 0;
    let panStartY = 0;

    function resetZoom() {
        lightboxZoomLevel = 1;
        lightboxPanX = 0;
        lightboxPanY = 0;
        const zoomContainer = lightbox.querySelector('#lightbox-zoom-container');
        if (zoomContainer) {
            zoomContainer.style.transform = 'scale(1) translate(0, 0)';
            lightboxImage.style.cursor = 'zoom-in';
        }
    }

    function updateZoomTransform() {
        const zoomContainer = lightbox.querySelector('#lightbox-zoom-container');
        if (zoomContainer) {
            zoomContainer.style.transform = `scale(${lightboxZoomLevel}) translate(${lightboxPanX}px, ${lightboxPanY}px)`;
            lightboxImage.style.cursor = lightboxZoomLevel > 1 ? (isPanning ? 'grabbing' : 'grab') : 'zoom-in';
        }
    }

    function cacheBaseImageSize() {
        baseImageWidth = lightboxImage.clientWidth;
        baseImageHeight = lightboxImage.clientHeight;
    }

    function getPanBounds() {
        const zoomContainer = lightbox.querySelector('#lightbox-zoom-container');
        if (!zoomContainer || !baseImageWidth || !baseImageHeight) {
            return { maxX: 0, maxY: 0 };
        }

        const scaledWidth = baseImageWidth * lightboxZoomLevel;
        const scaledHeight = baseImageHeight * lightboxZoomLevel;
        const maxX = Math.max(0, (scaledWidth - zoomContainer.clientWidth) / (2 * lightboxZoomLevel));
        const maxY = Math.max(0, (scaledHeight - zoomContainer.clientHeight) / (2 * lightboxZoomLevel));
        return { maxX, maxY };
    }

    function clampPanToBounds() {
        const { maxX, maxY } = getPanBounds();
        lightboxPanX = Math.min(maxX, Math.max(-maxX, lightboxPanX));
        lightboxPanY = Math.min(maxY, Math.max(-maxY, lightboxPanY));
    }

    function handleZoom(deltaY) {
        if (lightboxZoomLevel <= 1 && deltaY > 0) {
            return; // Don't zoom out below 1x
        }

        const oldZoom = lightboxZoomLevel;
        lightboxZoomLevel += deltaY > 0 ? -0.1 : 0.1;
        lightboxZoomLevel = Math.max(1, Math.min(5, lightboxZoomLevel));

        if (lightboxZoomLevel === 1) {
            lightboxPanX = 0;
            lightboxPanY = 0;
        }

        if (lightboxZoomLevel !== oldZoom) {
            clampPanToBounds();
            updateZoomTransform();
        }
    }

    function createGalleryItem(src, altText, mediaType = 'image', options = {}) {
        const item = document.createElement('div');
        item.className = 'gallery-item';

        if (options.aspectRatio) {
            item.style.setProperty('--gallery-item-aspect', options.aspectRatio);
        }

        let mediaElement;

        if (mediaType === 'video') {
            mediaElement = document.createElement('video');
            mediaElement.src = src;
            mediaElement.muted = true;
            mediaElement.loop = true;
            mediaElement.autoplay = true;
            mediaElement.playsInline = true;
            mediaElement.preload = 'metadata';
            mediaElement.controls = false;
        } else {
            mediaElement = document.createElement('img');
            mediaElement.loading = 'lazy';
            mediaElement.decoding = 'async';
            mediaElement.src = src;
        }

        mediaElement.alt = altText;
        mediaElement.dataset.mediaType = mediaType;

        item.appendChild(mediaElement);
        gallery.appendChild(item);
        thumbnails.push(mediaElement);

        mediaElement.addEventListener('click', () => {
            openLightbox(thumbnails.indexOf(mediaElement));
        });
    }

    function openLightbox(index) {
        resetZoom();
        const thumbnail = thumbnails[index];
        const lightboxVideo = lightbox.querySelector('#lightbox-video');

        if (!thumbnail) {
            return;
        }

        if (thumbnail.dataset.mediaType === 'video') {
            lightboxImage.style.display = 'none';
            lightboxVideo.style.display = 'block';
            lightboxVideo.src = thumbnail.src;
            lightboxVideo.loop = true;
            lightboxVideo.currentTime = 0;
            lightboxVideo.play().catch(() => {});
        } else {
            lightboxVideo.pause();
            lightboxVideo.removeAttribute('src');
            lightboxVideo.load();
            lightboxVideo.style.display = 'none';
            lightboxImage.style.display = 'block';
            lightboxImage.src = thumbnail.src;
            lightboxImage.alt = thumbnail.alt;
            lightboxImage.onload = () => {
                cacheBaseImageSize();
                clampPanToBounds();
                updateZoomTransform();
            };
        }

        lightbox.classList.add('open');
        lightbox.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
        currentIndex = index;
    }

    function closeLightbox() {
        isPanning = false;
        resetZoom();
        lightbox.classList.remove('open');
        lightbox.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
    }

    function showImage(index) {
        if (!thumbnails.length) {
            return;
        }

        const nextIndex = (index + thumbnails.length) % thumbnails.length;
        const thumbnail = thumbnails[nextIndex];
        const lightboxVideo = lightbox.querySelector('#lightbox-video');

        if (!thumbnail) {
            return;
        }

        currentIndex = nextIndex;

        if (thumbnail.dataset.mediaType === 'video') {
            lightboxImage.style.display = 'none';
            lightboxVideo.style.display = 'block';
            lightboxVideo.src = thumbnail.src;
            lightboxVideo.loop = true;
            lightboxVideo.currentTime = 0;
            lightboxVideo.play().catch(() => {});
        } else {
            lightboxVideo.pause();
            lightboxVideo.removeAttribute('src');
            lightboxVideo.load();
            lightboxVideo.style.display = 'none';
            lightboxImage.style.display = 'block';
            lightboxImage.src = thumbnail.src;
            lightboxImage.alt = thumbnail.alt;
        }
    }

    function mediaExists(src) {
        const extension = src.split('.').pop().toLowerCase();

        if (['mp4', 'webm', 'mov'].includes(extension)) {
            return new Promise((resolve) => {
                const testMedia = document.createElement('video');
                testMedia.preload = 'metadata';
                testMedia.onloadedmetadata = () => resolve(true);
                testMedia.onerror = () => resolve(false);
                testMedia.src = src;
            });
        }

        return new Promise((resolve) => {
            const testImage = new Image();
            testImage.onload = () => resolve(true);
            testImage.onerror = () => resolve(false);
            testImage.src = src;
        });
    }

    function loadImageDimensions(src) {
        return new Promise((resolve, reject) => {
            const testImage = new Image();
            testImage.onload = () => resolve({ width: testImage.naturalWidth, height: testImage.naturalHeight });
            testImage.onerror = reject;
            testImage.src = src;
        });
    }

    async function loadNumberedMedia() {
        for (let index = 1; index <= maxSequentialImages; index += 1) {
            let foundSrc = '';
            let foundType = 'image';

            for (const extension of extensions) {
                const candidateSrc = `${folder}/${index}.${extension}`;

                // Stop at the first matching numbered file, regardless of type.
                // This lets animation folders use 1.mp4 while image folders keep 1.jpg.
                // eslint-disable-next-line no-await-in-loop
                if (await mediaExists(candidateSrc)) {
                    foundSrc = candidateSrc;
                    foundType = extension === 'mp4' ? 'video' : 'image';
                    break;
                }
            }

            if (!foundSrc) {
                break;
            }

            createGalleryItem(foundSrc, `${prefix} ${index}`.trim(), foundType);
        }

        if (gallery.dataset.galleryLayout === 'adaptive-grid') {
            const itemCount = thumbnails.length;
            const columns = itemCount <= 1 ? 1 : itemCount === 2 ? 2 : 3;
            gallery.style.setProperty('--gallery-columns', String(columns));
            gallery.style.setProperty('--gallery-columns-mobile', String(Math.min(columns, 1)));
        }
    }

    async function loadNumberedStableMedia() {
        for (let index = 1; index <= maxSequentialImages; index += 1) {
            const candidateSrc = `${folder}/${index}.jpg`;

            // eslint-disable-next-line no-await-in-loop
            if (!(await mediaExists(candidateSrc))) {
                break;
            }

            // eslint-disable-next-line no-await-in-loop
            const dimensions = await loadImageDimensions(candidateSrc);
            const aspectRatio = `${dimensions.width} / ${dimensions.height}`;
            createGalleryItem(candidateSrc, `${prefix} ${index}`.trim(), 'image', { aspectRatio });
        }
    }

    function loadExplicitImages() {
        explicitImages.forEach((imageName, index) => {
            const isVideo = /\.(mp4|webm|mov)$/i.test(imageName);
            createGalleryItem(`${folder}/${imageName}`, `${prefix} ${index + 1}`.trim(), isVideo ? 'video' : 'image');
        });
    }

    let currentIndex = -1;
    const zoomContainer = lightbox.querySelector('#lightbox-zoom-container');

    lightbox.addEventListener('click', (event) => {
        if (event.target === lightbox || event.target === zoomContainer) {
            closeLightbox();
        }
    });

    if (zoomContainer) {
        // Wheel zoom
        lightbox.addEventListener('wheel', (event) => {
            if (!lightbox.classList.contains('open') || lightboxImage.style.display === 'none') {
                return;
            }
            event.preventDefault();
            handleZoom(event.deltaY);
        }, { passive: false });

        // Double-click to zoom
        lightboxImage.addEventListener('dblclick', (event) => {
            if (!lightbox.classList.contains('open') || lightboxImage.style.display === 'none') {
                return;
            }
            if (lightboxZoomLevel > 1.5) {
                resetZoom();
            } else {
                lightboxZoomLevel = 3;
                updateZoomTransform();
            }
        });

        // Touch pinch zoom
        let lastTouchDistance = 0;
        lightbox.addEventListener('touchmove', (event) => {
            if (!lightbox.classList.contains('open') || lightboxImage.style.display === 'none' || event.touches.length !== 2) {
                return;
            }
            event.preventDefault();
            const dx = event.touches[0].clientX - event.touches[1].clientX;
            const dy = event.touches[0].clientY - event.touches[1].clientY;
            const touchDistance = Math.sqrt(dx * dx + dy * dy);
            if (lastTouchDistance > 0) {
                const delta = touchDistance - lastTouchDistance;
                handleZoom(-delta * 0.05);
            }
            lastTouchDistance = touchDistance;
        }, { passive: false });

        lightbox.addEventListener('touchend', () => {
            lastTouchDistance = 0;
        });

        // Click-and-hold pan while zoomed in.
        lightboxImage.addEventListener('mousedown', (event) => {
            if (!lightbox.classList.contains('open') || lightboxImage.style.display === 'none' || lightboxZoomLevel <= 1) {
                return;
            }

            isPanning = true;
            panStartX = event.clientX - lightboxPanX;
            panStartY = event.clientY - lightboxPanY;
            updateZoomTransform();
            event.preventDefault();
        });

        document.addEventListener('mousemove', (event) => {
            if (!isPanning || !lightbox.classList.contains('open')) {
                return;
            }

            lightboxPanX = event.clientX - panStartX;
            lightboxPanY = event.clientY - panStartY;
            clampPanToBounds();
            updateZoomTransform();
        });

        document.addEventListener('mouseup', () => {
            if (!isPanning) {
                return;
            }

            isPanning = false;
            updateZoomTransform();
        });
    }

    document.addEventListener('keydown', (event) => {
        if (!lightbox.classList.contains('open')) {
            return;
        }

        if (event.key === 'Escape') {
            closeLightbox();
        } else if (event.key === 'ArrowRight') {
            showImage(currentIndex + 1);
        } else if (event.key === 'ArrowLeft') {
            showImage(currentIndex - 1);
        } else if (event.key === '+' || event.key === '=') {
            handleZoom(-0.2);
        } else if (event.key === '-') {
            handleZoom(0.2);
        }
    });

    if (mode === 'explicit') {
        loadExplicitImages();
    } else if (gallery.dataset.galleryLayout === 'stable-grid') {
        loadNumberedStableMedia();
    } else {
        loadNumberedMedia();
    }
})();