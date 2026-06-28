window.claimsData = {
    false: {
        hasClaim: true,
        verdict: "FAUX",
        verdictType: "error",
        speaker: "Invite politique",
        claim: "Le chomage n'a jamais ete aussi eleve en France, on a depasse les 10%.",
        correction: "Faux. Le taux de chomage recent est nettement sous 10%, meme si le niveau exact depend du trimestre et du perimetre retenu.",
        sourceName: "INSEE",
        sourceUrl: "https://www.insee.fr/",
        confidence: "high",
        latency: "1.2s"
    },
    misleading: {
        hasClaim: true,
        verdict: "NUANCE",
        verdictType: "misleading",
        speaker: "Debatteur economique",
        claim: "L'Etat gagne de l'argent avec la hausse des prix de l'essence.",
        correction: "Partiellement vrai. La TVA augmente avec le prix, mais la TICPE est principalement un montant fixe par litre.",
        sourceName: "Ministere de l'Economie",
        sourceUrl: "https://www.economie.gouv.fr/",
        confidence: "medium",
        latency: "1.8s"
    },
    true: {
        hasClaim: true,
        verdict: "VRAI",
        verdictType: "true",
        speaker: "Chroniqueur",
        claim: "La dette publique francaise depasse les 3000 milliards d'euros.",
        correction: "Vrai. La dette publique francaise a franchi le seuil de 3000 milliards d'euros selon les comptes nationaux.",
        sourceName: "INSEE",
        sourceUrl: "https://www.insee.fr/",
        confidence: "high",
        latency: "1.5s"
    }
};
