(function () {
    const headerHost = document.getElementById('site-header');
    if (!headerHost) {
        return;
    }

    if (!document.querySelector('.site-video-bg')) {
        const backgroundVideo = document.createElement('div');
        backgroundVideo.className = 'site-video-bg';
        backgroundVideo.setAttribute('aria-hidden', 'true');
        backgroundVideo.innerHTML = [
            '<video class="site-video-bg-video" autoplay muted loop playsinline preload="auto">',
            '    <source src="Banner.mp4" type="video/mp4">',
            '</video>'
        ].join('');
        document.body.prepend(backgroundVideo);
    }

    headerHost.innerHTML = [
        '<header>',
        '    <div class="header-content">',
        '        <a href="index.html" class="logo">FLOATI</a>',
        '        <button class="menu-toggle" type="button" aria-expanded="false" aria-controls="header-menu">Menu</button>',
        '        <div class="header-right" id="header-menu">',
        '            <a href="index.html">Work</a>',
        '            <a href="https://www.inprnt.com/gallery/floati/" target="_blank" rel="noopener noreferrer">Prints</a>',
        '            <a href="https://www.instagram.com/flxti01/" target="_blank" rel="noopener noreferrer">Instagram</a>',
        '            <a href="https://x.com/flxti" target="_blank" rel="noopener noreferrer">Twitter</a>',
        '            <a href="mailto:isakswiech@gmail.com">isakswiech@gmail.com</a>',
        '        </div>',
        '    </div>',
        '</header>'
    ].join('');

    const headerContent = headerHost.querySelector('.header-content');
    const menuToggle = headerHost.querySelector('.menu-toggle');
    const menuLinks = headerHost.querySelectorAll('.header-right a');

    if (headerContent && menuToggle) {
        menuToggle.addEventListener('click', () => {
            const isOpen = headerContent.classList.toggle('menu-open');
            menuToggle.setAttribute('aria-expanded', String(isOpen));
        });

        menuLinks.forEach((link) => {
            link.addEventListener('click', () => {
                headerContent.classList.remove('menu-open');
                menuToggle.setAttribute('aria-expanded', 'false');
            });
        });
    }
})();
