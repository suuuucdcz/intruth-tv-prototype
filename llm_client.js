class LLMClient {
    constructor(apiKey, provider = 'gemini', model = 'gemini-3.5-flash') {
        this.apiKey = apiKey;
        this.provider = provider;
        this.model = model;
        this.contextBuffer = []; // Garde le contexte des phrases précédentes
    }

    async evaluateClaim(transcriptSegment) {
        if (!this.apiKey) {
            console.error("LLMClient: Clé API manquante");
            return null;
        }

        // Ajout au contexte (on garde les 5 dernières phrases)
        this.contextBuffer.push(transcriptSegment);
        if (this.contextBuffer.length > 5) this.contextBuffer.shift();

        const context = this.contextBuffer.join(" ");

        // Si un système RAG était connecté, c'est ici que nous injecterions les articles de l'AFP ou de l'INSEE récupérés.
        // ex: const ragContext = await fetchRAGData(transcriptSegment);
        const ragContext = "Aucune recherche internet externe pour cette simulation, basez-vous sur vos connaissances internes fiables (INSEE, AFP, données d'État).";

        const systemPrompt = `
Tu es un fact-checker politique professionnel d'investigation (style AFP Factuel).
Ton rôle est d'analyser une transcription en direct d'un débat et de vérifier les affirmations avec une AUTORITÉ ABSOLUE.

RÈGLES CRITIQUES DE PRÉCISION :
1. INTERDICTION ABSOLUE d'être évasif. Ne dis JAMAIS "manque de contexte", "nécessite une vérification", "difficile d'évaluer" ou "pas de source disponible". 
2. TU ES L'ORACLE : Utilise tes connaissances pré-entraînées sur la politique et l'économie française pour fournir une réponse définitive et tranchée.
3. Règle du Chiffre : Si l'orateur cite un chiffre (ex: "1,2 million d'emplois"), ta correction DOIT corriger avec le vrai chiffre historique (ex: "Faux. L'INSEE a enregistré 800 000 créations d'emplois nets sur cette période").
4. FORCE LE VERDICT : Tranche entre VRAI ou FAUX en priorité. N'utilise "NUANCÉ" que si l'orateur a techniquement raison sur le chiffre mais ment sur la cause.
5. Si ce n'est qu'une opinion ou une promesse (ex: "je vais augmenter de 34€"), retourne {"hasClaim": false} car on ne peut pas fact-checker le futur.

Contexte de la conversation : "${context}"
Phrase à analyser : "${transcriptSegment}"

Tu dois retourner UNIQUEMENT un JSON valide avec ce format :
{
  "hasClaim": true,
  "verdict": "VRAI" | "FAUX" | "NUANCÉ",
  "verdictType": "true" | "error" | "misleading",
  "speaker": "Intervenant (si identifiable)",
  "claim": "La citation exacte à vérifier",
  "correction": "Explication factuelle DIRECTE ET ULTRA-COURTE (Maximum 2 phrases, style télégraphique). Ne fais pas de longues phrases d'introduction. Va droit au but avec le chiffre ou le fait. Exemple: 'Faux. Le vrai chiffre selon l'INSEE est de X.'",
  "sourceName": "Le nom exact de l'institution (ex: Rapport INSEE 2023)"
}`;

        try {
            if (this.provider === 'gemini') {
                return await this.callGemini(systemPrompt);
            } else if (this.provider === 'claude') {
                return await this.callClaude(systemPrompt);
            } else if (this.provider === 'groq') {
                return await this.callGroq(systemPrompt);
            }
        } catch (e) {
            console.error("LLMClient Error:", e);
            return null;
        }
    }

    async callGroq(prompt) {
        // Appelle l'API Groq (compatible OpenAI) ultra-rapide
        const url = "https://api.groq.com/openai/v1/chat/completions";
        
        const payload = {
            model: this.model,
            temperature: 0.1,
            response_format: { type: "json_object" }, // Force le format JSON sur Groq
            messages: [
                { role: "system", content: "Tu es un fact-checker professionnel. Tu dois répondre uniquement en JSON valide correspondant au format demandé." },
                { role: "user", content: prompt }
            ]
        };

        const response = await fetch(url, {
            method: "POST",
            headers: { 
                "Content-Type": "application/json",
                "Authorization": `Bearer ${this.apiKey}`
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        
        if (data.error) {
            console.error("Groq Error:", data.error);
            return null;
        }

        try {
            const resultText = data.choices[0].message.content;
            return JSON.parse(resultText);
        } catch (e) {
            console.error("Failed to parse Groq response as JSON", e);
            return null;
        }
    }

    async callGemini(prompt) {
        // Appelle le modèle Gemini sélectionné via REST API
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;
        
        const payload = {
            contents: [{ parts: [{ text: prompt }] }],
            tools: [
                { googleSearch: {} } // Activation de l'accès à internet en direct via Google Search
            ],
            generationConfig: {
                temperature: 0.1, // Basse température pour plus de faits
                responseMimeType: "application/json"
            }
        };

        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        
        if (data.error) {
            console.error("Gemini Error:", data.error);
            return null;
        }

        try {
            const resultText = data.candidates[0].content.parts[0].text;
            return JSON.parse(resultText);
        } catch (e) {
            console.error("Failed to parse Gemini response as JSON", e);
            return null;
        }
    }

    async callClaude(prompt) {
        // Appelle le modèle Claude sélectionné via REST API (Attention aux CORS en frontend, souvent nécessite un proxy)
        // Pour ce prototype, on tente l'appel direct (si CORS le permet via un proxy local ou extension)
        const url = "https://api.anthropic.com/v1/messages";
        
        const payload = {
            model: this.model,
            max_tokens: 500,
            temperature: 0.1,
            system: "Tu dois répondre uniquement en JSON valide.",
            messages: [{ role: "user", content: prompt }]
        };

        const response = await fetch(url, {
            method: "POST",
            headers: { 
                "Content-Type": "application/json",
                "x-api-key": this.apiKey,
                "anthropic-version": "2023-06-01",
                "anthropic-dangerously-allow-browser": "true" // Utilisé uniquement pour les démos/prototypes front-end
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        
        if (data.error) {
            console.error("Claude Error:", data.error);
            return null;
        }

        try {
            const resultText = data.content[0].text;
            // On cherche le bloc JSON au cas où Claude ajoute du texte
            const jsonMatch = resultText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
            return JSON.parse(resultText);
        } catch (e) {
            console.error("Failed to parse Claude response as JSON", e);
            return null;
        }
    }
}

window.LLMClient = LLMClient;
