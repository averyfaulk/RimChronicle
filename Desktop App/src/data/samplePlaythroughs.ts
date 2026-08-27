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
  id: "frost-valhalla-5501",
  title: "The Frost of New Valhalla",
  subtitle: "A rimworld colony's descent into cybernetic hubris and redemption across the frozen mountain wastes (5501–5504).",
  lastUpdated: new Date().toISOString(),
  preceptMatrices: [
    buildMatrix("faction-valhalla", "New Valhalla", {
      "body-modification": "Mandatory",
      "ai-personhood": "Respected",
      "melee-combat": "Respected",
      "charity": "Respected",
      "tree-worship": "Respected",
      "execution": "Allowed",
      "drug-use": "Allowed",
      "death-rites": "Allowed",
      "insect-meat": "Disliked",
      "organ-harvesting": "Disliked",
      "cannibalism": "Abhorred",
      "slavery": "Abhorred",
      "skull-taking": "Abhorred",
    }),
    buildMatrix("faction-ashen-skulls", "Ashen Skulls Cartel", {
      "slavery": "Mandatory",
      "melee-combat": "Mandatory",
      "drug-use": "Respected",
      "organ-harvesting": "Respected",
      "cannibalism": "Respected",
      "skull-taking": "Respected",
      "execution": "Respected",
      "body-modification": "Allowed",
      "insect-meat": "Allowed",
      "death-rites": "Allowed",
      "charity": "Disliked",
      "tree-worship": "Disliked",
      "ai-personhood": "Disliked",
    }),
    buildMatrix("faction-fallen-empire", "The Shattered Stellarch Empire", {
      "body-modification": "Mandatory",
      "death-rites": "Respected",
      "melee-combat": "Respected",
      "slavery": "Allowed",
      "charity": "Allowed",
      "execution": "Disliked",
      "drug-use": "Disliked",
      "tree-worship": "Disliked",
      "ai-personhood": "Disliked",
      "cannibalism": "Abhorred",
      "skull-taking": "Abhorred",
      "organ-harvesting": "Abhorred",
      "insect-meat": "Abhorred",
    }),
    buildMatrix("faction-mechanoids", "Hive Unit Kappa-7", {
      "ai-personhood": "Mandatory",
      "body-modification": "Mandatory",
      "execution": "Mandatory",
      "melee-combat": "Respected",
      "organ-harvesting": "Respected",
      "skull-taking": "Allowed",
      "insect-meat": "Allowed",
      "slavery": "Allowed",
      "cannibalism": "Allowed",
      "death-rites": "Allowed",
      "tree-worship": "Disliked",
      "drug-use": "Disliked",
      "charity": "Abhorred",
    }),
  ],
  culturalFrictionPoints: [],
  canonConstraints: [
    {
      id: "canon-sample-ftl",
      title: "FTL Prohibited",
      ruleStatement: "No faster-than-light travel exists within this system.",
      reminderMessage: "FTL is prohibited in your canon.",
      keywords: [
        "ftl",
        "faster than light",
        "warp drive",
        "warp jump",
        "hyperdrive",
        "jump drive",
        "hyperspace",
        "lightspeed",
      ],
      isEnabled: true,
    },
  ],
  chronicleLogHistory: [
    "5501 Aprimay 1: Three crashlanded survivors emerge from burning cryptosleep caskets onto the subzero slopes of Mount Karas. Dr. Valerie 'Vex' Vance, Cole 'Hammer' Briggs, and the slave architect Rex.",
    "5501 Jugust 14: Cold snap plunges temperatures to -48C. Food stores deplete. Cole's bonded thrumbo 'Aegis' loses an ear to frostbite. Vex performs emergency bionic eye surgery under candlelight.",
    "5502 Septober 3: Mechanoid defoliator ship impacts the southern glacier. Toxic ash begins to poison the pine valley. Countess Zephyrine is exiled by the Fallen Empire and seeks asylum.",
    "5502 Decembary 11: Bloodbath at the Gate. 30 pirate raiders from the Ashen Skulls siege the colony with incendiary mortars. Cole suffers a fiery berserk mental break; Rex sacrifices his natural leg to drag him inside.",
    "5503 Aprimay 22: Secret wedding between Vex and Cole in the newly consecrated Archotech Hydroponics Sanctuary. Zephyrine unlocks psychic berserk pulse.",
    "5503 Jugust 9: The Siege of Mount Karas. Mechanoid centipedes breach the inner crypt. Aegis the thrumbo falls in battle holding the choke point, allowing Vex to detonate the archotech warhead."
  ],
  characters: [
    {
      id: "char-vex",
      name: "Dr. Valerie Vance",
      nickname: "Vex",
      role: "Chief Trauma Surgeon & Sharpshooter",
      faction: "New Valhalla",
      status: "Active",
      traits: ["Iron-Willed", "Prostophile / Transhumanist", "Cynical", "Great Memory"],
      healthConditions: ["Bionic Eye (Left)", "Bionic Spine (Masterwork)", "Chemical Scar (Right Arm)"],
      bio: "Former glitterworld trauma chief turned frontier survivor. Vex treats flesh as a temporary liability, gradually replacing her wounded anatomy with masterwork plasteel prosthetics while serving as the emotional backbone of the colony.",
      dramaticArc: "Struggles between her growing cybernetic detachment and her fierce, unexpected love for the volatile pyromaniac soldier Cole.",
      quote: "The flesh rots under the frost. Plasteel remembers its duty.",
      avatarColor: "from-cyan-600 to-blue-800",
      avatarIcon: "Sparkles"
    },
    {
      id: "char-cole",
      name: "Cole Briggs",
      nickname: "Hammer",
      role: "Heavy Vanguard & Pyrotechnician",
      faction: "New Valhalla",
      status: "Active",
      traits: ["Pyromaniac", "Tough", "Bloodlust", "Fast Walker"],
      healthConditions: ["Archotech Arm (Right)", "Bionic Heart", "Psychic Sensitivity"],
      bio: "A scarred veteran of the Core World corporate wars. Cole finds solace only in the roar of flame and the silent companionship of his bonded ancient beast, the thrumbo Aegis. Prone to explosive mental breaks when the winter blizzards howl too long.",
      dramaticArc: "Seeking redemption for the catastrophic fire that consumed his previous outpost, learning vulnerability through his bond with Aegis and marriage to Vex.",
      quote: "Give me two canisters of chemfuel and a clear line of sight, and I'll keep the mechanoids warm for eternity.",
      avatarColor: "from-amber-600 to-red-800",
      avatarIcon: "Flame"
    },
    {
      id: "char-rex",
      name: "Rex Sullivan",
      nickname: "Rex",
      role: "Master Architect & Stonecrafter",
      faction: "New Valhalla",
      status: "Active",
      traits: ["Industrious", "Kind", "Undergrounder", "Slow Learner"],
      healthConditions: ["Peg Leg (Left) - Awaiting Bionic Replacement", "Shattered Rib"],
      bio: "A gentle giant formerly enslaved by the Red Scar pirates. Rex carved the subterranean halls of New Valhalla with his bare hands and masterwork chisels, turning cold granite into heated sanctuaria.",
      dramaticArc: "Confronting his lingering PTSD from pirate bondage as the very cartel that enslaved him begins hunting the mountain base.",
      quote: "Granite doesn't lie to you. You give it shape, and it shelters your brothers.",
      avatarColor: "from-emerald-600 to-teal-800",
      avatarIcon: "Shield"
    },
    {
      id: "char-zephyrine",
      name: "Countess Zephyrine of House Vane",
      nickname: "Zephyrine",
      role: "High Stellarch Exiled & Psycaster",
      faction: "New Valhalla (Refugee / Allied)",
      status: "Active",
      traits: ["Jealous", "Psychic Hypersensitive", "Greedy", "Beautiful"],
      healthConditions: ["Psychic Neuroformer (Tier VI)", "Eltex Implants"],
      bio: "Exiled after an imperial court conspiracy involving forbidden archotech artifacts. Zephyrine arrived half-frozen in satin robes, but now wields devastating psychic storm pulses that can crush pirate morale in seconds.",
      dramaticArc: "Learning humility among rough frontier scavengers while plotting her rightful vengeance against the Imperial High Regent.",
      quote: "You call this frigid cave a dining hall. I call it the throne room of our inevitable ascension.",
      avatarColor: "from-purple-600 to-fuchsia-900",
      avatarIcon: "Crown"
    },
    {
      id: "char-aegis",
      name: "Aegis the Thrumbo",
      nickname: "Aegis",
      role: "Colony War Beast & Revered Guardian",
      faction: "New Valhalla",
      status: "Deceased",
      traits: ["Ancient Horn", "Bonded (Cole)", "Indomitable"],
      healthConditions: ["Frostbitten Ear", "Fallen in the Great Choke Point Defence (5503)"],
      bio: "A majestic ancient thrumbo who walked into the colony during the Year 5501 cold snap. Bonded instantly with Cole, serving as living siege defense and emotional anchor until its legendary last stand against three mechanoid scythers.",
      dramaticArc: "A silent mythical titan whose sacrifice cemented the colony's victory and broke Cole's pyromaniac isolation.",
      quote: "*(A deep, rumbling horn-vibration that shakes the permafrost)*",
      avatarColor: "from-stone-500 to-slate-800",
      avatarIcon: "Zap"
    },
    {
      id: "char-skarn",
      name: "Warlord Skarn the Red",
      nickname: "Skarn",
      role: "Pirate Cartel Supreme Commander",
      faction: "Ashen Skulls Cartel",
      status: "Missing",
      traits: ["Bloodlust", "Psychopath", "Cannibal"],
      healthConditions: ["Bionic Jaw", "Scarred Eye"],
      bio: "Ruthless warlord controlling the southern badlands. Harbors a venomous hatred for New Valhalla after Cole incinerated his vanguard caravan.",
      dramaticArc: "Obsessive quest to breach Mount Karas and reclaim Rex as a trophy slave.",
      quote: "Their mountain will be their tomb. Burn the vents.",
      avatarColor: "from-red-700 to-rose-950",
      avatarIcon: "Skull"
    }
  ],
  factions: [
    {
      id: "faction-valhalla",
      name: "New Valhalla",
      type: "Transhumanist Mountain Colony",
      stance: "Player Colony",
      ideology: "Transhumanist Archotech Harmony & Fellowship of the Forge",
      leader: "Dr. Valerie 'Vex' Vance",
      description: "A fortress settlement burrowed inside Mount Karas. Renowned across the rim for masterwork bionic craft, geothermal hydroponics, and unrelenting survival grit against sub-zero conditions."
    },
    {
      id: "faction-ashen-skulls",
      name: "Ashen Skulls Cartel",
      type: "Pirate Syndicate",
      stance: "Hostile",
      ideology: "Supremacist Raider Pact",
      leader: "Warlord Skarn the Red",
      description: "Heavily armed raiders equipped with scavenged military mortars, go-juice stims, and incendiary launchers. They demand monthly tribute or rain orbital fire."
    },
    {
      id: "faction-fallen-empire",
      name: "The Shattered Stellarch Empire",
      type: "Fallen Empire",
      stance: "Neutral",
      ideology: "Feudal High Psylink Ascendancy",
      leader: "High Stellarch Kaelen IX",
      description: "Aristocratic nobility clinging to high-tech honor codes and psychic monopolies across decaying orbital orbital ships."
    },
    {
      id: "faction-mechanoids",
      name: "Hive Unit Kappa-7",
      type: "Mechanoid Hive",
      stance: "Hostile",
      ideology: "Autonomous Eradication Protocol",
      leader: "Archotech Hive Nexus",
      description: "Ancient terraforming and combat automatons awakened beneath the mountain glacier by geothermal drilling."
    }
  ],
  locations: [
    {
      id: "loc-mount-karas",
      name: "Mount Karas Caverns",
      type: "Colony Settlement",
      dangerLevel: "Safe",
      hexCoord: { q: 0, r: 0 },
      position: { x: 50, y: 40 },
      biome: "Glacial Ice Sheet",
      terrainDifficulty: 1.0,
      elevationMeters: 2850,
      temperatureCelsius: -38,
      controllingFaction: "New Valhalla",
      garrisonColonists: ["Dr. Valerie Vance", "Cole Briggs", "Rex Sullivan", "Countess Zephyrine"],
      activeResources: ["Geothermal Steam Vent", "Plasteel Smelter", "Bionic Crafting Bench"],
      description: "The subterranean fortress heart of [[New Valhalla]]. Features heated granite sleeping quarters, a masterwork hospital, and geothermal chemfuel refineries carved into the mountain bedrock."
    },
    {
      id: "loc-southern-glacier",
      name: "The Southern Glacier & Ancient Vault",
      type: "Ancient Cryptosleep Ruins",
      dangerLevel: "Extreme Hazard",
      hexCoord: { q: 2, r: 3 },
      position: { x: 75, y: 65 },
      biome: "Glacial Ice Sheet",
      terrainDifficulty: 2.2,
      elevationMeters: 3400,
      temperatureCelsius: -48,
      controllingFaction: "Hive Unit Kappa-7",
      garrisonColonists: [],
      activeResources: ["Luciferium Cache", "Defoliator Ship Core", "Cryo Cryptosleep Caskets"],
      description: "A frozen chasm containing a sealed cryptosleep tomb from the Second Mechanoid War. Ground zero for the defoliator crash and psychic emanator pulse."
    },
    {
      id: "loc-granite-outpost",
      name: "Granite Mining Outpost Alpha",
      type: "Mining Outpost",
      dangerLevel: "Dangerous",
      hexCoord: { q: -3, r: 2 },
      position: { x: 20, y: 30 },
      biome: "Boreal Mountain Forest",
      terrainDifficulty: 1.6,
      elevationMeters: 2100,
      temperatureCelsius: -24,
      controllingFaction: "New Valhalla",
      garrisonColonists: ["Rex Sullivan"],
      activeResources: ["Deep Plasteel Vein", "Compacted Machinery", "Solar Generator"],
      description: "A high-altitude remote quarry providing crucial plasteel for colony bionic manufacturing. Located 4.2 days on foot through the snowbound Iron Pass."
    },
    {
      id: "loc-blood-chasm",
      name: "The Blood Chasm (Battlefield)",
      type: "Battlefield & War Zone",
      dangerLevel: "Extreme Hazard",
      hexCoord: { q: 1, r: 1 },
      position: { x: 60, y: 50 },
      biome: "Tundra",
      terrainDifficulty: 1.8,
      elevationMeters: 2400,
      temperatureCelsius: -32,
      controllingFaction: "Unclaimed Wilderness",
      garrisonColonists: [],
      activeResources: ["Scattered Mechanoid Shells", "Mortar Craters"],
      description: "The scarred valley where Cole Briggs unleashed Dawnbreaker during the Great Cold Snap raid of 5501, decimating thirty raiders in sub-zero blinding snow."
    },
    {
      id: "loc-ashen-fortress",
      name: "Ashen Skulls Raider Stronghold",
      type: "Raider Fortress",
      dangerLevel: "Extreme Hazard",
      hexCoord: { q: 4, r: -2 },
      position: { x: 85, y: 30 },
      biome: "Arid Shrubland",
      terrainDifficulty: 1.4,
      elevationMeters: 1400,
      temperatureCelsius: 18,
      controllingFaction: "Ashen Skulls Cartel",
      garrisonColonists: [],
      activeResources: ["Mortar Battery", "Go-Juice Lab", "Chemfuel Stockpile"],
      description: "A fortified crag bristling with heavy slugger turrets and incendiary mortar batteries, commanded by Warlord Skarn the Red."
    },
    {
      id: "loc-stellarch-beacon",
      name: "Shattered Stellarch Trade Beacon",
      type: "Trading Hub",
      dangerLevel: "Safe",
      hexCoord: { q: -2, r: -3 },
      position: { x: 25, y: 70 },
      biome: "Temperate Valley",
      terrainDifficulty: 1.1,
      elevationMeters: 1600,
      temperatureCelsius: 6,
      controllingFaction: "The Shattered Stellarch Empire",
      garrisonColonists: [],
      activeResources: ["Orbital Shuttle Pad", "Psytrainer Vault", "Hyperweave Loom"],
      description: "An imperial trade relay and orbital shuttle pad where royal shuttles land to trade psytrainers, glitterworld medicine, and high-tech weaponry."
    }
  ],
  relics: [
    {
      id: "relic-dawnbreaker",
      name: "Dawnbreaker the Persona Monosword",
      category: "Persona Weapon",
      wielder: "Cole Briggs",
      description: "A bonded plasteel plasma blade with a sentient AI personality named 'Sol'. Grants hyper-reflexes and glows with incandescent blue fury in melee combat."
    },
    {
      id: "relic-archotech-eye",
      name: "The Eye of Karas",
      category: "Archotech Artifact",
      wielder: "Dr. Valerie Vance",
      description: "An ancient optical sensor engineered by a transcendent machine mind. Provides micro-surgical precision and glimpses of future structural stress lines."
    }
  ],
  relationships: [
    {
      id: "rel-vex-cole",
      source: "Dr. Valerie Vance",
      target: "Cole Briggs",
      type: "Spouse",
      opinion: 94,
      notes: "Deep, protective romantic bond forged during emergency operations and the Great Cold Snap of 5501. Married in Year 5503."
    },
    {
      id: "rel-cole-aegis",
      source: "Cole Briggs",
      target: "Aegis the Thrumbo",
      type: "Bonded Beast",
      opinion: 100,
      notes: "Telepathic-level master and war beast bond. Aegis's death in 5503 triggered a transformative emotional awakening."
    },
    {
      id: "rel-rex-vex",
      source: "Rex Sullivan",
      target: "Dr. Valerie Vance",
      type: "Savior",
      opinion: 85,
      notes: "Vex saved Rex's life during the pirate mortar barrage by performing an emergency field amputation and stabilization."
    },
    {
      id: "rel-cole-rex",
      source: "Cole Briggs",
      target: "Rex Sullivan",
      type: "Kin",
      opinion: 78,
      notes: "Brothers in arms. Rex dragged Cole out of an incendiary firestorm, losing his leg in the process."
    },
    {
      id: "rel-zephyrine-vex",
      source: "Countess Zephyrine of House Vane",
      target: "Dr. Valerie Vance",
      type: "Rival",
      opinion: -15,
      notes: "Simmering tension over colony leadership and resource allocation for imperial luxury bedrooms versus medical research."
    },
    {
      id: "rel-skarn-rex",
      source: "Warlord Skarn the Red",
      target: "Rex Sullivan",
      type: "Blood Feud",
      opinion: -95,
      notes: "Skarn previously branded Rex and vows to drag him back in chains to the Ashen Skulls cartel."
    }
  ],
  timelineEvents: [
    {
      id: "evt-crash-5501",
      timestamp: "1 Aprimay, 5501",
      quadrumYear: "Year 5501",
      title: "Impact on Mount Karas",
      category: "Discovery",
      threatLevel: "Major",
      participants: ["Dr. Valerie Vance", "Cole Briggs", "Rex Sullivan"],
      location: "Mount Karas Caverns",
      description: "Three cryptosleep pods slam into the northern granite slope during a high-orbit warhead detonation. The survivors salvage 40 packs of survival meals and establish a rudimentary cavern shelter.",
      narrativeImpact: "Founding moment of [[New Valhalla]]. [[Rex Sullivan]] begins hand-carving the first heated barracks.",
      intensityScore: 7
    },
    {
      id: "evt-cold-snap-5501",
      timestamp: "14 Jugust, 5501",
      quadrumYear: "Year 5501",
      title: "The Great Cold Snap & The Thrumbo's Arrival",
      category: "Miracle",
      threatLevel: "Major",
      participants: ["Cole Briggs", "Aegis the Thrumbo", "Dr. Valerie Vance"],
      location: "Mount Karas Caverns",
      description: "Temperatures plummet to -48°C. A starving, wounded ancient thrumbo collapses outside the airlock. [[Cole Briggs]] risks hypothermia to haul raw agave to the beast, forging an unbreakable psychic bond.",
      narrativeImpact: "Colony gains [[Aegis the Thrumbo]] as a frontline guardian, shifting their survival odds permanently.",
      intensityScore: 8
    },
    {
      id: "evt-defoliator-5502",
      timestamp: "3 Septober, 5502",
      quadrumYear: "Year 5502",
      title: "The Defoliator Crash & Imperial Refuge",
      category: "Combat",
      threatLevel: "Major",
      participants: ["Countess Zephyrine of House Vane", "Dr. Valerie Vance"],
      location: "The Southern Glacier & Ancient Vault",
      description: "A mechanoid defoliator ship crashes into the southern ice, releasing psychic poison that kills surrounding pines. Hours later, [[Countess Zephyrine of House Vane]] arrives fleeing imperial bounty hunters.",
      narrativeImpact: "Introduces psycaster powers to [[New Valhalla]], but attracts the hostility of [[The Shattered Stellarch Empire]].",
      intensityScore: 8,
      tags: ["venomous"],
      involvedFactionIds: ["faction-valhalla", "faction-mechanoids"],
      actions: [
        { label: "Defoliator toxin scoured the sacred pines", tenetKey: "tree-worship" }
      ],
    },
    {
      id: "evt-ashen-siege-5502",
      timestamp: "11 Decembary, 5502",
      quadrumYear: "Year 5502",
      title: "The Mortar Siege of the Ashen Skulls",
      category: "Combat",
      threatLevel: "Catastrophic",
      participants: ["Warlord Skarn the Red", "Cole Briggs", "Rex Sullivan", "Dr. Valerie Vance"],
      location: "Mount Karas Caverns",
      description: "Thirty pirate mercenaries unleash incendiary mortar rounds on the colony vents. [[Cole Briggs]] enters a berserk rage, storming the siege camp alone. [[Rex Sullivan]] is severely maimed while dragging Cole back through fire.",
      narrativeImpact: "Rex loses his left leg; [[Dr. Valerie Vance]] successfully installs masterwork bionics under emergency blackout conditions.",
      intensityScore: 10
    },
    {
      id: "evt-wedding-5503",
      timestamp: "22 Aprimay, 5503",
      quadrumYear: "Year 5503",
      title: "The Archotech Sanctuary Nuptials",
      category: "Social",
      threatLevel: "Minor",
      participants: ["Dr. Valerie Vance", "Cole Briggs", "Countess Zephyrine of House Vane", "Rex Sullivan"],
      location: "The Archotech Hydroponics Sanctuary",
      description: "Under the golden glow of geothermal sun lamps, Vex and Cole exchange titanium rings engraved with the colony's motto. Even Countess Zephyrine plays a resonant imperial harp solo.",
      narrativeImpact: "Massive colony mood boost (+15 Colony Spirit) and emotional stabilization for Cole.",
      intensityScore: 4
    },
    {
      id: "evt-last-stand-aegis-5503",
      timestamp: "9 Jugust, 5503",
      quadrumYear: "Year 5503",
      title: "The Choke Point Sacrifice of Aegis",
      category: "Tragedy",
      threatLevel: "Catastrophic",
      participants: ["Aegis the Thrumbo", "Cole Briggs", "Dr. Valerie Vance"],
      location: "The Southern Glacier & Ancient Vault",
      description: "A mechanoid hive breach threatens to overrun the hospital ward. [[Aegis the Thrumbo]] holds the narrow granite corridor against three heavy scythers and a flame centipede, absorbing dozens of blade cuts before succumbing.",
      narrativeImpact: "Aegis dies a hero, allowing Vex to detonate an EMP minefield. Cole inherits a piece of Aegis's horn as a talisman.",
      intensityScore: 10
    }
  ],
  wikiArticles: [
    {
      id: "art-vex",
      title: "Dr. Valerie Vance",
      category: "Characters",
      tags: ["colonist", "surgeon", "transhumanist", "founder"],
      featuredQuote: "The flesh rots under the frost. Plasteel remembers its duty.",
      createdAt: "5501-04-01",
      lastModified: "5503-08-10",
      backlinks: ["Cole Briggs", "New Valhalla", "Mount Karas Caverns", "The Eye of Karas"],
      wordCount: 420,
      markdownContent: `# Dr. Valerie "Vex" Vance

> *"The flesh rots under the frost. Plasteel remembers its duty."*
> — Dr. Valerie Vance, Colony Medical Log Year 5502

## Overview
**Dr. Valerie Vance**, known across the sub-arctic rim as **Vex**, is the founding chief medical officer and tactical sharpshooter of [[New Valhalla]]. A former glittering world trauma specialist who survived the catastrophic crash on [[Mount Karas Caverns]], she is renowned for her unwavering composure during combat surgeries and her philosophical commitment to transhumanist bionics.

## Chronicle History

### The Crash & Subzero Survival (5501)
Alongside [[Cole Briggs]] and [[Rex Sullivan]], Vex was one of the original three survivors of the pod disaster. Operating with rudimentary herbal medicine in a cavern room kept barely above freezing by a single camp stove, she prevented multiple frostbite amputations during the first brutal winter.

### Bionic Transcendence
Following the acquisition of archotech components from [[The Southern Glacier & Ancient Vault]], Vex successfully performed self-guided bionic eye implantation. Her signature relic, [[The Eye of Karas]], provides her with unparalleled diagnostic vision.

### Marriage to Cole Briggs
Despite their stark personality contrast—Vex's measured stoicism versus Cole's fiery pyromania—the two formed an unbreakable bond during the mortar siege. They were wed in [[The Archotech Hydroponics Sanctuary]] on 22 Aprimay, 5503.

## Key Relationships
* **[[Cole Briggs]]**: Spouse and battle partner. Vex acts as his stabilizing anchor during psychic drones.
* **[[Rex Sullivan]]**: Close comrade whom she saved from septic shock after the pirate raid.
* **[[Countess Zephyrine of House Vane]]**: A complex dynamic combining medical duty with aristocratic friction.

## Equipment & Relics
* **Primary Relic**: [[The Eye of Karas]]
* **Sidearm**: Masterwork Charge Rifle (Plasteel frame)
* **Armor**: Hyperweave Duster over Recon Power Armor`
    },
    {
      id: "art-cole",
      title: "Cole Briggs",
      category: "Characters",
      tags: ["colonist", "pyromaniac", "vanguard", "founder"],
      featuredQuote: "Give me two canisters of chemfuel and a clear line of sight, and I'll keep the mechanoids warm for eternity.",
      createdAt: "5501-04-01",
      lastModified: "5503-08-10",
      backlinks: ["Dr. Valerie Vance", "Aegis the Thrumbo", "Dawnbreaker the Persona Monosword", "New Valhalla"],
      wordCount: 460,
      markdownContent: `# Cole "Hammer" Briggs

> *"Give me two canisters of chemfuel and a clear line of sight, and I'll keep the mechanoids warm for eternity."*
> — Cole Briggs during the defense of the Northern Choke

## Overview
**Cole Briggs**, nicknamed **Hammer**, is the frontline heavy infantry commander and lead pyrotechnician of [[New Valhalla]]. Renowned for his fearless—often suicidal—melee charges, he wields the sentient persona monosword [[Dawnbreaker the Persona Monosword]].

## Biography & Arcs

### The Fire Within
Cole carries deep trauma from a former mercenary command where an out-of-control ammunition depot fire destroyed his regiment. His pyromania is both a coping mechanism and an obsession. In the frozen wastes of [[Mount Karas Caverns]], his affinity for flame became the colony's primary weapon against subzero winters and insectoid infestations.

### Bond with Aegis
During the Great Cold Snap of 5501, Cole tamed [[Aegis the Thrumbo]]. The psychic empathy between the veteran warrior and the ancient beast became legendary. When Aegis fell in battle during the mechanoid breach of 5503, Cole entered a legendary state of focused vengeance, cutting down four mechanoid scythers single-handedly.

### Union with Vex
Cole's marriage to [[Dr. Valerie Vance]] provided him with the first genuine home he had known in forty core-years.

## Notable Combat Exploits
* **The Ashen Mortar Counterattack**: Infiltrated the pirate artillery line under cover of a smoke storm, detonating their chemfuel reserves.
* **The Choke Point Stand**: Fought back-to-back with Aegis for twenty uninterrupted minutes against Hive Unit Kappa-7.`
    },
    {
      id: "art-valhalla",
      title: "New Valhalla",
      category: "Factions",
      tags: ["colony", "mountain", "transhumanist"],
      featuredQuote: "Burrow deep, forge true, transcend the flesh.",
      createdAt: "5501-04-01",
      lastModified: "5503-08-10",
      backlinks: ["Dr. Valerie Vance", "Cole Briggs", "Mount Karas Caverns", "The Archotech Hydroponics Sanctuary"],
      wordCount: 380,
      markdownContent: `# New Valhalla (Colony)

> *"Burrow deep, forge true, transcend the flesh."*
> — Inscription on the Granite Gate of Mount Karas

## Description
**New Valhalla** is an autonomous transhumanist mountain colony established in Year 5501 inside the subterranean granite halls of [[Mount Karas Caverns]]. Built from the wreckage of three escape pods, the settlement has grown into a fortified redoubt powered by deep geothermal vents and defended by masterwork bionic warriors.

## Key Districts
* **The Granite Gate & Killbox**: Reinforced plasteel embrasures with double-thick granite blast doors.
* **[[The Archotech Hydroponics Sanctuary]]**: The agricultural core providing year-round rice, psychoid leaves, and healroot.
* **The Bio-Fabrication Vault**: Cleanroom laboratory where [[Dr. Valerie Vance]] fabricates bionic limbs.

## Ideology & Customs
The colonists practice the **Fellowship of the Forge**, valuing cybernetic enhancement, collective solidarity in sub-zero survival, and deep reverence for bonded animals.`
    },
    {
      id: "art-karas",
      title: "Mount Karas Caverns",
      category: "Locations",
      tags: ["mountain", "fortress", "geothermal"],
      featuredQuote: "A tomb of ice on the surface, a fortress of steam within.",
      createdAt: "5501-04-01",
      lastModified: "5503-08-10",
      backlinks: ["New Valhalla", "Dr. Valerie Vance", "Rex Sullivan"],
      wordCount: 310,
      markdownContent: `# Mount Karas Caverns

## Overview
**Mount Karas** is a dormant volcanic peak located in the northern rim tundra. Its interior chambers contain natural granite caverns and rich pockets of compacted plasteel and uranium.

## Strategic Importance
The mountain provides complete immunity to orbital bombardment and toxic fallout. However, the deep temperature differentials create frequent cold snap hazards and attract subterranean mechanoid hives seeking geothermal energy.`
    }
  ],
  storyHierarchy: [
    {
      id: "act-1",
      title: "Act I: Metal in the Frost",
      theme: "Desperate survival, frostbite, and the initial forge of brotherhood.",
      chapters: [
        {
          id: "chap-1",
          title: "Chapter 1: The Cryptosleep Fall",
          summary: "The escape pods rain down like burning meteors upon the frozen slopes of Mount Karas. Vex, Cole, and Rex drag themselves from the wreckage into the freezing dark.",
          isDrafted: true,
          wordCount: 1140,
          scenes: [
            {
              id: "sc-1-1",
              title: "Impact on the Glacier",
              description: "Pods shattering on granite, sub-zero air shocking scorched lungs.",
              assignedEventIds: ["evt-crash-5501"],
              status: "Polished",
              sceneMarkdown: "The emergency thrusters did not fire so much as explode. Dr. Valerie Vance gasped as freezing tundra air flooded her shattered pod, tasting like ozone and pulverized snow."
            },
            {
              id: "sc-1-2",
              title: "The First Campfire",
              description: "Cole lights chemfuel in the mouth of the cavern while Rex chisels the first windbreak.",
              assignedEventIds: ["evt-crash-5501"],
              status: "Drafted"
            }
          ],
          fullChapterMarkdown: `# Chapter 1: The Cryptosleep Fall

The descent alarm had screamed for eleven minutes before the atmospheric shearing ripped the starboard hull away.

When Dr. Valerie "Vex" Vance finally struck the snowfield on the western shoulder of [[Mount Karas Caverns]], the impact compressed the pod's shock-gel into a solid wall of agonizing pressure. Her bionic retinal display flickered in violent amber static: *CABIN PRESSURE: 0% — EXTERIOR TEMP: -34°C — LIFE SUPPORT: COMPROMISED.*

She kicked the buckled hatch until the plasteel latch sheared.

The cold hit her like a physical club. Snow whipped horizontally across the ridge, blinding in the pale twilight of 1 Aprimay. Ten paces away, another smoking cylinder lay half-buried in a drift. From its mangled cockpit crawled Cole "Hammer" Briggs, his heavy combat parka smoking with residual chemfuel fumes.

"Vex!" Cole roared over the blizzard, clutching his side. "Tell me you brought the medicine kit!"

"I brought the scalpel and forty rations, Cole," she yelled back, her breath freezing instantly upon her lips. "If you want to live until midnight, find Rex and get us inside that granite fissure."

Further up the slope, a colossal silhouette was already moving. [[Rex Sullivan]], his broad shoulders dusted with ice, was dragging two crates of survival meals toward the dark mouth of the cavern with quiet, monolithic determination.

By the time the twin moons rose over the tundra, Cole had struck a spark into a shallow basin of dried pine roots. The orange flame danced against ancient granite walls. For the first time in three days, the three survivors felt the whisper of warmth.

"We call it [[New Valhalla]]," Rex murmured, his chisel already biting into the stone, shaping their first doorway. "Because if we die here, at least we die with weapons in our hands."`
        },
        {
          id: "chap-2",
          title: "Chapter 2: The Horn in the Blizzard",
          summary: "The Great Cold Snap strikes. Food dwindles, and an ancient titan stumbles out of the storm to change their fate.",
          isDrafted: false,
          wordCount: 0,
          scenes: [
            {
              id: "sc-2-1",
              title: "Mercury Drops to -48",
              description: "Heaters failing, frostbite creeping in.",
              assignedEventIds: ["evt-cold-snap-5501"],
              status: "Outline"
            },
            {
              id: "sc-2-2",
              title: "Taming of Aegis",
              description: "Cole's psychic communion with the dying thrumbo.",
              assignedEventIds: ["evt-cold-snap-5501"],
              status: "Outline"
            }
          ]
        }
      ]
    },
    {
      id: "act-2",
      title: "Act II: Blood and Plasteel",
      theme: "Pirate mortar fire, imperial intrigue, and the bionic ascension of the wounded.",
      chapters: [
        {
          id: "chap-3",
          title: "Chapter 3: The Ashen Siege",
          summary: "Skarn's mercenaries rain incendiary fire upon the vents. Rex loses his limb to save Cole from his berserk pyromaniac fury.",
          isDrafted: false,
          scenes: [
            {
              id: "sc-3-1",
              title: "Mortar Shrapnel at Dawn",
              description: "The ceiling caves in on the medical bay.",
              assignedEventIds: ["evt-ashen-siege-5502"],
              status: "Outline"
            }
          ]
        },
        {
          id: "chap-4",
          title: "Chapter 4: The Vow in Hydroponics",
          summary: "Under the warm glow of sunlamps, Vex and Cole cement their marriage amidst the smell of fresh soil and gun oil.",
          isDrafted: false,
          scenes: [
            {
              id: "sc-4-1",
              title: "The Titanium Rings",
              description: "Rex crafts the rings from pod scrap; Countess Zephyrine plays the imperial harp.",
              assignedEventIds: ["evt-wedding-5503"],
              status: "Outline"
            }
          ]
        }
      ]
    },
    {
      id: "act-3",
      title: "Act III: The Archotech Crucible",
      theme: "The ultimate sacrifice of Aegis and the transcendence of New Valhalla.",
      chapters: [
        {
          id: "chap-5",
          title: "Chapter 5: The Choke Point Last Stand",
          summary: "Aegis holds the narrow corridor against Hive Kappa-7. Vex arms the EMP reactor core.",
          isDrafted: false,
          scenes: [
            {
              id: "sc-5-1",
              title: "Aegis's Final Roar",
              description: "The ancient beast gives everything for Cole.",
              assignedEventIds: ["evt-last-stand-aegis-5503"],
              status: "Outline"
            }
          ]
        }
      ]
    }
  ],
  plotGapReport: {
    overallConsistencyScore: 88,
    literaryToneAssessment: "A gripping frontier saga with high emotional stakes and brutal RimWorld authenticity. Character motivations are vivid, though a bridging scene is needed between Cole's mental breakdown and his calm wedding vows.",
    plotGaps: [
      {
        id: "gap-1",
        type: "Missing Bridge",
        severity: "Warning",
        title: "Sudden Transition from Berserk Trauma to Wedding Vows",
        affectedEntities: ["Cole Briggs", "Dr. Valerie Vance"],
        explanation: "Between the devastating mortar siege (where Cole suffered a violent berserk episode and Rex was maimed) and the idyllic wedding in the hydroponics bay, there is no documented scene showing how Cole coped with guilt over Rex's injury.",
        suggestedBridge: "A quiet late-night scene in the workshop where Cole helps Vex calibrate Rex's new bionic leg, expressing his raw guilt, leading Vex to comfort him and forge their commitment to marry.",
        recommendedChapterPlacement: "Between Chapter 3 and Chapter 4",
        status: "open"
      },
      {
        id: "gap-2",
        type: "Lore Mystery",
        severity: "Opportunity",
        title: "Zephyrine's Hidden Imperial Retinue or Bounty Hunter Threat",
        affectedEntities: ["Countess Zephyrine of House Vane", "The Shattered Stellarch Empire"],
        explanation: "Zephyrine fled high-tier imperial assassins in 5502, but no imperial reconnaissance or spy drones have attempted contact since her arrival.",
        suggestedBridge: "A brief atmospheric encounter with an imperial comms cipher received by the mountain dish, offering a ransom for Zephyrine or warning of an impending royal strike team.",
        recommendedChapterPlacement: "Act II Interlude",
        status: "open"
      }
    ],
    novelizationTips: [
      "Amplify sensory contrast: juxtapose the lethal -40°C tundra outside with the warm steam of hydroponics inside.",
      "Highlight Cole's psychological dependency on fire and his gradual shift toward grounding his warmth in Vex's cybernetic hand.",
      "Use RimWorld tactical mechanics (killbox bottlenecks, heat dispersion, psychic drone frequencies) as gritty narrative realism."
    ],
    analyzedAt: new Date().toISOString()
  },
  mapSettings: {
    mapStyle: "hexGrid",
    themeTerrain: "glacier",
    gridCols: 6,
    gridRows: 5,
    showHeatmap: true,
    heatmapType: "all",
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
        biome: "Glacial Ice Sheet",
        elevation: "Lowland",
        movementCost: 1.0,
        isPassable: true,
        roadType: "Ancient Asphalt Highway",
        feature: "Geothermal Vent",
        customLabel: "New Valhalla Foothold"
      },
      "-3,2": {
        q: -3,
        r: 2,
        biome: "Boreal Mountain Forest",
        elevation: "Hills",
        movementCost: 1.6,
        isPassable: true,
        roadType: "Dirt Path",
        customLabel: "Iron Pass Quarry"
      },
      "2,3": {
        q: 2,
        r: 3,
        biome: "Glacial Ice Sheet",
        elevation: "Glacial Crest",
        movementCost: 2.2,
        isPassable: true,
        roadType: "None",
        feature: "Defoliator Crater",
        customLabel: "Ancient Vault Glacier"
      },
      "1,1": {
        q: 1,
        r: 1,
        biome: "Tundra",
        elevation: "Hills",
        movementCost: 1.8,
        isPassable: true,
        roadType: "None",
        customLabel: "Blood Chasm Ridge"
      },
      "4,-2": {
        q: 4,
        r: -2,
        biome: "Arid Shrubland",
        elevation: "Hills",
        movementCost: 1.4,
        isPassable: true,
        roadType: "None",
        customLabel: "Ashen Fortress Crag"
      },
      "-2,-3": {
        q: -2,
        r: -3,
        biome: "Temperate Valley",
        elevation: "Lowland",
        movementCost: 1.1,
        isPassable: true,
        roadType: "Stone Road",
        feature: "Archotech Pillar",
        customLabel: "Stellarch Beacon Valley"
      },
      "-1,-1": {
        q: -1,
        r: -1,
        biome: "Temperate Valley",
        elevation: "Lowland",
        movementCost: 0.8,
        isPassable: true,
        roadType: "Stone Road"
      },
      "-1,1": {
        q: -1,
        r: 1,
        biome: "Boreal Mountain Forest",
        elevation: "Hills",
        movementCost: 1.5,
        isPassable: true,
        roadType: "Dirt Path"
      },
      "-2,1": {
        q: -2,
        r: 1,
        biome: "Boreal Mountain Forest",
        elevation: "Hills",
        movementCost: 1.5,
        isPassable: true,
        roadType: "Dirt Path"
      },
      "1,2": {
        q: 1,
        r: 2,
        biome: "Glacial Ice Sheet",
        elevation: "Hills",
        movementCost: 1.9,
        isPassable: true,
        roadType: "None"
      }
    }
  },
  mapRoutes: [
    {
      id: "route-karas-outpost",
      sourceId: "loc-mount-karas",
      targetId: "loc-granite-outpost",
      name: "Iron Pass Ore Highway",
      distanceHexes: 5,
      terrainDifficultyAvg: 1.3,
      travelDaysOnFoot: 4.2,
      travelDaysMuffalo: 3.1,
      travelDaysDropPods: 0.3,
      travelDaysMechanoid: 1.9,
      logisticalHazards: [
        "Forced March Fatigue: Remote distance (+25% mental break risk without psychite tea)",
        "Hypothermia Danger: Ambient night temp drops to -38°C through the Iron Pass gorge",
        "Food Supply Demand: Requires minimum 24 packaged survival rations for a 3-person team"
      ],
      hazards: [
        { id: "haz-fatigue", label: "Forced March Fatigue", severity: "Moderate", description: "Remote distance (+25% mental break risk without psychite tea)" },
        { id: "haz-hypothermia", label: "Hypothermia Danger", severity: "Major", description: "Ambient night temp drops to -38°C through the Iron Pass gorge" },
        { id: "haz-food", label: "Food Supply Demand", severity: "Minor", description: "Requires minimum 24 packaged survival rations for a 3-person team" },
      ],
      notes: "Crucial supply line for New Valhalla bionic manufacturing plasteel."
    },
    {
      id: "route-karas-glacier",
      sourceId: "loc-mount-karas",
      targetId: "loc-southern-glacier",
      name: "Glacier Cryptosleep Expedition Trail",
      distanceHexes: 4,
      terrainDifficultyAvg: 1.6,
      travelDaysOnFoot: 3.8,
      travelDaysMuffalo: 2.7,
      travelDaysDropPods: 0.25,
      travelDaysMechanoid: 1.7,
      logisticalHazards: [
        "Extreme Glacial Terrain: Deep ice crevasses require climbing gear",
        "Psychic Drone Resonance: Approaching the vault lowers psychic sensitivity mood by -12"
      ],
      hazards: [
        { id: "haz-crevasse", label: "Extreme Glacial Terrain", severity: "Major", description: "Deep ice crevasses require climbing gear" },
        { id: "haz-psychic", label: "Psychic Drone Resonance", severity: "Moderate", description: "Approaching the vault lowers psychic sensitivity mood by -12" },
      ],
      notes: "Path to the defoliator crash and ancient cryptosleep vault."
    },
    {
      id: "route-karas-beacon",
      sourceId: "loc-mount-karas",
      targetId: "loc-stellarch-beacon",
      name: "Stellarch Royal Trade Route",
      distanceHexes: 4,
      terrainDifficultyAvg: 1.05,
      travelDaysOnFoot: 3.4,
      travelDaysMuffalo: 2.4,
      travelDaysDropPods: 0.25,
      travelDaysMechanoid: 1.5,
      logisticalHazards: [
        "Gentle valley descent with high trade caravan security",
        "Toll checkpoint at Imperial border"
      ],
      hazards: [
        { id: "haz-toll", label: "Imperial Toll Checkpoint", severity: "Minor", description: "Deducts 12% of carried goods at the Imperial border crossing" },
      ],
    }
  ]
};

const seedAnalysisTarget = basePlaythroughProject.timelineEvents.find(
  (e) => e.id === "evt-defoliator-5502"
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
