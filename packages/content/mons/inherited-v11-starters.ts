/** Inherited v8 detail as consolidated in NYC_Mon_Master_Bible_v11.md (4 October 2026).
 * Types are LEGACY ten-type labels, NEVER eight-Affinity IDs.
 * Size is an ART DIRECTION TEXT TARGET, not a numeric collision dimension.
 * Max unlock items/mastery are authored cues, NOT executable EvolutionEvents.
 * Per-species home district is NOT defined by these sources; no guessed home districts.
 */
export interface InheritedDexDetail {
  readonly legacyTypeNames: readonly ('Neutral' | 'Water' | 'Ghost' | 'Wind' | 'Electric' | 'Nature' | 'Spirit' | 'Poison' | 'Fire' | 'Rock')[];
  readonly scaleTargetDescription: string | null;
  readonly loreSummary: string | null;
  readonly evolutionUnlock: { readonly itemName: string; readonly mastery: string } | null;
}

/**
 * The four Phase 1 starter Bloodlines' records (F01 #1-7, F02 #8-14, F04 #20-24, F12 #61-67),
 * kept apart so a starter-only bundle (the Alexa Mon card) does not carry the
 * other 83 records. inherited-v11-details.ts merges both halves.
 */
export const starterDexDetails: Readonly<Partial<Record<number, InheritedDexDetail>>> = {
  "1": {
    "legacyTypeNames": [],
    "scaleTargetDescription": "Hand-held collectible scale; absolute dimensions are a design target to set at art lock, not a measured biological egg.",
    "loreSummary": "Metro Egg — dormant potential. A quick-witted street survivor becomes the friend who never leaves anyone behind.",
    "evolutionUnlock": null
  },
  "2": {
    "legacyTypeNames": [
      "Neutral"
    ],
    "scaleTargetDescription": "Small cuddle-scale character; exaggerate head/body ratio without shrinking the finished adult costume.",
    "loreSummary": "Squeaklet — first trust. A quick-witted street survivor becomes the friend who never leaves anyone behind.",
    "evolutionUnlock": null
  },
  "3": {
    "legacyTypeNames": [
      "Neutral"
    ],
    "scaleTargetDescription": "Intermediate adventure scale; establish a measured concept-sheet height before final rigging.",
    "loreSummary": "Lil’ Ratti — learning independence. A quick-witted street survivor becomes the friend who never leaves anyone behind.",
    "evolutionUnlock": null
  },
  "4": {
    "legacyTypeNames": [
      "Neutral"
    ],
    "scaleTargetDescription": "Companion scale; use a shared ground line against Baby, Small and Max. Exact dimensions remain design targets.",
    "loreSummary": "Hood Ratti — capable companion. A quick-witted street survivor becomes the friend who never leaves anyone behind.",
    "evolutionUnlock": null
  },
  "5": {
    "legacyTypeNames": [
      "Neutral"
    ],
    "scaleTargetDescription": "6–8 m cinematic study; fit competitive presentation to arena/camera without changing the stable Dex identity.",
    "loreSummary": "Ratti Royale — mastered identity. A quick-witted street survivor becomes the friend who never leaves anyone behind.",
    "evolutionUnlock": {
      "itemName": "Street Cred Crystal",
      "mastery": "Street Cred trial"
    }
  },
  "6": {
    "legacyTypeNames": [
      "Water"
    ],
    "scaleTargetDescription": "1.0–1.2 m to ears, excluding water effects; notably smaller than Ratti Royale.",
    "loreSummary": "Agua Ratti — mastered identity. A quick-witted street survivor becomes the friend who never leaves anyone behind.",
    "evolutionUnlock": {
      "itemName": "Aqua Crystal",
      "mastery": "Rescue/flow trial for the chosen family"
    }
  },
  "7": {
    "legacyTypeNames": [
      "Ghost"
    ],
    "scaleTargetDescription": "1.2–1.4 m core silhouette; mist does not count toward collision.",
    "loreSummary": "Phantom Ratti — mastered identity. A quick-witted street survivor becomes the friend who never leaves anyone behind.",
    "evolutionUnlock": {
      "itemName": "Phantom Crystal",
      "mastery": "Night-route rescue trial"
    }
  },
  "8": {
    "legacyTypeNames": [],
    "scaleTargetDescription": "Hand-held collectible scale; absolute dimensions are a design target to set at art lock, not a measured biological egg.",
    "loreSummary": "Corner Egg — dormant potential. Three expressions of city confidence: counter timing, sonic style and supernatural night work.",
    "evolutionUnlock": null
  },
  "9": {
    "legacyTypeNames": [
      "Neutral"
    ],
    "scaleTargetDescription": "Small cuddle-scale character; exaggerate head/body ratio without shrinking the finished adult costume.",
    "loreSummary": "Kittee Cee — first trust. Three expressions of city confidence: counter timing, sonic style and supernatural night work.",
    "evolutionUnlock": null
  },
  "10": {
    "legacyTypeNames": [
      "Neutral"
    ],
    "scaleTargetDescription": "Intermediate adventure scale; establish a measured concept-sheet height before final rigging.",
    "loreSummary": "Lil’ Cee — learning independence. Three expressions of city confidence: counter timing, sonic style and supernatural night work.",
    "evolutionUnlock": null
  },
  "11": {
    "legacyTypeNames": [
      "Neutral"
    ],
    "scaleTargetDescription": "Companion scale; use a shared ground line against Baby, Small and Max. Exact dimensions remain design targets.",
    "loreSummary": "Bodega Cee — capable companion. Three expressions of city confidence: counter timing, sonic style and supernatural night work.",
    "evolutionUnlock": null
  },
  "12": {
    "legacyTypeNames": [
      "Neutral"
    ],
    "scaleTargetDescription": "0.75 m to ears in neutral standing pose; tail can extend higher.",
    "loreSummary": "Bodega Baddiee Cee — mastered identity. Three expressions of city confidence: counter timing, sonic style and supernatural night work.",
    "evolutionUnlock": {
      "itemName": "Bodega Heart Orb",
      "mastery": "Corner defense trial"
    }
  },
  "13": {
    "legacyTypeNames": [
      "Neutral"
    ],
    "scaleTargetDescription": "0.85 m to ears; earrings have a limited swing arc.",
    "loreSummary": "Knocka Cee — mastered identity. Three expressions of city confidence: counter timing, sonic style and supernatural night work.",
    "evolutionUnlock": {
      "itemName": "Knocker Orb",
      "mastery": "Rhythm/coordination trial"
    }
  },
  "14": {
    "legacyTypeNames": [
      "Ghost"
    ],
    "scaleTargetDescription": "0.8 m to ears; long tail is a design anchor, not another limb.",
    "loreSummary": "Midnight Cee — mastered identity. Three expressions of city confidence: counter timing, sonic style and supernatural night work.",
    "evolutionUnlock": {
      "itemName": "Midnight Orb",
      "mastery": "Stealth rescue trial"
    }
  },
  "20": {
    "legacyTypeNames": [],
    "scaleTargetDescription": "Hand-held collectible scale; absolute dimensions are a design target to set at art lock, not a measured biological egg.",
    "loreSummary": "Signal Egg — dormant potential. A wingless spotted hopper learns to turn scarlet electricity into a readable relay network.",
    "evolutionUnlock": null
  },
  "21": {
    "legacyTypeNames": [
      "Electric"
    ],
    "scaleTargetDescription": "Small cuddle-scale character; exaggerate head/body ratio without shrinking the finished adult costume.",
    "loreSummary": "Fye Dot — first trust. A wingless spotted hopper learns to turn scarlet electricity into a readable relay network.",
    "evolutionUnlock": null
  },
  "22": {
    "legacyTypeNames": [
      "Electric"
    ],
    "scaleTargetDescription": "Intermediate adventure scale; establish a measured concept-sheet height before final rigging.",
    "loreSummary": "Flicker Fye — learning independence. A wingless spotted hopper learns to turn scarlet electricity into a readable relay network.",
    "evolutionUnlock": null
  },
  "23": {
    "legacyTypeNames": [
      "Electric"
    ],
    "scaleTargetDescription": "Companion scale; use a shared ground line against Baby, Small and Max. Exact dimensions remain design targets.",
    "loreSummary": "Scarlet Skippa — capable companion. A wingless spotted hopper learns to turn scarlet electricity into a readable relay network.",
    "evolutionUnlock": null
  },
  "24": {
    "legacyTypeNames": [
      "Electric"
    ],
    "scaleTargetDescription": "0.8 m body-length concept with about 1.8 m maximum wing span; scale is provisional.",
    "loreSummary": "LanternFye — mastered identity. A wingless spotted hopper learns to turn scarlet electricity into a readable relay network.",
    "evolutionUnlock": {
      "itemName": "Redline Orb",
      "mastery": "Red-nymph landing trial"
    }
  },
  "61": {
    "legacyTypeNames": [],
    "scaleTargetDescription": "Hand-held collectible scale; absolute dimensions are a design target to set at art lock, not a measured biological egg.",
    "loreSummary": "Prism Egg — dormant potential. An adaptable long-legged coyote chooses an elemental route while keeping one unmistakable family body.",
    "evolutionUnlock": null
  },
  "62": {
    "legacyTypeNames": [
      "Neutral"
    ],
    "scaleTargetDescription": "Small cuddle-scale character; exaggerate head/body ratio without shrinking the finished adult costume.",
    "loreSummary": "Yotito — first trust. An adaptable long-legged coyote chooses an elemental route while keeping one unmistakable family body.",
    "evolutionUnlock": null
  },
  "63": {
    "legacyTypeNames": [
      "Neutral"
    ],
    "scaleTargetDescription": "Intermediate adventure scale; establish a measured concept-sheet height before final rigging.",
    "loreSummary": "Lil’ Yote — learning independence. An adaptable long-legged coyote chooses an elemental route while keeping one unmistakable family body.",
    "evolutionUnlock": null
  },
  "64": {
    "legacyTypeNames": [
      "Neutral"
    ],
    "scaleTargetDescription": "Companion scale; use a shared ground line against Baby, Small and Max. Exact dimensions remain design targets.",
    "loreSummary": "Barrio-Yote — capable companion. An adaptable long-legged coyote chooses an elemental route while keeping one unmistakable family body.",
    "evolutionUnlock": null
  },
  "65": {
    "legacyTypeNames": [
      "Fire"
    ],
    "scaleTargetDescription": "1.1 m shoulder height; not a rat or fox body.",
    "loreSummary": "Fuego-Yote — mastered identity. An adaptable long-legged coyote chooses an elemental route while keeping one unmistakable family body.",
    "evolutionUnlock": {
      "itemName": "Fire Crystal",
      "mastery": "Pressure-control trial"
    }
  },
  "66": {
    "legacyTypeNames": [
      "Electric"
    ],
    "scaleTargetDescription": "1.05 m shoulder height; longest stride in the Yote family.",
    "loreSummary": "Yote del Eléctrico — mastered identity. An adaptable long-legged coyote chooses an elemental route while keeping one unmistakable family body.",
    "evolutionUnlock": {
      "itemName": "Electric Crystal",
      "mastery": "Precision-route trial"
    }
  },
  "67": {
    "legacyTypeNames": [
      "Water"
    ],
    "scaleTargetDescription": "1.15 m shoulder height; visibly more rangy than the compact Water rat.",
    "loreSummary": "Agua-Yote — mastered identity. An adaptable long-legged coyote chooses an elemental route while keeping one unmistakable family body.",
    "evolutionUnlock": {
      "itemName": "Aqua Crystal",
      "mastery": "Rescue/flow trial for the chosen family"
    }
  }
};
