import type { BloodlineId, LifecycleStage } from '@acme/core';

/** Full registered Dex. A null field is an explicit unresolved canon decision, NOT a new stage. */
export interface RosterEntry {
  readonly dexId: number;
  readonly bloodlineId: BloodlineId;
  readonly bloodlineName: string;
  readonly formName: string | null;
  readonly stage: LifecycleStage | null;
}

// Sourced canon extract: roster v11.1, 4 October 2026. Do not change IDs, names, stages without a recorded creator decision.
export const rosterEntries: readonly RosterEntry[] = [
  {
    "dexId": 1,
    "bloodlineId": "F01",
    "bloodlineName": "Hood Ratti",
    "formName": "Metro Egg",
    "stage": "Egg"
  },
  {
    "dexId": 2,
    "bloodlineId": "F01",
    "bloodlineName": "Hood Ratti",
    "formName": "Squeaklet",
    "stage": "Baby"
  },
  {
    "dexId": 3,
    "bloodlineId": "F01",
    "bloodlineName": "Hood Ratti",
    "formName": "Lil’ Ratti",
    "stage": "Small"
  },
  {
    "dexId": 4,
    "bloodlineId": "F01",
    "bloodlineName": "Hood Ratti",
    "formName": "Hood Ratti",
    "stage": "Mid"
  },
  {
    "dexId": 5,
    "bloodlineId": "F01",
    "bloodlineName": "Hood Ratti",
    "formName": "Ratti Royale",
    "stage": "Max"
  },
  {
    "dexId": 6,
    "bloodlineId": "F01",
    "bloodlineName": "Hood Ratti",
    "formName": "Agua Ratti",
    "stage": "Max"
  },
  {
    "dexId": 7,
    "bloodlineId": "F01",
    "bloodlineName": "Hood Ratti",
    "formName": "Phantom Ratti",
    "stage": "Max"
  },
  {
    "dexId": 8,
    "bloodlineId": "F02",
    "bloodlineName": "Bodega Baddiee Cee",
    "formName": "Corner Egg",
    "stage": "Egg"
  },
  {
    "dexId": 9,
    "bloodlineId": "F02",
    "bloodlineName": "Bodega Baddiee Cee",
    "formName": "Kittee Cee",
    "stage": "Baby"
  },
  {
    "dexId": 10,
    "bloodlineId": "F02",
    "bloodlineName": "Bodega Baddiee Cee",
    "formName": "Lil’ Cee",
    "stage": "Small"
  },
  {
    "dexId": 11,
    "bloodlineId": "F02",
    "bloodlineName": "Bodega Baddiee Cee",
    "formName": "Bodega Cee",
    "stage": "Mid"
  },
  {
    "dexId": 12,
    "bloodlineId": "F02",
    "bloodlineName": "Bodega Baddiee Cee",
    "formName": "Bodega Baddiee Cee",
    "stage": "Max"
  },
  {
    "dexId": 13,
    "bloodlineId": "F02",
    "bloodlineName": "Bodega Baddiee Cee",
    "formName": "Knocka Cee",
    "stage": "Max"
  },
  {
    "dexId": 14,
    "bloodlineId": "F02",
    "bloodlineName": "Bodega Baddiee Cee",
    "formName": "Midnight Cee",
    "stage": "Max"
  },
  {
    "dexId": 15,
    "bloodlineId": "F03",
    "bloodlineName": "Boss Pidgey P",
    "formName": "Rooftop Egg",
    "stage": "Egg"
  },
  {
    "dexId": 16,
    "bloodlineId": "F03",
    "bloodlineName": "Boss Pidgey P",
    "formName": "Peep P",
    "stage": "Baby"
  },
  {
    "dexId": 17,
    "bloodlineId": "F03",
    "bloodlineName": "Boss Pidgey P",
    "formName": "Lil’ P",
    "stage": "Small"
  },
  {
    "dexId": 18,
    "bloodlineId": "F03",
    "bloodlineName": "Boss Pidgey P",
    "formName": "Stoop P",
    "stage": "Mid"
  },
  {
    "dexId": 19,
    "bloodlineId": "F03",
    "bloodlineName": "Boss Pidgey P",
    "formName": "Boss Pidgey P",
    "stage": "Max"
  },
  {
    "dexId": 20,
    "bloodlineId": "F04",
    "bloodlineName": "LanternFye",
    "formName": "Signal Egg",
    "stage": "Egg"
  },
  {
    "dexId": 21,
    "bloodlineId": "F04",
    "bloodlineName": "LanternFye",
    "formName": "Fye Dot",
    "stage": "Baby"
  },
  {
    "dexId": 22,
    "bloodlineId": "F04",
    "bloodlineName": "LanternFye",
    "formName": "Flicker Fye",
    "stage": "Small"
  },
  {
    "dexId": 23,
    "bloodlineId": "F04",
    "bloodlineName": "LanternFye",
    "formName": "Scarlet Skippa",
    "stage": "Mid"
  },
  {
    "dexId": 24,
    "bloodlineId": "F04",
    "bloodlineName": "LanternFye",
    "formName": "LanternFye",
    "stage": "Max"
  },
  {
    "dexId": 25,
    "bloodlineId": "F05",
    "bloodlineName": "CanBandit",
    "formName": "Salvage Egg",
    "stage": "Egg"
  },
  {
    "dexId": 26,
    "bloodlineId": "F05",
    "bloodlineName": "CanBandit",
    "formName": "Rookit",
    "stage": "Baby"
  },
  {
    "dexId": 27,
    "bloodlineId": "F05",
    "bloodlineName": "CanBandit",
    "formName": "Lil’ Latch",
    "stage": "Small"
  },
  {
    "dexId": 28,
    "bloodlineId": "F05",
    "bloodlineName": "CanBandit",
    "formName": "CanScout",
    "stage": "Mid"
  },
  {
    "dexId": 29,
    "bloodlineId": "F05",
    "bloodlineName": "CanBandit",
    "formName": "CanBandit",
    "stage": "Max"
  },
  {
    "dexId": 30,
    "bloodlineId": "F06",
    "bloodlineName": "BlockBully",
    "formName": "Guard Egg",
    "stage": "Egg"
  },
  {
    "dexId": 31,
    "bloodlineId": "F06",
    "bloodlineName": "BlockBully",
    "formName": "Pibblet",
    "stage": "Baby"
  },
  {
    "dexId": 32,
    "bloodlineId": "F06",
    "bloodlineName": "BlockBully",
    "formName": "Lil’ Bully",
    "stage": "Small"
  },
  {
    "dexId": 33,
    "bloodlineId": "F06",
    "bloodlineName": "BlockBully",
    "formName": "Block Pup",
    "stage": "Mid"
  },
  {
    "dexId": 34,
    "bloodlineId": "F06",
    "bloodlineName": "BlockBully",
    "formName": "BlockBully",
    "stage": "Max"
  },
  {
    "dexId": 35,
    "bloodlineId": "F07",
    "bloodlineName": "Da Nut Hustla (Pause)",
    "formName": "Acorn Egg",
    "stage": "Egg"
  },
  {
    "dexId": 36,
    "bloodlineId": "F07",
    "bloodlineName": "Da Nut Hustla (Pause)",
    "formName": "Kernel",
    "stage": "Baby"
  },
  {
    "dexId": 37,
    "bloodlineId": "F07",
    "bloodlineName": "Da Nut Hustla (Pause)",
    "formName": "Lil’ Stash",
    "stage": "Small"
  },
  {
    "dexId": 38,
    "bloodlineId": "F07",
    "bloodlineName": "Da Nut Hustla (Pause)",
    "formName": "Acorn Ace",
    "stage": "Mid"
  },
  {
    "dexId": 39,
    "bloodlineId": "F07",
    "bloodlineName": "Da Nut Hustla (Pause)",
    "formName": "Da Nut Hustla (Pause)",
    "stage": "Max"
  },
  {
    "dexId": 40,
    "bloodlineId": "F08",
    "bloodlineName": "Ocky Possy",
    "formName": "Pouch Egg",
    "stage": "Egg"
  },
  {
    "dexId": 41,
    "bloodlineId": "F08",
    "bloodlineName": "Ocky Possy",
    "formName": "Joey Joy",
    "stage": "Baby"
  },
  {
    "dexId": 42,
    "bloodlineId": "F08",
    "bloodlineName": "Ocky Possy",
    "formName": "Pocket Possy",
    "stage": "Small"
  },
  {
    "dexId": 43,
    "bloodlineId": "F08",
    "bloodlineName": "Ocky Possy",
    "formName": "Lil’ Ocky",
    "stage": "Mid"
  },
  {
    "dexId": 44,
    "bloodlineId": "F08",
    "bloodlineName": "Ocky Possy",
    "formName": "Ocky Possy",
    "stage": "Max"
  },
  {
    "dexId": 45,
    "bloodlineId": "F09",
    "bloodlineName": "Cockie Roy",
    "formName": "Shellcase Egg",
    "stage": "Egg"
  },
  {
    "dexId": 46,
    "bloodlineId": "F09",
    "bloodlineName": "Cockie Roy",
    "formName": "Roachie",
    "stage": "Baby"
  },
  {
    "dexId": 47,
    "bloodlineId": "F09",
    "bloodlineName": "Cockie Roy",
    "formName": "Lil’ Gloss",
    "stage": "Small"
  },
  {
    "dexId": 48,
    "bloodlineId": "F09",
    "bloodlineName": "Cockie Roy",
    "formName": "Lady Roy",
    "stage": "Mid"
  },
  {
    "dexId": 49,
    "bloodlineId": "F09",
    "bloodlineName": "Cockie Roy",
    "formName": "Cockie Roy",
    "stage": "Max"
  },
  {
    "dexId": 50,
    "bloodlineId": "F10",
    "bloodlineName": "Hawk Fu Young",
    "formName": "Thermal Egg",
    "stage": "Egg"
  },
  {
    "dexId": 51,
    "bloodlineId": "F10",
    "bloodlineName": "Hawk Fu Young",
    "formName": "Peep Fu",
    "stage": "Baby"
  },
  {
    "dexId": 52,
    "bloodlineId": "F10",
    "bloodlineName": "Hawk Fu Young",
    "formName": "Hop Fu",
    "stage": "Small"
  },
  {
    "dexId": 53,
    "bloodlineId": "F10",
    "bloodlineName": "Hawk Fu Young",
    "formName": "Hawk Fu",
    "stage": "Mid"
  },
  {
    "dexId": 54,
    "bloodlineId": "F10",
    "bloodlineName": "Hawk Fu Young",
    "formName": "Hawk Fu Young",
    "stage": "Max"
  },
  {
    "dexId": 55,
    "bloodlineId": "F10",
    "bloodlineName": "Hawk Fu Young",
    "formName": "Tengu Talonz",
    "stage": "Max"
  },
  {
    "dexId": 56,
    "bloodlineId": "F11",
    "bloodlineName": "Stank Dripz",
    "formName": "Stripe Egg",
    "stage": "Egg"
  },
  {
    "dexId": 57,
    "bloodlineId": "F11",
    "bloodlineName": "Stank Dripz",
    "formName": "Pufflet",
    "stage": "Baby"
  },
  {
    "dexId": 58,
    "bloodlineId": "F11",
    "bloodlineName": "Stank Dripz",
    "formName": "Lil’ Whiff",
    "stage": "Small"
  },
  {
    "dexId": 59,
    "bloodlineId": "F11",
    "bloodlineName": "Stank Dripz",
    "formName": "Miss Dripz",
    "stage": "Mid"
  },
  {
    "dexId": 60,
    "bloodlineId": "F11",
    "bloodlineName": "Stank Dripz",
    "formName": "Stank Dripz",
    "stage": "Max"
  },
  {
    "dexId": 61,
    "bloodlineId": "F12",
    "bloodlineName": "Yote",
    "formName": "Prism Egg",
    "stage": "Egg"
  },
  {
    "dexId": 62,
    "bloodlineId": "F12",
    "bloodlineName": "Yote",
    "formName": "Yotito",
    "stage": "Baby"
  },
  {
    "dexId": 63,
    "bloodlineId": "F12",
    "bloodlineName": "Yote",
    "formName": "Lil’ Yote",
    "stage": "Small"
  },
  {
    "dexId": 64,
    "bloodlineId": "F12",
    "bloodlineName": "Yote",
    "formName": "Barrio-Yote",
    "stage": "Mid"
  },
  {
    "dexId": 65,
    "bloodlineId": "F12",
    "bloodlineName": "Yote",
    "formName": "Fuego-Yote",
    "stage": "Max"
  },
  {
    "dexId": 66,
    "bloodlineId": "F12",
    "bloodlineName": "Yote",
    "formName": "Yote del Eléctrico",
    "stage": "Max"
  },
  {
    "dexId": 67,
    "bloodlineId": "F12",
    "bloodlineName": "Yote",
    "formName": "Agua-Yote",
    "stage": "Max"
  },
  {
    "dexId": 68,
    "bloodlineId": "F13",
    "bloodlineName": "Naga Raja",
    "formName": "Saffron Egg",
    "stage": "Egg"
  },
  {
    "dexId": 69,
    "bloodlineId": "F13",
    "bloodlineName": "Naga Raja",
    "formName": "Hissu",
    "stage": "Baby"
  },
  {
    "dexId": 70,
    "bloodlineId": "F13",
    "bloodlineName": "Naga Raja",
    "formName": "Naglet",
    "stage": "Small"
  },
  {
    "dexId": 71,
    "bloodlineId": "F13",
    "bloodlineName": "Naga Raja",
    "formName": "Naga Rolla",
    "stage": "Mid"
  },
  {
    "dexId": 72,
    "bloodlineId": "F13",
    "bloodlineName": "Naga Raja",
    "formName": "Raja Naga",
    "stage": "Max"
  },
  {
    "dexId": 73,
    "bloodlineId": "F13",
    "bloodlineName": "Naga Raja",
    "formName": "Shila Naga",
    "stage": "Max"
  },
  {
    "dexId": 74,
    "bloodlineId": "F13",
    "bloodlineName": "Naga Raja",
    "formName": "Bhoot Naga",
    "stage": "Max"
  },
  {
    "dexId": 75,
    "bloodlineId": "F14",
    "bloodlineName": "Nuru",
    "formName": "Nuru Egg",
    "stage": "Egg"
  },
  {
    "dexId": 76,
    "bloodlineId": "F14",
    "bloodlineName": "Nuru",
    "formName": "Moyo Grub",
    "stage": "Baby"
  },
  {
    "dexId": 77,
    "bloodlineId": "F14",
    "bloodlineName": "Nuru",
    "formName": "Kipe Cocoon",
    "stage": "Small"
  },
  {
    "dexId": 78,
    "bloodlineId": "F14",
    "bloodlineName": "Nuru",
    "formName": "Nuru Flutter",
    "stage": "Mid"
  },
  {
    "dexId": 79,
    "bloodlineId": "F14",
    "bloodlineName": "Nuru",
    "formName": "Roho Kipepeo",
    "stage": "Max"
  },
  {
    "dexId": 80,
    "bloodlineId": "F14",
    "bloodlineName": "Nuru",
    "formName": "Upendo Glow",
    "stage": "Max"
  },
  {
    "dexId": 81,
    "bloodlineId": "F14",
    "bloodlineName": "Nuru",
    "formName": "Kivuli Nuru",
    "stage": "Max"
  },
  {
    "dexId": 82,
    "bloodlineId": "F15",
    "bloodlineName": "Big Apple Turtle",
    "formName": "Apple Shell Egg",
    "stage": "Egg"
  },
  {
    "dexId": 83,
    "bloodlineId": "F15",
    "bloodlineName": "Big Apple Turtle",
    "formName": "Nibble Snap",
    "stage": "Baby"
  },
  {
    "dexId": 84,
    "bloodlineId": "F15",
    "bloodlineName": "Big Apple Turtle",
    "formName": "Boro Snap",
    "stage": "Small"
  },
  {
    "dexId": 85,
    "bloodlineId": "F15",
    "bloodlineName": "Big Apple Turtle",
    "formName": "Stoop Shell",
    "stage": "Mid"
  },
  {
    "dexId": 86,
    "bloodlineId": "F15",
    "bloodlineName": "Big Apple Turtle",
    "formName": "Appleback Titan",
    "stage": "Max"
  },
  {
    "dexId": 87,
    "bloodlineId": "F15",
    "bloodlineName": "Big Apple Turtle",
    "formName": "Harbor Shellord",
    "stage": "Max"
  },
  {
    "dexId": 88,
    "bloodlineId": "F15",
    "bloodlineName": "Big Apple Turtle",
    "formName": "Brickback Bastion",
    "stage": "Max"
  },
  {
    "dexId": 89,
    "bloodlineId": "F15",
    "bloodlineName": "Big Apple Turtle",
    "formName": "Roho Shell",
    "stage": "Max"
  },
  {
    "dexId": 90,
    "bloodlineId": "F16",
    "bloodlineName": "Vampire Bat Twins",
    "formName": "Echo Egg",
    "stage": "Egg"
  },
  {
    "dexId": 91,
    "bloodlineId": "F16",
    "bloodlineName": "Vampire Bat Twins",
    "formName": "Peepbat",
    "stage": "Baby"
  },
  {
    "dexId": 92,
    "bloodlineId": "F16",
    "bloodlineName": "Vampire Bat Twins",
    "formName": "Winglet",
    "stage": "Small"
  },
  {
    "dexId": 93,
    "bloodlineId": "F16",
    "bloodlineName": "Vampire Bat Twins",
    "formName": "Bridge Batti",
    "stage": "Mid"
  },
  {
    "dexId": 94,
    "bloodlineId": "F16",
    "bloodlineName": "Vampire Bat Twins",
    "formName": "Vanto Yin",
    "stage": "Max"
  },
  {
    "dexId": 95,
    "bloodlineId": "F16",
    "bloodlineName": "Vampire Bat Twins",
    "formName": "Vanta Yang",
    "stage": "Max"
  },
  {
    "dexId": 96,
    "bloodlineId": "F17",
    "bloodlineName": "Legendary Hart",
    "formName": "Halo Egg",
    "stage": "Egg"
  },
  {
    "dexId": 97,
    "bloodlineId": "F17",
    "bloodlineName": "Legendary Hart",
    "formName": "Fawnlight",
    "stage": "Baby"
  },
  {
    "dexId": 98,
    "bloodlineId": "F17",
    "bloodlineName": "Legendary Hart",
    "formName": "Grove Fawn",
    "stage": "Small"
  },
  {
    "dexId": 99,
    "bloodlineId": "F17",
    "bloodlineName": "Legendary Hart",
    "formName": "Boro Stag",
    "stage": "Mid"
  },
  {
    "dexId": 100,
    "bloodlineId": "F17",
    "bloodlineName": "Legendary Hart",
    "formName": "Gaia Hart",
    "stage": "Max"
  },
  {
    "dexId": 101,
    "bloodlineId": "F17",
    "bloodlineName": "Legendary Hart",
    "formName": "Lumina Hart",
    "stage": "Max"
  },
  {
    "dexId": 102,
    "bloodlineId": "F17",
    "bloodlineName": "Legendary Hart",
    "formName": "Volt Hart",
    "stage": "Max"
  },
  {
    "dexId": 103,
    "bloodlineId": "F17",
    "bloodlineName": "Legendary Hart",
    "formName": "Phantom Hart",
    "stage": "Max"
  },
  {
    "dexId": 104,
    "bloodlineId": "F17",
    "bloodlineName": "Legendary Hart",
    "formName": "Tide Hart",
    "stage": "Max"
  },
  {
    "dexId": 105,
    "bloodlineId": "F18",
    "bloodlineName": "Subwave",
    "formName": "Harbor Roe",
    "stage": "Egg"
  },
  {
    "dexId": 106,
    "bloodlineId": "F18",
    "bloodlineName": "Subwave",
    "formName": "Gillie",
    "stage": "Baby"
  },
  {
    "dexId": 107,
    "bloodlineId": "F18",
    "bloodlineName": "Subwave",
    "formName": "Finside",
    "stage": "Small"
  },
  {
    "dexId": 108,
    "bloodlineId": "F18",
    "bloodlineName": "Subwave",
    "formName": "Sharkslide",
    "stage": "Mid"
  },
  {
    "dexId": 109,
    "bloodlineId": "F18",
    "bloodlineName": "Subwave",
    "formName": "Subwave",
    "stage": "Max"
  },
  {
    "dexId": 110,
    "bloodlineId": "F19",
    "bloodlineName": "Rentgoose",
    "formName": null,
    "stage": "Egg"
  },
  {
    "dexId": 111,
    "bloodlineId": "F19",
    "bloodlineName": "Rentgoose",
    "formName": "Squabblet",
    "stage": "Baby"
  },
  {
    "dexId": 112,
    "bloodlineId": "F19",
    "bloodlineName": "Rentgoose",
    "formName": "Ren Mc Duckie",
    "stage": "Small"
  },
  {
    "dexId": 113,
    "bloodlineId": "F19",
    "bloodlineName": "Rentgoose",
    "formName": "Leasebeak",
    "stage": "Mid"
  },
  {
    "dexId": 114,
    "bloodlineId": "F19",
    "bloodlineName": "Rentgoose",
    "formName": "Lordy Hordie",
    "stage": null
  },
  {
    "dexId": 115,
    "bloodlineId": "F19",
    "bloodlineName": "Rentgoose",
    "formName": "Grand Gander",
    "stage": "Max"
  }
];
