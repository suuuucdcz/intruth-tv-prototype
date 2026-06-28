const FACT_CHECK_SCHEMA = {
    type: "object",
    additionalProperties: false,
    properties: {
        hasClaim: { type: "boolean" },
        analyse_interne: { type: "string", description: "Ta réflexion silencieuse étape par étape avant de rendre le verdict final." },
        verdict: {
            type: "string",
            enum: ["VRAI", "FAUX", "NUANCE", "NON VERIFIABLE"]
        },
        verdictType: {
            type: "string",
            enum: ["true", "error", "misleading", "unknown"]
        },
        speaker: { type: "string" },
        claim: { type: "string" },
        correction: { type: "string" },
        sourceName: { type: "string" },
        sourceUrl: { type: "string" },
        confidence: {
            type: "string",
            enum: ["high", "medium", "low"]
        }
    },
    required: [
        "hasClaim",
        "verdict",
        "verdictType",
        "speaker",
        "claim",
        "correction",
        "sourceName",
        "sourceUrl",
        "confidence"
    ]
};

const TRUSTED_SOURCE_HINTS = [
    "INSEE",
    "DARES",
    "DREES",
    "Banque de France",
    "Cour des comptes",
    "Ministere de l'Economie",
    "data.gouv.fr",
    "Eurostat",
    "OCDE",
    "Assemblee nationale",
    "Senat"
];

function compactText(value, fallback = "", maxLength = 500) {
    const text = String(value ?? fallback).replace(/\s+/g, " ").trim();
    return text.length > maxLength ? `${text.slice(0, maxLength - 3)}...` : text;
}

function parseJsonPayload(rawText) {
    const text = String(rawText ?? "").trim();
    const withoutFence = text
        .replace(/^```(?:json)?/i, "")
        .replace(/```$/i, "")
        .trim();

    try {
        return JSON.parse(withoutFence);
    } catch (error) {
        const match = withoutFence.match(/\{[\s\S]*\}/);
        if (!match) throw error;
        return JSON.parse(match[0]);
    }
}

class LLMClient {
    constructor(apiKey, provider = "groq", model = "llama-3.3-70b-versatile") {
        this.apiKey = apiKey;
        this.provider = provider;
        this.model = model;
        this.contextBuffer = [];
    }

    async evaluateClaim(transcriptSegment) {
        if (!this.apiKey) {
            throw new Error("Cle API manquante.");
        }

        const segment = compactText(transcriptSegment, "", 900);
        if (!segment) {
            return { hasClaim: false };
        }

        this.contextBuffer.push(segment);
        if (this.contextBuffer.length > 5) this.contextBuffer.shift();

        const prompt = this.buildFactCheckPrompt(segment);
        let result;

        if (this.provider === "groq") {
            result = await this.callGroq(prompt);
        } else if (this.provider === "gemini") {
            result = await this.callGemini(prompt);
        } else if (this.provider === "claude") {
            result = await this.callClaude(prompt);
        } else {
            throw new Error(`Fournisseur non supporte : ${this.provider}`);
        }

        return this.normalizeFactCheckResult(result);
    }

    buildFactCheckPrompt(transcriptSegment) {
        const context = this.contextBuffer.join(" ");
        const trustedSources = TRUSTED_SOURCE_HINTS.join(", ");

        return `
Tu es un analyste de fact-checking politique francophone intraitable. Ton rôle est de séparer le bruit médiatique des vraies affirmations factuelles.

Objectif: produire un verdict utile sans inventer de preuve. Ne réagis QUE sur les faits lourds.

Regles strictes de triage (Le "Filtre Anti-Bruit") :
1. Pense à voix haute dans le champ "analyse_interne" UNIQUEMENT quand tu donnes ton verdict final.
2. CE QUI EST VÉRIFIABLE (hasClaim=true) :
   - Une statistique générale, nationale ou internationale (ex: "Le chômage a baissé de 2%").
   - Un fait historique, scientifique, ou législatif précis (ex: "Cette loi a été votée en 2012").
   - Un chiffre économique ou une accusation publique factuelle vérifiable.
3. CE QUI DOIT ÊTRE IGNORÉ (hasClaim=false, ne pas vérifier) :
   - Le bavardage télévisuel, les phrases d'introduction, les transitions journalistiques (ex: "Nous accueillons notre invité", "C'est un sujet très important aujourd'hui").
   - Les questions rhétoriques, les commentaires vagues, les descriptions d'ambiance.
   - Les anecdotes personnelles ou constats de terrain locaux (ex: "Je vois beaucoup de patients...", "Dans mon cabinet..."). Tu ne peux pas vérifier la vie des gens.
   - Les prédictions, programmes ou estimations futures (ex: "Demain il y aura environ 500 000 personnes"). On ne fact-check pas le futur.
   - Les consignes, arrêtés locaux ou règles temporaires (ex: "Interdiction de consommer de l'alcool").
   - Les opinions, jugements de valeur, ou promesses politiques.
4. Règle d'or : Si la phrase n'apporte aucune donnée de fond ou affirme une banalité non chiffrée, retourne IMPÉRATIVEMENT hasClaim=false.
5. Si l'affirmation est vérifiable (point 2) mais que tu n'as pas assez d'elements fiables, retourne verdict="NON VERIFIABLE".
6. Ne fabrique jamais de preuve. Utilise searchTavily pour l'actualité.
7. La correction doit tenir en deux phrases maximum, avec des chiffres précis si possible.

Contexte recent:
"${context}"

Phrase a analyser:
"${transcriptSegment}"`;
    }

