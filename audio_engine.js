class AudioEngine {
    constructor() {
        this.recognition = null;
        this.isListening = false;
        this.shouldListen = false;
        this.restartDelayMs = 350;

        this.onTranscriptFinal = null;
        this.onTranscriptInterim = null;
        this.onError = null;

        this.init();
    }

    init() {
        window.SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

        if (!window.SpeechRecognition) {
            console.error("Web Speech API non supportee sur ce navigateur.");
            return;
        }

        this.recognition = new window.SpeechRecognition();
        this.recognition.lang = "fr-FR";
        this.recognition.continuous = true;
        this.recognition.interimResults = true;

        this.recognition.onstart = () => {
            this.isListening = true;
        };

        this.recognition.onerror = (event) => {
            const error = event.error || "unknown";
            console.error("AudioEngine recognition error:", error);

            if (error === "not-allowed" || error === "service-not-allowed") {
                this.shouldListen = false;
                this.isListening = false;
            }

            if (this.onError) {
                this.onError(error);
            }
        };

        this.recognition.onend = () => {
            this.isListening = false;

            if (!this.shouldListen) return;

            window.setTimeout(() => {
                if (!this.shouldListen || this.isListening) return;

                try {
                    this.recognition.start();
                } catch (error) {
                    console.warn("AudioEngine restart skipped:", error.message);
                }
            }, this.restartDelayMs);
        };

        this.recognition.onresult = (event) => {
            let interimTranscript = "";
            let finalTranscript = "";

            for (let index = event.resultIndex; index < event.results.length; index += 1) {
                const transcript = event.results[index][0].transcript;
                if (event.results[index].isFinal) {
                    finalTranscript += transcript;
                } else {
                    interimTranscript += transcript;
                }
            }

            if (interimTranscript.trim() && this.onTranscriptInterim) {
                this.onTranscriptInterim(interimTranscript.trim());
            }

            if (finalTranscript.trim() && this.onTranscriptFinal) {
                this.onTranscriptFinal(finalTranscript.trim());
            }
        };
    }

    startListening() {
        if (!this.recognition) {
            if (this.onError) {
                this.onError("unsupported");
            }
            return false;
        }

        if (this.shouldListen || this.isListening) {
            return false;
        }

        this.shouldListen = true;

        try {
            this.recognition.start();
            this.isListening = true;
            return true;
        } catch (error) {
            this.shouldListen = false;
            this.isListening = false;
            console.error("AudioEngine start error:", error);

            if (this.onError) {
                this.onError(error.message || "start-failed");
            }

            return false;
        }
    }

    stopListening() {
        this.shouldListen = false;

        if (!this.recognition) {
            this.isListening = false;
            return;
        }

        if (this.isListening) {
            try {
                this.recognition.stop();
            } catch (error) {
                console.warn("AudioEngine stop skipped:", error.message);
            }
        }

        this.isListening = false;
    }
}

window.AudioEngine = AudioEngine;
