// Données de simulation pour le mode hors-ligne
const claimsData = {
    "false": {
        verdict: "FAUX",
        verdictType: "error", // pour le CSS (rouge)
        speaker: "Invité Politique",
        claim: "Le chômage n'a jamais été aussi élevé en France, on a dépassé les 10%.",
        correction: "Selon l'INSEE (T4 2023), le taux de chômage en France est de 7,5%, loin des 10%.",
        sourceName: "INSEE",
        latency: "1.2s"
    },
    "misleading": {
        verdict: "NUANCÉ",
        verdictType: "misleading", // pour le CSS (orange)
        speaker: "Débatteur Économique",
        claim: "L'État gagne de l'argent avec la hausse des prix de l'essence.",
        correction: "L'État perçoit la TVA, mais la TICPE (principale taxe) est un montant fixe par litre, non lié à l'inflation.",
        sourceName: "Ministère de l'Économie",
        latency: "1.8s"
    },
    "true": {
        verdict: "VRAI",
        verdictType: "true", // pour le CSS (vert)
        speaker: "Chroniqueur",
        claim: "La dette publique française dépasse les 3000 milliards d'euros.",
        correction: "Exact. L'INSEE a confirmé au T1 2023 que la dette publique a franchi le cap symbolique des 3000 milliards d'euros.",
        sourceName: "Cour des Comptes",
        latency: "1.5s"
    }
};
