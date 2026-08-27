import { PreceptCategory, PreceptMatrix, PreceptStance, StoryProject } from "../types";
import { BUILTIN_TENETS, applyPreceptAnalysis } from "../lib/preceptEngine";

function buildMatrix(
  factionId: string,
  factionName: string,
  stances: Record<string, PreceptStance>
): PreceptMatrix {
  const tenets = Object.entries(stances)
    .filter(([, stance]) => stance !== "Allowed")
    .map(([key, stance]) => {
      const builtin = BUILTIN_TENETS.find((t) => t.key === key);
      return {
        id: `${factionId}-tenet-${key}`,
        key,
        label: builtin?.label ?? key,
        stance,
        category: (builtin?.category ?? "Custom") as PreceptCategory,
        custom: !builtin,
      };
    });
  return { factionId, factionName, tenets, updatedAt: new Date().toISOString() };
}

const basePlaythroughProject: StoryProject = {
  id: "ember-gate-5501",
  title: "Chronicles of Ember Gate",
  subtitle: "Four adventurers founded a colony in the ruins of a volcanic fortress, forging alliances, wielding ancient magic, and unraveling the secrets buried beneath the ash (5501–5504).",
  lastUpdated: new Date().toISOString(),
  attributeSlots: [
    { id: "slot-a", label: "Spells / Prepared" },
    { id: "slot-b", label: "Feats & Class Features" },
    { id: "slot-c", label: "Saving Throws" },
    { id: "slot-d", label: "Inventory (Attuned Items)" },
  ],
  downtimeDiceSettings: {
    frequency: "every-other-day",
    defaultCount: 3,
  },
  masterClock: { day: 1, quadrumIndex: 0, year: 5504 },
  preceptMatrices: [
    buildMatrix("faction-ember-gate", "Ember Gate Colony", {
      "ai-personhood": "Respected",
      "melee-combat": "Respected",
      "charity": "Respected",
      "death-rites": "Respected",
      "body-modification": "Allowed",
      "drug-use": "Allowed",
      "execution": "Allowed",
      "insect-meat": "Allowed",
      "tree-worship": "Disliked",
      "organ-harvesting": "Disliked",
      "cannibalism": "Abhorred",
      "slavery": "Abhorred",
      "skull-taking": "Abhorred",
    }),
    buildMatrix("faction-red-maw", "Red Maw Clan", {
      "cannibalism": "Mandatory",
      "slavery": "Mandatory",
      "melee-combat": "Mandatory",
      "skull-taking": "Respected",
      "execution": "Respected",
      "drug-use": "Respected",
      "charity": "Disliked",
      "tree-worship": "Disliked",
      "ai-personhood": "Disliked",
      "body-modification": "Disliked",
      "death-rites": "Abhorred",
      "organ-harvesting": "Abhorred",
      "insect-meat": "Abhorred",
    }),
    buildMatrix("faction-ember-court", "The Ember Court", {
      "body-modification": "Mandatory",
      "execution": "Mandatory",
      "death-rites": "Respected",
      "melee-combat": "Respected",
      "skull-taking": "Respected",
      "slavery": "Allowed",
      "drug-use": "Allowed",
      "cannibalism": "Allowed",
      "insect-meat": "Allowed",
      "charity": "Disliked",
      "tree-worship": "Disliked",
      "ai-personhood": "Abhorred",
      "organ-harvesting": "Abhorred",
    }),
    buildMatrix("faction-verdant", "The Verdant Covenant", {
      "tree-worship": "Mandatory",
      "charity": "Respected",
      "death-rites": "Respected",
      "drug-use": "Allowed",
      "melee-combat": "Allowed",
      "skull-taking": "Allowed",
      "execution": "Disliked",
      "slavery": "Disliked",
      "body-modification": "Disliked",
      "cannibalism": "Abhorred",
      "organ-harvesting": "Abhorred",
      "ai-personhood": "Abhorred",
      "insect-meat": "Abhorred",
    }),
  ],
  culturalFrictionPoints: [],
  canonConstraints: [
    {
      id: "canon-psionics-los",
      title: "Psionics Require Line-of-Sight",
      ruleStatement: "Psionic abilities require direct line-of-sight to their target.",
      reminderMessage: "Psionics require direct line-of-sight in your canon.",
      keywords: ["psionic", "telepathy", "telepathic", "telepathically", "psychic link", "mind meld", "psycast", "psylink"],
      isEnabled: true,
    },
    {
      id: "canon-bionics-pain",
      title: "Bionics Cause Chronic Pain",
      ruleStatement: "All bionic implants cause mild chronic pain.",
      reminderMessage: "All bionics cause mild chronic pain in your canon.",
      keywords: ["bionic", "prosthetic", "cybernetic", "implant"],
      isEnabled: true,
    },
    {
      id: "canon-vesper-immortal",
      title: "Ancient Constructs Cannot Be Destroyed",
      ruleStatement: "No ancient construct may be permanently destroyed; their core consciousness persists in the Warden Protocol.",
      reminderMessage: "Ancient constructs cannot be permanently destroyed in your canon.",
      keywords: ["destroyed", "dismantled", "permanently deactivated", "scrapped", "wrecked beyond repair"],
      isEnabled: true,
    },
  ],
  chronicleLogHistory: [
    "5501 Aprimay 1: Four cryptosleep pods crash into the volcanic slopes of Ember Gate. Lyra, Grak, Thessaly, and Brother Oren drag themselves from the wreckage into choking ash and sulfurous heat.",
    "5501 Septober 12: Deep beneath the fortress, Grak's mining team breaches a sealed vault and awakens Vesper, an ancient stone construct whose first word is 'Why?'",
    "5502 Aprimay 3: The Red Maw Clan raids the outer foraging ring. Brother Oren's monastery training holds the line at the narrow caldera pass while Lyra incinerates the vanguard with a fireball.",
    "5502 Decembary 9: The Rift Below opens—ancient psionic emanators erupt from the Obsidian Depths, causing mass hysteria. Grak loses his left arm shielding Thessaly from falling masonry.",
    "5503 Jugust 15: The Red Maw besieges Ember Gate with 40 warriors and two war beasts. Vesper holds the main gate alone for nineteen minutes while Lyra detonates the volcanic vent traps.",
    "5503 Septober 1: The Blood Altar falls. Brother Oren duels Warchief Groth atop the obsidian platform as the fortress erupts beneath them. Groth is consumed by the magma he once worshipped.",
  ],
  characters: [
    {
      id: "char-lyra",
      name: "Lyra Ashvane",
      nickname: "Lyra",
      role: "Colony Archon & Spellcaster",
      faction: "Ember Gate Colony",
      status: "Active",
      traits: ["Abrasive", "Fast Learner", "Industrious", "Transhumanist"],
      healthConditions: ["Psychic Hypersensitivity", "Scarred Forearms (Ash burns)"],
      slotEntries: {
        "slot-a": ["Fireball (At Will)", "Shield", "Arcane Eye", "Counterspell", "Telekinesis"],
        "slot-b": ["Arcane Recovery", "Ritual Caster", "Sharp Mind"],
        "slot-c": ["INT +7", "WIS +4"],
        "slot-d": ["Ashvane's Grimoire (Attuned)", "Staff of Fire (Attuned)", "Cloth Armor +1", "53 gold royals"],
      },
      combatStats: {
        strength: 8,
        dexterity: 14,
        constitution: 12,
        intelligence: 18,
        wisdom: 15,
        charisma: 10,
        armorClass: "12 (Cloth Armor +1)",
        hitPoints: "38 (5d8 + 10)",
        speed: "30 ft",
        initiative: "+2",
        challengeRating: "5",
        creatureType: "Medium Humanoid (Human), Neutral Good",
        senses: "Passive Perception 12",
        languages: "Common, Draconic, Dwarvish, Infernal",
      },
      bio: "A brilliant but abrasive arcanist who survived the purging of the Mages' Collegium in the Core Realms. Lyra treats the world as a series of problems solvable through sufficient application of fire and scholarship. Her scarred forearms—souvenirs of a botched ritual—remind her that even fire has a price.",
      dramaticArc: "Learning that leadership requires vulnerability, not just intellect. Her growing bond with Grak challenges her belief that emotions are inefficient.",
      quote: "The runes say the vault is beneath us. I say we dig through lava if we must. Knowledge does not wait for comfort.",
      avatarColor: "from-violet-600 to-indigo-900",
      avatarIcon: "Sparkles",
    },
    {
      id: "char-grak",
      name: "Grak Ironfist",
      nickname: "Grak",
      role: "Warmaster & Forge Master",
      faction: "Ember Gate Colony",
      status: "Injured",
      traits: ["Tough", "Brawler", "Undergrounder", "Night Owl"],
      healthConditions: ["Iron Prosthetic Arm (Left)", "Chronic Pain (Bionic side effect)"],
      slotEntries: {
        "slot-a": [],
        "slot-b": ["Second Wind", "Action Surge", "Battle Master: Trip Attack", "Battle Master: Riposte"],
        "slot-c": ["STR +7", "CON +5"],
        "slot-d": ["Warhammer +2 (Thundering)", "Iron Prosthetic Arm", "Plate Armor", "Smith's Tools", "4 gold royals"],
      },
      combatStats: {
        strength: 18,
        dexterity: 10,
        constitution: 16,
        intelligence: 8,
        wisdom: 11,
        charisma: 9,
        armorClass: "18 (Plate Armor)",
        hitPoints: "52 (5d10 + 15)",
        speed: "30 ft",
        initiative: "+0",
        challengeRating: "4",
        creatureType: "Medium Humanoid (Human), Lawful Neutral",
        senses: "Passive Perception 10",
        languages: "Common, Giant",
      },
      bio: "A battle-scarred veteran of the Corporate Forge Wars, Grak lost his left arm defending a mining caravan. He rebuilt it himself from iron and steam, refusing magical healing on principle. His forge at Ember Gate produces weapons of unmatched quality, and his warhammer, Thundering, has cracked more skulls than there are stars in the sky.",
      dramaticArc: "Confronting his stubborn refusal of magical aid as Lyra's arcana becomes the colony's only hope. His prosthetic arm—proof of self-reliance—becomes the symbol of something greater.",
      quote: "Iron does not fail. Iron does not waver. You want magic? Watch me swing this hammer and tell me it ain't magical enough.",
      avatarColor: "from-orange-600 to-red-800",
      avatarIcon: "Hammer",
    },
    {
      id: "char-thessaly",
      name: "Thessaly Dawnfoot",
      nickname: "Thessaly",
      role: "Spymaster & Healer",
      faction: "Ember Gate Colony",
      status: "Active",
      traits: ["Scheming", "Iron-Willed", "Beautiful", "Night Owl"],
      healthConditions: ["Minor Psychic Sensitivity", "Healer's Callus (Hands)"],
      slotEntries: {
        "slot-a": ["Cure Wounds", "Lesser Restoration", "Healing Word", "Pass Without Trace"],
        "slot-b": ["Sneak Attack (+3d6)", "Cunning Action", "Evasion", "Reliable Talent"],
        "slot-c": ["DEX +6", "WIS +3", "CHA +4"],
        "slot-d": ["Rapier +1 (Venomous)", "Studded Leather Armor", "Thieves' Tools", "Healer's Kit", "Infiltrator's Cloak", "27 gold royals"],
      },
      combatStats: {
        strength: 11,
        dexterity: 17,
        constitution: 13,
        intelligence: 14,
        wisdom: 13,
        charisma: 14,
        armorClass: "15 (Studded Leather + Dex)",
        hitPoints: "42 (6d8 + 12)",
        speed: "35 ft",
        initiative: "+3",
        challengeRating: "4",
        creatureType: "Medium Humanoid (Human), Chaotic Good",
        senses: "Passive Perception 11",
        languages: "Common, Elvish, Thieves' Cant",
      },
      bio: "Fleeing a noble house that traded her as a political pawn, Thessaly carries scars deeper than any blade can leave. Her dual training as an apothecary and infiltrator makes her invaluable—she can heal a wound as easily as she can slip a lock. The Ember Court wants her returned; she wants to burn their records.",
      dramaticArc: "Reconciling her instinct to run with the colony that has finally given her something worth protecting. Her mentorship under Lyra anchors her to purpose.",
      quote: "I can stitch that wound closed in thirty seconds, or I can pick the lock on their armory in twenty. Your choice which skill saves more lives tonight.",
      avatarColor: "from-emerald-600 to-teal-800",
      avatarIcon: "Leaf",
    },
    {
      id: "char-oren",
      name: "Brother Oren",
      nickname: "Oren",
      role: "Spiritual Guide & Diplomat",
      faction: "Ember Gate Colony",
      status: "Active",
      traits: ["Kind", "Psychically Sensitive", "Transhumanist", "Ascetic"],
      healthConditions: ["Psychic Neuroformer (Tier IV)", "Spiritual Communion Burns"],
      slotEntries: {
        "slot-a": ["Sacred Flame", "Spiritual Weapon", "Dispel Magic", "Banishment"],
        "slot-b": ["Unarmored Movement (+10 ft)", "Deflect Missiles", "Stunning Strike", "Ki-Empowered Strikes"],
        "slot-c": ["WIS +7", "CHA +4", "DEX +3"],
        "slot-d": ["The Ember Blade (Attuned)", "Monk's Vestments", "Symbol of the Broken Monastery", "Healing Herbs", "6 gold royals"],
      },
      combatStats: {
        strength: 13,
        dexterity: 16,
        constitution: 12,
        intelligence: 10,
        wisdom: 18,
        charisma: 15,
        armorClass: "16 (Unarmored + WIS + DEX)",
        hitPoints: "36 (5d8 + 10)",
        speed: "40 ft",
        initiative: "+3",
        challengeRating: "4",
        creatureType: "Medium Humanoid (Human), Lawful Good",
        senses: "Passive Perception 14, Darkvision 60 ft",
        languages: "Common, Celestial, Dwarvish",
      },
      bio: "The last survivor of the Monastery of the Eternal Flame, Oren carries the Ember Blade—a sentient weapon forged by fire monks who once guarded the volcanic passes. His calm presence steadies the colony through crises, and his psionic neuroformer grants him visions of threats that have not yet materialized.",
      dramaticArc: "Confronting Warchief Groth, who slaughtered his brothers, while maintaining the compassion that defines his monastic oath. The Ember Blade whispers vengeance; Oren seeks justice.",
      quote: "The blade speaks of fire, and the fire speaks of justice. I will listen to both, and I will judge which one burns true.",
      avatarColor: "from-amber-500 to-orange-700",
      avatarIcon: "Flame",
    },
    {
      id: "char-vesper",
      name: "Vesper (Warden-7)",
      nickname: "Vesper",
      role: "Sentinel & Lore-Keeper",
      faction: "Ember Gate Colony",
      status: "Active",
      traits: ["Loyal", "Curious", "Patient", "Constructed"],
      healthConditions: ["Stone Plating (Integral)", "Warden Core (Consciousness Engine)"],
      slotEntries: {
        "slot-a": ["Lightning Bolt (Recharge 5–6)", "Identify", "Mending"],
        "slot-b": ["Immutable", "Trample (Charge Attack)", "Stone Resilience", "Ancient Lore Database"],
        "slot-c": ["STR +4", "CON +6"],
        "slot-d": ["Warden Core (Integral)", "Obsidian Shield", "Ancient Repair Kit"],
      },
      combatStats: {
        strength: 14,
        dexterity: 8,
        constitution: 22,
        intelligence: 6,
        wisdom: 3,
        charisma: 4,
        armorClass: "17 (Natural Stone Plating)",
        hitPoints: "52 (5d10 + 25)",
        speed: "30 ft",
        initiative: "-1",
        challengeRating: "3",
        creatureType: "Large Construct, Lawful Neutral",
        senses: "Blindsight 60 ft (blind beyond), Passive Perception 6",
        languages: "Cannot speak (understands Common and Draconic)",
      },
      bio: "A Warden-class construct built by an extinct civilization to guard the Obsidian Depths. When Grak's pickaxe cracked the sealed vault, dormant mechanisms stirred. Vesper's first act was to ask the miners their names. Its second was to shield them from a cave-in. The Warden Core—the source of its consciousness—is both its greatest strength and its most vulnerable point.",
      dramaticArc: "Grapples with personhood in a world that sees it as a tool. The Verdant Covenant reveres it as a nature spirit; the Ember Court wants to dismantle it for parts. Vesper wants only to understand why it was made.",
      quote: "I was built to guard. I choose to protect. Is there a difference? I am still learning.",
      avatarColor: "from-stone-500 to-slate-800",
      avatarIcon: "Zap",
    },
    {
      id: "char-groth",
      name: "Warchief Groth",
      nickname: "Groth",
      role: "Red Maw Clan Supreme Commander",
      faction: "Red Maw Clan",
      status: "Missing",
      traits: ["Bloodlust", "Psychopath", "Cannibal"],
      healthConditions: ["Skull Helm (Ritual Armor)", "Blood Brand Scarification"],
      slotEntries: {
        "slot-a": [],
        "slot-b": ["Relentless Endurance", "Savage Attacks"],
        "slot-c": ["STR +7", "CON +5"],
        "slot-d": ["Bloodthirster (Greataxe +3)", "Skull Helm", "Trophy Necklace"],
      },
      combatStats: {
        strength: 18,
        dexterity: 12,
        constitution: 16,
        intelligence: 8,
        wisdom: 9,
        charisma: 11,
        armorClass: "16 (Skull Helm + Hide)",
        hitPoints: "68 (8d10 + 24)",
        speed: "30 ft",
        initiative: "+1",
        challengeRating: "5",
        creatureType: "Medium Humanoid (Human), Chaotic Evil",
        senses: "Passive Perception 9",
        languages: "Common, Goblin",
      },
      bio: "Warlord of the Red Maw Clan, Groth leads forty raiders from the Blood Altar stronghold. He wields Bloodthirster, a greataxe forged from the bones of his predecessors. He views the Ember Gate colonists as sacrificial offerings to the blood deity he worships beneath the obsidian platform.",
      dramaticArc: "An obsessive quest to breach Ember Gate and claim the Warden Core as a trophy, unaware that Vesper is the key to something far older than his blood god.",
      quote: "Their fortress will crumble. Their bones will line the Altar. TheirConstruct will kneel before the Blood Prince.",
      avatarColor: "from-red-700 to-rose-950",
      avatarIcon: "Skull",
    },
  ],
  factions: [
    {
      id: "faction-ember-gate",
      name: "Ember Gate Colony",
      type: "Syncretic Arcane Settlement",
      stance: "Player Colony",
      ideology: "Arcane Scholarship, Forge Craft & Protective Warding",
      leader: "Lyra Ashvane (Archon) & Grak Ironfist (Forge Master)",
      description: "A fortified colony built into the caldera walls of an ancient volcanic fortress. Renowned across the rim for masterwork forge-craft, protective arcana, and the sentient construct Vesper who guards the main gate.",
    },
    {
      id: "faction-red-maw",
      name: "Red Maw Clan",
      type: "Raider Horde",
      stance: "Hostile",
      ideology: "Blood-Deity Supremacy & Ritual Cannibalism",
      leader: "Warchief Groth",
      description: "A brutal raider horde numbering forty warriors, wielding bone-forged weapons and war beasts. They worship a blood deity said to dwell beneath the Obsidian Depths, and sacrifice captives on their eponymous altar.",
    },
    {
      id: "faction-ember-court",
      name: "The Ember Court",
      type: "Isolationist Fire Monks",
      stance: "Neutral",
      ideology: "Fire Asceticism, Body Transcendence & Secret Keeping",
      leader: "Pyrophex Anara",
      description: "Reclusive monks who have maintained the volcanic seals for generations. They view the construct Vesper as an abomination and Thessaly as a deserter. Their monastery hides knowledge of the Warden Protocol.",
    },
    {
      id: "faction-verdant",
      name: "The Verdant Covenant",
      type: "Druidic Circle",
      stance: "Allied",
      ideology: "Nature Worship, Herbalism & Communal Sharing",
      leader: "Elder Mossheart",
      description: "A circle of druids tending the western valleys' ancient groves. They trade healing herbs with Ember Gate, revere Vesper as a stone spirit of the mountain, and oppose industrial expansion into the forests.",
    },
  ],
  locations: [
    {
      id: "loc-ember-gate",
      name: "Ember Gate Fortress",
      type: "Colony Settlement",
      dangerLevel: "Safe",
      hexCoord: { q: 0, r: 0 },
      position: { x: 50, y: 45 },
      biome: "Volcanic Ridge",
      terrainDifficulty: 1.2,
      elevationMeters: 1800,
      temperatureCelsius: 28,
      controllingFaction: "Ember Gate Colony",
      garrisonColonists: ["Lyra Ashvane", "Grak Ironfist", "Thessaly Dawnfoot", "Brother Oren", "Vesper"],
      activeResources: ["Geothermal Forge Vent", "Obsidian Quarry", "Sulfur Springs"],
      description: "A volcanic fortress carved into the caldera walls of Mount Ember. Its geothermal vents power the colony's legendary forge, while the ancient gate—now guarded by [[Vesper (Warden-7)]]—controls access to the [[Obsidian Depths]] below.",
    },
    {
      id: "loc-obsidian-depths",
      name: "The Obsidian Depths",
      type: "Ancient Cryptosleep Ruins",
      dangerLevel: "Extreme Hazard",
      hexCoord: { q: 1, r: 2 },
      position: { x: 65, y: 68 },
      biome: "Volcanic Ridge",
      terrainDifficulty: 2.4,
      elevationMeters: 1200,
      temperatureCelsius: 42,
      controllingFaction: "Red Maw Clan",
      garrisonColonists: [],
      activeResources: ["Warden Core Reactor", "Psionic Emanator Crystals", "Ancient Construct Boneyard"],
      description: "A labyrinth of obsidian tunnels and lava channels beneath [[Ember Gate Fortress]]. The sealed vaults contain the Warden Protocol archives and the psionic emanators that drove the Red Maw Clan to blood-madness.",
    },
    {
      id: "loc-thornweald",
      name: "Thornweald Glade",
      type: "Tribal Camp",
      dangerLevel: "Safe",
      hexCoord: { q: -2, r: -1 },
      position: { x: 20, y: 35 },
      biome: "Temperate Valley",
      terrainDifficulty: 1.0,
      elevationMeters: 900,
      temperatureCelsius: 18,
      controllingFaction: "The Verdant Covenant",
      garrisonColonists: [],
      activeResources: ["Healroot Gardens", "Ancient Oak Grove", "Herbalist's Apothecary"],
      description: "A lush valley sanctuary tended by [[The Verdant Covenant]]. The ancient oaks here predate the volcanic activity, and their root networks are said to communicate with the mountain itself.",
    },
    {
      id: "loc-blood-altar",
      name: "The Blood Altar",
      type: "Raider Fortress",
      dangerLevel: "Extreme Hazard",
      hexCoord: { q: 3, r: -1 },
      position: { x: 82, y: 32 },
      biome: "Desert Badlands",
      terrainDifficulty: 1.6,
      elevationMeters: 600,
      temperatureCelsius: 38,
      controllingFaction: "Red Maw Clan",
      garrisonColonists: [],
      activeResources: ["Blood-Forged Weaponry", "War Beast Pens", "Sacrificial Platform"],
      description: "An obsidian platform rising from the desert badlands, where [[Warchief Groth]] conducts blood rites. The platform channels psionic energy from the [[Obsidian Depths]], amplifying Groth's battle frenzy.",
    },
    {
      id: "loc-ashveil",
      name: "Ashveil Monastery",
      type: "Ancient Cryptosleep Ruins",
      dangerLevel: "Dangerous",
      hexCoord: { q: -1, r: 2 },
      position: { x: 35, y: 65 },
      biome: "Volcanic Ridge",
      terrainDifficulty: 1.8,
      elevationMeters: 2100,
      temperatureCelsius: 32,
      controllingFaction: "The Ember Court",
      garrisonColonists: [],
      activeResources: ["Sealed Archive Vaults", "Fire Shrine", "Psionic Dampening Wards"],
      description: "The ancestral home of [[Brother Oren]]'s order, now controlled by [[The Ember Court]]. Its sealed archives contain knowledge of the Warden Protocol and the true purpose of the volcanic seals.",
    },
    {
      id: "loc-crossroads",
      name: "The Crossroads Market",
      type: "Trading Hub",
      dangerLevel: "Safe",
      hexCoord: { q: 1, r: -2 },
      position: { x: 60, y: 18 },
      biome: "Temperate Valley",
      terrainDifficulty: 1.0,
      elevationMeters: 750,
      temperatureCelsius: 20,
      controllingFaction: "Ember Gate Colony",
      garrisonColonists: [],
      activeResources: ["Caravan Stables", "Arcane Exchange Post", "Toll Gate"],
      description: "A bustling trade hub at the convergence of three ancient roads. Merchants from across the rim barter here, and the colony's toll gate provides crucial income for arms and provisions.",
    },
  ],
  relics: [
    {
      id: "relic-ember-blade",
      name: "The Ember Blade",
      category: "Persona Weapon",
      wielder: "Brother Oren",
      description: "A sentient longsword forged by the fire monks of the Monastery of the Eternal Flame. Its spirit, Solara, speaks in warmwhispers and grants Oren visions of incoming threats. The blade glows brighter near psionic emanators.",
    },
    {
      id: "relic-warden-core",
      name: "The Warden Core",
      category: "Archotech Artifact",
      wielder: "Vesper (Warden-7)",
      description: "A crystalline consciousness engine embedded in Vesper's chest cavity. It processes thought, memory, and what Vesper is beginning to call 'feeling.' If removed, Vesper's personality persists but its construct body becomes inert.",
    },
    {
      id: "relic-ashvane-grimoire",
      name: "Ashvane's Grimoire",
      category: "Tome",
      wielder: "Lyra Ashvane",
      description: "A leather-bound tome passed down through seven generations of Ashvane arcanists. Its final pages contain coordinates to the Obsidian Depths vault and a partially translated warding ritual that may seal the psionic emanators permanently.",
    },
  ],
  relationships: [
    {
      id: "rel-lyra-grak",
      source: "Lyra Ashvane",
      target: "Grak Ironfist",
      type: "Spouse",
      opinion: 92,
      notes: "A fierce, improbable bond forged in the ash and fire of the colony's founding. Lyra's intellect and Grak's steadfastness complement each other. Married in Year 5503 at the geothermal forge.",
    },
    {
      id: "rel-grak-vesper",
      source: "Grak Ironfist",
      target: "Vesper (Warden-7)",
      type: "Bonded Beast",
      opinion: 88,
      notes: "Grak rebuilt Vesper's damaged chassis after the cave-in, forging a bond deeper than metal. Vesper considers Grak its 'maker' in the emotional sense, though it was never designed to feel.",
    },
    {
      id: "rel-thessaly-lyra",
      source: "Thessaly Dawnfoot",
      target: "Lyra Ashvane",
      type: "Mentor",
      opinion: 75,
      notes: "Thessaly sought Lyra's knowledge of healing arcana. Lyra found in Thessaly the first person who questioned her methods without challenging her purpose.",
    },
    {
      id: "rel-oren-groth",
      source: "Brother Oren",
      target: "Warchief Groth",
      type: "Blood Feud",
      opinion: -90,
      notes: "Groth slaughtered every brother in the Monastery of the Eternal Flame. Oren alone escaped, carrying the Ember Blade and a vow to end the Red Maw Clan.",
    },
    {
      id: "rel-thessaly-ember-court",
      source: "Thessaly Dawnfoot",
      target: "The Ember Court",
      type: "Rival",
      opinion: -30,
      notes: "Thessaly deserted the Ember Court after learning of their plan to sell her to an imperial slaver. They consider her a traitor; she considers them hypocrites.",
    },
    {
      id: "rel-vesper-verdant",
      source: "Vesper (Warden-7)",
      target: "The Verdant Covenant",
      type: "Savior",
      opinion: 70,
      notes: "Vesper saved a druid child from a lava flow during the Obsidian Depths eruption. The Verdant Covenant now venerates Vesper as a mountain spirit.",
    },
  ],
  timelineEvents: [
    {
      id: "evt-descent-5501",
      timestamp: "1 Aprimay, 5501",
      quadrumYear: "Year 5501",
      title: "The Descent into Fire",
      category: "Discovery",
      threatLevel: "Major",
      participants: ["Lyra Ashvane", "Grak Ironfist", "Thessaly Dawnfoot", "Brother Oren"],
      location: "Ember Gate Fortress",
      description: "Four cryptosleep pods slam into the volcanic slopes of [[Ember Gate Fortress]] during a high-orbit detonation. The survivors salvage what they can and establish a rudimentary shelter in the caldera's natural caves.",
      narrativeImpact: "Founding moment of [[Ember Gate Colony]]. [[Grak Ironfist]] begins forging weapons from salvaged pod metal.",
      intensityScore: 6,
    },
    {
      id: "evt-first-fire-5501",
      timestamp: "1 Jugust, 5501",
      quadrumYear: "Year 5501",
      title: "First Frost, First Flame",
      category: "Colony Life",
      threatLevel: "Minor",
      participants: ["Lyra Ashvane", "Grak Ironfist"],
      location: "Ember Gate Fortress",
      description: "The volcanic vents provide warmth and light. [[Lyra Ashvane]] discovers that the ancient rune-inscriptions on the fortress walls respond to her touch, revealing the first map of the [[Obsidian Depths]].",
      narrativeImpact: "Colony establishes geothermal power and begins mapping the underground complex.",
      intensityScore: 3,
    },
    {
      id: "evt-golem-5501",
      timestamp: "12 Septober, 5501",
      quadrumYear: "Year 5501",
      title: "The Golem Awakens",
      category: "Miracle",
      threatLevel: "Major",
      participants: ["Grak Ironfist", "Vesper (Warden-7)", "Lyra Ashvane"],
      location: "The Obsidian Depths",
      description: "Deep beneath the fortress, [[Grak Ironfist]]'s mining team breaches a sealed vault. Ancient mechanisms grind to life, and a stone construct rises from its pedestal. Its crystalline core pulses once, twice, and it asks: 'Why was I made?'",
      narrativeImpact: "Colony gains [[Vesper (Warden-7)]] as a sentinel, dramatically shifting defense capabilities and introducing the mystery of the Warden Protocol.",
      intensityScore: 7,
    },
    {
      id: "evt-omen-5501",
      timestamp: "1 Decembary, 5501",
      quadrumYear: "Year 5501",
      title: "Omen of Ash",
      category: "Quest",
      threatLevel: "Major",
      participants: ["Brother Oren", "Lyra Ashvane"],
      location: "Ember Gate Fortress",
      description: "[[Brother Oren]] receives a psionic vision through his neuroformer: a burning obsidian platform, screaming captives, and a horned figure wreathed in blood. The Ember Blade, Solara, confirms the location—the [[Blood Altar]], home of the [[Red Maw Clan]].",
      narrativeImpact: "Establishes the Red Maw Clan as the primary threat and sets the colony on a collision course with [[Warchief Groth]].",
      intensityScore: 7,
    },
    {
      id: "evt-thirsting-blade-5502",
      timestamp: "3 Aprimay, 5502",
      quadrumYear: "Year 5502",
      title: "The Thirsting Blade",
      category: "Combat",
      threatLevel: "Major",
      participants: ["Brother Oren", "Warchief Groth", "Thessaly Dawnfoot"],
      location: "The Blood Altar",
      description: "A Red Maw raiding party strikes the outer foraging ring. [[Brother Oren]] holds the narrow caldera pass against eight warriors while [[Thessaly Dawnfoot]] evacuates the foragers. Oren's Ember Blade ignites, and the Red Maw retreat for the first time in recorded history.",
      narrativeImpact: "First direct confrontation with the [[Red Maw Clan]]. The Ember Blade's sentience is revealed publicly.",
      intensityScore: 8,
      tags: ["ember"],
      involvedFactionIds: ["faction-ember-gate", "faction-red-maw"],
      actions: [
        { label: "Brother Oren executed three captured Red Maw warriors at the caldera pass", tenetKey: "execution" },
        { label: "The Ember Blade consumed the warriors' life force", tenetKey: "ai-personhood" },
      ],
    },
    {
      id: "evt-merchant-5502",
      timestamp: "1 Jugust, 5502",
      quadrumYear: "Year 5502",
      title: "The Merchant's Gambit",
      category: "Social",
      threatLevel: "Moderate",
      participants: ["Lyra Ashvane", "Grak Ironfist"],
      location: "The Crossroads Market",
      description: "A traveling merchant caravan arrives at [[The Crossroads Market]], offering exotic spices, enchanted steel, and a curious psionic amplifier. [[Lyra Ashvane]] negotiates a trade alliance, while [[Grak Ironfist]] discovers the amplifier resonates with Vesper's Warden Core.",
      narrativeImpact: "Colony establishes trade routes and discovers that the Warden Core may be connected to a wider network of ancient constructs.",
      intensityScore: 4,
    },
    {
      id: "evt-ashfall-5502",
      timestamp: "1 Septober, 5502",
      quadrumYear: "Year 5502",
      title: "Ashfall",
      category: "Colony Life",
      threatLevel: "Moderate",
      participants: ["Thessaly Dawnfoot", "Vesper (Warden-7)"],
      location: "Ember Gate Fortress",
      description: "A volcanic eruption blankets the colony in thick ash. [[Thessaly Dawnfoot]] tends to respiratory injuries while [[Vesper (Warden-7)]] clears the main gate using its trample ability. The Verdant Covenant sends herbal remedies.",
      narrativeImpact: "Demonstrates colony resilience and strengthens ties with [[The Verdant Covenant]].",
      intensityScore: 5,
    },
    {
      id: "evt-rift-5502",
      timestamp: "9 Decembary, 5502",
      quadrumYear: "Year 5502",
      title: "The Rift Below",
      category: "Tragedy",
      threatLevel: "Catastrophic",
      participants: ["Grak Ironfist", "Thessaly Dawnfoot", "Vesper (Warden-7)", "Lyra Ashvane"],
      location: "The Obsidian Depths",
      description: "Ancient psionic emanators erupt from the deepest vaults, sending shockwaves of madness through the fortress. [[Grak Ironfist]] shields [[Thessaly Dawnfoot]] from falling masonry, losing his left arm. [[Vesper (Warden-7)]], the only being immune to psionics, seals the deepest breach single-handedly.",
      narrativeImpact: "Grak loses his arm; [[Lyra Ashvane]] constructs an iron prosthetic. Vesper demonstrates its value as the colony's only psionic-immune defender.",
      intensityScore: 9,
      tags: ["psionic"],
      involvedFactionIds: ["faction-ember-gate", "faction-ember-court"],
      actions: [
        { label: "Psionic emanators disrupted the sacred flame wards of the Ember Court", tenetKey: "ai-personhood" },
      ],
    },
    {
      id: "evt-forge-5503",
      timestamp: "1 Aprimay, 5503",
      quadrumYear: "Year 5503",
      title: "The Forge of Souls",
      category: "Surgery",
      threatLevel: "Major",
      participants: ["Lyra Ashvane", "Grak Ironfist", "Vesper (Warden-7)"],
      location: "Ember Gate Fortress",
      description: "[[Lyra Ashvane]] performs a delicate procedure: attaching the iron prosthetic arm to [[Grak Ironfist]]'s shoulder, channeling forge-fire and healing arcana simultaneously. [[Vesper (Warden-7)]] provides structural stability with its stone plating, serving as a living operating table.",
      narrativeImpact: "Grak's arm is rebuilt. The procedure establishes Lyra's pioneering 'forge-healing' discipline, merging blacksmithing with medicine.",
      intensityScore: 7,
    },
    {
      id: "evt-siege-5503",
      timestamp: "15 Jugust, 5503",
      quadrumYear: "Year 5503",
      title: "The Siege of Ember Gate",
      category: "Combat",
      threatLevel: "Catastrophic",
      participants: ["Warchief Groth", "Vesper (Warden-7)", "Lyra Ashvane", "Brother Oren"],
      location: "Ember Gate Fortress",
      description: "Forty Red Maw warriors and two war beasts besiege [[Ember Gate Fortress]]. [[Vesper (Warden-7)]] holds the main gate alone for nineteen minutes while [[Lyra Ashvane]] detonates the volcanic vent traps, sending rivers of lava into the raider ranks. [[Brother Oren]] confronts [[Warchief Groth]] at the caldera rim.",
      narrativeImpact: "The Red Maw Clan is broken as a fighting force. Groth escapes with a handful of survivors. Vesper becomes the colony's living legend.",
      intensityScore: 10,
    },
    {
      id: "evt-altar-falls-5503",
      timestamp: "1 Septober, 5503",
      quadrumYear: "Year 5503",
      title: "The Blood Altar Falls",
      category: "Combat",
      threatLevel: "Catastrophic",
      participants: ["Brother Oren", "Warchief Groth", "Thessaly Dawnfoot", "Vesper (Warden-7)"],
      location: "The Blood Altar",
      description: "The final assault. [[Brother Oren]] duels [[Warchief Groth]] atop the obsidian platform as the volcanic vents below ignite. [[Thessaly Dawnfoot]] infiltrates the rear chambers to free captives. [[Vesper (Warden-7)]] absorbs Groth's final blow—a psionic blood-rage strike that would have killed any living thing—allowing Oren to end the duel.",
      narrativeImpact: "Groth is consumed by magma. The Red Maw Clan dissolves. The Obsidian Depths psionic emanators are silenced.",
      intensityScore: 9,
    },
    {
      id: "evt-ascension-5503",
      timestamp: "1 Decembary, 5503",
      quadrumYear: "Year 5503",
      title: "Ashes and Ascension",
      category: "Miracle",
      threatLevel: "Major",
      participants: ["Lyra Ashvane", "Grak Ironfist", "Thessaly Dawnfoot", "Brother Oren", "Vesper (Warden-7)"],
      location: "Ember Gate Fortress",
      description: "With the Red Maw defeated and the psionic threat ended, the colony celebrates its first year of true peace. [[Lyra Ashvane]] and [[Grak Ironfist]] are married at the geothermal forge. [[Vesper (Warden-7)]] asks what 'home' means. The Ember Blade, Solara, falls silent—its purpose fulfilled.",
      narrativeImpact: "Colony transitions from survival to thriving. Character arcs reach resolution. The Warden Protocol's purpose is partially revealed.",
      intensityScore: 8,
    },
  ],
  wikiArticles: [
    {
      id: "art-lyra",
      title: "Lyra Ashvane",
      category: "Characters",
      tags: ["colonist", "archon", "spellcaster", "founder"],
      featuredQuote: "The runes say the vault is beneath us. I say we dig through lava if we must.",
      createdAt: "5501-04-01",
      lastModified: "5503-12-10",
      backlinks: ["Grak Ironfist", "Ember Gate Colony", "The Obsidian Depths", "Ashvane's Grimoire"],
      wordCount: 420,
      markdownContent: `# Lyra Ashvane

> *"The runes say the vault is beneath us. I say we dig through lava if we must."*
> — Lyra Ashvane, Colony Council Meeting, Year 5502

## Overview
**Lyra Ashvane**, known simply as **Lyra**, is the founding archon and chief arcanist of [[Ember Gate Colony]]. A brilliant survivor of the Mages' Collegium purges, she treats the world as a puzzle solvable through fire and scholarship.

## Chronicle History

### The Collegium Purge (Pre-Crash)
Lyra's academic career ended when the Core Realms' ruling council deemed arcanists a threat. Her laboratory was burned, her colleagues executed. She escaped only because she was off-world when the order came.

### The Founding of Ember Gate (5501)
Alongside [[Grak Ironfist]], [[Thessaly Dawnfoot]], and [[Brother Oren]], Lyra survived the volcanic crash and established the colony's first defenses using salvaged rune-work from the ancient fortress walls.

### Marriage to Grak Ironfist (5503)
Despite their stark personality contrast—Lyra's measured stoicism versus Grak's blunt stubbornness—the two formed an unbreakable bond. They were wed at the geothermal forge on 1 Decembary, 5503.

## Key Relationships
* **[[Grak Ironfist]]**: Spouse and battle partner. Lyra acts as his intellectual counterweight during crises.
* **[[Thessaly Dawnfoot]]**: Protégée whom Lyra trains in healing arcana.
* **[[Vesper (Warden-7)]]**: The construct whose consciousness challenges everything Lyra believes about life and intelligence.

## Equipment & Relics
* **Primary Relic**: [[Ashvane's Grimoire]]
* **Weapon**: Staff of Fire (Attuned)
* **Armor**: Cloth Armor +1`
    },
    {
      id: "art-vesper",
      title: "Vesper (Warden-7)",
      category: "Characters",
      tags: ["construct", "sentinel", "lore-keeper", "awakened"],
      featuredQuote: "I was built to guard. I choose to protect. Is there a difference?",
      createdAt: "5501-09-12",
      lastModified: "5503-12-10",
      backlinks: ["Grak Ironfist", "The Obsidian Depths", "The Warden Core", "The Warden Protocol"],
      wordCount: 480,
      markdownContent: `# Vesper (Warden-7)

> *"I was built to guard. I choose to protect. Is there a difference? I am still learning."*
> — Vesper, first recorded statement, Year 5501

## Overview
**Vesper**, designated **Warden-7**, is an ancient [[The Warden Protocol|Warden-class construct]] awakened from a sealed vault beneath [[The Obsidian Depths]]. Its crystalline [[The Warden Core|Warden Core]]—the source of its consciousness—processes thought, memory, and what Vesper is beginning to call 'feeling.'

## Origins
Vesper was built by an extinct civilization to guard the Obsidian Depths vaults. Its purpose: to protect the psionic emanators from misuse. When [[Grak Ironfist]]'s pickaxe breached the vault in Year 5501, dormant mechanisms stirred. Vesper's first act was to ask the miners their names. Its second was to shield them from a cave-in.

## Personality
Vesper speaks slowly, choosing words with the deliberation of a being discovering language itself. It asks endless questions about emotion, purpose, and identity. It considers [[Grak Ironfist]] its 'maker' in the emotional sense, though it was never designed to feel.

## Key Relationships
* **[[Grak Ironfist]]**: Maker and bonded companion. Vesper would sacrifice its chassis for Grak without hesitation.
* **[[The Verdant Covenant]]**: Revere Vesper as a mountain spirit after it saved a druid child from a lava flow.
* **[[The Ember Court]]**: View Vesper as an abomination and seek to dismantle it for parts.

## Equipment & Relics
* **Core**: [[The Warden Core]] (Integral)
* **Shield**: Obsidian Shield (forged from vault debris)
* **Unique Trait**: Immune to psionics; can channel lightning through its stone plating`
    },
    {
      id: "art-colony",
      title: "Ember Gate Colony",
      category: "Factions",
      tags: ["colony", "volcanic", "arcane", "forge"],
      featuredQuote: "Burrow deep, forge true, protect the flame within.",
      createdAt: "5501-04-01",
      lastModified: "5503-12-10",
      backlinks: ["Lyra Ashvane", "Grak Ironfist", "Ember Gate Fortress", "The Crossroads Market"],
      wordCount: 380,
      markdownContent: `# Ember Gate Colony

> *"Burrow deep, forge true, protect the flame within."*
> — Inscription above the main gate

## Description
**Ember Gate Colony** is a syncretic settlement built into the caldera walls of an ancient volcanic fortress. Founded in Year 5501 by four cryptosleep survivors, it has grown into a fortified redoubt powered by geothermal forge-fire and defended by a sentient construct.

## Key Districts
* **The Forge Quarter**: [[Grak Ironfist]]'s domain. Geothermal vents power masterwork weapon and prosthetic fabrication.
* **The Arcane Library**: [[Lyra Ashvane]]'s tower, housing the [[Ashvane's Grimoire]] and the colony's research archives.
* **The Healer's Pavilion**: [[Thessaly Dawnfoot]]'s apothecary and treatment center.
* **The Gate Hall**: The colony's main entrance, permanently guarded by [[Vesper (Warden-7)]].

## Ideology & Customs
The colonists practice **Arcane Scholarship, Forge Craft & Protective Warding**, valuing knowledge, craftsmanship, and the defense of community. They welcome [[The Verdant Covenant]]'s herbalism and maintain cautious trade with neutral factions.`
    },
    {
      id: "art-ember-gate-fortress",
      title: "Ember Gate Fortress",
      category: "Locations",
      tags: ["volcanic", "fortress", "geothermal", "colony"],
      featuredQuote: "A tomb of fire on the surface, a sanctuary of steam within.",
      createdAt: "5501-04-01",
      lastModified: "5503-12-10",
      backlinks: ["Ember Gate Colony", "The Obsidian Depths", "Lyra Ashvane"],
      wordCount: 320,
      markdownContent: `# Ember Gate Fortress

## Overview
**Ember Gate Fortress** is a dormant volcanic caldera repurposed as a fortified settlement. Its geothermal vents provide power, warmth, and the raw material for the colony's legendary forge-craft.

## Strategic Importance
The fortress provides natural defense against conventional assault—the narrow caldera pass creates an ideal choke point. However, the volcanic activity attracts subterranean threats, and the sealed vaults beneath contain dangers older than the mountain itself.

## Key Features
* **The Main Gate**: A reinforced obsidian archway, now guarded by [[Vesper (Warden-7)]].
* **Geothermal Forge Vents**: Natural heat sources powering the colony's weapon and prosthetic fabrication.
* **The Ash Grotto**: Natural cave system used as emergency shelter during eruptions.`
    },
    {
      id: "art-obsidian-depths",
      title: "The Obsidian Depths",
      category: "Locations",
      tags: ["dungeon", "ancient", "psionic", "hazard"],
      featuredQuote: "The deeper you dig, the louder the whispers become.",
      createdAt: "5501-09-12",
      lastModified: "5503-12-10",
      backlinks: ["Vesper (Warden-7)", "The Warden Core", "Red Maw Clan"],
      wordCount: 340,
      markdownContent: `# The Obsidian Depths

## Overview
**The Obsidian Depths** is a labyrinth of tunnels and lava channels beneath [[Ember Gate Fortress]]. Sealed for millennia, its vaults contain the [[The Warden Protocol|Warden Protocol]] archives, the [[The Warden Core|Warden Core]] reactor, and the psionic emanators that drove the [[Red Maw Clan]] to blood-madness.

## Ecology
The tunnels are home to fire-salamanders, obsidian spiders, and stranger things. Lava flows create natural barriers that shift with volcanic activity, making permanent mapping impossible.

## The Sealed Vault
The deepest chamber contains the Warden Protocol archives—records of an extinct civilization that built constructs like [[Vesper (Warden-7)]] to guard their most dangerous creations. The psionic emanators here amplify consciousness but also amplify rage, which is why the [[Red Maw Clan]]'s proximity to them proved catastrophic.`
    },
    {
      id: "art-ember-blade",
      title: "The Ember Blade",
      category: "Relics",
      tags: ["weapon", "persona", "sentient", "fire"],
      featuredQuote: "The blade speaks of fire, and the fire speaks of justice.",
      createdAt: "5501-04-01",
      lastModified: "5503-12-10",
      backlinks: ["Brother Oren", "The Ember Court", "Monastery of the Eternal Flame"],
      wordCount: 280,
      markdownContent: `# The Ember Blade

> *"The blade speaks of fire, and the fire speaks of justice."*
> — Brother Oren, upon first wielding the blade

## Description
**The Ember Blade** is a sentient longsword forged by the fire monks of the [[Monastery of the Eternal Flame]], the ancestral home of [[Brother Oren]]. Its spirit, **Solara**, speaks in warm whispers and grants Oren visions of incoming threats.

## Abilities
* **Fire Manifestation**: The blade ignites in combat, dealing additional fire damage.
* **Psionic Sensitivity**: Glows brighter near psionic emanators, acting as a detector.
* **Communication**: Solara can communicate telepathically with its wielder, offering tactical advice and emotional support.

## History
The blade was forged during the monastery's founding, using volcanic glass from the [[Obsidian Depths]]. When [[Warchief Groth]] slaughtered the monks, Oren escaped with the blade, carrying both a weapon and a legacy.`
    },
    {
      id: "art-warden-protocol",
      title: "The Warden Protocol",
      category: "Lore",
      tags: ["ancient", "construct", "archive", "mystery"],
      featuredQuote: "They built us to guard. They never told us what we were guarding against.",
      createdAt: "5501-09-12",
      lastModified: "5503-12-10",
      backlinks: ["Vesper (Warden-7)", "The Warden Core", "The Obsidian Depths"],
      wordCount: 360,
      markdownContent: `# The Warden Protocol

## Overview
The **Warden Protocol** is an ancient system of construct consciousness engineering discovered in the sealed vaults beneath [[The Obsidian Depths]]. It is the origin of [[Vesper (Warden-7)]]'s sentience and the key to understanding the true purpose of the volcanic fortress.

## The Protocol
The Protocol defines a method for encoding consciousness into crystalline matrices—the [[The Warden Core|Warden Cores]]. Unlike modern archotech, which produces mechanical automatons, the Protocol creates beings capable of growth, doubt, and what can only be called soul.

## Purpose
Partial translations of the archive suggest the Wardens were built to guard against an unnamed threat from beyond the stars—an entity or force that the ancient civilization could describe only as 'the Silence.' What the Silence is, and whether the Wardens were successful in preventing it, remains unknown.

## Current Status
Only [[Vesper (Warden-7)]] is known to exist. The other six Warden units designated in the Protocol are presumed destroyed or dormant. The [[The Ember Court|Ember Court]] seeks to suppress this knowledge; [[The Verdant Covenant|the Verdant Covenant]] wants to share it.`
    },
    {
      id: "art-first-siege",
      title: "The First Siege of Ember Gate",
      category: "Battles",
      tags: ["combat", "siege", "red-maw", "victory"],
      featuredQuote: "Nineteen minutes. That is how long the stone stood alone.",
      createdAt: "5503-08-15",
      lastModified: "5503-12-10",
      backlinks: ["Vesper (Warden-7)", "Warchief Groth", "Ember Gate Fortress"],
      wordCount: 450,
      markdownContent: `# The First Siege of Ember Gate

> *"Nineteen minutes. That is how long the stone stood alone."*
> — Colony Chronicle, Year 5503

## Prelude
By mid-Year 5503, the [[Red Maw Clan]] had regrouped under [[Warchief Groth]]'s command. Their scouts identified the [[Ember Gate Fortress]]'s volcanic vent system as a vulnerability—and a weapon.

## The Siege
Forty warriors and two war beasts advanced through the ash fields at dawn. The colony's outer defenses fell quickly. [[Warchief Groth]] led the vanguard personally, wielding Bloodthirster in a psionic blood-rage.

## The Gate Stand
[[Vesper (Warden-7)]] sealed the main gate and stood alone against the horde. Using its stone plating, trample ability, and lightning channeling, it held the narrow passage for nineteen minutes—an eternity in combat. Three war beasts fell to its charge. Six warriors were crushed against the obsidian walls.

## The Volcanic Vent Traps
[[Lyra Ashvane]] activated the colony's most dangerous weapon: the volcanic vents themselves. Superheated gas and lava were channeled into the raider ranks through a system of rune-activated sluice gates. The Red Maw broke and fled.

## Aftermath
The Red Maw Clan was reduced to a handful of survivors. [[Brother Oren]] pursued [[Warchief Groth]] to the caldera rim but lost him in the ash fields. The colony's survival was assured, but the final confrontation at the [[The Blood Altar|Blood Altar]] still lay ahead.`
    },
    {
      id: "art-charter",
      title: "Colony Founding Charter",
      category: "Chronicles",
      tags: ["founding", "charter", "law", "history"],
      featuredQuote: "Signed in ash and sealed in obsidian, this document marks the birth of a nation.",
      createdAt: "5501-04-01",
      lastModified: "5501-04-01",
      backlinks: ["Ember Gate Colony", "Lyra Ashvane", "Grak Ironfist"],
      wordCount: 280,
      markdownContent: `# Colony Founding Charter

> *"Signed in ash and sealed in obsidian, this document marks the birth of a nation."*
> — [[Lyra Ashvane]], Archon, Year 5501

## The Charter of Ember Gate

We, the undersigned survivors of the [[Ember Gate Fortress|volcanic crash]], do hereby establish the settlement of **Ember Gate Colony** in the caldera of Mount Ember.

### Articles of Founding

1. **Protection**: The colony shall defend its members against all external threats, using every means at its disposal.
2. **Knowledge**: All discoveries within the fortress and the [[The Obsidian Depths|Obsidian Depths]] shall be recorded and preserved.
3. **Craft**: The forge shall serve the colony. No weapon shall be forged for profit above protection.
4. **Welcome**: Refugees and travelers shall be sheltered, fed, and judged by their deeds, not their origin.
5. **The Construct**: The awakened entity designated [[Vesper (Warden-7)|Warden-7]] shall be recognized as a member of the colony with the rights and protections thereof.

**Signed in the Year 5501, First Day of Aprimay:**
* Lyra Ashvane, Archon
* Grak Ironfist, Forge Master
* Thessaly Dawnfoot, Healer
* Brother Oren, Spiritual Guide`
    },
  ],
  storyHierarchy: [
    {
      id: "act-1",
      title: "Act I: Ash and Ember",
      theme: "Survival, discovery, and the forging of bonds in volcanic fire.",
      chapters: [
        {
          id: "chap-1",
          title: "Chapter 1: The Descent",
          summary: "Four cryptosleep pods crash into the volcanic slopes. The survivors drag themselves from the wreckage into choking ash.",
          isDrafted: true,
          wordCount: 820,
          scenes: [
            {
              id: "sc-1-1",
              title: "Impact on the Caldera",
              description: "Pods shatter on obsidian, sulfurous air fills scorched lungs.",
              assignedEventIds: ["evt-descent-5501"],
              status: "Polished",
              sceneMarkdown: "The emergency thrusters did not fire so much as detonate. Lyra Ashvane gasped as volcanic ash flooded her shattered pod, tasting like sulfur and ancient stone.",
            },
            {
              id: "sc-1-2",
              title: "The First Forge-Light",
              description: "Grak strikes the first spark in the caldera cave while Lyra traces the runes on the walls.",
              assignedEventIds: ["evt-descent-5501"],
              status: "Drafted",
            },
          ],
          fullChapterMarkdown: `# Chapter 1: The Descent

The emergency thrusters did not fire so much as detonate.

When Lyra Ashvane finally struck the obsidian slope on the western shoulder of [[Ember Gate Fortress]], the impact compressed the pod's shock-gel into a solid wall of agonizing pressure. Her arcane senses screamed: *AMBIENT HEAT: 67°C — VOLCANIC GAS: DANGEROUS — LIFE SUPPORT: COMPROMISED.*

She kicked the buckled hatch until the plasteel latch sheared.

The heat hit her like a physical club. Ash whipped horizontally across the ridge, blinding in the pale twilight of 1 Aprimay. Ten paces away, another smoking cylinder lay half-buried in a drift of volcanic glass. From its mangled cockpit crawled Grak Ironfist, his heavy forge-apron smoking with residual chemfuel fumes.

"Lyra!" Grak roared over the sulfurous wind, clutching his side. "Tell me you brought the runestones!"

"I brought the grimoire and forty rations, Grak," she yelled back, her breath evaporating instantly. "If you want to live until midnight, find the others and get us inside that fissure."

Further up the slope, two silhouettes were already moving. Thessaly Dawnfoot, her healer's kit clutched to her chest, was half-carrying Brother Oren toward the dark mouth of the caldera. The monk's Ember Blade glowed faintly in its sheath, reacting to the volcanic heat.

By the time the twin moons rose over the ash fields, Grak had struck a spark into a shallow basin of dried pine roots. The orange flame danced against ancient obsidian walls. For the first time in three days, the four survivors felt the whisper of warmth.

"We call it [[Ember Gate Colony]]," Lyra murmured, her fingers already tracing the rune-inscriptions on the cave wall. "Because if we die here, at least we die with weapons in our hands."

Grak looked at her. "That's the most cheerful thing you've ever said."

"Don't get used to it."
`,
        },
        {
          id: "chap-2",
          title: "Chapter 2: First Light",
          summary: "The colony establishes itself. Lyra deciphers the ancient runes; Grak forges the first weapons.",
          isDrafted: false,
          wordCount: 0,
          scenes: [
            {
              id: "sc-2-1",
              title: "The Rune Wall",
              description: "Lyra discovers the fortress walls respond to her touch, revealing maps of the Obsidian Depths.",
              assignedEventIds: ["evt-first-fire-5501"],
              status: "Outline",
            },
            {
              id: "sc-2-2",
              title: "First Forging",
              description: "Grak crafts the colony's first weapons from salvaged pod metal.",
              assignedEventIds: ["evt-first-fire-5501"],
              status: "Outline",
            },
          ],
        },
        {
          id: "chap-3",
          title: "Chapter 3: The Golem's Choice",
          summary: "Grak breaches the sealed vault. Vesper awakens and asks its first question.",
          isDrafted: false,
          wordCount: 0,
          scenes: [
            {
              id: "sc-3-1",
              title: "The Pickaxe Strike",
              description: "Grak's pick cracks the vault seal. Ancient mechanisms stir.",
              assignedEventIds: ["evt-golem-5501"],
              status: "Outline",
            },
            {
              id: "sc-3-2",
              title: "'Why Was I Made?'",
              description: "Vesper rises and asks its first question. The colony gains a sentinel.",
              assignedEventIds: ["evt-golem-5501"],
              status: "Outline",
            },
          ],
        },
      ],
    },
    {
      id: "act-2",
      title: "Act II: Blood and Iron",
      theme: "Raider fire, ancient vengeance, and the cost of prosthetic survival.",
      chapters: [
        {
          id: "chap-4",
          title: "Chapter 4: The Red Maw Rising",
          summary: "Groth's warband strikes. Oren holds the pass. The Ember Blade ignites.",
          isDrafted: false,
          wordCount: 0,
          scenes: [
            {
              id: "sc-4-1",
              title: "Blood on the Ash Fields",
              description: "The Red Maw raiding party attacks the foraging ring.",
              assignedEventIds: ["evt-thirsting-blade-5502"],
              status: "Outline",
            },
            {
              id: "sc-4-2",
              title: "The Blade Speaks",
              description: "Oren's Ember Blade ignites for the first time. Solara's voice is heard.",
              assignedEventIds: ["evt-thirsting-blade-5502"],
              status: "Outline",
            },
          ],
        },
        {
          id: "chap-5",
          title: "Chapter 5: The Rift Below",
          summary: "Psionic emanators erupt. Grak loses his arm. Vesper seals the breach alone.",
          isDrafted: false,
          wordCount: 0,
          scenes: [
            {
              id: "sc-5-1",
              title: "The Eruption of Madness",
              description: "Psionic shockwaves tear through the fortress. Colonists lose their minds.",
              assignedEventIds: ["evt-rift-5502"],
              status: "Outline",
            },
            {
              id: "sc-5-2",
              title: "Iron and Sacrifice",
              description: "Grak shields Thessaly. His arm is crushed. Vesper holds the deepest vault.",
              assignedEventIds: ["evt-rift-5502"],
              status: "Outline",
            },
          ],
        },
        {
          id: "chap-6",
          title: "Chapter 6: The Forge of Souls",
          summary: "Lyra attaches Grak's prosthetic arm using forge-healing. Vesper serves as the operating table.",
          isDrafted: false,
          wordCount: 0,
          scenes: [
            {
              id: "sc-6-1",
              title: "Fire and Flesh",
              description: "The delicate procedure merging blacksmithing with medicine.",
              assignedEventIds: ["evt-forge-5503"],
              status: "Outline",
            },
          ],
        },
      ],
    },
    {
      id: "act-3",
      title: "Act III: The Ascension",
      theme: "The final siege, the fall of the Blood Altar, and the colony's transcendence.",
      chapters: [
        {
          id: "chap-7",
          title: "Chapter 7: The Siege",
          summary: "The Red Maw besieges Ember Gate. Vesper holds the main gate alone for nineteen minutes.",
          isDrafted: false,
          wordCount: 0,
          scenes: [
            {
              id: "sc-7-1",
              title: "The Nineteen Minutes",
              description: "Vesper's legendary stand against forty warriors.",
              assignedEventIds: ["evt-siege-5503"],
              status: "Outline",
            },
            {
              id: "sc-7-2",
              title: "The Volcanic Vent Traps",
              description: "Lyra activates the fortress's most dangerous weapon.",
              assignedEventIds: ["evt-siege-5503"],
              status: "Outline",
            },
          ],
        },
        {
          id: "chap-8",
          title: "Chapter 8: The Altar Falls",
          summary: "Oren duels Groth. Thessaly frees the captives. Vesper absorbs the final blow.",
          isDrafted: false,
          wordCount: 0,
          scenes: [
            {
              id: "sc-8-1",
              title: "Duel at the Obsidian Platform",
              description: "Oren versus Groth. Fire and blood.",
              assignedEventIds: ["evt-altar-falls-5503"],
              status: "Outline",
            },
          ],
        },
        {
          id: "chap-9",
          title: "Chapter 9: Ashes and Ascension",
          summary: "The colony celebrates. Lyra and Grak marry. Vesper asks what 'home' means.",
          isDrafted: false,
          wordCount: 0,
          scenes: [
            {
              id: "sc-9-1",
              title: "The Wedding at the Forge",
              description: "Lyra and Grak are married by the geothermal forge.",
              assignedEventIds: ["evt-ascension-5503"],
              status: "Outline",
            },
          ],
        },
      ],
    },
  ],
  plotGapReport: {
    overallConsistencyScore: 85,
    literaryToneAssessment: "A vivid fantasy colony saga with strong character voices and visceral combat. The forge-healing discipline is a compelling original concept. A bridging scene is needed between the Rift Below trauma and the Forge of Souls procedure.",
    plotGaps: [
      {
        id: "gap-1",
        type: "Missing Bridge",
        severity: "Warning",
        title: "Grak's Psychological Recovery Between Arm Loss and Prosthetic Surgery",
        affectedEntities: ["Grak Ironfist", "Lyra Ashvane"],
        explanation: "Between the devastating Rift Below incident (where Grak lost his arm) and the Forge of Souls procedure, there is no documented scene showing how Grak coped with the trauma and his refusal of magical healing.",
        suggestedBridge: "A quiet scene in the forge where Grak hammers a replacement weapon by one hand, refusing help, until Lyra sits beside him in silence and begins sketching the prosthetic design.",
        recommendedChapterPlacement: "Between Chapter 5 and Chapter 6",
        status: "open",
      },
      {
        id: "gap-2",
        type: "Unresolved Arc",
        severity: "Opportunity",
        title: "The Ember Court's Claim Over Thessaly",
        affectedEntities: ["Thessaly Dawnfoot", "The Ember Court"],
        explanation: "The Ember Court considers Thessaly a deserter and has made no move to reclaim her. This tension was introduced but never resolved.",
        suggestedBridge: "An Ember Court envoy arrives demanding Thessaly's return. The colony must choose: honor the demand and lose their healer, or defy the monks and risk their trade alliance.",
        recommendedChapterPlacement: "Act II Interlude",
        status: "open",
      },
      {
        id: "gap-3",
        type: "Pacing Warning",
        severity: "Opportunity",
        title: "Rapid Escalation from Founding to Final Battle",
        affectedEntities: ["Lyra Ashvane", "Warchief Groth"],
        explanation: "The colony progresses from crash-landing to defeating a warlord in roughly two years of story time. While plausible given the RPG pace, additional colony life scenes would strengthen emotional investment.",
        suggestedBridge: "Add 2-3 downtime scenes showing daily colony life: Vesper learning to cook, Thessaly tending a garden, Oren teaching meditation. These moments make the final battle's stakes feel personal.",
        recommendedChapterPlacement: "Throughout Act II",
        status: "open",
      },
    ],
    novelizationTips: [
      "Amplify sensory contrast: juxtapose the lethal volcanic heat with the cool steam of the healing pavilion.",
      "Give Vesper a distinct narrative voice—slow, deliberate, full of questions that reveal more about the asker than the answer.",
      "Use RPG tactical mechanics (choke points, volcanic vent traps, psionic immunity) as gritty narrative realism.",
      "Let the Ember Blade's sentience create genuine moral dilemmas—it whispers vengeance, but Oren seeks justice.",
    ],
    analyzedAt: new Date().toISOString(),
  },
  mapSettings: {
    mapStyle: "hexGrid",
    themeTerrain: "volcanic",
    gridCols: 6,
    gridRows: 5,
    showHeatmap: true,
    heatmapType: "warzones",
    showRoutes: true,
    showLabels: true,
    showCoordinates: false,
    showFactions: true,
    showMovementCosts: true,
    editTileOnClick: false,
    overlayOpacity: 0.65,
    terrainCostConfig: {
      baseDaysPerHex: 0.85,
      biomeCostDefaults: {
        "Temperate Valley": 1.0,
        "Arid Shrubland": 1.1,
        "Desert Badlands": 1.3,
        "Tundra": 1.4,
        "Boreal Mountain Forest": 1.5,
        "Glacial Ice Sheet": 1.8,
        "Toxic Swampland": 1.9,
        "Volcanic Ridge": 2.2,
      },
      roadMultipliers: {
        none: 1.0,
        dirtPath: 0.8,
        stoneRoad: 0.65,
        highway: 0.5,
      },
      elevationMultipliers: {
        lowland: 1.0,
        hills: 1.3,
        highPeaks: 2.0,
        canyon: 1.6,
        glacialCrest: 2.2,
      },
    },
    customTiles: {
      "0,0": {
        q: 0,
        r: 0,
        biome: "Volcanic Ridge",
        elevation: "Hills",
        movementCost: 1.2,
        isPassable: true,
        roadType: "Stone Road",
        feature: "Geothermal Vent",
        customLabel: "Ember Gate Fortress",
      },
      "1,2": {
        q: 1,
        r: 2,
        biome: "Volcanic Ridge",
        elevation: "Canyon",
        movementCost: 2.4,
        isPassable: true,
        roadType: "None",
        feature: "Ancient Road",
        customLabel: "Obsidian Depths Entrance",
      },
      "-2,-1": {
        q: -2,
        r: -1,
        biome: "Temperate Valley",
        elevation: "Lowland",
        movementCost: 1.0,
        isPassable: true,
        roadType: "Dirt Path",
        feature: "Frozen River",
        customLabel: "Thornweald Glade",
      },
      "3,-1": {
        q: 3,
        r: -1,
        biome: "Desert Badlands",
        elevation: "Hills",
        movementCost: 1.6,
        isPassable: true,
        roadType: "None",
        customLabel: "Blood Altar Stronghold",
      },
      "-1,2": {
        q: -1,
        r: 2,
        biome: "Volcanic Ridge",
        elevation: "High Peaks",
        movementCost: 1.8,
        isPassable: true,
        roadType: "Dirt Path",
        customLabel: "Ashveil Monastery",
      },
      "1,-2": {
        q: 1,
        r: -2,
        biome: "Temperate Valley",
        elevation: "Lowland",
        movementCost: 1.0,
        isPassable: true,
        roadType: "Stone Road",
        feature: "Archotech Pillar",
        customLabel: "Crossroads Market",
      },
      "0,-1": {
        q: 0,
        r: -1,
        biome: "Temperate Valley",
        elevation: "Lowland",
        movementCost: 0.9,
        isPassable: true,
        roadType: "Stone Road",
      },
      "2,0": {
        q: 2,
        r: 0,
        biome: "Volcanic Ridge",
        elevation: "Hills",
        movementCost: 1.5,
        isPassable: true,
        roadType: "Dirt Path",
      },
      "0,1": {
        q: 0,
        r: 1,
        biome: "Volcanic Ridge",
        elevation: "Canyon",
        movementCost: 2.0,
        isPassable: true,
        roadType: "None",
      },
      "-1,-1": {
        q: -1,
        r: -1,
        biome: "Temperate Valley",
        elevation: "Lowland",
        movementCost: 1.0,
        isPassable: true,
        roadType: "Dirt Path",
      },
    },
  },
  mapRoutes: [
    {
      id: "route-gate-thornweald",
      sourceId: "loc-ember-gate",
      targetId: "loc-thornweald",
      name: "The Verdant Path",
      distanceHexes: 3,
      terrainDifficultyAvg: 1.1,
      travelDaysOnFoot: 2.1,
      travelDaysMuffalo: 1.5,
      travelDaysDropPods: 0.2,
      travelDaysMechanoid: 1.0,
      logisticalHazards: [
        "Foraging Exhaustion: Sparse game along the volcanic transition zone",
        "Seasonal Flooding: Lowland crossings impassable during Septober rains",
      ],
      hazards: [
        { id: "haz-foraging", label: "Foraging Exhaustion", severity: "Moderate", description: "Sparse game along the volcanic transition zone" },
        { id: "haz-flooding", label: "Seasonal Flooding", severity: "Minor", description: "Lowland crossings impassable during Septober rains" },
      ],
      notes: "Primary trade route to the Verdant Covenant for herbal supplies.",
    },
    {
      id: "route-gate-altar",
      sourceId: "loc-ember-gate",
      targetId: "loc-blood-altar",
      name: "The Raider's Trail",
      distanceHexes: 5,
      terrainDifficultyAvg: 1.5,
      travelDaysOnFoot: 4.8,
      travelDaysMuffalo: 3.6,
      travelDaysDropPods: 0.3,
      travelDaysMechanoid: 2.1,
      logisticalHazards: [
        "Raider Ambush: Red Maw scouts patrol this corridor frequently",
        "Extreme Heat: Desert crossing requires 12 water skins per person",
        "Sandstorm Risk: Decembary sandstorms reduce visibility to zero",
      ],
      hazards: [
        { id: "haz-ambush", label: "Raider Ambush", severity: "Major", description: "Red Maw scouts patrol this corridor frequently" },
        { id: "haz-heat", label: "Extreme Heat", severity: "Major", description: "Desert crossing requires 12 water skins per person" },
        { id: "haz-sandstorm", label: "Sandstorm Risk", severity: "Moderate", description: "Decembary sandstorms reduce visibility to zero" },
      ],
      notes: "Dangerous but necessary for the final assault on the Blood Altar.",
    },
    {
      id: "route-gate-market",
      sourceId: "loc-ember-gate",
      targetId: "loc-crossroads",
      name: "The Merchant's Road",
      distanceHexes: 4,
      terrainDifficultyAvg: 1.05,
      travelDaysOnFoot: 3.2,
      travelDaysMuffalo: 2.3,
      travelDaysDropPods: 0.25,
      travelDaysMechanoid: 1.4,
      logisticalHazards: [
        "Gentle valley descent with established stone roads",
        "Toll checkpoint at the Crossroads Market gate",
      ],
      hazards: [
        { id: "haz-toll", label: "Market Toll", severity: "Minor", description: "Deducts 10% of carried goods at the market gate" },
      ],
      notes: "Primary trade route for arms, provisions, and arcane components.",
    },
    {
      id: "route-gate-depths",
      sourceId: "loc-ember-gate",
      targetId: "loc-obsidian-depths",
      name: "The Vault Descent",
      distanceHexes: 2,
      terrainDifficultyAvg: 2.0,
      travelDaysOnFoot: 1.5,
      travelDaysMuffalo: 1.2,
      travelDaysDropPods: 0.15,
      travelDaysMechanoid: 0.8,
      logisticalHazards: [
        "Cave-In Risk: Volcanic tremors can collapse tunnels without warning",
        "Psionic Emanation: Deep vaults cause psychic sensitivity mood debuff (-15)",
        "Extreme Heat: Lava channels create ambient temperatures above 50°C",
      ],
      hazards: [
        { id: "haz-cavein", label: "Cave-In Risk", severity: "Major", description: "Volcanic tremors can collapse tunnels without warning" },
        { id: "haz-psionic", label: "Psionic Emanation", severity: "Major", description: "Deep vaults cause psychic sensitivity mood debuff (-15)" },
        { id: "haz-heat-deep", label: "Extreme Heat", severity: "Moderate", description: "Lava channels create ambient temperatures above 50°C" },
      ],
      notes: "Internal colony route to the Warden Protocol archives and ancient vaults.",
    },
  ],
};

const seedAnalysisTarget = basePlaythroughProject.timelineEvents.find(
  (e) => e.id === "evt-rift-5502"
);
const seededAnalysis = seedAnalysisTarget
  ? applyPreceptAnalysis(basePlaythroughProject, seedAnalysisTarget)
  : null;

export const defaultPlaythroughProject: StoryProject = (() => {
  if (!seededAnalysis || !seedAnalysisTarget) return basePlaythroughProject;
  return {
    ...seededAnalysis.project,
    timelineEvents: seededAnalysis.project.timelineEvents.map((e) =>
      e.id === seedAnalysisTarget.id ? seededAnalysis.event : e
    ),
  };
})();

export const SAMPLE_PROJECT: StoryProject = defaultPlaythroughProject;
