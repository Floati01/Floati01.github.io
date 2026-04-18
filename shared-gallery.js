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
            '<img id="lightbox-image" alt="Expanded image">',
            '<video id="lightbox-video" controls loop playsinline muted preload="metadata" style="display:none; max-width:min(96vw, 1800px); max-height:92vh; width:auto; height:auto; box-shadow:0 10px 40px rgba(0, 0, 0, 0.5);"></video>'
        ].join('');
        document.body.appendChild(overlay);
        return overlay;
    }

    function createGalleryItem(src, altText, mediaType = 'image') {
        const item = document.createElement('div');
        item.className = 'gallery-item';

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
        }

        lightbox.classList.add('open');
        lightbox.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
        currentIndex = index;
    }

    function closeLightbox() {
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

    function loadExplicitImages() {
        explicitImages.forEach((imageName, index) => {
            const isVideo = /\.(mp4|webm|mov)$/i.test(imageName);
            createGalleryItem(`${folder}/${imageName}`, `${prefix} ${index + 1}`.trim(), isVideo ? 'video' : 'image');
        });
    }

    let currentIndex = -1;

    lightbox.addEventListener('click', (event) => {
        if (event.target === lightbox || event.target === lightboxImage) {
            closeLightbox();
        }
    });

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
        }
    });

    if (mode === 'explicit') {
        loadExplicitImages();
    } else {
        loadNumberedMedia();
    }
})();