    getJsonSchemaPrompt() {
        return `
Schema attendu obligatoirement en JSON:
{
  "hasClaim": boolean,
  "analyse_interne": "Ton analyse et raisonnement logique ici...",
  "verdict": "VRAI" | "FAUX" | "NUANCE" | "NON VERIFIABLE",
  "verdictType": "true" | "error" | "misleading" | "unknown",
  "speaker": "Intervenant ou Inconnu",
  "claim": "Citation courte a verifier",
  "correction": "Correction factuelle courte",
  "sourceName": "Nom de source ou Source non verifiee",
  "sourceUrl": "URL https si connue, sinon chaine vide",
  "confidence": "high" | "medium" | "low"
}`;
    }

    async callGroq(prompt) {
        const url = "https://api.groq.com/openai/v1/chat/completions";
        const headers = {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${this.apiKey}`
        };

        const messages = [
            {
                role: "system",
                content: "You are a fact-checking routing assistant. STEP 1: Decide if we need to search the web to verify this claim. Reply ONLY in JSON format: { \"useTool\": true, \"toolName\": \"searchTavily\" or \"searchWikipedia\", \"query\": \"your search keywords\" } or { \"useTool\": false }"
            },
            { role: "user", content: prompt }
        ];

        const firstPayload = this.createGroqPayload(messages, {
            includeTools: true,
            preferSchema: false
        });

        const firstData = await this.fetchJson(url, {
            method: "POST",
            headers,
            body: JSON.stringify(firstPayload)
        }, "Groq");

        const firstMessage = this.extractGroqMessage(firstData);
        let step1 = { useTool: false };
        try {
            step1 = JSON.parse(firstMessage.content);
        } catch (e) {
            // Ignore parse errors, default to no tool
        }

        if (step1.useTool && step1.toolName && step1.query) {
            messages.push({ role: "assistant", content: JSON.stringify(step1) });
            
            const toolCallMock = {
                id: "call_manual",
                function: { name: step1.toolName, arguments: JSON.stringify({ query: step1.query }) }
            };
            
            const toolResult = await this.executeToolCall(toolCallMock);
            
            // We use system role to inject the tool result instead of native tool role to avoid Groq validation errors
            messages.push({
                role: "system",
                content: `Résultat de ${step1.toolName} : ${toolResult.content}`
            });

            // Append the JSON schema prompt for the final resolution
            messages.push({
                role: "system",
                content: "Maintenant que tu as les résultats de la recherche, génère le verdict final. " + this.getJsonSchemaPrompt()
            });

            const finalPayload = this.createGroqPayload(messages, {
                includeTools: false,
                preferSchema: true
            });

            const finalData = await this.fetchJson(url, {
                method: "POST",
                headers,
                body: JSON.stringify(finalPayload)
            }, "Groq");

            return parseJsonPayload(this.extractGroqMessage(finalData).content);
        }

        return parseJsonPayload(firstMessage.content);
    }

    createGroqPayload(messages, options) {
        const payload = {
            model: this.model,
            messages,
            temperature: 0.1,
            top_p: 0.2,
            seed: 42,
            max_completion_tokens: 650
        };

        if (!options.includeTools) {
            payload.response_format = this.createResponseFormat(options.preferSchema);
        } else {
            payload.response_format = { type: "json_object" };
        }

        if (this.model.startsWith("openai/gpt-oss-")) {
            payload.reasoning_format = "hidden";
            payload.reasoning_effort = this.model.endsWith("120b") ? "medium" : "low";
        }

        return payload;
    }

    createResponseFormat(preferSchema) {
        if (preferSchema && this.supportsGroqJsonSchema()) {
            return {
                type: "json_schema",
                json_schema: {
                    name: "fact_check_result",
                    strict: true,
                    schema: FACT_CHECK_SCHEMA
                }
            };
        }

        return { type: "json_object" };
    }

    supportsGroqJsonSchema() {
        return this.model.startsWith("openai/gpt-oss-");
    }

    getGroqTools() {
        return [
            {
                type: "function",
                function: {
                    name: "searchTavily",
                    description: "Moteur de recherche web en temps réel. Utilisez cet outil en priorité pour vérifier des chiffres récents, l'actualité ou des déclarations politiques.",
                    parameters: {
                        type: "object",
                        properties: {
                            query: {
                                type: "string",
                                description: "La requête de recherche optimisée pour un moteur de recherche (ex: 'taux chômage France INSEE 2023')"
                            }
                        },
                        required: ["query"]
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "searchWikipedia",
                    description: "Recherche un contexte encyclopedique court en francais. Utile pour identifier un sujet historique, une date ou une notion; insuffisant seul pour des chiffres publics recents.",
                    parameters: {
                        type: "object",
                        properties: {
                            query: {
                                type: "string",
                                description: "Mots-cles concis, par exemple 'date construction Tour Eiffel'."
                            }
                        },
                        required: ["query"]
                    }
                }
            }
        ];
    }

    async executeToolCall(toolCall) {
        const toolName = toolCall.function && toolCall.function.name;
        let content = "Outil indisponible.";

        if (toolName === "searchWikipedia" && window.searchWikipedia) {
            try {
                const args = parseJsonPayload(toolCall.function.arguments || "{}");
                content = await window.searchWikipedia(compactText(args.query, "", 140));
            } catch (error) {
                content = `Erreur outil Wikipedia: ${error.message}`;
            }
        } else if (toolName === "searchTavily" && window.searchTavily) {
            try {
                const args = parseJsonPayload(toolCall.function.arguments || "{}");
                content = await window.searchTavily(compactText(args.query, "", 140));
            } catch (error) {
                content = `Erreur outil Tavily: ${error.message}`;
            }
        }

        return {
            role: "tool",
            tool_call_id: toolCall.id,
            name: toolName,
            content
        };
    }

    extractGroqMessage(data) {
        const message = data && data.choices && data.choices[0] && data.choices[0].message;
        if (!message) {
            throw new Error("Reponse Groq invalide.");
        }

        return message;
    }

    async callGemini(prompt) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;
        const finalPrompt = prompt + "\n\n" + this.getJsonSchemaPrompt();
        const payload = {
            contents: [{ parts: [{ text: finalPrompt }] }],
            generationConfig: {
                temperature: 0.1,
                responseMimeType: "application/json"
            }
        };

        const data = await this.fetchJson(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        }, "Gemini");

        const resultText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!resultText) throw new Error("Reponse Gemini vide.");
        return parseJsonPayload(resultText);
    }

    async callClaude(prompt) {
        const url = "https://api.anthropic.com/v1/messages";
        const finalPrompt = prompt + "\n\n" + this.getJsonSchemaPrompt();
        const payload = {
            model: this.model,
            max_tokens: 800,
            temperature: 0.1,
            system: "Tu dois repondre uniquement en JSON valide.",
            messages: [{ role: "user", content: finalPrompt }]
        };

        const data = await this.fetchJson(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-api-key": this.apiKey,
                "anthropic-version": "2023-06-01",
                "anthropic-dangerously-allow-browser": "true"
            },
            body: JSON.stringify(payload)
        }, "Claude");

        const resultText = data?.content?.[0]?.text;
        if (!resultText) throw new Error("Reponse Claude vide.");
        return parseJsonPayload(resultText);
    }

    async fetchJson(url, options, providerName) {
        try {
            if (window.bgFetch) {
                return await window.bgFetch(url, options);
            }
            
            const response = await fetch(url, options);
            const data = await response.json();
            
            if (!response.ok || data.error) {
                const detail = data?.error?.message || data?.error || response.statusText || "erreur inconnue";
                throw new Error(`${providerName}: ${detail}`);
            }
            return data;
        } catch (error) {
            throw new Error(`${providerName}: requete impossible (${error.message}).`);
        }
    }

    normalizeFactCheckResult(rawResult) {
        const result = rawResult && typeof rawResult === "object" ? rawResult : {};

        // Si le LLM n'a pas explicitement dit qu'il y avait une affirmation factuelle,
        // ou s'il a renvoyé un JSON vide (erreur de parsing), on ignore !
        if (result.hasClaim !== true || !result.claim) {
            return { hasClaim: false };
        }

        const verdictType = ["true", "error", "misleading", "unknown"].includes(result.verdictType)
            ? result.verdictType
            : "unknown";
        const confidence = ["high", "medium", "low"].includes(result.confidence)
            ? result.confidence
            : "low";

        const defaultVerdicts = {
            true: "VRAI",
            error: "FAUX",
            misleading: "NUANCE",
            unknown: "NON VERIFIABLE"
        };

        return {
            hasClaim: true,
            verdict: compactText(result.verdict, defaultVerdicts[verdictType], 30),
            verdictType,
            speaker: compactText(result.speaker, "Intervenant", 80),
            claim: compactText(result.claim, "Affirmation factuelle detectee", 260),
            correction: compactText(result.correction, "Verification insuffisante pour trancher proprement.", 420),
            sourceName: compactText(result.sourceName, "Source non verifiee", 120),
            sourceUrl: /^https?:\/\//i.test(String(result.sourceUrl || "")) ? String(result.sourceUrl) : "",
            confidence
        };
    }
}

window.LLMClient = LLMClient;
