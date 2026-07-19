export class Player {
  constructor(id, color, isAI) {
    this.id = id;
    this.color = color;
    this.isAI = isAI;
    this.techScore = 0;
    this.expScore = 0;
    this.expProgress = 0;
    this.happinessScore = 0;
    // Once true, conquering this player again yields loot but no elim XP
    this.eliminationXpAwarded = false;
    this.cruiserStyle = null;
    this.credits = 0;
    this.hasOwnedPlanet = false;
    Object.defineProperty(this, 'ownedPlanets', {
      value: [],
      enumerable: false,
      writable: true,
      configurable: true
    });
    const getRandDiscount = () => Math.round((-0.10 + Math.random() * 0.20) * 100) / 100;
    this.upgradeModifiers = {
      sensorarray: getRandDiscount(),
      lab: getRandDiscount(),
      armor: getRandDiscount(),
      shield: getRandDiscount(),
      engine: getRandDiscount(),
      munitions: getRandDiscount(),
      targeting: getRandDiscount(),
      damagecontrol: getRandDiscount(),
      supplyship: getRandDiscount(),
      extendedfuel: getRandDiscount(),
      diplomat: getRandDiscount(),
      marines: getRandDiscount(),
      command: getRandDiscount()
    };
    this.prevTechBonus = 0;
    this.atWarWith = {};
    this.tradingBonus = 0;
    this.useCredits = true;
    this.tradeLimitToggle = true;
    this.builtClasses = {};
    this.buildCounts = {
      corvette: 0,
      destroyer: 0,
      battlecruiser: 0,
      titan: 0,
      mammoth: 0
    };
    
    // Sci-Fi Planetary Resources System
    this.resources = {
      dilithium: 0,
      merculite: 0,
      duranium: 0,
      tritanium: 0,
      antimatter: 0,
      deuterium: 0,
      latinum: 0
    };
    this.targetStockpile = {
      dilithium: 0,
      merculite: 0,
      duranium: 0,
      tritanium: 0,
      antimatter: 0,
      deuterium: 0,
      latinum: 0
    };
    this.offerPrice = {
      dilithium: 3,
      merculite: 3,
      duranium: 3,
      tritanium: 3,
      antimatter: 3,
      deuterium: 3,
      latinum: 3
    };
    this.buyPrice = {
      dilithium: 2,
      merculite: 2,
      duranium: 2,
      tritanium: 2,
      antimatter: 2,
      deuterium: 2,
      latinum: 2
    };
    this.sellToggled = {
      dilithium: false,
      merculite: false,
      duranium: false,
      tritanium: false,
      antimatter: false,
      deuterium: false,
      latinum: false
    };

    if (this.isAI) {
      this.name = id;
    } else {
      this.name = id === 'p1' ? 'Player 1' : 'Player ' + id;
    }
    
    this.tradeCapacity = 5;
    this.tradeOptions = undefined;
    this.tradeRegenAccumulator = 0;
    this.discoveredPlanets = new Set();
    this.attackedPlanets = new Map();
    this.lastKnownPlanets = {};
    this.spyRootedEvents = new Set();
    this.lastBundleSaleTime = null;
  }

  addExperience(kills) {
    this.expProgress += kills;
    while (this.expProgress >= 20) {
      this.expProgress -= 20;
      this.expScore++;
    }
  }

  triggerWarWith(otherPlayer) {
    if (!otherPlayer || otherPlayer === this || otherPlayer.id === 'monsters' || this.id === 'monsters') return;
    if (!this.atWarWith) this.atWarWith = {};
    if (!otherPlayer.atWarWith) otherPlayer.atWarWith = {};
    
    const now = Date.now();
    const currentExpiry = this.atWarWith[otherPlayer.id] || 0;
    const remaining = Math.max(0, currentExpiry - now);
    const newDuration = Math.min(600000, remaining + 60000); // Add 1 minute, cap at 10 minutes
    const newExpiry = now + newDuration;
    
    this.atWarWith[otherPlayer.id] = newExpiry;
    otherPlayer.atWarWith[this.id] = newExpiry;
  }

  isAtWarWith(otherPlayer) {
    if (!otherPlayer || !this.atWarWith) return false;
    const expiry = this.atWarWith[otherPlayer.id];
    if (!expiry) return false;
    if (Date.now() >= expiry) {
      delete this.atWarWith[otherPlayer.id];
      return false;
    }
    return true;
  }
}
