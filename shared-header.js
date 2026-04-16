(function () {
    const headerHost = document.getElementById('site-header');
    if (!headerHost) {
        return;
    }

    headerHost.innerHTML = [
        '<header>',
        '    <div class="header-content">',
        '        <div class="header-left">',
        '            <a href="index.html">Work</a>',
        '            <a href="contact.html">Contact</a>',
        '            <a href="https://www.inprnt.com/gallery/floati/" target="_blank" rel="noopener noreferrer">Prints</a>',
        '        </div>',
        '        <div class="logo">FLOATI</div>',
        '        <div class="header-right">',
        '            <a href="https://www.instagram.com/flxti01/" target="_blank" rel="noopener noreferrer">Instagram</a>',
        '            <a href="https://x.com/flxti" target="_blank" rel="noopener noreferrer">Twitter</a>',
        '        </div>',
        '    </div>',
        '</header>'
    ].join('');
})();
