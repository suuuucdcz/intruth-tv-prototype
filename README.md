# InTruth TV - Real-Time Fact-Checking Prototype 🎙️✅

InTruth TV est un prototype de démonstration technique (Proof of Concept) visant à illustrer l'intégration d'un moteur de **fact-checking en temps réel** directement dans l'interface d'un flux vidéo en direct (comme une application TV, Freebox, ou OQEE).

Ce projet démontre qu'il est techniquement possible de transcrire et d'analyser à la volée un débat politique, en vérifiant les affirmations factuelles (chiffres, bilans) sans latence perceptible pour l'utilisateur final.

## 🚀 Fonctionnalités Clés

*   **Transcription Audio Temps Réel :** Utilisation de l'API `Web Speech` pour capter et transcrire le flux audio par blocs (chunking) avec une précision quasi instantanée.
*   **Moteur LLM Ultra-Rapide :** Intégration optimisée avec les API de dernière génération (Groq LPU, Gemini 1.5 Flash, Claude 3.5 Sonnet) pour garantir une latence sous la seconde.
*   **Filtrage Avancé (Prompt Engineering) :** Une mémoire glissante (Context Buffer) permet au LLM de comprendre le contexte de la conversation, d'ignorer les simples opinions, et de traquer spécifiquement les erreurs factuelles ou le cherry-picking.
*   **Interface TV Premium :** Design "Glassmorphism" non intrusif, superposé au flux vidéo. Deux modes d'affichage :
    *   **Pop-up central :** Alertes dynamiques pour les affirmations fausses ou trompeuses.
    *   **Volet d'historique :** Fil continu et permanent de l'ensemble des déclarations vérifiées.

## 🛠️ Architecture Technique

Le prototype fonctionne entièrement en environnement local (Frontend-only), ce qui garantit la sécurité des données et supprime la latence réseau liée à l'envoi de fichiers audio lourds :

1.  **Audio Engine (`audio_engine.js`) :** Gère la capture du microphone (ou du flux interne via câble virtuel) et segmente la parole de manière sémantique.
2.  **App Core (`app.js`) :** Orchestre l'interface utilisateur, met à jour le DOM de manière asynchrone, et gère les événements vidéo.
3.  **LLM Client (`llm_client.js`) :** Gère les requêtes HTTP asynchrones vers les fournisseurs d'IA, maintient la fenêtre de contexte glissante, et force un formatage strict (JSON) avec le rôle "Oracle/AFP".

## ⚙️ Installation & Démarrage

Le projet ne nécessite ni base de données, ni serveur backend lourd.

1.  **Cloner le dépôt :**
    ```bash
    git clone https://github.com/votre-nom/intruth-tv-prototype.git
    cd intruth-tv-prototype
    ```

2.  **Lancer un serveur local :**
    Utilisez n'importe quel serveur HTTP statique (ex: Python).
    ```bash
    python -m http.server 8000
    ```

3.  **Accéder à l'application :**
    Ouvrez votre navigateur Chrome à l'adresse : `http://localhost:8000`

4.  **Configuration (Dev Panel) :**
    *   Cliquez sur l'engrenage ⚙️ en haut à droite.
    *   Saisissez votre clé API (Groq, Google Gemini ou Anthropic). Aucune clé n'est stockée sur serveur, tout reste dans votre `localStorage`.
    *   Sélectionnez votre source audio (Direct / Simulation).

## 🔒 Sécurité et Confidentialité
*   **Aucune donnée persistante :** L'historique et les clés API sont uniquement conservés dans le navigateur client de l'utilisateur.
*   **Sécurité API :** Les clés API doivent être saisies manuellement dans le panel développeur et ne sont **jamais** incluses dans le code source de ce dépôt.

## 📝 Auteur
Prototype conçu pour démontrer la faisabilité technique du fact-checking embarqué dans les médias télévisés.
