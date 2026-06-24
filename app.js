class FactCheckApp {
    constructor() {
        this.currentMode = 'popup'; // 'popup' ou 'sidebar'
        this.factCheckMode = 'sim'; // 'sim' ou 'live'
        
        this.audioEngine = new window.AudioEngine();
        this.llmClient = null;

        this.initUI();
        this.bindEvents();
    }

    initUI() {
        this.uiPopups = document.getElementById('ui-popups');
        this.uiSidebar = document.getElementById('ui-sidebar');
        this.popupContainer = document.getElementById('popup-container');
        this.sidebarFeed = document.getElementById('sidebar-feed');
        this.transcriptDebug = document.getElementById('transcript-debug');
        this.micStatus = document.getElementById('mic-status');
    }

    bindEvents() {
        // Toggle Dev Panel
        document.getElementById('dev-header-toggle').addEventListener('click', () => {
            const content = document.getElementById('dev-content');
            const icon = document.getElementById('toggle-icon');
            if (content.style.display === 'none') {
                content.style.display = 'flex';
                icon.innerText = '▲';
            } else {
                content.style.display = 'none';
                icon.innerText = '▼';
            }
        });

        // Bouton Historique
        const btnHistory = document.getElementById('btn-toggle-history');
        if (btnHistory) {
            btnHistory.addEventListener('click', () => {
                const sidebar = document.getElementById('ui-sidebar');
                if (sidebar.classList.contains('hidden')) {
                    sidebar.classList.remove('hidden');
                    btnHistory.innerHTML = '✕ Fermer l\'historique';
                } else {
                    sidebar.classList.add('hidden');
                    btnHistory.innerHTML = '📋 Historique';
                }
            });
        }

        // Mode Fact-Checking (Simulation vs Live)
        document.getElementById('btn-mode-sim').addEventListener('click', (e) => {
            this.setFactCheckMode('sim');
            document.querySelectorAll('#btn-mode-sim, #btn-mode-live').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
        });
        document.getElementById('btn-mode-live').addEventListener('click', (e) => {
            this.setFactCheckMode('live');
            document.querySelectorAll('#btn-mode-sim, #btn-mode-live').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
        });

        // Boutons Simulation
        document.getElementById('btn-sim-false').addEventListener('click', () => this.triggerSimulation('false'));
        document.getElementById('btn-sim-misleading').addEventListener('click', () => this.triggerSimulation('misleading'));
        document.getElementById('btn-sim-true').addEventListener('click', () => this.triggerSimulation('true'));

        // Lancement Écoute Live
        document.getElementById('btn-start-listening').addEventListener('click', () => this.toggleLiveListening());

        // Chargement Vidéo YouTube
        document.getElementById('btn-load-yt').addEventListener('click', () => this.loadYouTubeVideo());

        // Callbacks de l'AudioEngine
        this.audioEngine.onTranscriptInterim = (text) => {
            if (this.factCheckMode === 'live') {
                this.transcriptDebug.innerHTML = `<i>${text}</i>`;
                this.transcriptDebug.scrollTop = this.transcriptDebug.scrollHeight;
                
                const subtitleText = document.getElementById('subtitles-text');
                if (subtitleText) {
                    subtitleText.innerHTML = `<span style="color: rgba(255,255,255,0.7); font-style: italic;">${text}</span>`;
                }
            }
        };

        this.audioEngine.onTranscriptFinal = async (text) => {
            if (this.factCheckMode === 'live') {
                this.transcriptDebug.innerHTML += `<br/><b>${text}</b>`;
                this.transcriptDebug.scrollTop = this.transcriptDebug.scrollHeight;
                
                const subtitleText = document.getElementById('subtitles-text');
                if (subtitleText) {
                    subtitleText.innerHTML = `<b>${text}</b>`;
                }
                
                await this.processLiveTranscript(text);
            }
        };

        this.audioEngine.onError = (error) => {
            if (this.factCheckMode === 'live') {
                console.error("App Recog Error:", error);
                const subtitleText = document.getElementById('subtitles-text');
                if (error === 'not-allowed') {
                    this.micStatus.innerText = "⚠️ Microphone bloqué. Autorisez l'accès.";
                    this.micStatus.style.color = "var(--color-false)";
                    this.transcriptDebug.innerHTML = "<span style='color:var(--color-false)'>Erreur: Permission micro manquante. Autorisez le microphone dans la barre d'adresse du navigateur.</span>";
                    if (subtitleText) subtitleText.innerHTML = "<span style='color:var(--color-false)'>⚠️ Erreur : Autorisez le micro dans le navigateur</span>";
                } else if (error === 'no-speech') {
                    // no-speech est un timeout normal si l'on ne parle pas
                } else {
                    this.micStatus.innerText = `⚠️ Erreur micro: ${error}`;
                    if (subtitleText) subtitleText.innerHTML = `<span style='color:var(--color-false)'>Erreur micro : ${error}</span>`;
                }
            }
        };
    }

    setUIMode(mode) {
        this.currentMode = mode;
        if (mode === 'popup') {
            this.uiPopups.classList.remove('hidden');
            this.uiSidebar.classList.add('hidden');
        } else {
            this.uiPopups.classList.add('hidden');
            this.uiSidebar.classList.remove('hidden');
        }
    }

    setFactCheckMode(mode) {
        this.factCheckMode = mode;
        if (mode === 'sim') {
            document.getElementById('sim-settings-panel').classList.remove('hidden');
            document.getElementById('live-settings-panel').classList.add('hidden');
            this.audioEngine.stopListening();
            this.updateMicStatus(false);
        } else {
            document.getElementById('sim-settings-panel').classList.add('hidden');
            document.getElementById('live-settings-panel').classList.remove('hidden');
        }
    }

    loadYouTubeVideo() {
        const urlInput = document.getElementById('yt-url-input').value.trim();
        const tvContainer = document.getElementById('tv-container');
        const player = document.getElementById('youtube-player');
        
        if (!urlInput) {
            player.src = "";
            tvContainer.classList.remove('has-video');
            return;
        }

        const videoId = this.extractYouTubeVideoId(urlInput);
        if (videoId) {
            // Chargement de l'iframe YouTube en mode cover (sans mute=1 ni autoplay=1 pour éviter le blocage du son par le navigateur)
            player.src = `https://www.youtube.com/embed/${videoId}?enablejsapi=1&controls=1`;
            tvContainer.classList.add('has-video');
        } else {
            alert("Format d'URL YouTube invalide. Veuillez entrer un lien complet ou directement l'ID de la vidéo.");
        }
    }

    extractYouTubeVideoId(url) {
        if (url.length === 11 && !url.includes('/') && !url.includes('.')) {
            return url;
        }
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
        const match = url.match(regExp);
        return (match && match[2].length === 11) ? match[2] : null;
    }

    toggleLiveListening() {
        if (this.audioEngine.isListening) {
            this.audioEngine.stopListening();
            this.updateMicStatus(false);
        } else {
            const apiKey = document.getElementById('api-key-input').value.trim();
            const selectEl = document.getElementById('llm-model');
            const model = selectEl.value;
            const provider = selectEl.options[selectEl.selectedIndex].getAttribute('data-provider');
            
            if (!apiKey) {
                alert("Veuillez entrer une clé API valide.");
                return;
            }
            
            this.llmClient = new window.LLMClient(apiKey, provider, model);
            const started = this.audioEngine.startListening();
            if (started) {
                this.updateMicStatus(true);
                const hasVideo = document.getElementById('tv-container').classList.contains('has-video');
                if (hasVideo) {
                    this.transcriptDebug.innerHTML = "Écoute en cours... Lancez la vidéo. Le son de vos haut-parleurs doit être activé pour que votre micro le capte.";
                } else {
                    this.transcriptDebug.innerHTML = "Écoute en cours... Parlez dans le micro ou approchez-le d'une source audio.";
                }
            }
        }
    }

    updateMicStatus(isListening) {
        const btn = document.getElementById('btn-start-listening');
        const subtitleBar = document.getElementById('live-subtitles');
        if (isListening) {
            btn.innerHTML = '<i class="fas fa-stop"></i> Arrêter l\'écoute';
            btn.style.background = '#555';
            this.micStatus.innerText = "Microphone ACTIF - Enregistrement en cours...";
            this.micStatus.style.color = "var(--color-false)";
            // On laisse la barre de sous-titres cachée pour la démo finale (mode discret)
            // if (subtitleBar) subtitleBar.classList.remove('hidden');
        } else {
            btn.innerHTML = '<i class="fas fa-microphone"></i> Lancer l\'écoute Live';
            btn.style.background = 'var(--red-free)';
            this.micStatus.innerText = "Microphone inactif";
            this.micStatus.style.color = "var(--text-muted)";
            if (subtitleBar) {
                subtitleBar.classList.add('hidden');
                document.getElementById('subtitles-text').innerText = "En attente de voix...";
            }
        }
    }

    // --- LOGIQUE DE SIMULATION ---
    triggerSimulation(type) {
        const data = window.claimsData[type];
        if (data) {
            this.displayFactCheck(data);
        }
    }

    // --- LOGIQUE LIVE (LLM) ---
    async processLiveTranscript(transcriptText) {
        if (!this.llmClient) return;

        // On affiche un mini statut "Vérification..." si on veut, 
        // mais pour l'effet TV, on attend d'avoir le résultat.
        const result = await this.llmClient.evaluateClaim(transcriptText);
        
        if (result && result.hasClaim) {
            this.displayFactCheck(result);
        }
    }

    // --- AFFICHAGE UI ---
    displayFactCheck(data) {
        // Toujours ajouter à l'historique (Volet Droit)
        this.createSidebarCard(data);
        
        // Afficher le popup uniquement si c'est faux ou nuancé
        if (data.verdictType !== 'true') {
            this.createPopup(data);
        }
    }

    createPopup(data) {
        const card = document.createElement('div');
        card.className = `fact-card popup-card ${data.verdictType}`;
        
        const iconClass = data.verdictType === 'error' ? 'fa-times-circle' : 'fa-exclamation-triangle';
        
        card.innerHTML = `
            <div class="card-icon"><i class="fas ${iconClass}"></i></div>
            <div class="card-content">
                <div class="card-header">
                    <span class="badge badge-${data.verdictType}">${data.verdict}</span>
                    <span class="speaker-name">${data.speaker}</span>
                </div>
                <p class="claim-text">"${data.claim}"</p>
                <p class="correction-text"><strong>Correction :</strong> ${data.correction}</p>
                <p class="source-text" style="font-size:0.75rem; color:#aaa; margin-top:4px;"><i class="fas fa-shield-alt"></i> Source : ${data.sourceName}</p>
            </div>
        `;

        this.popupContainer.appendChild(card);

        // Disparition automatique après 8 secondes
        setTimeout(() => {
            card.classList.add('hide');
            setTimeout(() => card.remove(), 400); // Nettoyage du DOM après l'animation
        }, 8000);
    }

    createSidebarCard(data) {
        const card = document.createElement('div');
        card.className = `sidebar-card ${data.verdictType}`;
        
        const time = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

        card.innerHTML = `
            <div class="card-header" style="display:flex; justify-content:space-between; align-items:center;">
                <span class="badge badge-${data.verdictType}">${data.verdict}</span>
                <span style="font-size:0.75rem; color:var(--text-muted);">${time}</span>
            </div>
            <p class="speaker-name" style="margin-bottom:4px;">${data.speaker}</p>
            <p class="claim-text">"${data.claim}"</p>
            <p class="correction-text"><strong>Correction :</strong> ${data.correction}</p>
            <p class="source-text" style="font-size:0.75rem; color:var(--text-muted); margin-top:8px;">Source : ${data.sourceName}</p>
        `;

        // Insérer au début de la liste
        this.sidebarFeed.insertBefore(card, this.sidebarFeed.firstChild);
    }
}

// Initialisation au chargement
window.onload = () => {
    window.claimsData = claimsData; // Assigne la variable globale pour la simulation
    window.app = new FactCheckApp();
};
