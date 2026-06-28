(async function initExtension() {
    if (document.getElementById('intruth-extension-root')) return;

    // Inject CSS
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = chrome.runtime.getURL('style.css');
    document.head.appendChild(link);

    // Inject UI Wrapper
    const wrapper = document.createElement('div');
    wrapper.id = 'intruth-extension-root';

    try {
        const response = await fetch(chrome.runtime.getURL('ui.html'));
        wrapper.innerHTML = await response.text();
        document.documentElement.appendChild(wrapper);

        // --- 1. Gestion du Plein Écran ---
        document.addEventListener("fullscreenchange", () => {
            const fsElement = document.fullscreenElement;
            if (fsElement) {
                // Déplace l'extension DANS l'élément plein écran pour qu'elle reste au-dessus
                fsElement.appendChild(wrapper);
            } else {
                // Retour à la position normale
                document.documentElement.appendChild(wrapper);
            }
        });

        // --- 2. Indestructibilité SPA ---
        // Surveille si le site web supprime notre extension lors d'un changement de page
        const observer = new MutationObserver(() => {
            if (!document.getElementById('intruth-extension-root')) {
                const target = document.fullscreenElement || document.documentElement;
                target.appendChild(wrapper);
            }
        });
        observer.observe(document.documentElement, { childList: true });

        // Initialize App
        window.app = new window.FactCheckApp();
        console.log("InTruth TV Extension successfully injected and secured.");
    } catch (e) {
        console.error("Failed to inject InTruth TV:", e);
    }
})();
