class AudioEngine {
    constructor() {
        this.recognition = null;
        this.isListening = false;
        this.onTranscriptFinal = null; // Callback for final sentences
        this.onTranscriptInterim = null; // Callback for live typing effect
        
        this.init();
    }

    init() {
        // Vérification du support Web Speech API
        window.SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        
        if (!window.SpeechRecognition) {
            console.error("L'API Web Speech n'est pas supportée sur ce navigateur.");
            return;
        }

        this.recognition = new window.SpeechRecognition();
        this.recognition.lang = 'fr-FR';
        this.recognition.continuous = true; 
        this.recognition.interimResults = true; 

        this.recognition.onstart = () => {
            this.isListening = true;
            console.log("AudioEngine: Écoute démarrée");
        };

        this.recognition.onerror = (event) => {
            console.error("AudioEngine: Erreur de reconnaissance vocale", event.error);
            if (this.onError) {
                this.onError(event.error);
            }
        };

        this.recognition.onend = () => {
            console.log("AudioEngine: Écoute arrêtée");
            // Relancer automatiquement si on est supposé écouter (pour éviter les coupures)
            if (this.isListening) {
                try {
                    this.recognition.start();
                } catch(e) {
                    console.log("Relance silencieuse");
                }
            }
        };

        this.recognition.onresult = (event) => {
            let interimTranscript = '';
            let finalTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript;
                } else {
                    interimTranscript += event.results[i][0].transcript;
                }
            }

            if (interimTranscript.trim() && this.onTranscriptInterim) {
                this.onTranscriptInterim(interimTranscript);
            }

            if (finalTranscript.trim() && this.onTranscriptFinal) {
                // On envoie la phrase terminée
                this.onTranscriptFinal(finalTranscript.trim());
            }
        };
    }

    startListening() {
        if (!this.recognition) {
            alert("⚠️ Votre navigateur ne supporte pas la reconnaissance vocale intégrée (Web Speech API). Utilisez Google Chrome ou Microsoft Edge sur ordinateur pour cette fonctionnalité.");
            return false;
        }
        if (!this.isListening) {
            this.recognition.start();
            return true;
        }
        return false;
    }

    stopListening() {
        if (this.recognition && this.isListening) {
            this.isListening = false;
            this.recognition.stop();
        }
    }
}

// Rendre l'engin disponible globalement
window.AudioEngine = AudioEngine;
