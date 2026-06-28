# InTruth TV - Extension Chrome de Fact-Checking en Direct

**InTruth TV** est une extension Chrome (proof of concept) capable de superposer des alertes de fact-checking en temps réel directement sur les flux vidéo en direct (comme `tv.free.fr`, YouTube, ou BFM TV). 

Propulsée par l'IA (modèles Groq, Gemini ou Claude) et la *Web Speech API*, l'extension écoute le flux audio de votre ordinateur (via un câble audio virtuel ou les haut-parleurs), transcrit la parole en direct, filtre le bruit médiatique et lance des recherches sur le web pour vérifier les affirmations factuelles.

## 🚀 Fonctionnalités Clés

- **Filtre Anti-Bruit Intraitable :** L'IA ignore automatiquement les banalités, les opinions, et les transitions journalistiques pour ne se concentrer que sur les affirmations lourdes (chiffres, lois, histoire).
- **Routage JSON Autonome (Outils) :** L'extension utilise un système de réflexion en 2 étapes ("JSON Routing") contournant les bugs de syntaxe natifs des LLMs pour appeler fiablement des outils de recherche (Tavily, Wikipédia).
- **Indestructibilité SPA & Fullscreen :**
  - **Plein Écran Dynamique :** L'extension écoute l'API Fullscreen du navigateur et se greffe automatiquement *à l'intérieur* de la vidéo pour s'assurer que les alertes rouges passent toujours au-dessus du flux, même en plein écran.
  - **Auto-Réparation (MutationObserver) :** Conçue pour survivre aux sites SPA (React/Vue), l'extension patrouille le DOM et se réinjecte instantanément si le site tente de l'effacer lors d'un changement de chaîne.
- **Z-Index Absolu :** Interface protégée par le z-index maximum mathématique (`2147483647`) pour rester au premier plan.
- **Panneau Latéral Déplaçable :** Drag & Drop du panneau de configuration IA.

## 📦 Installation de l'Extension

1. Ouvrez votre navigateur basé sur Chromium (Chrome, Edge, Brave).
2. Allez sur la page de gestion des extensions : `chrome://extensions` ou `edge://extensions`.
3. Activez le **Mode Développeur** (en haut à droite).
4. Cliquez sur **Charger l'extension non empaquetée** (Load unpacked).
5. Sélectionnez le dossier contenant ce code source (`intruth-tv-prototype`).
6. L'icône InTruth TV apparaîtra dans votre navigateur.

## 🛠️ Architecture

- `manifest.json`: Configuration de l'extension (V3).
- `content_script.js`: Script d'injection, gestionnaire de l'API Fullscreen et du MutationObserver (SPA).
- `ui.html` & `style.css`: L'interface utilisateur injectée dans le DOM (Pop-ups, Historique, Paramètres IA).
- `app.js`: Orchestrateur principal (Gestion du Drag&Drop, de l'UI, et de la file d'attente des transcriptions).
- `audio_engine.js`: Capture audio via `webkitSpeechRecognition` avec redémarrage automatique en cas de micro-coupures réseau.
- `llm_client.js`: Cerveau de l'opération. Gère le prompt de fact-checking, le routage des outils (Tavily/Wiki) et la normalisation JSON.
- `api_tools.js`: Fonctions d'appels aux API de recherche (Tavily, Wikipedia).

## 🎙️ Comment l'utiliser

1. Allez sur une chaîne d'information en continu (ex: `tv.free.fr`).
2. Ouvrez le panneau des **Paramètres IA** en haut à gauche.
3. Renseignez votre clé API Groq (ou Gemini/Claude). Elle sera sauvegardée localement.
4. Cliquez sur **Démarrer l'écoute**.
5. L'IA restera silencieuse jusqu'à ce qu'elle entende une "Fake News" (Pop-up Rouge) ou une information Nuancée (Pop-up Orange). Les vérités iront discrètement dans l'historique.

## ⚠️ Notes Techniques

- **Audio Virtuel :** Pour que l'extension écoute la télévision (et non votre micro physique), il est recommandé d'utiliser un logiciel comme "VB-Cable Virtual Audio Device" pour router le son de Windows vers le micro du navigateur.
- **Sécurité des clés :** Les clés API sont stockées via `chrome.storage.local` directement sur votre machine. Aucune donnée n'est envoyée à un serveur tiers autre que les API LLM (Groq/Google/Anthropic).
