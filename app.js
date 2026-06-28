const VERDICT_META = {
    error: {
        verdict: "FAUX",
        badgeClass: "badge-error",
        icon: "circle-x"
    },
    misleading: {
        verdict: "NUANCE",
        badgeClass: "badge-misleading",
        icon: "triangle-alert"
    },
    true: {
        verdict: "VRAI",
        badgeClass: "badge-true",
        icon: "circle-check"
    },
    unknown: {
        verdict: "NON VERIFIABLE",
        badgeClass: "badge-unknown",
        icon: "circle-help"
    }
};

const CONFIDENCE_LABELS = {
    high: "confiance haute",
    medium: "confiance moyenne",
    low: "confiance faible"
};

function renderIcons() {
    if (window.lucide && typeof window.lucide.createIcons === "function") {
        window.lucide.createIcons();
    }
}

function createElement(tagName, options = {}) {
    const element = document.createElement(tagName);

    if (options.className) {
        element.className = options.className;
    }

    if (options.text !== undefined) {
        element.textContent = options.text;
    }

    if (options.attributes) {
        Object.entries(options.attributes).forEach(([name, value]) => {
            if (value !== undefined && value !== null) {
                element.setAttribute(name, value);
            }
        });
    }

    return element;
}

function createIcon(iconName, className = "") {
    return createElement("i", {
        className,
        attributes: {
            "data-lucide": iconName,
            "aria-hidden": "true"
        }
    });
}

function setButtonContent(button, iconName, text) {
    button.replaceChildren(createIcon(iconName), createElement("span", { text }));
    renderIcons();
}

function normalizeText(value, fallback = "") {
    return String(value ?? fallback).replace(/\s+/g, " ").trim();
}

function clampText(value, fallback, maxLength) {
    const text = normalizeText(value, fallback);
    return text.length > maxLength ? `${text.slice(0, maxLength - 3)}...` : text;
}

function normalizeFactCheckData(rawData) {
    const data = rawData && typeof rawData === "object" ? rawData : {};
    const verdictType = VERDICT_META[data.verdictType] ? data.verdictType : "unknown";
    const confidence = ["high", "medium", "low"].includes(data.confidence) ? data.confidence : "low";
    const sourceUrl = normalizeText(data.sourceUrl);

    return {
        hasClaim: Boolean(data.hasClaim ?? true),
        verdictType,
        verdict: clampText(data.verdict, VERDICT_META[verdictType].verdict, 30) || VERDICT_META[verdictType].verdict,
        speaker: clampText(data.speaker, "Intervenant", 80),
        claim: clampText(data.claim, "Affirmation non fournie", 260),
        correction: clampText(data.correction, "Verification insuffisante pour trancher proprement.", 420),
        sourceName: clampText(data.sourceName, "Source non fournie", 120),
        sourceUrl: /^https?:\/\//i.test(sourceUrl) ? sourceUrl : "",
        confidence,
        latency: clampText(data.latency, "", 20)
    };
}

class FactCheckApp {
    constructor() {
        this.currentMode = "popup";
        this.factCheckMode = "sim";
        this.historyCount = 0;
        this.transcriptQueue = [];
        this.isProcessingTranscript = false;
        this.lastTranscriptSignature = "";

        this.audioEngine = new window.AudioEngine();
        this.llmClient = null;

        this.initUI();
        this.bindEvents();
        renderIcons();
    }

    initUI() {
        this.uiPopups = document.getElementById("ui-popups");
        this.uiSidebar = document.getElementById("ui-sidebar");
        this.popupContainer = document.getElementById("popup-container");
        this.sidebarFeed = document.getElementById("sidebar-feed");
        this.sidebarEmpty = document.getElementById("sidebar-empty");
        this.sidebarCount = document.getElementById("sidebar-count");
        this.transcriptDebug = document.getElementById("transcript-debug");
        this.micStatus = document.getElementById("mic-status");
        this.checkStatus = document.getElementById("check-status");
        this.subtitlesText = document.getElementById("subtitles-text");
        this.devContent = document.getElementById("dev-content");
        this.devHeaderToggle = document.getElementById("dev-header-toggle");
        this.toggleIcon = document.getElementById("toggle-icon");
        this.btnStartListening = document.getElementById("btn-start-listening");
        this.btnHistory = document.getElementById("btn-toggle-history");

        // Load settings from storage
        if (typeof chrome !== "undefined" && chrome.storage) {
            chrome.storage.local.get(["apiKey", "model"], (result) => {
                if (result.apiKey) {
                    document.getElementById("api-key-input").value = result.apiKey;
                }
                if (result.model) {
                    document.getElementById("llm-model").value = result.model;
                }
            });
        }
    }

