/** Inherited v8 encounter atlas, consolidated in NYC_Mon_Master_Bible_v11.md.
 * C common, U uncommon, R rare, Q authored quest, P partner/community.
 * These are BROAD game encounter tiers; NEVER per-species home districts or real wildlife locations.
 */
export type BoroughName = 'Manhattan' | 'Brooklyn' | 'Queens' | 'Bronx' | 'Staten Island';
export type EncounterTier = 'C' | 'U' | 'R' | 'Q' | 'P';
export interface BloodlineEncounterProfile {
  readonly tierByBorough: Readonly<Record<BoroughName, EncounterTier>>;
  readonly habitats: readonly string[];
  readonly notes: string;
}

export const boroughEncounterProfiles: Readonly<Partial<Record<string, BloodlineEncounterProfile>>> = {
  "F01": {
    "tierByBorough": {
      "Manhattan": "C",
      "Brooklyn": "C",
      "Queens": "C",
      "Bronx": "C",
      "Staten Island": "C"
    },
    "habitats": [
      "street",
      "transit_set",
      "courtyard"
    ],
    "notes": "Common citywide mascot encounters; no mapping of poverty or ethnicity to pest rarity."
  },
  "F02": {
    "tierByBorough": {
      "Manhattan": "P",
      "Brooklyn": "P",
      "Queens": "P",
      "Bronx": "P",
      "Staten Island": "P"
    },
    "habitats": [
      "community_hub",
      "courtyard",
      "street"
    ],
    "notes": "Partner/community-story encounters, not wild predation or real pet capture. Rare cat finals require evolution, not coat-color neighborhoods."
  },
  "F03": {
    "tierByBorough": {
      "Manhattan": "C",
      "Brooklyn": "C",
      "Queens": "C",
      "Bronx": "C",
      "Staten Island": "C"
    },
    "habitats": [
      "plaza",
      "rooftop",
      "transit_set"
    ],
    "notes": "Built environment is the main filter; retain the NYC hat in every borough."
  },
  "F04": {
    "tierByBorough": {
      "Manhattan": "U",
      "Brooklyn": "U",
      "Queens": "U",
      "Bronx": "U",
      "Staten Island": "U"
    },
    "habitats": [
      "host_tree_corridor",
      "park",
      "plaza"
    ],
    "notes": "Season changes wild-stage mix, not owned adult form. Fantasy eggs can hatch anytime; no real insect transport missions."
  },
  "F05": {
    "tierByBorough": {
      "Manhattan": "U",
      "Brooklyn": "U",
      "Queens": "U",
      "Bronx": "U",
      "Staten Island": "U"
    },
    "habitats": [
      "woodland_edge",
      "park",
      "courtyard",
      "waterfront"
    ],
    "notes": "A wooded-edge specialist even in Manhattan; no scavenging real bins."
  },
  "F06": {
    "tierByBorough": {
      "Manhattan": "P",
      "Brooklyn": "P",
      "Queens": "P",
      "Bronx": "P",
      "Staten Island": "P"
    },
    "habitats": [
      "community_hub",
      "park",
      "street"
    ],
    "notes": "Fictional guardian/adoption quest in every borough. Never wild pit-bull packs or aggression assigned by borough."
  },
  "F07": {
    "tierByBorough": {
      "Manhattan": "C",
      "Brooklyn": "C",
      "Queens": "C",
      "Bronx": "C",
      "Staten Island": "C"
    },
    "habitats": [
      "park",
      "woodland_edge",
      "courtyard"
    ],
    "notes": "Common in suitable green spaces across all five boroughs, not only Central Park."
  },
  "F08": {
    "tierByBorough": {
      "Manhattan": "R",
      "Brooklyn": "U",
      "Queens": "U",
      "Bronx": "U",
      "Staten Island": "U"
    },
    "habitats": [
      "woodland_edge",
      "courtyard",
      "park"
    ],
    "notes": "Outer-borough weighting is authored game balance; no verified comparative population estimate is claimed."
  },
  "F09": {
    "tierByBorough": {
      "Manhattan": "C",
      "Brooklyn": "C",
      "Queens": "C",
      "Bronx": "C",
      "Staten Island": "C"
    },
    "habitats": [
      "utility_set",
      "transit_set"
    ],
    "notes": "Service-room sets, not real private kitchens. Roach is not a bird and not geographically assigned to Chinatown."
  },
  "F10": {
    "tierByBorough": {
      "Manhattan": "U",
      "Brooklyn": "U",
      "Queens": "U",
      "Bronx": "U",
      "Staten Island": "U"
    },
    "habitats": [
      "park",
      "rooftop",
      "woodland_edge",
      "waterfront"
    ],
    "notes": "Equal borough baseline. Washington Square and Prospect/BBG are both documented habitat references. Do not assert Downtown Manhattan is more abundant than Brooklyn."
  },
  "F11": {
    "tierByBorough": {
      "Manhattan": "R",
      "Brooklyn": "R",
      "Queens": "R",
      "Bronx": "R",
      "Staten Island": "R"
    },
    "habitats": [
      "meadow",
      "woodland_edge",
      "park"
    ],
    "notes": "Rare citywide; prioritize open grass/meadow edges, not deep woods. No unsupported Harlem origin."
  },
  "F12": {
    "tierByBorough": {
      "Manhattan": "R",
      "Brooklyn": "Q",
      "Queens": "R",
      "Bronx": "U",
      "Staten Island": "R"
    },
    "habitats": [
      "woodland_edge",
      "meadow",
      "waterfront"
    ],
    "notes": "Bronx forest-edge emphasis. Brooklyn has a fantasy story-quest route rather than a claimed established everyday population. No final branch appears simply because a borough matches its element."
  },
  "F13": {
    "tierByBorough": {
      "Manhattan": "Q",
      "Brooklyn": "Q",
      "Queens": "Q",
      "Bronx": "Q",
      "Staten Island": "Q"
    },
    "habitats": [
      "community_hub",
      "fantasy_stone_garden"
    ],
    "notes": "New fantasy partner family available by quest in every borough. Not a claim that cobras are ordinary wild NYC street animals; never directs owners to find real snakes."
  },
  "F14": {
    "tierByBorough": {
      "Manhattan": "Q",
      "Brooklyn": "Q",
      "Queens": "Q",
      "Bronx": "Q",
      "Staten Island": "Q"
    },
    "habitats": [
      "community_hub",
      "fantasy_butterfly_garden"
    ],
    "notes": "New fantasy partner/garden quest available in every borough. Culture does not lock the encounter to an ethnic neighborhood; humanoid finals are earned, not wild adult humans to capture."
  },
  "F15": {
    "tierByBorough": {
      "Manhattan": "U",
      "Brooklyn": "U",
      "Queens": "U",
      "Bronx": "U",
      "Staten Island": "U"
    },
    "habitats": [
      "park",
      "wetland",
      "courtyard"
    ],
    "notes": "Fictional garden/wetland route, not a real turtle capture location. All four branches can be unlocked from any hub."
  },
  "F16": {
    "tierByBorough": {
      "Manhattan": "U",
      "Brooklyn": "U",
      "Queens": "U",
      "Bronx": "U",
      "Staten Island": "U"
    },
    "habitats": [
      "park",
      "rooftop",
      "bridge_set"
    ],
    "notes": "Virtual dusk/nocturnal presentation. Do not approach actual roosts or feed real bats. Twin story quest supplies two separate individuals, not a split spawn."
  },
  "F17": {
    "tierByBorough": {
      "Manhattan": "Q",
      "Brooklyn": "Q",
      "Queens": "Q",
      "Bronx": "Q",
      "Staten Island": "Q"
    },
    "habitats": [
      "grove_sanctuary",
      "park_edge"
    ],
    "notes": "Legendary guardian story encounters, remotely accessible. No guaranteed wild legendary spawn or real deer tracking/feeding."
  },
  "F18": {
    "tierByBorough": {
      "Manhattan": "U",
      "Brooklyn": "U",
      "Queens": "U",
      "Bronx": "U",
      "Staten Island": "U"
    },
    "habitats": [
      "harbor",
      "estuary",
      "waterfront"
    ],
    "notes": "Fantasy harbor lineage; shark-to-whale transition is magical, not a real life cycle. Subwave sky travel uses authored routes."
  }
};