    bindEvents() {
        const wasDragged = this.makeDraggable(document.getElementById("dev-panel"), this.devHeaderToggle);

        this.devHeaderToggle.addEventListener("click", (e) => {
            if (wasDragged()) {
                e.preventDefault();
                e.stopPropagation();
                return;
            }
            this.toggleDevPanel();
        });
        
        this.btnHistory.addEventListener("click", () => this.toggleHistoryPanel());

        document.getElementById("btn-mode-sim").addEventListener("click", (event) => {
            this.setFactCheckMode("sim");
            this.setActiveModeButton(event.currentTarget);
        });

        document.getElementById("btn-mode-live").addEventListener("click", (event) => {
            this.setFactCheckMode("live");
            this.setActiveModeButton(event.currentTarget);
        });

        document.getElementById("btn-sim-false")?.addEventListener("click", () => this.triggerSimulation("false"));
        document.getElementById("btn-sim-misleading")?.addEventListener("click", () => this.triggerSimulation("misleading"));
        document.getElementById("btn-sim-true")?.addEventListener("click", () => this.triggerSimulation("true"));
        document.getElementById("btn-start-listening")?.addEventListener("click", () => this.toggleLiveListening());

        this.audioEngine.onTranscriptInterim = (text) => this.handleInterimTranscript(text);
        this.audioEngine.onTranscriptFinal = (text) => this.handleFinalTranscript(text);
        this.audioEngine.onError = (error) => this.handleAudioError(error);
    }

    toggleDevPanel() {
        const isOpening = this.devContent.style.display === "none" || !this.devContent.style.display;
        this.devContent.style.display = isOpening ? "flex" : "none";
        this.devHeaderToggle.setAttribute("aria-expanded", String(isOpening));
        this.toggleIcon.setAttribute("data-lucide", isOpening ? "chevron-up" : "chevron-down");
        renderIcons();
    }

    makeDraggable(panel, handle) {
        let isDragging = false;
        let startX, startY, initialLeft, initialTop;
        let hasMoved = false;

        handle.addEventListener("mousedown", (e) => {
            // Seuls les clics gauches initient le drag
            if (e.button !== 0) return;
            isDragging = true;
            hasMoved = false;
            startX = e.clientX;
            startY = e.clientY;
            
            const rect = panel.getBoundingClientRect();
            initialLeft = rect.left;
            initialTop = rect.top;

            // Libérer les contraintes pour permettre le mouvement fluide
            panel.style.right = "auto";
            panel.style.bottom = "auto";
            panel.style.margin = "0";
            
            handle.style.cursor = "grabbing";
        });

        document.addEventListener("mousemove", (e) => {
            if (!isDragging) return;
            
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            
            if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
                hasMoved = true;
            }

            if (hasMoved) {
                panel.style.left = `${initialLeft + dx}px`;
                panel.style.top = `${initialTop + dy}px`;
            }
        });

        document.addEventListener("mouseup", () => {
            if (isDragging) {
                isDragging = false;
                handle.style.cursor = "grab";
            }
        });
        
        handle.style.cursor = "grab";
        return () => hasMoved;
    }

    toggleHistoryPanel() {
        const isOpening = this.uiSidebar.classList.contains("hidden");
        this.uiSidebar.classList.toggle("hidden", !isOpening);
        document.body.classList.toggle("history-open", isOpening);
        setButtonContent(this.btnHistory, isOpening ? "panel-right-close" : "panel-right-open", isOpening ? "Fermer" : "Historique");
    }

    setActiveModeButton(activeButton) {
        document.querySelectorAll("#btn-mode-sim, #btn-mode-live").forEach((button) => {
            button.classList.toggle("active", button === activeButton);
        });
    }

    setFactCheckMode(mode) {
        this.factCheckMode = mode;

        if (mode === "sim") {
            document.getElementById("sim-settings-panel").classList.remove("hidden");
            document.getElementById("live-settings-panel").classList.add("hidden");
            this.audioEngine.stopListening();
            this.updateMicStatus(false);
            this.setCheckStatus("Mode simulation actif.", "muted");
            return;
        }

        document.getElementById("sim-settings-panel").classList.add("hidden");
        document.getElementById("live-settings-panel").classList.remove("hidden");
        this.setCheckStatus("Pret pour le fact-checking live.", "muted");
        renderIcons();
    }

    loadYouTubeVideo() {
        const urlInput = document.getElementById("yt-url-input").value.trim();
        const tvContainer = document.getElementById("tv-container");
        const player = document.getElementById("youtube-player");

        if (!urlInput) {
            player.src = "";
            tvContainer.classList.remove("has-video");
            this.setCheckStatus("Fond video retire.", "muted");
            return;
        }

        const videoId = this.extractYouTubeVideoId(urlInput);
        if (!videoId) {
            this.setCheckStatus("Lien YouTube invalide.", "error");
            return;
        }

        player.src = `https://www.youtube.com/embed/${videoId}?enablejsapi=1&controls=1&rel=0`;
        tvContainer.classList.add("has-video");
        this.setCheckStatus("Video chargee.", "success");
    }

    extractYouTubeVideoId(value) {
        const input = value.trim();

        if (/^[a-zA-Z0-9_-]{11}$/.test(input)) {
            return input;
        }

        try {
            const url = new URL(input.includes("://") ? input : `https://${input}`);
            const host = url.hostname.replace(/^www\./, "");

            if (host === "youtu.be") {
                return /^[a-zA-Z0-9_-]{11}$/.test(url.pathname.slice(1)) ? url.pathname.slice(1) : null;
            }

            if (host.endsWith("youtube.com")) {
                const watchId = url.searchParams.get("v");
                if (watchId && /^[a-zA-Z0-9_-]{11}$/.test(watchId)) return watchId;

                const parts = url.pathname.split("/").filter(Boolean);
                const embedIndex = parts.findIndex((part) => ["embed", "shorts", "live"].includes(part));
                const candidate = embedIndex >= 0 ? parts[embedIndex + 1] : null;
                return candidate && /^[a-zA-Z0-9_-]{11}$/.test(candidate) ? candidate : null;
            }
        } catch (error) {
            return null;
        }

        return null;
    }

    toggleLiveListening() {
        if (this.audioEngine.isListening) {
            this.audioEngine.stopListening();
            this.updateMicStatus(false);
            this.setCheckStatus("Ecoute arretee.", "muted");
            return;
        }

        const apiKey = document.getElementById("api-key-input").value.trim();
        const selectEl = document.getElementById("llm-model");
        const model = selectEl.value;
        const provider = selectEl.options[selectEl.selectedIndex].getAttribute("data-provider");

        if (!apiKey) {
            this.setCheckStatus("Ajoute une cle API avant de lancer l'ecoute.", "error");
            return;
        }

        // Save settings
        if (typeof chrome !== "undefined" && chrome.storage) {
            chrome.storage.local.set({ apiKey, model });
        }

        this.llmClient = new window.LLMClient(apiKey, provider, model);
        this.transcriptQueue = [];
        this.lastTranscriptSignature = "";

        const started = this.audioEngine.startListening();
        if (!started) return;

        this.updateMicStatus(true);
        this.setCheckStatus("Ecoute active. Les affirmations detectees seront verifiees.", "loading");
        this.resetTranscriptDebug("En attente de voix...");
    }

    updateMicStatus(isListening) {
        if (isListening) {
            setButtonContent(this.btnStartListening, "mic-off", "Arreter l'ecoute");
            this.btnStartListening.classList.add("is-active");
            this.micStatus.textContent = "Microphone actif.";
            this.micStatus.style.color = "var(--color-false)";
            return;
        }

        setButtonContent(this.btnStartListening, "mic", "Demarrer l'ecoute");
        this.btnStartListening.classList.remove("is-active");
        this.micStatus.textContent = "Microphone inactif";
        this.micStatus.style.color = "var(--text-muted)";
        this.subtitlesText.textContent = "En attente de voix...";
        document.getElementById("live-subtitles").classList.add("hidden");
    }

    handleInterimTranscript(text) {
        if (this.factCheckMode !== "live") return;

        this.appendTranscriptLine(text, "interim", true);
        this.subtitlesText.textContent = text;
    }

    handleFinalTranscript(text) {
        if (this.factCheckMode !== "live") return;

        this.appendTranscriptLine(text, "final");
        this.subtitlesText.textContent = text;
        this.processLiveTranscript(text);
    }

    handleAudioError(error) {
        if (this.factCheckMode !== "live") return;

        if (error === "no-speech") {
            this.setCheckStatus("Aucune voix detectee pour le moment.", "muted");
            return;
        }

        if (error === "not-allowed" || error === "service-not-allowed") {
            this.audioEngine.stopListening();
            this.updateMicStatus(false);
            this.setCheckStatus("Microphone bloque par le navigateur.", "error");
            this.resetTranscriptDebug("Autorise le micro dans le navigateur pour utiliser le live.");
            return;
        }

        if (error === "unsupported") {
            this.setCheckStatus("Reconnaissance vocale non supportee par ce navigateur.", "error");
            return;
        }

        if (error === "network") {
            // Edge/Chrome frequently drop the connection, audio_engine will auto-restart
            return;
        }

        this.setCheckStatus(`Erreur micro : ${error}`, "error");
    }

    resetTranscriptDebug(text) {
        this.transcriptDebug.replaceChildren(createElement("div", {
            className: "transcript-line",
            text
        }));
    }

    appendTranscriptLine(text, type, replaceInterim = false) {
        if (replaceInterim) {
            const previousInterim = this.transcriptDebug.querySelector(".transcript-line.interim");
            if (previousInterim) previousInterim.remove();
        }

        if (this.transcriptDebug.childNodes.length === 1 && this.transcriptDebug.textContent === "En attente de voix...") {
            this.transcriptDebug.replaceChildren();
        }

        const line = createElement("div", {
            className: `transcript-line ${type}`,
            text
        });

        this.transcriptDebug.appendChild(line);

        while (this.transcriptDebug.children.length > 10) {
            this.transcriptDebug.firstElementChild.remove();
        }

        this.transcriptDebug.scrollTop = this.transcriptDebug.scrollHeight;
    }

    triggerSimulation(type) {
        const data = window.claimsData[type];
        if (data) {
            this.displayFactCheck(data);
            this.setCheckStatus("Carte de simulation ajoutee.", "success");
        }
    }

    processLiveTranscript(transcriptText) {
        if (!this.llmClient) return;

        const normalizedTranscript = normalizeText(transcriptText);
        if (!this.shouldEvaluateTranscript(normalizedTranscript)) return;

        this.transcriptQueue.push(normalizedTranscript);
        if (this.transcriptQueue.length > 4) {
            this.transcriptQueue.shift();
        }

        this.drainTranscriptQueue();
    }

    shouldEvaluateTranscript(text) {
        if (text.length < 24) return false;

        const signature = text.toLocaleLowerCase("fr-FR");
        if (signature === this.lastTranscriptSignature) return false;

        this.lastTranscriptSignature = signature;
        return true;
    }

    async drainTranscriptQueue() {
        if (this.isProcessingTranscript) return;
        this.isProcessingTranscript = true;

        while (this.transcriptQueue.length > 0) {
            const transcript = this.transcriptQueue.shift();
            this.setCheckStatus("Verification Groq en cours...", "loading");

            try {
                const result = await this.llmClient.evaluateClaim(transcript);

                if (result && result.hasClaim) {
                    this.displayFactCheck(result);
                    this.setCheckStatus("Verification ajoutee a l'historique.", "success");
                } else {
                    this.setCheckStatus("Aucune affirmation factuelle detectee.", "muted");
                }
            } catch (error) {
                console.error("Fact-checking error:", error);
                this.setCheckStatus(error.message || "Erreur pendant la verification.", "error");
            }
        }

        this.isProcessingTranscript = false;
    }

    displayFactCheck(rawData) {
        const data = normalizeFactCheckData(rawData);
        if (!data.hasClaim) return;

        this.createSidebarCard(data);

        if (data.verdictType === "error" || data.verdictType === "misleading") {
            this.createPopup(data);
        }
    }

    createPopup(data) {
        const card = this.createFactCard(data, "popup-card");
        this.popupContainer.appendChild(card);
        renderIcons();

        window.setTimeout(() => {
            card.classList.add("hide");
            window.setTimeout(() => card.remove(), 260);
        }, 18000);
    }

    createSidebarCard(data) {
        const card = this.createFactCard(data, "sidebar-card");
        card.querySelector(".card-time").textContent = new Date().toLocaleTimeString("fr-FR", {
            hour: "2-digit",
            minute: "2-digit"
        });

        this.sidebarEmpty.classList.add("hidden");
        this.sidebarFeed.prepend(card);
        this.historyCount += 1;
        this.sidebarCount.textContent = String(this.historyCount);
        renderIcons();
    }

    createFactCard(data, className) {
        const meta = VERDICT_META[data.verdictType] || VERDICT_META.unknown;
        const card = createElement("article", {
            className: `fact-card ${className} ${data.verdictType}`
        });

        const iconBox = createElement("div", {
            className: `card-icon ${data.verdictType}`
        });
        iconBox.appendChild(createIcon(meta.icon));

        const content = createElement("div", { className: "card-content" });
        const header = createElement("div", { className: "card-header" });

        header.appendChild(createElement("span", {
            className: `badge ${meta.badgeClass}`,
            text: data.verdict || meta.verdict
        }));

        if (className === "sidebar-card") {
            header.appendChild(createElement("span", { className: "card-time" }));
        } else {
            header.appendChild(createElement("span", {
                className: "speaker-name",
                text: data.speaker
            }));
        }

        content.appendChild(header);

        if (className === "sidebar-card") {
            content.appendChild(createElement("p", {
                className: "speaker-name",
                text: data.speaker
            }));
        }

        content.appendChild(createElement("p", {
            className: "claim-text",
            text: `"${data.claim}"`
        }));

        const correction = createElement("p", { className: "correction-text" });
        correction.appendChild(createElement("strong", { text: "Correction : " }));
        correction.appendChild(document.createTextNode(data.correction));
        content.appendChild(correction);
        content.appendChild(this.createSourceLine(data));

        card.appendChild(iconBox);
        card.appendChild(content);
        return card;
    }

    createSourceLine(data) {
        const source = createElement("p", { className: "source-text" });
        source.appendChild(createIcon("shield-check"));

        if (data.sourceUrl) {
            const link = createElement("a", {
                text: data.sourceName,
                attributes: {
                    href: data.sourceUrl,
                    target: "_blank",
                    rel: "noopener noreferrer"
                }
            });
            source.appendChild(document.createTextNode("Source : "));
            source.appendChild(link);
        } else {
            source.appendChild(document.createTextNode(`Source : ${data.sourceName}`));
        }

        source.appendChild(createElement("span", {
            className: "confidence-chip",
            text: CONFIDENCE_LABELS[data.confidence] || CONFIDENCE_LABELS.low
        }));

        return source;
    }

    setCheckStatus(message, variant = "muted") {
        this.checkStatus.textContent = message;
        this.checkStatus.className = `check-status ${variant}`;
    }
}

// Extension mode: initialized by content_script.js
window.FactCheckApp = FactCheckApp;
