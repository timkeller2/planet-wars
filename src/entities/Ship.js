const SHIP_CLASSES = {
  corvette: { name: 'Corvette', key: 's', hp: 15, costShips: 50, costCap: 2 },
  destroyer: { name: 'Destroyer', key: 'd', hp: 25, costShips: 100, costCap: 4 },
  battlecruiser: { name: 'Battlecruiser', key: 'a', hp: 35, costShips: 175, costCap: 7 },
  titan: { name: 'Titan', key: 't', hp: 45, costShips: 300, costCap: 12 },
  mammoth: { name: 'Mammoth', key: 'm', hp: 55, costShips: 500, costCap: 20 }
};

export class Ship {
  constructor(id, x, y, targetPlanet, owner, targetX = null, targetY = null) {
    this.id = id;
    this.x = x;
    this.y = y;
    this.targetPlanet = targetPlanet;
    this.targetX = targetX;
    this.targetY = targetY;
    this.owner = owner;
    this.speed = (owner && owner.isAI) ? 35 : 15;
    this.active = true;
    this.flightTime = 0;
    this.startX = x;
    this.startY = y;
    this.health = 0;
    this.maxHealth = 0;
    this.fuel = 0;
    const initDestX = targetPlanet ? targetPlanet.x : (targetX !== null ? targetX : x);
    const initDestY = targetPlanet ? targetPlanet.y : (targetY !== null ? targetY : y);
    const initDx = initDestX - x;
    const initDy = initDestY - y;
    this.angle = (initDx !== 0 || initDy !== 0) ? Math.atan2(initDy, initDx) : 0;
    this.fireCooldown = Math.random(); // Start randomly staggered
    this.isCruiser = false;
    this.cruiserTargetType = null;
    this.cruiserTargetId = null;
    this.cruiserTargetClickX = null;
    this.cruiserTargetClickY = null;
    this.orderQueue = [];
    this.savedBombardPlanetId = null;
    this.isRetreating = false;
    this.retreatTargetPlanetId = null;
    this.retreatTargetShipId = null;
    this.timeNotMoved = 0;
    this.lastX = null;
    this.lastY = null;
    this.isSniperKiting = false;
    this.sniperKiteX = null;
    this.sniperKiteY = null;
    this.isMovingBackward = false;
    this.lastTimeAttacked = 0;
    this.lastTimeAttacking = 0;
    this.isPatrolling = false;
    this.patrolReloading = false;
    this.patrolFuelRetreating = false;
    this.patrolFuelRetreatTargetPlanetId = null;
    this.bombardRearming = false;
    this.bombardRearmTargetPlanetId = null;
    this.patrolStationX = null;
    this.patrolStationY = null;
    this.isScouting = false;
    this.scoutFuelRetreating = false;
    this.scoutTargetX = null;
    this.scoutTargetY = null;
    this.scoutTargetIsUnexplored = false;
    this.scoutFuelRetreatTargetPlanetId = null;
    this.scoutFuelRetreatTargetShipId = null;
    this.scoutAttackEnabled = false;
    this.useResources = false;
    this.isResearching = false;
    this.researchFuelRetreating = false;
    this.researchFuelRetreatTargetPlanetId = null;
    this.researchRearming = false;
    this.researchRearmTargetPlanetId = null;
    this.diplomacyFuelRetreating = false;
    this.diplomacyFuelRetreatTargetPlanetId = null;
    this.diplomacyFleeing = false;
    this.diplomacyFleeTargetPlanetId = null;
    this.stationedX = targetPlanet ? null : targetX;
    this.stationedY = targetPlanet ? null : targetY;
    this.stationedPlanetId = targetPlanet ? targetPlanet.id : null;
    this.stationedOffsetX = 0;
    this.stationedOffsetY = 0;
    this.fireSideLeft = false;
    this.labs = 0;
    this.accumulatedTech = 0;
    this.beakerIncreaseEvent = 0;
    this.creditsGainedEvent = 0;
    this.sensorarrays = 0;
    this.armor = 0;
    this.maxArmor = 0;
    this.armorPoints = 0;
    this.shields = 0;
    this.shieldPoints = 0;
    this.shieldShowTimer = 0;
    this.shieldRegenCooldown = 0;
    this.inEffectiveStorm = false;
    this.timeSinceLastMoved = 0;
    this.engine = 0;
    this.munitions = 0;
    this.splashDamage = 0;
    this.targeting = 0;
    this.damagecontrol = 0;
    this.supply_ship = 0;
    this.extended_fuel = 0;
    this.freeFuelTimer = 0;
    this.reactor = 0;
    this.reactorCooldown = 0;
    this.reactorTimer = 0;
    this.supplies = 0;
    this.maxsupplies = 0;
    this.diplomat = 0;
    this.parley = 0;
    this.marines = 0;
    this.command = 0;
    this.commandPoints = 0;
    this.specialfuel = 0;
    this.specialbombs = 0;
    this.specialduranium = 0;
    this.bombReloadTimer = 0;
    this.resourceConsumeEvents = { deuterium: 0, tritanium: 0, duranium: 0, merculite: 0, antimatter: 0, dilithium: 0 };
    this.resourceAccumulators = { deuterium: 0, tritanium: 0, duranium: 0, merculite: 0, antimatter: 0, dilithium: 0 };
    this.conversionTimer = 0;
    this.waitingForSupplyFuelConversion = false;
    this.suppliesConvertedToFuel = 0;
    this.crew = 0;
    this.marineCount = 0;
    this._cruiserStyle = null;
    this.package = 'ranged';
    this.tactics = 'normal';
    this.strategy = 'normal';
    this.isUpgrading = false;
    this.isDismantling = false;
    this.dismantleTimer = 0;
    this.dismantleDuration = 0;
    this.dismantleCreditsTotal = 0;
    this.dismantleCreditsReturned = 0;
    this.dismantleResourcesTotal = {};
    this.dismantleResourcesReturned = {};
    this.upgradeTimer = 0;
    this.upgradeProp = null;
    this.upgradeType = null;
    this.upgradePlanetId = null;
    this.upgradeShipsPaid = 0;
    this.upgradeAccumulator = 0;
    this.upgradeTokens = 0;
    this.upgradeUsingToken = false;
    this.patrolReloadTargetPlanetId = null;
    this.planetBombardTimer = 0;
    this.combatCooldown = 0;
    this.playerMoveOrderRetreatCooldown = 0;
    this.marineLaunchCooldown = 0;
    this.name = null;
    this.expScore = 0;
    this.anomalyDiscoveryCooldown = 0;
    this.cruiserTargetOffsetX = 0;
    this.cruiserTargetOffsetY = 0;
    this.bomberOffsetMag = 0; // Assigned in game.js during launch
    const endSpreadRadius = targetPlanet ? targetPlanet.radius / 2 : 25;
    this.bomberTargetOffsetX = (Math.random() - 0.5) * endSpreadRadius * 2;
    this.bomberTargetOffsetY = (Math.random() - 0.5) * endSpreadRadius * 2;
    this.endOffsetX = (Math.random() - 0.5) * 20;
    this.endOffsetY = (Math.random() - 0.5) * 20;
    this.count = 1;
    const formations = ['arrow'];
    this.formation = 'arrow';
  }

  gainXp(amount, game, customX = null, customY = null) {
    if (amount <= 0) return;
    this.expScore = (this.expScore || 0) + amount;
    if (this.isCruiser && this.owner && !this.owner.isMonster && this.owner.id !== 'monsters') {
      if (game) {
        if (!game.pendingExplorationEvents) game.pendingExplorationEvents = [];
        const startX = customX !== null ? customX : this.x;
        const startY = customY !== null ? customY : this.y;
        game.pendingExplorationEvents.push({
          playerId: this.owner.id,
          x: startX,
          y: startY,
          shipId: this.id,
          xp: Math.round(amount * 100) / 100 // keep XP decimal formatting nice
        });
      }
    }
  }

  get cruiserStyle() {
    return this._cruiserStyle || null;
  }

  set cruiserStyle(style) {
    this._cruiserStyle = style;
    if (this.maxHealth > 0 && !this.isAmoeba) {
      if (style === 'Gorn') {
        this.package = 'brute';
      } else if (style === 'Romulan' || style === 'Tholian') {
        this.package = 'sniper';
      } else {
        this.package = 'ranged';
      }

      if (style === 'Tholian' || style === 'Lyran') {
        this.tactics = 'patient';
      } else if (style === 'Romulan') {
        this.tactics = 'frenzied';
      } else {
        this.tactics = 'normal';
      }

      if (style === 'Tholian' || style === 'Romulan' || style === 'Klingon') {
        this.strategy = 'long';
      } else if (style === 'Gorn') {
        this.strategy = 'normal';
      } else {
        this.strategy = 'normal';
      }
    }
  }

  get isDiplomacy() {
    return (this.diplomat || 0) > 0;
  }

  set isDiplomacy(val) {
    // no-op
  }

  isCruiserMoving() {
    if (this.orderQueue && this.orderQueue.length > 0) {
      return true;
    }
    if (this.targetPlanet) {
      const dx = this.targetPlanet.x - this.x;
      const dy = this.targetPlanet.y - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist >= (this.targetPlanet.radius || 0) + 45) {
        return true;
      }
    } else if (this.targetX !== null && this.targetX !== undefined && this.targetY !== null && this.targetY !== undefined) {
      const dx = this.targetX - this.x;
      const dy = this.targetY - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist >= 15) {
        return true;
      }
    }
    return false;
  }

  getLaserStartPoint() {
    let startX = this.x;
    let startY = this.y;
    if (this.maxHealth > 0 && !this.isAmoeba) {
      this.fireSideLeft = !this.fireSideLeft;
      const mult = this.fireSideLeft ? -1 : 1;
      if (this.isCruiser) {
        const size = (6 + (this.maxHealth || 0)) / 3;
        const localX = mult * size * 0.75;
        const localY = size * 0.15;
        const rotAngle = (this.angle || 0) + Math.PI / 2;
        const gx = localX * Math.cos(rotAngle) - localY * Math.sin(rotAngle);
        const gy = localX * Math.sin(rotAngle) + localY * Math.cos(rotAngle);
        startX = this.x + gx;
        startY = this.y + gy;
      } else {
        const offset = 5;
        const angle = this.angle || 0;
        startX = this.x + Math.sin(angle) * offset * mult;
        startY = this.y - Math.cos(angle) * offset * mult;
      }
    }
    return { startX, startY };
  }

  findNearbySupplyShip(allShips, excludeSelf = false) {
    if (!allShips || !this.owner) return null;
    let closestSupplyShip = null;
    let closestDistSq = Infinity;
    const myRadarRange = (this.isCruiser && typeof this.cruiserRadarRange === 'function') ? this.cruiserRadarRange() : 150;

    for (const other of allShips) {
      if (excludeSelf && other === this) continue;
      if (other.active && other.isCruiser && other.owner && other.owner.id === this.owner.id && (other.supplies || 0) > 0) {
        const dx = other.x - this.x;
        const dy = other.y - this.y;
        const distSq = dx * dx + dy * dy;
        
        const otherRadarRange = (typeof other.cruiserRadarRange === 'function') ? other.cruiserRadarRange() : 150;
        const maxRange = Math.max(myRadarRange, otherRadarRange);
        const maxRangeSq = maxRange * maxRange;

        if (distSq <= maxRangeSq) {
          if (distSq < closestDistSq) {
            closestDistSq = distSq;
            closestSupplyShip = other;
          }
        }
      }
    }
    return closestSupplyShip;
  }

  isWithinSensorRangeOfSupplyShip(allShips) {
    if (!allShips || !this.owner) return false;
    for (const other of allShips) {
      if (other === this) continue;
      if (other.active && other.isCruiser && other.owner && other.owner.id === this.owner.id && (other.supplies || 0) > 0) {
        const dx = other.x - this.x;
        const dy = other.y - this.y;
        const distSq = dx * dx + dy * dy;
        const otherRadarRange = (typeof other.cruiserRadarRange === 'function') ? other.cruiserRadarRange() : 150;
        if (distSq <= otherRadarRange * otherRadarRange) {
          return true;
        }
      }
    }
    return false;
  }

  getLocalXpBonus() {
    return Math.sqrt(this.expScore || 0) + (this.commandPoints || 0);
  }

  getMaxBombs() {
    const baseMax = Math.floor(this.maxHealth / 5);
    const bonus = this.munitions || 0;
    return baseMax + bonus;
  }

  getMaxFuel() {
    const baseFuel = this.maxHealth / 5;
    return baseFuel + (this.extended_fuel || 0) * baseFuel;
  }

  getMaxShields() {
    const techScore = this.owner ? (this.owner.techScore || 0) : 0;
    const playerTechBonus = Math.floor(Math.sqrt(techScore));
    const shieldPerLevel = Math.ceil(2 + playerTechBonus / 5);
    return shieldPerLevel * (this.shields || 0);
  }

  getMaxSpeed() {
    const speedTechBonus = this.owner ? (0.01 * Math.sqrt(this.owner.techScore || 0)) : 0;
    let maxSp = this.speed * (1 + speedTechBonus);
    let engineBonus = (this.engine || 0) * 3;
    maxSp += engineBonus;
    maxSp += (this.commandPoints || 0) * 0.5;
    if (this.isWarp) {
      maxSp += this.warpBonus || 0;
    }
    if (this.supply_ship && this.supply_ship > 0) {
      maxSp = Math.max(5, maxSp - this.supply_ship * 3);
    }
    if (this.specialfuel && this.specialfuel > 0) {
      maxSp += 10;
    }
    if (this.speedModifier) {
      maxSp *= this.speedModifier;
    }
    if (this.owner && (this.owner.isMonster || this.owner.id === 'monsters')) {
      if (this.isCruiser) {
        maxSp *= 0.5;
      }
    }
    return maxSp;
  }

  cruiserRadarRange() {
    if (this.maxHealth <= 0) return 0;
    let baseCruiserRadar = 25 + this.maxHealth * 2;
    let range = baseCruiserRadar + 25 * (this.sensorarrays || 0);
    if (this.isWarp) {
      range *= 0.25;
    }
    const techScore = this.owner ? (this.owner.techScore || 0) : 0;
    const playerTechBonus = 0.01 * Math.floor(Math.sqrt(techScore));

    range *= (1 + playerTechBonus);
    range *= (1 + 0.01 * (this.commandPoints || 0));
    if (this.supply_ship && this.supply_ship > 0) {
      range = Math.max(25, range - this.supply_ship * 20);
    }
    return range;
  }

  getEffectiveSpeedForOrder(isWarp, speedModifier, game = null) {
    const speedTechBonus = this.owner ? (0.01 * Math.sqrt(this.owner.techScore || 0)) : 0;
    let effectiveSpeed = this.speed * (1 + speedTechBonus);
    let engineBonus = (this.engine || 0) * 3;
    effectiveSpeed += engineBonus;
    effectiveSpeed += (this.commandPoints || 0) * 0.5;
    if (isWarp) {
      effectiveSpeed += this.warpBonus || 0;
    }
    if (this.supply_ship && this.supply_ship > 0) {
      effectiveSpeed = Math.max(5, effectiveSpeed - this.supply_ship * 3);
    }
    if (this.specialfuel && this.specialfuel > 0) {
      effectiveSpeed += 10;
    }
    const finalSpeedModifier = speedModifier !== null ? speedModifier : this.speedModifier;
    if (finalSpeedModifier) {
      effectiveSpeed *= finalSpeedModifier;
    }
    if (this.owner && (this.owner.isMonster || this.owner.id === 'monsters')) {
      if (this.isCruiser) {
        effectiveSpeed *= 0.5;
      }
    }
    if (this.maxHealth > 0 && this.fuel <= 0) {
      effectiveSpeed *= 0.25;
    }
    return effectiveSpeed;
  }

  handlePlayerMoveOrder(destination, game) {
    if (!this.isCruiser) return;
    this.flightTime = 0;

    // Save stationed destination
    if (destination && destination.planet) {
      this.stationedPlanetId = destination.planet.id;
      this.stationedX = null;
      this.stationedY = null;
      this.stationedOffsetX = destination.x - destination.planet.x;
      this.stationedOffsetY = destination.y - destination.planet.y;
    } else if (destination) {
      this.stationedPlanetId = null;
      this.stationedX = destination.x;
      this.stationedY = destination.y;
      this.stationedOffsetX = 0;
      this.stationedOffsetY = 0;
    }

    // Reset all retreat states and flags
    this.isRetreating = false;
    this.retreatTargetPlanetId = null;
    this.retreatTargetShipId = null;
    this.patrolReloading = false;
    this.patrolFuelRetreating = false;
    this.patrolFuelRetreatTargetPlanetId = null;
    this.bombardRearming = false;
    this.bombardRearmTargetPlanetId = null;
    this.savedBombardPlanetId = null;
    this.scoutFuelRetreating = false;
    this.scoutFuelRetreatTargetPlanetId = null;
    this.scoutFuelRetreatTargetShipId = null;
    this.researchFuelRetreating = false;
    this.researchFuelRetreatTargetPlanetId = null;
    this.researchRearming = false;
    this.researchRearmTargetPlanetId = null;
    this.diplomacyFuelRetreating = false;
    this.diplomacyFuelRetreatTargetPlanetId = null;
    this.diplomacyFleeing = false;
    this.diplomacyFleeTargetPlanetId = null;

    // Put auto-retreat triggers on a 15-second cooldown
    this.playerMoveOrderRetreatCooldown = 15.0;

    // Exit autonomous modes so the cruiser obeys the move order immediately
    this.isPatrolling = false;
    this.isScouting = false;
    this.isResearching = false;
    this.isDiplomacy = false;
    this.cruiserTargetType = null;
    this.cruiserTargetId = null;
  }

  executeNextOrder(allPlanets, allShips, game = null) {
    if (!this.orderQueue || this.orderQueue.length === 0) {
      return;
    }
    const order = this.orderQueue.shift();
    if (order.type === 'moveSpace') {
      if (this.isCruiser) {
        this.handlePlayerMoveOrder({ x: order.targetX, y: order.targetY }, game);
      }
      this.targetPlanet = null;
      this.cruiserTargetOffsetX = 0;
      this.cruiserTargetOffsetY = 0;
      this.cruiserTargetType = null;
      this.cruiserTargetId = null;
      this.savedBombardPlanetId = null;
      this.targetX = order.targetX;
      this.targetY = order.targetY;
      this.startX = this.x;
      this.startY = this.y;
      
      if (order.speedModifier !== null && order.speedModifier !== undefined) {
        this.speedModifier = order.speedModifier;
      }
      if (order.isWarp) {
        if (!this.isWarp && game) {
          if (game.applyWarpToShip(this, this.owner)) {
            this.active = false;
          }
        }
      } else {
        this.isWarp = false;
      }
    } else if (order.type === 'movePlanet') {
      const planet = allPlanets ? allPlanets.find(p => p.id === order.targetId) : null;
      if (planet) {
        if (this.isCruiser) {
          this.handlePlayerMoveOrder({ planet, x: planet.x + (order.offsetX || 0), y: planet.y + (order.offsetY || 0) }, game);
        }
        this.targetPlanet = planet;
        this.targetX = null;
        this.targetY = null;
        this.cruiserTargetType = null;
        this.cruiserTargetId = null;
        this.savedBombardPlanetId = null;
        this.cruiserTargetOffsetX = order.offsetX || 0;
        this.cruiserTargetOffsetY = order.offsetY || 0;
        this.startX = this.x;
        this.startY = this.y;
        
        if (order.speedModifier !== null && order.speedModifier !== undefined) {
          this.speedModifier = order.speedModifier;
        }
        if (order.isWarp) {
          if (!this.isWarp && game) {
            if (game.applyWarpToShip(this, this.owner)) {
              this.active = false;
            }
          }
        } else {
          this.isWarp = false;
        }
      } else {
        // If planet doesn't exist, try next order
        this.executeNextOrder(allPlanets, allShips, game);
      }
    } else if (order.type === 'target') {
      let tx = this.x;
      let ty = this.y;
      if (order.targetType === 'planet') {
        const planet = allPlanets ? allPlanets.find(p => p.id === order.targetId) : null;
        if (planet) {
          tx = order.clickX !== null && order.clickX !== undefined ? order.clickX : planet.x;
          ty = order.clickY !== null && order.clickY !== undefined ? order.clickY : planet.y;
        }
      } else if (order.targetType === 'ship') {
        const ship = allShips ? allShips.find(s => s.id === order.targetId) : null;
        if (ship) {
          tx = ship.x;
          ty = ship.y;
        }
      }
      if (this.isCruiser) {
        const targetPlanet = order.targetType === 'planet' ? (allPlanets ? allPlanets.find(p => p.id === order.targetId) : null) : null;
        this.handlePlayerMoveOrder({ planet: targetPlanet, x: tx, y: ty }, game);
      }
      this.cruiserTargetType = order.targetType;
      this.cruiserTargetId = order.targetId;
      this.savedBombardPlanetId = null;
      this.cruiserTargetClickX = order.clickX !== undefined ? order.clickX : null;
      this.cruiserTargetClickY = order.clickY !== undefined ? order.clickY : null;
      this.targetPlanet = null;
      this.targetX = tx;
      this.targetY = ty;
      this.startX = this.x;
      this.startY = this.y;
    }
  }

  checkSurvivalRoll() {
    if (this.maxHealth > 0) return true;
    if (this.speedModifier === 0.25 && Math.random() < 0.90) return true;
    if (this.speedModifier === 0.50 && Math.random() < 0.75) return true;
    return false;
  }

  getGravityWellBonusAt(x, y, owner, allPlanets) {
    if (!allPlanets || !owner) return 0;
    let totalBonus = 0;
    for (const gp of allPlanets) {
      if (gp.owner !== owner) continue;
      const gravityRadius = gp.getGravityRadius();
      const dx = gp.x - x;
      const dy = gp.y - y;
        let mult = 0.002;
        if (gp.isMilitary || gp.focusMode === 'garrison') {
          if (gp.ships >= gp.maxShips * 2 - 10) {
            mult = 0.0045;
          } else if (gp.ships >= gp.maxShips) {
            mult = 0.003;
          }
        }
        let bonus = mult * Math.floor(gp.ships / 10);
        if (gp.inRevolt) {
          bonus *= 0.5;
        }
        totalBonus += bonus;
    }
    return totalBonus;
  }

  getAccuracy() {
    const techBonus = this.owner ? Math.sqrt(this.owner.techScore || 0) : 0;
    const expBonus = this.owner ? Math.sqrt(this.owner.expScore || 0) : 0;
    const shipExpBonus = this.getLocalXpBonus();

    if (this.maxHealth > 0 && !this.isAmoeba) {
      let hitChance = 0.10;
      let bombAccuracyBonus = 0;
      if (this.bombs > 0) {
        bombAccuracyBonus = 0.10;
        if (this.tactics === 'patient') {
          bombAccuracyBonus = 0.07;
        } else if (this.tactics === 'frenzied') {
          bombAccuracyBonus = 0.20;
        }
      }
      hitChance += bombAccuracyBonus;
      hitChance += (techBonus + expBonus + shipExpBonus) / 100;
      const targetingBonus = (this.targeting || 0) * 0.05;
      hitChance += targetingBonus;
      if (this.supply_ship && this.supply_ship > 0) {
        hitChance -= this.supply_ship * 0.05;
      }
      if (this.specialbombs && this.specialbombs > 0) {
        hitChance += 0.10;
      }
      if (this.bombs <= 0 && this.fuel <= 0) {
        hitChance *= 0.5;
      }
      return Math.min(1.0, Math.max(0.0, hitChance));
    } else {
      const bombBonus = (this.bombs && this.bombs > 0) ? (this.bombs * 3) : 0;
      const hitChance = (10 + techBonus + expBonus + shipExpBonus + this.maxHealth * 5 + bombBonus) / 100;
      return Math.min(1.0, Math.max(0.0, hitChance));
    }
  }

  getWeaponRange() {
    const playerTechBonus = this.owner ? Math.floor(Math.sqrt(this.owner.techScore || 0)) : 0;
    const laserTechBonus = 0.01 * playerTechBonus;
    const shipExpBonus = this.getLocalXpBonus();
    const expBonus = this.owner ? Math.sqrt(this.owner.expScore || 0) : 0;
    
    let effectiveRange = 40 * (1 + laserTechBonus);
    if (this.isAmoeba) {
      const displayedMaxHealth = this.maxHealth + (this.maxHealth * (this.maxHealth - 1)) / 2;
      effectiveRange = 20 + displayedMaxHealth;
      if (this.bombs > 0) {
        effectiveRange += 10;
      }
      effectiveRange = Math.floor(effectiveRange);
    } else if (this.maxHealth > 0) {
      const xpRangeBonus = (expBonus + shipExpBonus) * 0.01;
      const baseDogfightRange = 40 * (1 + laserTechBonus + xpRangeBonus);
      effectiveRange = baseDogfightRange * 1.10;
      if (this.bombs > 0) {
        effectiveRange += baseDogfightRange * 0.10;
      }
      const targetingRangeBonus = (this.targeting || 0) * 0.05;
      effectiveRange *= (1 + targetingRangeBonus);
      if (this.supply_ship && this.supply_ship > 0) {
        effectiveRange = Math.max(5, effectiveRange - this.supply_ship * 5);
      }
      if (this.specialbombs && this.specialbombs > 0) {
        effectiveRange += 10;
      }
      if (this.package === 'brute') {
        effectiveRange *= 0.5;
      } else if (this.package === 'sniper') {
        effectiveRange *= 1.5;
      }
      if (this.bombs <= 0 && this.fuel <= 0) {
        effectiveRange *= 0.75;
      }
      effectiveRange = Math.floor(effectiveRange);
    }
    return effectiveRange;
  }

  getHazardAccuracyReduction(allStorms) {
    if (this.isAmoeba) return 0;
    if (!allStorms || !this.owner) return 0;
    let reduction = 0;
    for (const storm of allStorms) {
      if (storm.type === 'minefield') continue;
      const dx = this.x - storm.x;
      const dy = this.y - storm.y;
      if (dx * dx + dy * dy <= storm.radius * storm.radius) {
        const knowledge = (storm.knowledge && storm.knowledge[this.owner.id]) || 0;
        const tRed = Math.sqrt(this.owner.techScore || 0);
        const eRed = Math.sqrt(this.owner.expScore || 0);
        const sRed = this.getLocalXpBonus();
        const eff = Math.max(0, storm.intensity - knowledge - (tRed + eRed) / 2 - sRed);
        reduction += eff / 100;
      }
    }
    return reduction;
  }

  canSeeStats(p, allPlanets, allShips, game) {
    if (p.inFog) return false;
    if (!this.owner) return false;
    if (this.owner.isMonster || this.owner.id === 'monsters') return true;
    const fowSetting = (game && game.settings && game.settings.fogOfWar === false);
    if (fowSetting) return true;
    if (p.owner && p.owner.id === this.owner.id) return true;
    if (p.sympathy && p.sympathy[this.owner.id] > 0) return true;
    if (allPlanets) {
      for (const pl of allPlanets) {
        if (pl.owner && pl.owner.id === this.owner.id) {
          const gr = pl.getGravityRadius();
          const dx = pl.x - p.x;
          const dy = pl.y - p.y;
          if (dx * dx + dy * dy <= gr * gr) return true;
        }
      }
    }
    if (allShips) {
      for (const s of allShips) {
        if (s.active && s.owner && s.owner.id === this.owner.id) {
          const radarRange = (s.isCruiser && typeof s.cruiserRadarRange === 'function') ? s.cruiserRadarRange() : 50;
          const dx = s.x - p.x;
          const dy = s.y - p.y;
          if (dx * dx + dy * dy <= radarRange * radarRange) return true;
        }
      }
    }
    return false;
  }

  startDismantle(game) {
    this.isDismantling = true;
    this.isUpgrading = false;
    this.upgradeProp = null;
    this.upgradeType = null;
    this.upgradePlanetId = null;
    
    this.dismantleTimer = this.maxHealth / 2;
    this.dismantleDuration = this.dismantleTimer;
    
    const damageFactor = Math.max(0, Math.min(1, this.health / this.maxHealth));
    const baseShipValue = SHIP_CLASSES[this.classType] ? SHIP_CLASSES[this.classType].costShips : 150;
    const totalUpgradeCost = game.getCruiserTotalUpgradeCost(this);
    
    this.dismantleCreditsTotal = (baseShipValue + totalUpgradeCost) * 0.70 * damageFactor;
    this.dismantleCreditsReturned = 0;
    
    this.dismantleResourcesTotal = {
      deuterium: ((this.specialfuel || 0) * (1/12)) + ((this.resourceAccumulators && this.resourceAccumulators.deuterium) || 0),
      duranium: ((this.specialduranium || 0) * (1/12)) + ((this.resourceAccumulators && this.resourceAccumulators.duranium) || 0),
      tritanium: (this.resourceAccumulators && this.resourceAccumulators.tritanium) || 0,
      merculite: (this.resourceAccumulators && this.resourceAccumulators.merculite) || 0,
      antimatter: (this.resourceAccumulators && this.resourceAccumulators.antimatter) || 0,
      dilithium: (this.resourceAccumulators && this.resourceAccumulators.dilithium) || 0
    };
    
    let bombResource = 'merculite';
    const style = this.cruiserStyle || (this.owner ? this.owner.cruiserStyle : null);
    if (style === 'Romulan' || style === 'Gorn') {
      bombResource = 'antimatter';
    } else if (style === 'Tholian' || style === 'Lyran') {
      bombResource = 'dilithium';
    }
    this.dismantleResourcesTotal[bombResource] = (this.dismantleResourcesTotal[bombResource] || 0) + ((this.specialbombs || 0) * (1/12));
    
    this.dismantleResourcesReturned = {};
    for (const res of Object.keys(this.dismantleResourcesTotal)) {
      this.dismantleResourcesReturned[res] = 0;
    }
  }

  update(deltaTime, allShips, explosions, allPlanets, lasers, ionStorms, mapWidth, game = null) {
    if (!this.active) return;

    let friendlyWellPlanet = null;
    let neutralWellPlanet = null;
    let minFriendlyDistSq = Infinity;
    let minNeutralDistSq = Infinity;

    if (allPlanets && this.owner) {
      for (const planet of allPlanets) {
        const pdx = this.x - planet.x;
        const pdy = this.y - planet.y;
        const distSq = pdx * pdx + pdy * pdy;
        const gravityRadius = planet.getGravityRadius();
        if (distSq < gravityRadius * gravityRadius) {
          if (planet.owner && this.owner && planet.owner.id === this.owner.id) {
            const hasSupplies = (planet.supplies || 0) >= 1.0;
            const currentHasSupplies = friendlyWellPlanet && (friendlyWellPlanet.supplies || 0) >= 1.0;
            
            if (!friendlyWellPlanet || (hasSupplies && !currentHasSupplies) || (hasSupplies === currentHasSupplies && distSq < minFriendlyDistSq)) {
              friendlyWellPlanet = planet;
              minFriendlyDistSq = distSq;
            }
          } else if (!planet.owner && !planet.isDeepSpaceAnomaly) {
            const hasSupplies = (planet.supplies || 0) >= 1.0;
            const currentHasSupplies = neutralWellPlanet && (neutralWellPlanet.supplies || 0) >= 1.0;
            
            if (!neutralWellPlanet || (hasSupplies && !currentHasSupplies) || (hasSupplies === currentHasSupplies && distSq < minNeutralDistSq)) {
              neutralWellPlanet = planet;
              minNeutralDistSq = distSq;
            }
          }
        }
      }
    }
    this.inFriendlyWell = friendlyWellPlanet !== null;

    if (this.pioneerWarpIn) {
      const dx = this.pioneerWarpX - this.x;
      const dy = this.pioneerWarpY - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 15) {
        this.pioneerWarpIn = false;
        this.isWarp = false;
        this.speed = 14;
        this.x = this.pioneerWarpX;
        this.y = this.pioneerWarpY;
        this.targetX = this.pioneerWarpX;
        this.targetY = this.pioneerWarpY;
      } else {
        this.targetX = this.pioneerWarpX;
        this.targetY = this.pioneerWarpY;
        this.angle = Math.atan2(dy, dx);
      }
    }

    if (this.isCruiser) {
      this.shieldShowTimer = Math.max(0, (this.shieldShowTimer || 0) - deltaTime / 1000);
      this.shieldRegenCooldown = Math.max(0, (this.shieldRegenCooldown || 0) - deltaTime / 1000);

      // --- REACTOR & EXTENDED FUEL TANKS LOGIC ---
      // 1. Reactor cooldown decrement
      this.reactorCooldown = Math.max(0, (this.reactorCooldown || 0) - deltaTime);

      if ((this.extended_fuel || 0) > 0) {
        // 2. Free fuel regeneration: 1 fuel per level of extended fuel tanks every 3 minutes
        this.freeFuelTimer = (this.freeFuelTimer || 0) + deltaTime;
        if (this.freeFuelTimer >= 180000) {
          this.freeFuelTimer -= 180000;
          this.fuel = Math.min(this.getMaxFuel(), (this.fuel || 0) + this.extended_fuel);
        }

        // 3. Accumulate reactor points if dilithium is available (1 point per second, no partial units)
        const reactorCap = this.extended_fuel * 10;
        const currentReactor = this.reactor || 0;
        if (this.inFriendlyWell && currentReactor < reactorCap) {
          this.reactorTimer = (this.reactorTimer || 0) + deltaTime;
          while (this.reactorTimer >= 1000 && this.reactor < reactorCap) {
            const dilithiumCost = 0.05;
            if (this.owner && this.owner.resources && (this.owner.resources.dilithium || 0) >= dilithiumCost) {
              this.owner.resources.dilithium -= dilithiumCost;
              this.reactor = (this.reactor || 0) + 1;
              if (!this.resourceConsumeEvents) {
                this.resourceConsumeEvents = { deuterium: 0, tritanium: 0, duranium: 0, merculite: 0, antimatter: 0, dilithium: 0 };
              }
              this.resourceConsumeEvents.dilithium = (this.resourceConsumeEvents.dilithium || 0) + dilithiumCost;
              this.reactorTimer -= 1000;
            } else {
              break;
            }
          }
        } else {
          this.reactorTimer = 0;
        }

        // 4. Consume reactor points to restore fuel if below 1/2 fuel and cooldown is ready
        if (this.reactorCooldown <= 0 && (this.reactor || 0) > 0 && (this.fuel || 0) < this.getMaxFuel() / 2) {
          const amount = Math.min(this.extended_fuel, this.reactor);
          this.reactor -= amount;
          this.fuel = Math.min(this.getMaxFuel(), (this.fuel || 0) + amount);
          this.reactorCooldown = 15000; // 15 second cooldown
        }
      }
    }
    if (this.anomalyDiscoveryCooldown > 0) {
      this.anomalyDiscoveryCooldown = Math.max(0, this.anomalyDiscoveryCooldown - deltaTime);
    }
    this.isMovingBackward = false;

    if (this.isMaterializing) {
      const dt = deltaTime / 1000;
      this.materializeProgress = Math.min(1.0, this.materializeProgress + dt / this.materializeDuration);
      this.health = Math.max(1, Math.floor(this.materializeProgress * this.maxHealth));
      
      const remainingProgressTime = this.materializeDuration * (1.0 - this.materializeProgress + (dt / this.materializeDuration));
      if (this.materializeProgress < 1.0) {
        if (this.buildCostShipsRemaining > 0) {
          const shipsDeduction = (this.buildCostShipsRemaining / (remainingProgressTime / dt));
          const actualDeduction = Math.min(this.buildCostShipsRemaining, shipsDeduction);
          if (this.sourcePlanet && this.sourcePlanet.owner && this.owner && this.sourcePlanet.owner.id === this.owner.id) {
            this.sourcePlanet.ships = Math.max(0, this.sourcePlanet.ships - actualDeduction);
          }
          this.buildCostShipsRemaining = Math.max(0, this.buildCostShipsRemaining - actualDeduction);
        }
        if (this.buildCostCreditsRemaining > 0) {
          const creditsDeduction = (this.buildCostCreditsRemaining / (remainingProgressTime / dt));
          const actualDeduction = Math.min(this.buildCostCreditsRemaining, creditsDeduction);
          if (this.owner) {
            let minAllowedCredits = 0;
            if (typeof game !== 'undefined' && game && game.planets) {
              const ownsHomeworld = game.planets.some(p => p.homeworldOf === this.owner.id && p.owner && p.owner.id === this.owner.id);
              if (ownsHomeworld) {
                minAllowedCredits = -(1000 + Math.floor(this.owner.totalShips || 0));
              }
            }
            this.owner.credits = Math.max(minAllowedCredits, (this.owner.credits || 0) - actualDeduction);
          }
          this.buildCostCreditsRemaining = Math.max(0, this.buildCostCreditsRemaining - actualDeduction);
        }
      } else {
        if (this.buildCostShipsRemaining > 0) {
          if (this.sourcePlanet && this.sourcePlanet.owner && this.owner && this.sourcePlanet.owner.id === this.owner.id) {
            this.sourcePlanet.ships = Math.max(0, this.sourcePlanet.ships - this.buildCostShipsRemaining);
          }
          this.buildCostShipsRemaining = 0;
        }
        if (this.buildCostCreditsRemaining > 0) {
          if (this.owner) {
            let minAllowedCredits = 0;
            if (typeof game !== 'undefined' && game && game.planets) {
              const ownsHomeworld = game.planets.some(p => p.homeworldOf === this.owner.id && p.owner && p.owner.id === this.owner.id);
              if (ownsHomeworld) {
                minAllowedCredits = -(1000 + Math.floor(this.owner.totalShips || 0));
              }
            }
            this.owner.credits = Math.max(minAllowedCredits, (this.owner.credits || 0) - this.buildCostCreditsRemaining);
          }
          this.buildCostCreditsRemaining = 0;
        }
        this.health = this.maxHealth;
        this.isMaterializing = false;

        // Apply configuration upgrades if present
        if (this.configUpgrades) {
          for (const key of Object.keys(this.configUpgrades)) {
            const val = this.configUpgrades[key] || 0;
            if (val > 0) {
              this[key] = val;
              if (key === 'armor') {
                const bonus = (4 + 0.10 * this.maxHealth) * val;
                this.maxArmor = (this.maxArmor || 0) + bonus;
                this.armorPoints = (this.armorPoints || 0) + bonus;
              } else if (key === 'munitions') {
                this.splashDamage = val;
              } else if (key === 'supply_ship') {
                this.maxsupplies = val * 12;
                this.supplies = 0;
              } else if (key === 'extended_fuel') {
                const baseFuel = this.maxHealth / 5;
                this.fuel = Math.min(this.getMaxFuel(), (this.fuel || 0) + baseFuel * val);
              } else if (key === 'shields') {
                this.shieldPoints = this.getMaxShields();
              } else if (key === 'marines') {
                this.marineCount = 0;
              }
            }
          }
          delete this.configUpgrades;
        }

        console.log(`[Capital Ship Materialized] ${this.id} finished construction. Final HP: ${this.health}`);
      }
      this.currentSpeed = 0;
      return;
    }

    if (this.isCruiser && !this.isAmoeba && this.owner) {
      this.conversionTimer = (this.conversionTimer || 0) + deltaTime;
      if (this.conversionTimer >= 5000) {
        this.conversionTimer -= 5000;
        this.tryAutoResourceConversion();
      }
    }

    // Cruiser Standby (Not Moved) Tracking
    if (this.maxHealth > 0 && !this.isAmoeba) {
      if (this.lastX === null || this.lastY === null) {
        this.lastX = this.x;
        this.lastY = this.y;
        this.timeNotMoved = 0;
      } else {
        const dx = this.x - this.lastX;
        const dy = this.y - this.lastY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 0.1) {
          this.timeNotMoved += deltaTime / 1000;
        } else {
          this.timeNotMoved = 0;
          this.lastX = this.x;
          this.lastY = this.y;
        }
      }
    }

    // Cruiser Standardized Retreat Mode Decision Engine
    if (this.maxHealth > 0 && !this.isAmoeba && this.owner && !this.owner.isMonster && this.owner.id !== 'monsters') {
      const maxFuel = this.getMaxFuel();
      const maxBombs = this.getMaxBombs();
      const hasSupplies = (this.supplies || 0) > 0;
      const withinSensorRangeOfSupplyShip = this.isWithinSensorRangeOfSupplyShip(allShips);
      
      const lowFuel = false; // Disable auto-retreat for low fuel
      const emptyBombs = maxBombs > 0 && this.bombs <= 0 && !hasSupplies && !withinSensorRangeOfSupplyShip;
      const lowHealth = this.health < this.maxHealth * 0.5;

      const isBombingPlanet = (this.cruiserTargetType === 'planet' && this.cruiserTargetId !== null) || this.savedBombardPlanetId !== null;
      const inActiveMode = this.isPatrolling || this.isScouting || this.isResearching || this.isDiplomacy || isBombingPlanet;
      const isStandby = this.timeNotMoved >= 60;

      const inCombat = (Date.now() - (this.lastTimeAttacked || 0) < 10000) || 
                       (Date.now() - (this.lastTimeAttacking || 0) < 10000);

      // Trigger condition
      if (!this.isRetreating && (!this.playerMoveOrderRetreatCooldown || this.playerMoveOrderRetreatCooldown <= 0)) {
        if (this.isPatrolling || this.isScouting) {
          const specialModeActive = this.isPatrolling || this.isScouting || this.isResearching || this.isDiplomacy || isBombingPlanet;
          if (specialModeActive || isStandby) {
            const combatTrigger = inCombat && (emptyBombs || lowHealth);
            const normalTrigger = !this.inFriendlyWell && (lowFuel || emptyBombs || (lowHealth && (inActiveMode || isStandby)));

            if (combatTrigger || normalTrigger) {
              this.isRetreating = true;
              this.retreatTargetPlanetId = null;
              if (this.isScouting) {
                this.scoutTargetX = null;
                this.scoutTargetY = null;
              }
            }
          }
        }
      }

      // Exit condition
      if (this.isRetreating) {
        const requiredFuelPct = this.isScouting ? 0.97 : 1.0;
        const fullyFueled = this.fuel >= maxFuel * requiredFuelPct;
        const fullyArmed = maxBombs === 0 || this.bombs >= maxBombs;
        const isBombingPlanet = (this.cruiserTargetType === 'planet' && this.cruiserTargetId !== null) || this.savedBombardPlanetId !== null;
        const requiredHealthPct = (this.isResearching || this.isScouting || this.isDiplomacy || isBombingPlanet) ? 1.0 : 0.75;
        const fullyHealed = this.health >= this.maxHealth * requiredHealthPct;

        if (fullyFueled && fullyArmed && fullyHealed) {
          this.isRetreating = false;
          this.retreatTargetPlanetId = null;
          this.retreatTargetShipId = null;

          // Return to stationed destination!
          if (this.stationedX !== null || this.stationedY !== null || this.stationedPlanetId !== null) {
            if (this.stationedPlanetId !== null) {
              const targetPlanet = allPlanets ? allPlanets.find(p => p.id === this.stationedPlanetId) : null;
              if (targetPlanet) {
                this.targetPlanet = targetPlanet;
                this.targetX = null;
                this.targetY = null;
                this.cruiserTargetOffsetX = this.stationedOffsetX || 0;
                this.cruiserTargetOffsetY = this.stationedOffsetY || 0;
              } else {
                this.targetPlanet = null;
                this.targetX = this.stationedX;
                this.targetY = this.stationedY;
              }
            } else {
              this.targetPlanet = null;
              this.targetX = this.stationedX;
              this.targetY = this.stationedY;
            }
          }
        }
      }
      
      // Retreat movement/routing logic
      if (this.isRetreating) {
        if (this.retreatTargetShipId && allShips) {
          const targetShip = allShips.find(s => s.id === this.retreatTargetShipId);
          if (targetShip && targetShip.active) {
            const hasExcessFuel = (targetShip.fuel || 0) > 4;
            const hasSupplies = (targetShip.supplies || 0) > 0;
            if (hasExcessFuel || hasSupplies) {
              const dx = this.x - targetShip.x;
              const dy = this.y - targetShip.y;
              const dist = Math.sqrt(dx * dx + dy * dy);
              const bumpRange = Math.max(this.maxHealth || 0, targetShip.maxHealth || 0);
              const stopDistance = bumpRange + 10;
              if (dist > stopDistance) {
                this.targetX = targetShip.x + (dx / dist) * stopDistance;
                this.targetY = targetShip.y + (dy / dist) * stopDistance;
              } else if (dist > 0.01) {
                this.targetX = targetShip.x + (dx / dist) * stopDistance;
                this.targetY = targetShip.y + (dy / dist) * stopDistance;
              } else {
                const angle = Math.random() * Math.PI * 2;
                this.targetX = targetShip.x + Math.cos(angle) * stopDistance;
                this.targetY = targetShip.y + Math.sin(angle) * stopDistance;
              }
            } else {
              this.retreatTargetShipId = null;
              this.targetX = null;
              this.targetY = null;
            }
          } else {
            this.retreatTargetShipId = null;
            this.targetX = null;
            this.targetY = null;
          }
        }

        // A. Enemy Proximity Evasion (fleeing if enemy within 200px)
        let closestEnemyUnit = null;
        let closestEnemyDistSq = Infinity;
        if (allShips) {
          const candidateShips = allShips;
          for (const other of candidateShips) {
            if (other.active && other.id !== this.id) {
              const isEnemy = (other.owner && other.owner.id !== this.owner.id && !other.isMaterializing) || other.isAmoeba;
              if (isEnemy) {
                let isVisible = true;
                if (game && typeof game.isShipVisibleTo === 'function') {
                  isVisible = game.isShipVisibleTo(other, this.owner);
                }
                if (!isVisible) continue;
                const edx = other.x - this.x;
                const edy = other.y - this.y;
                const distSq = edx * edx + edy * edy;
                if (distSq < closestEnemyDistSq) {
                  closestEnemyDistSq = distSq;
                  closestEnemyUnit = other;
                }
              }
            }
          }
        }
        const enemyClose = closestEnemyUnit && (closestEnemyDistSq <= 200 * 200);

        if (enemyClose) {
          // Force recalculating retreat target
          this.retreatTargetPlanetId = null;
          this.retreatTargetShipId = null;
        }

        // B. Safe target selection
        let needNewTarget = this.targetX === null || this.targetY === null || (!this.retreatTargetPlanetId && !this.retreatTargetShipId);
        
        // Double check existing target ownership
        if (!needNewTarget && this.retreatTargetPlanetId) {
          const tp = allPlanets ? allPlanets.find(p => p.id === this.retreatTargetPlanetId) : null;
          if (!tp || !tp.owner || tp.owner.id !== this.owner.id) {
            needNewTarget = true;
          }
        }

        if (needNewTarget) {
          const friendlyPlanets = allPlanets ? allPlanets.filter(p => p.owner && p.owner.id === this.owner.id) : [];
          const safeCandidates = [];
          let globalBestFallback = null;
          let maxSafetyDistSq = -1;

          // 1. Look for friendly cruisers with supplies or excess fuel to refuel, or supplies for repair/rearm
          const needsFuelForCruiser = this.fuel < maxFuel * 0.97;
          const needsRepairsForCruiser = this.health < this.maxHealth;
          const needsRearmForCruiser = maxBombs > 0 && this.bombs < maxBombs;

          if (allShips && this.owner && (needsFuelForCruiser || needsRepairsForCruiser || needsRearmForCruiser)) {
            for (const other of allShips) {
              if (other.active && other.id !== this.id && other.isCruiser && other.owner && other.owner.id === this.owner.id) {
                const hasExcessFuel = (other.fuel || 0) > 4;
                const hasSupplies = (other.supplies || 0) > 0;
                
                let matchesRequirement = false;
                if (needsRepairsForCruiser || needsRearmForCruiser) {
                  if (hasSupplies) matchesRequirement = true;
                } else if (needsFuelForCruiser) {
                  if (hasExcessFuel || hasSupplies) matchesRequirement = true;
                }

                if (matchesRequirement) {
                  // Ensure this destination cruiser doesn't have active enemies close to it
                  let safeFromEnemies = true;
                  if (allShips) {
                    for (const enemy of allShips) {
                      if (enemy.active && enemy.id !== this.id) {
                        const isEnemy = (enemy.owner && enemy.owner.id !== this.owner.id) || enemy.isAmoeba;
                        if (isEnemy) {
                          const edx = enemy.x - other.x;
                          const edy = enemy.y - other.y;
                          if (edx * edx + edy * edy < 300 * 300) {
                            safeFromEnemies = false;
                            break;
                          }
                        }
                      }
                    }
                  }
                  const isSupplyShip = hasSupplies;
                  if (safeFromEnemies || isSupplyShip) {
                    const cdx = other.x - this.x;
                    const cdy = other.y - this.y;
                    const distToCruiser = Math.sqrt(cdx * cdx + cdy * cdy);
                    safeCandidates.push({ x: other.x, y: other.y, ship: other, dist: distToCruiser });
                  }
                }
              }
            }
          }
          
          let foundDestination = false;
          
          if (friendlyPlanets.length > 0) {
            for (const p of friendlyPlanets) {
              const gRad = p.getGravityRadius();
              
              for (let attempt = 0; attempt < 50; attempt++) {
                const theta = Math.random() * Math.PI * 2;
                const r = Math.random() * gRad * 0.7; // Keep well inside gravity well boundary
                const tx = p.x + r * Math.cos(theta);
                const ty = p.y + r * Math.sin(theta);
                
                // 1. Avoid active ion storms or minefields with effective intensity >= 5
                let hazardIntensityVal = 0;
                if (ionStorms) {
                  for (const h of ionStorms) {
                    if (h.type !== 'nebula') {
                      const hdx = tx - h.x;
                      const hdy = ty - h.y;
                      if (hdx * hdx + hdy * hdy <= h.radius * h.radius) {
                        const knowledge = h.knowledge[this.owner ? this.owner.id : ''] || 0;
                        const tRed = this.owner ? Math.sqrt(this.owner.techScore || 0) : 0;
                        const eRed = this.owner ? Math.sqrt(this.owner.expScore || 0) : 0;
                        const sRed = this.getLocalXpBonus();
                        const effectiveIntensity = Math.max(0, h.intensity - knowledge - (tRed + eRed) / 2 - sRed);
                        if (effectiveIntensity > hazardIntensityVal) {
                          hazardIntensityVal = effectiveIntensity;
                        }
                      }
                    }
                  }
                }
                
                if (hazardIntensityVal >= 5) {
                  continue; // Avoid this candidate
                }
                
                // 2. Check distance from active enemies
                let minEnemyDistSq = Infinity;
                if (allShips) {
                  for (const other of allShips) {
                    if (other.active && other.id !== this.id) {
                      const isEnemy = (other.owner && other.owner.id !== this.owner.id) || other.isAmoeba;
                      if (isEnemy) {
                        const edx = other.x - tx;
                        const edy = other.y - ty;
                        const distSq = edx * edx + edy * edy;
                        if (distSq < minEnemyDistSq) {
                          minEnemyDistSq = distSq;
                        }
                      }
                    }
                  }
                }
                
                if (minEnemyDistSq >= 300 * 300) {
                  const cdx = tx - this.x;
                  const cdy = ty - this.y;
                  const distToCruiser = Math.sqrt(cdx * cdx + cdy * cdy);
                  safeCandidates.push({ x: tx, y: ty, p: p, dist: distToCruiser });
                } else {
                  // Keep track of the one with the maximum safety distance in case we need a fallback
                  if (minEnemyDistSq > maxSafetyDistSq) {
                    maxSafetyDistSq = minEnemyDistSq;
                    globalBestFallback = { x: tx, y: ty, p: p };
                  }
                }
              }
            }
          }
          
          let selected = null;
          if (safeCandidates.length > 0) {
            let candidatesToUse = safeCandidates;
            if (closestEnemyUnit) {
              const edx = closestEnemyUnit.x - this.x;
              const edy = closestEnemyUnit.y - this.y;
              const oppositeCandidates = safeCandidates.filter(c => {
                const cdx = c.x - this.x;
                const cdy = c.y - this.y;
                return (cdx * edx + cdy * edy) < 0;
              });
              if (oppositeCandidates.length > 0) {
                candidatesToUse = oppositeCandidates;
              }
            }

            const closeCandidates = candidatesToUse.filter(c => c.dist <= 400);
            if (closeCandidates.length > 0) {
              closeCandidates.sort((a, b) => a.dist - b.dist);
              selected = closeCandidates[0];
            } else {
              candidatesToUse.sort((a, b) => a.dist - b.dist);
              selected = candidatesToUse[0];
            }
          }
          
          if (selected) {
            this.targetPlanet = null;
            if (selected.ship) {
              const dx = this.x - selected.ship.x;
              const dy = this.y - selected.ship.y;
              const dist = Math.sqrt(dx * dx + dy * dy);
              const bumpRange = Math.max(this.maxHealth || 0, selected.ship.maxHealth || 0);
              const stopDistance = bumpRange + 10;
              if (dist > stopDistance) {
                this.targetX = selected.ship.x + (dx / dist) * stopDistance;
                this.targetY = selected.ship.y + (dy / dist) * stopDistance;
              } else if (dist > 0.01) {
                this.targetX = selected.ship.x + (dx / dist) * stopDistance;
                this.targetY = selected.ship.y + (dy / dist) * stopDistance;
              } else {
                const angle = Math.random() * Math.PI * 2;
                this.targetX = selected.ship.x + Math.cos(angle) * stopDistance;
                this.targetY = selected.ship.y + Math.sin(angle) * stopDistance;
              }
            } else {
              this.targetX = selected.x;
              this.targetY = selected.y;
            }
            if (selected.p) {
              this.retreatTargetPlanetId = selected.p.id;
              this.retreatTargetShipId = null;
            } else if (selected.ship) {
              this.retreatTargetPlanetId = null;
              this.retreatTargetShipId = selected.ship.id;
            }
            this.cruiserTargetType = null;
            this.cruiserTargetId = null;
            foundDestination = true;
          } else if (globalBestFallback) {
            this.targetPlanet = null;
            this.targetX = globalBestFallback.x;
            this.targetY = globalBestFallback.y;
            this.retreatTargetPlanetId = globalBestFallback.p.id;
            this.retreatTargetShipId = null;
            this.cruiserTargetType = null;
            this.cruiserTargetId = null;
            foundDestination = true;
          } else if (friendlyPlanets.length > 0) {
            // Final fallback: Closest friendly planet center
            const sortedFriendlyPlanets = [...friendlyPlanets].sort((a, b) => {
              const da = (a.x - this.x) * (a.x - this.x) + (a.y - this.y) * (a.y - this.y);
              const db = (b.x - this.x) * (b.x - this.x) + (b.y - this.y) * (b.y - this.y);
              return da - db;
            });
            const closestPlanet = sortedFriendlyPlanets[0];
            this.targetPlanet = closestPlanet;
            this.targetX = closestPlanet.x;
            this.targetY = closestPlanet.y;
            this.retreatTargetPlanetId = closestPlanet.id;
            this.retreatTargetShipId = null;
            this.cruiserTargetType = null;
            this.cruiserTargetId = null;
            foundDestination = true;
          }
        }
      }
    }

    if (this.fuel <= 0) {
      this.specialfuel = 0;
    }
    if (this.bombs !== undefined && this.bombs <= 0) {
      this.specialbombs = 0;
    }

    if (this.active && this.owner && !this.owner.isMonster && this.owner.id !== 'monsters') {
      if (game) {
        if (!game.exploredGrid) game.exploredGrid = {};
        const pId = this.owner.id;
        const now = Date.now();
        const scX = Math.floor(this.x / 100);
        const scY = Math.floor(this.y / 100);
        const radarRange = this.isCruiser ? this.cruiserRadarRange() : 50;
        const cellRadius = Math.max(1, Math.ceil(radarRange / 100));
        for (let dx = -cellRadius; dx <= cellRadius; dx++) {
          for (let dy = -cellRadius; dy <= cellRadius; dy++) {
            const cx = scX + dx;
            const cy = scY + dy;
            const key = `${pId}_${cx}_${cy}`;
            const wasExplored = (game.exploredGrid[key] || 0) !== 0;
            if (!wasExplored) {
              let alreadyExploredByAnyone = false;
              if (game.allPlayers) {
                for (const p of game.allPlayers) {
                  if (p.id !== pId && (game.exploredGrid[`${p.id}_${cx}_${cy}`] || 0) !== 0) {
                    alreadyExploredByAnyone = true;
                    break;
                  }
                }
              } else {
                const suffix = `_${cx}_${cy}`;
                for (const k of Object.keys(game.exploredGrid)) {
                  if (k.endsWith(suffix) && !k.startsWith(`${pId}_`)) {
                    if ((game.exploredGrid[k] || 0) !== 0) {
                      alreadyExploredByAnyone = true;
                      break;
                    }
                  }
                }
              }

              game.exploredGrid[key] = now;
              if (this.isCruiser) {
                const xpGain = alreadyExploredByAnyone ? 1 : 2;
                this.gainXp(xpGain, game, cx * 100 + 50, cy * 100 + 50);

                if ((this.anomalyDiscoveryCooldown || 0) <= 0) {
                  const tileX = cx * 100 + 50;
                  const tileY = cy * 100 + 50;
                  const mapH = (game && game.height) ? game.height : 1620;
                  if (tileX >= 0 && tileX <= mapWidth && tileY >= 0 && tileY <= mapH) {
                    let isTileInDeepSpace = true;
                    if (allPlanets) {
                      for (const planet of allPlanets) {
                        if (planet.isDeepSpaceAnomaly) continue;
                        const dx = planet.x - tileX;
                        const dy = planet.y - tileY;
                        const distSq = dx * dx + dy * dy;
                        const safeDist = planet.getGravityRadius ? planet.getGravityRadius() : (planet.radius * 3);
                        if (distSq <= safeDist * safeDist) {
                          isTileInDeepSpace = false;
                          break;
                        }
                      }
                    }
                    if (isTileInDeepSpace) {
                      const xpBonus = this.getLocalXpBonus ? this.getLocalXpBonus() : 0;
                      const labs = this.labs || 0;
                      const chance = ((xpBonus + labs * 2) / 10) / 100;
                      if (Math.random() < chance) {
                        this.anomalyDiscoveryCooldown = 60000;
                        if (game && typeof game.spawnNewDeepSpaceAnomaly === 'function') {
                          game.spawnNewDeepSpaceAnomaly(tileX, tileY, this.owner, this.name);
                        }
                      }
                    }
                  }
                }
              }
            } else {
              game.exploredGrid[key] = now;
            }
          }
        }
      }
    }

    // Pirate Cruiser AI
    if (this.isCruiser && this.owner && (this.owner.isMonster || this.owner.id === 'monsters')) {
      // Fuel, bombs, and health regeneration (1 per 30 seconds)
      this.pirateRegenTimer = (this.pirateRegenTimer || 0) + (deltaTime / 1000);
      if (this.pirateRegenTimer >= 30) {
        this.pirateRegenTimer -= 30;
        this.fuel = Math.min(this.getMaxFuel(), (this.fuel || 0) + 1);
        if (this.bombs !== undefined) {
          this.bombs = Math.min(this.getMaxBombs(), this.bombs + 1);
        }
        this.health = Math.min(this.maxHealth, this.health + 1);
      }

      // Fuel check for refueling state
      if (this.fuel <= 0) {
        this.isRefueling = true;
      }
      if (this.isRefueling) {
        if (this.fuel >= this.getMaxFuel()) {
          this.isRefueling = false;
        }
      }

      if (this.isRefueling) {
        // Stop moving and targeting while refueling
        this.targetX = this.x;
        this.targetY = this.y;
        this.targetPlanet = null;
        this.cruiserTargetType = null;
        this.cruiserTargetId = null;
      } else {
        // Engage enemy fleets and cruisers in sensor range
        const sensorRange = this.cruiserRadarRange();
        const rangeSq = sensorRange * sensorRange;

        let nearestEnemy = null;
        let nearestDistSq = rangeSq;

        if (allShips) {
          const candidateThreats = (typeof allShips.getShipsInRadiusSq === 'function')
            ? allShips.getShipsInRadiusSq(this.x, this.y, rangeSq)
            : allShips;

          for (const other of candidateThreats) {
            let isBoardingCandidate = false;
            if (other.isCruiser && other.health < 2) {
              if (other.isUnderBoarding) {
                isBoardingCandidate = true;
              } else if (allShips) {
                for (const s of allShips) {
                  if (s.active && s.isCruiser && s.owner && s.owner.id === this.owner.id && (s.marineCount || 0) > 0 && s.scoutAttackEnabled === true) {
                    const dx = s.x - other.x;
                    const dy = s.y - other.y;
                    if (dx * dx + dy * dy <= 500 * 500) {
                      isBoardingCandidate = true;
                      break;
                    }
                  }
                }
              }
            }
            if (other.active && other.owner && other.owner !== this.owner && !other.isAmoeba && !other.isReturnPod && !other.isBoardingFleet && !other.isMaterializing && !isBoardingCandidate) {
              const dx = other.x - this.x;
              const dy = other.y - this.y;
              const distSq = dx * dx + dy * dy;
              if (distSq < nearestDistSq) {
                nearestDistSq = distSq;
                nearestEnemy = other;
              }
            }
          }
        }

        if (nearestEnemy) {
          this.cruiserTargetType = 'ship';
          this.cruiserTargetId = nearestEnemy.id;
          this.targetX = nearestEnemy.x;
          this.targetY = nearestEnemy.y;
          this.targetPlanet = null;
        } else {
          const reachedDest = !this.targetX || (Math.sqrt((this.targetX - this.x) * (this.targetX - this.x) + (this.targetY - this.y) * (this.targetY - this.y)) < 15);
          if (reachedDest) {
            const mapW = mapWidth || 1920;
            const mapH = (game && game.height) ? game.height : 1620;
            this.targetX = Math.random() * mapW;
            this.targetY = Math.random() * mapH;
            this.targetPlanet = null;
            this.cruiserTargetType = null;
            this.cruiserTargetId = null;
          }
        }
      }
    }

    if (this.isCruiser && this.isUpgrading) {
      if (this.upgradeUsingToken) {
        this.upgradeAccumulator += deltaTime / 1000;
        while (this.upgradeAccumulator >= 0.2 && this.upgradeTimer > 0) {
          this.upgradeTimer = Math.max(0, this.upgradeTimer - 0.2);
          this.upgradeAccumulator -= 0.2;
        }
        
        if (this.upgradeTimer <= 0) {
          this.upgradeTimer = 0;
          this.isUpgrading = false;
          this.upgradeUsingToken = false;
          
          const prop = this.upgradeProp;
          const currentLevel = this[prop] || 0;
          this[prop] = currentLevel + 1;
          
          if (prop === 'armor') {
            const upgradeCost = 50;
            const duraniumThreshold = upgradeCost / 50;
            let bonus = 4 + 0.10 * this.maxHealth;
            const canUseRes = !!(this.useResources || (this.owner && this.owner.tradeLimitToggle === true));
            if (canUseRes && this.owner && this.owner.resources && (this.owner.resources.duranium || 0) > duraniumThreshold) {
              this.owner.resources.duranium = Math.max(0, (this.owner.resources.duranium || 0) - duraniumThreshold);
              bonus *= 1.5;
              console.log(`[Armor Token Upgrade Boosted] Consumed ${duraniumThreshold} duranium. Boosted bonus by 50% to ${bonus}`);
            }
            this.maxArmor = (this.maxArmor || 0) + bonus;
            this.armorPoints = (this.armorPoints || 0) + bonus;
          } else if (prop === 'munitions') {
            this.splashDamage = this.munitions;
            this.bombs = this.getMaxBombs();
          } else if (prop === 'supply_ship') {
            this.maxsupplies = (this.supply_ship || 0) * 12;
          } else if (prop === 'extended_fuel') {
            this.fuel = this.getMaxFuel();
          } else if (prop === 'marines') {
            // Keep existing marineCount, do not auto-fill
          } else if (prop === 'shields') {
            this.shieldPoints = this.getMaxShields();
          }
          
          console.log(`[Cruiser Token Upgrade Complete] Ship ${this.id} upgraded ${prop} to level ${this[prop]}`);
          this.upgradeProp = null;
          this.upgradeType = null;
          this.upgradePlanetId = null;
        }
      } else {
        const planet = allPlanets ? allPlanets.find(p => p.id === this.upgradePlanetId) : null;
        let minAllowedCredits = 0;
        if (this.owner && game && game.planets) {
          const ownsHomeworld = game.planets.some(p => p.homeworldOf === this.owner.id && p.owner && p.owner.id === this.owner.id);
          if (ownsHomeworld) {
            minAllowedCredits = -(1000 + (this.owner.totalShips || 0));
          }
        }
        const creditsAvailable = (this.owner && this.owner.credits !== undefined) ? (this.owner.credits - minAllowedCredits) : 0;
        if (planet && planet.owner && this.owner && planet.owner.id === this.owner.id && (planet.ships >= 1 || creditsAvailable >= 1)) {
          this.upgradeAccumulator += deltaTime / 1000;
          while (this.upgradeAccumulator >= 0.2 && this.upgradeTimer > 0) {
            const currentCredits = this.owner.credits || 0;
            const currentCreditsAvailable = currentCredits - minAllowedCredits;
            if (currentCreditsAvailable >= 1) {
              this.owner.credits -= 1;
              this.upgradeShipsPaid += 1;
              this.upgradeTimer = Math.max(0, this.upgradeTimer - 0.2);
              this.upgradeAccumulator -= 0.2;
            } else if (planet.ships >= 1) {
              planet.ships -= 1;
              this.upgradeShipsPaid += 1;
              this.upgradeTimer = Math.max(0, this.upgradeTimer - 0.2);
              this.upgradeAccumulator -= 0.2;
            } else {
              break;
            }
          }
          
          if (this.upgradeTimer <= 0) {
            this.upgradeTimer = 0;
            this.isUpgrading = false;
            
            const currentLevel = this[this.upgradeProp] || 0;
            this[this.upgradeProp] = currentLevel + 1;
            
            if (this.upgradeProp === 'armor') {
              const upgradeCost = this.upgradeShipsPaid || 0;
              const duraniumThreshold = upgradeCost / 50;
              let bonus = 4 + 0.10 * this.maxHealth;
              const canUseRes = !!(this.useResources || (this.owner && this.owner.tradeLimitToggle === true));
              if (canUseRes && this.owner && this.owner.resources && (this.owner.resources.duranium || 0) > duraniumThreshold) {
                this.owner.resources.duranium = Math.max(0, (this.owner.resources.duranium || 0) - duraniumThreshold);
                bonus *= 1.5;
                console.log(`[Armor Upgrade Boosted] Consumed ${duraniumThreshold} duranium. Boosted bonus by 50% to ${bonus}`);
              }
              this.maxArmor = (this.maxArmor || 0) + bonus;
              this.armorPoints = (this.armorPoints || 0) + bonus;
            } else if (this.upgradeProp === 'munitions') {
              this.splashDamage = this.munitions;
            } else if (this.upgradeProp === 'supply_ship') {
              this.maxsupplies = (this.supply_ship || 0) * 12;
            } else if (this.upgradeProp === 'extended_fuel') {
              const baseFuel = this.maxHealth / 5;
              this.fuel = Math.min(this.getMaxFuel(), (this.fuel || 0) + baseFuel);
            } else if (this.upgradeProp === 'marines') {
              // Just capacity increases; do not load free marines upon upgrade completion
            } else if (this.upgradeProp === 'shields') {
              this.shieldPoints = this.getMaxShields();
            }
            
            console.log(`[Cruiser Upgrade Complete] Ship ${this.id} upgraded ${this.upgradeProp} to level ${this[this.upgradeProp]}`);
            this.upgradeProp = null;
            this.upgradeType = null;
            this.upgradePlanetId = null;
          }
        }
      }
    }

    if (this.isCruiser && this.isDismantling) {
      if (this.dismantleTimer === undefined) {
        this.dismantleTimer = this.maxHealth / 2;
        this.dismantleDuration = this.dismantleTimer;
        this.dismantleCreditsTotal = 0;
        this.dismantleCreditsReturned = 0;
        this.dismantleResourcesTotal = {};
        this.dismantleResourcesReturned = {};
      }
      
      const dt = deltaTime / 1000;
      this.dismantleTimer -= dt;
      
      let stepFraction = 0;
      if (this.dismantleTimer <= 0) {
        stepFraction = 1.0;
      } else {
        stepFraction = dt / (this.dismantleDuration || 1.0);
      }
      stepFraction = Math.max(0, Math.min(1.0, stepFraction));
      
      if (this.owner) {
        if (this.dismantleTimer <= 0) {
          const remainingCredits = Math.max(0, this.dismantleCreditsTotal - this.dismantleCreditsReturned);
          if (remainingCredits > 0) {
            this.owner.credits = (this.owner.credits || 0) + remainingCredits;
            this.dismantleCreditsReturned = this.dismantleCreditsTotal;
          }
          for (const res of Object.keys(this.dismantleResourcesTotal)) {
            const remainingRes = Math.max(0, (this.dismantleResourcesTotal[res] || 0) - (this.dismantleResourcesReturned[res] || 0));
            if (remainingRes > 0) {
              this.owner.resources = this.owner.resources || {};
              this.owner.resources[res] = (this.owner.resources[res] || 0) + remainingRes;
              this.dismantleResourcesReturned[res] = this.dismantleResourcesTotal[res];
            }
          }
        } else {
          const creditsToGive = Math.min(this.dismantleCreditsTotal - this.dismantleCreditsReturned, this.dismantleCreditsTotal * stepFraction);
          if (creditsToGive > 0) {
            this.owner.credits = (this.owner.credits || 0) + creditsToGive;
            this.dismantleCreditsReturned += creditsToGive;
          }
          for (const res of Object.keys(this.dismantleResourcesTotal)) {
            const totalRes = this.dismantleResourcesTotal[res] || 0;
            const returnedRes = this.dismantleResourcesReturned[res] || 0;
            const resToGive = Math.min(totalRes - returnedRes, totalRes * stepFraction);
            if (resToGive > 0) {
              this.owner.resources = this.owner.resources || {};
              this.owner.resources[res] = (this.owner.resources[res] || 0) + resToGive;
              this.dismantleResourcesReturned[res] += resToGive;
            }
          }
        }
      }
      
      if (this.dismantleTimer <= 0) {
        this.isDismantling = false;
        this.active = false;
        
        if (this.owner) {
          const localXp = this.expScore || 0;
          const gainedPlayerXp = localXp * 0.10;
          this.owner.expScore = (this.owner.expScore || 0) + gainedPlayerXp;
          console.log(`[Cruiser Dismantled] Ship ${this.id} dismantled. Owner gained ${gainedPlayerXp.toFixed(2)} player XP.`);
        }
      }
    }


    if (this.pursueTarget) {
      if (this.pursueTarget.active) {
        const pdx = this.pursueTarget.x - this.x;
        const pdy = this.pursueTarget.y - this.y;
        const pDistSq = pdx * pdx + pdy * pdy;
        if (!this.isAmoeba || pDistSq <= 250000) {
          this.targetPlanet = null;
          this.targetX = this.pursueTarget.x;
          this.targetY = this.pursueTarget.y;
        } else {
          this.pursueTarget = null;
        }
      } else {
        const originalTarget = this.pursueTarget;
        this.pursueTarget = null;

        if (this.isScoutDefenseFleet) {
          // 1. Target the nearest cruiser within 300px
          let nearestCruiser = null;
          let nearestDistSq = 300 * 300;
          if (allShips) {
            const candidateThreats = (typeof allShips.getShipsInRadiusSq === 'function')
              ? allShips.getShipsInRadiusSq(this.x, this.y, nearestDistSq)
              : allShips;

            for (const other of candidateThreats) {
              if (other.active && other.isCruiser && other.owner && this.originalAttackingPlayer && other.owner.id === this.originalAttackingPlayer.id && other !== originalTarget && !other.isMaterializing) {
                const dx = other.x - this.x;
                const dy = other.y - this.y;
                const distSq = dx * dx + dy * dy;
                if (distSq < nearestDistSq) {
                  nearestDistSq = distSq;
                  nearestCruiser = other;
                }
              }
            }
          }

          if (nearestCruiser) {
            this.pursueTarget = nearestCruiser;
            this.targetPlanet = null;
            this.targetX = nearestCruiser.x;
            this.targetY = nearestCruiser.y;
            console.log(`[Defensive Fleet] Target destroyed. Retargeted nearest cruiser ${nearestCruiser.id} within 300px.`);
          } else if (this.originalAttackingPlayer) {
            // 2. Target nearest planet owned by original attacking player
            let nearestPlanet = null;
            let nearestPlanetDistSq = Infinity;
            if (allPlanets) {
              for (const planet of allPlanets) {
                if (planet.owner && this.originalAttackingPlayer && planet.owner.id === this.originalAttackingPlayer.id) {
                  const dx = planet.x - this.x;
                  const dy = planet.y - this.y;
                  const distSq = dx * dx + dy * dy;
                  if (distSq < nearestPlanetDistSq) {
                    nearestPlanetDistSq = distSq;
                    nearestPlanet = planet;
                  }
                }
              }
            }

            if (nearestPlanet) {
              this.targetPlanet = nearestPlanet;
              this.targetX = nearestPlanet.x;
              this.targetY = nearestPlanet.y;
              console.log(`[Defensive Fleet] Target destroyed. Retargeted nearest planet ${nearestPlanet.id} of original attacking player.`);
            }
          }
        }
      }
    }

    if (this.hazardCooldown && this.hazardCooldown > 0) {
      this.hazardCooldown -= deltaTime;
    }
    if (this.planetBombardTimer && this.planetBombardTimer > 0) {
      this.planetBombardTimer -= deltaTime / 1000;
      if (this.planetBombardTimer < 0) this.planetBombardTimer = 0;
    }
    if (this.combatCooldown && this.combatCooldown > 0) {
      this.combatCooldown -= deltaTime / 1000;
      if (this.combatCooldown < 0) this.combatCooldown = 0;
    }
    if (this.playerMoveOrderRetreatCooldown && this.playerMoveOrderRetreatCooldown > 0) {
      this.playerMoveOrderRetreatCooldown -= deltaTime / 1000;
      if (this.playerMoveOrderRetreatCooldown < 0) this.playerMoveOrderRetreatCooldown = 0;
    }
    if (this.marineLaunchCooldown && this.marineLaunchCooldown > 0) {
      this.marineLaunchCooldown -= deltaTime / 1000;
      if (this.marineLaunchCooldown < 0) this.marineLaunchCooldown = 0;
    }

    this.flightTime += deltaTime / 1000;

    const techBonus = this.owner ? Math.sqrt(this.owner.techScore || 0) : 0;
    const expBonus = this.owner ? Math.sqrt(this.owner.expScore || 0) : 0;
    const safeTime = techBonus + expBonus;

    if (this.flightTime >= safeTime) {
      const timeExposed = this.flightTime - safeTime;
      let currentAttritionRate = 0.01 + 0.01 * Math.floor(timeExposed / 4);
      if (this.isBomber) currentAttritionRate /= 2;
      
      if (this.inFriendlyWell) {
        currentAttritionRate /= 3;
      }
      
      if (this.maxHealth === 0) {
        if (this.count > 1) {
          const expectedDeaths = this.count * currentAttritionRate * (deltaTime / 1000);
          let deaths = 0;
          if (expectedDeaths >= 1) {
            deaths = Math.floor(expectedDeaths);
          } else if (Math.random() < expectedDeaths) {
            deaths = 1;
          }
          if (deaths > 0) {
            let confirmedDeaths = 0;
            for (let d = 0; d < deaths; d++) {
              if (!this.checkSurvivalRoll()) {
                confirmedDeaths++;
              }
            }
            if (confirmedDeaths > 0) {
              this.count -= confirmedDeaths;
              if (this.count <= 0) {
                this.count = 0;
                this.active = false;
                if (explosions) {
                  explosions.push({
                    x: this.x,
                    y: this.y,
                    color: this.owner ? this.owner.color : (this.isAmoeba ? 'amoeba' : '#fff'),
                    age: 0
                  });
                }
                return;
              }
            }
          }
        } else if (Math.random() < currentAttritionRate * (deltaTime / 1000)) {
          if (!this.checkSurvivalRoll()) {
            this.active = false;
            if (explosions) {
              explosions.push({
                x: this.x,
                y: this.y,
                color: this.owner ? this.owner.color : (this.isAmoeba ? 'amoeba' : '#fff'),
                age: 0
              });
            }
            return;
          }
        }
      }
    }

    const playerTechBonus = this.owner ? Math.floor(Math.sqrt(this.owner.techScore || 0)) : 0;
    const laserTechBonus = 0.01 * playerTechBonus;
    const shipExpBonus = this.getLocalXpBonus();
    
    // Range Calculation
    let effectiveRange = 40 * (1 + laserTechBonus);
    if (this.isAmoeba) {
      const displayedMaxHealth = this.maxHealth + (this.maxHealth * (this.maxHealth - 1)) / 2;
      effectiveRange = 20 + displayedMaxHealth;
      if (this.bombs > 0) {
        effectiveRange += 10;
      }
      effectiveRange = Math.floor(effectiveRange);
    } else if (this.maxHealth > 0) {
      const xpRangeBonus = (expBonus + shipExpBonus) * 0.01;
      const baseDogfightRange = 40 * (1 + laserTechBonus + xpRangeBonus);
      effectiveRange = baseDogfightRange * 1.10;
      if (this.bombs > 0) {
        effectiveRange += baseDogfightRange * 0.10;
      }
      const targetingRangeBonus = (this.targeting || 0) * 0.05;
      effectiveRange *= (1 + targetingRangeBonus);
      if (this.supply_ship && this.supply_ship > 0) {
        effectiveRange = Math.max(5, effectiveRange - this.supply_ship * 5);
      }
      if (this.specialbombs && this.specialbombs > 0) {
        effectiveRange += 10;
      }
      if (this.package === 'brute') {
        effectiveRange *= 0.5;
      } else if (this.package === 'sniper') {
        effectiveRange *= 1.5;
      }
      effectiveRange = Math.floor(effectiveRange);
    } else {
      const healthBonus = Math.floor(this.health);
      effectiveRange = 40 * (1 + laserTechBonus) * (1 + healthBonus * 0.10);
    }
    const squaredRange = effectiveRange * effectiveRange;
    
    // Hit Chance Calculation
    let hitChance = 0;
    if (this.maxHealth > 0 && !this.isAmoeba) {
      hitChance = 0.10;
      let bombAccuracyBonus = 0;
      if (this.bombs > 0) {
        bombAccuracyBonus = 0.10;
        if (this.tactics === 'patient') {
          bombAccuracyBonus = 0.07;
        } else if (this.tactics === 'frenzied') {
          bombAccuracyBonus = 0.20;
        }
      }
      hitChance += bombAccuracyBonus;
      hitChance += (techBonus + expBonus + shipExpBonus) / 100;
      const targetingBonus = (this.targeting || 0) * 0.05;
      hitChance += targetingBonus;
      if (this.supply_ship && this.supply_ship > 0) {
        hitChance -= this.supply_ship * 0.05;
      }
      if (this.specialbombs && this.specialbombs > 0) {
        hitChance += 0.10;
      }
    } else {
      const bombBonus = (this.bombs && this.bombs > 0) ? (this.bombs * 3) : 0;
      hitChance = (10 + techBonus + expBonus + shipExpBonus + this.maxHealth * 5 + bombBonus) / 100;
    }

    // Rate of Fire (maxShots)
    let maxShots = 1;
    if (this.isCruiser && !this.isAmoeba) {
      if (this.health <= 2) {
        maxShots = 0;
      } else {
        const maxShotsFull = Math.max(1, Math.floor((this.maxHealth + this.maxHealth) / 6));
        let baseMaxShots = Math.max(1, Math.floor((this.maxHealth + this.health) / 6));
        const cap = Math.floor(this.health - 2);
        if (baseMaxShots > cap) {
          baseMaxShots = cap;
        }

        const lostShots = Math.max(0, maxShotsFull - baseMaxShots);
        let penaltyFactor = 1.0;
        if (this.damagecontrol > 0) {
          penaltyFactor = 1 / (1 + this.damagecontrol);
        }
        const finalLostShots = Math.round(lostShots * penaltyFactor);
        maxShots = Math.max(1, maxShotsFull - finalLostShots);
        
        if (maxShots > maxShotsFull) {
          maxShots = maxShotsFull;
        }
        const absoluteCap = Math.max(1, Math.floor(this.health - 1));
        if (maxShots > absoluteCap) {
          maxShots = absoluteCap;
        }
        if (this.supply_ship && this.supply_ship > 0) {
          maxShots = Math.max(1, maxShots - 2 * this.supply_ship);
        }
      }
    } else if (this.maxHealth > 0) {
      maxShots = Math.max(1, Math.floor(this.health));
    }
    if (this.scoutAttackEnabled === 'peace') {
      maxShots = 0;
    }
    const shotsPerVolley = maxShots;
    let shotsFired = 0;

    this.fireCooldown -= (deltaTime / 1000);
    if (this.fireCooldown <= 0 && maxShots > 0) {
      let amoebaCount = 1;
      if (game && game.amoebaCount !== undefined) {
        amoebaCount = game.amoebaCount;
      } else if (allShips) {
        amoebaCount = (allShips.amoebaCount !== undefined) ? allShips.amoebaCount : allShips.filter(s => s.active && s.isAmoeba).length;
      }
      const mapScale = 1600 / (mapWidth || 1600);
      const amoebaTimer = 10 * amoebaCount * mapScale;

      let validTargets = [];
      if (allShips) {
        let maxQueryRange = effectiveRange;
        if (this.maxHealth > 0 && !this.isAmoeba) {
          maxQueryRange = effectiveRange * 1.3;
        }
        const queryRadiusSq = maxQueryRange * maxQueryRange;
        const candidateShips = (typeof allShips.getShipsInRadiusSq === 'function') 
          ? allShips.getShipsInRadiusSq(this.x, this.y, queryRadiusSq)
          : allShips;

        for (const enemyShip of candidateShips) {
          if (!enemyShip.active || (enemyShip.owner && this.owner && enemyShip.owner.id === this.owner.id) || enemyShip.isMaterializing) continue;
          if (this.isAmoeba && enemyShip.isAmoeba) continue;
          
          if (this.owner && enemyShip.isCruiser && enemyShip.health < 2) {
            let attemptBoarding = false;
            
            // 1. Cruiser with marines is nearby (within 500px)
            if (allShips) {
              for (const other of allShips) {
                if (other.active && other.isCruiser && other.owner && (other.owner.id === this.owner.id || other.owner === this.owner) && (other.marineCount || 0) > 0 && other.scoutAttackEnabled === true) {
                  const dx = other.x - enemyShip.x;
                  const dy = other.y - enemyShip.y;
                  if (dx * dx + dy * dy <= 500 * 500) {
                    attemptBoarding = true;
                    break;
                  }
                }
              }
            }
            
            // 2. Marines actively attacking (already boarding)
            if (!attemptBoarding && enemyShip.isUnderBoarding && enemyShip.boardingPlayer && (enemyShip.boardingPlayer.id === this.owner.id || enemyShip.boardingPlayer === this.owner || enemyShip.boardingPlayer === this.owner.id)) {
              attemptBoarding = true;
            }
            
            if (attemptBoarding) {
              continue; // Cease firing!
            }
          }

          if (this.owner && !this.owner.isMonster && this.owner.id !== 'monsters') {
            if (game && typeof game.isShipVisibleTo === 'function') {
              if (!game.isShipVisibleTo(enemyShip, this.owner)) {
                continue;
              }
            }
          }

          const edx = enemyShip.x - this.x;
          const edy = enemyShip.y - this.y;
          const distSq = edx * edx + edy * edy;
          
          let targetRange = effectiveRange;
          let targetType = 'side';
          
          if (this.maxHealth > 0 && !this.isAmoeba) {
            // Cruiser: determine relative target direction
            const enemyAngle = Math.atan2(edy, edx);
            let diff = enemyAngle - this.angle;
            while (diff < -Math.PI) diff += Math.PI * 2;
            while (diff > Math.PI) diff -= Math.PI * 2;
            
            const absDiff = Math.abs(diff);
            const xpRangeBonus = (expBonus + shipExpBonus) * 0.01;
            const baseDogfightRange = 40 * (1 + laserTechBonus + xpRangeBonus);
            let targetingRangeBonus = 0;
            if (this.targeting > 0) {
              targetingRangeBonus += 0.05;
              if (this.targeting > 1) {
                targetingRangeBonus += 0.025;
              }
              if (this.targeting > 2) {
                targetingRangeBonus += 0.025;
              }
            }

            if (absDiff <= Math.PI / 4) {
              targetType = 'front';
              targetRange = effectiveRange * 1.3;
            } else if (absDiff >= 3 * Math.PI / 4) {
              targetType = 'aft';
              // Firing aft: do not gain range advantages of munitions (bombs)
              let rangeWithoutMunitions = effectiveRange;
              if (this.bombs > 0) {
                const munitionsBonus = baseDogfightRange * 0.10 * (1 + targetingRangeBonus);
                rangeWithoutMunitions = Math.max(0, effectiveRange - munitionsBonus);
              }
              targetRange = rangeWithoutMunitions * 0.85;
            } else {
              targetType = 'side';
              
              let bombRangeBoost = 0;
              if (this.bombs > 0) {
                bombRangeBoost = baseDogfightRange * 0.10 * (1 + targetingRangeBonus);
              }
              let specialBombRangeBoost = 0;
              if (this.specialbombs > 0) {
                specialBombRangeBoost = 10;
              }
              let packageMult = 1.0;
              if (this.package === 'brute') {
                packageMult = 0.5;
              } else if (this.package === 'sniper') {
                packageMult = 1.5;
              }
              bombRangeBoost *= packageMult;
              specialBombRangeBoost *= packageMult;

              targetRange = effectiveRange - 0.5 * bombRangeBoost - 0.5 * specialBombRangeBoost;
            }
          }
          
          if (distSq < targetRange * targetRange) {
            validTargets.push({ ship: enemyShip, distSq: distSq, targetType: targetType, targetRange: targetRange });
          }
        }
      }

      if (this.count > 1) {
        this.fireCooldown = 1.0;
        this.combatCooldown = 1.1;

        let totalShots = this.count;
        let lasersDrawn = 0;
        const friendlyPlanetBoost = this.getGravityWellBonusAt(this.x, this.y, this.owner, allPlanets);
        const hazardPenalty = this.getHazardAccuracyReduction(ionStorms);
        const penaltyCache = new Map();

        for (let s = 0; s < totalShots; s++) {
          if (validTargets.length === 0) break;
          const targetIndex = Math.floor(Math.random() * validTargets.length);
          const targetData = validTargets[targetIndex];
          const enemyShip = targetData.ship;
          
          let defenderPlanetPenalty = penaltyCache.get(enemyShip.id);
          if (defenderPlanetPenalty === undefined) {
            defenderPlanetPenalty = this.getGravityWellBonusAt(enemyShip.x, enemyShip.y, enemyShip.owner, allPlanets);
            penaltyCache.set(enemyShip.id, defenderPlanetPenalty);
          }
          
          const targetDist = Math.sqrt(targetData.distSq);
          const maxTargetRange = targetData.targetRange;
          let distRatio = 0;
          if (maxTargetRange > 25) {
            distRatio = Math.min(1.0, Math.max(0, targetDist - 25) / (maxTargetRange - 25));
          }
          const falloff = 1.0 - 0.5 * distRatio;

          const bombBonusInFinal = ((this.bombs && this.bombs > 0) ? (this.bombs * 3) : 0) / 100;
          const nonBombHitChance = Math.max(0, hitChance - bombBonusInFinal);
          const baseHitChance = nonBombHitChance * falloff + bombBonusInFinal;
          const finalHitChance = Math.max(0.01, baseHitChance + friendlyPlanetBoost - defenderPlanetPenalty - hazardPenalty);
          
          if (s === 0) {
            if (game && game.accuracyEvents) {
              game.accuracyEvents.push({
                x: enemyShip.x,
                y: enemyShip.y,
                accuracy: Math.round(finalHitChance * 100),
                isCruiser: false,
                attackerOwnerId: this.owner ? this.owner.id : null,
                targetOwnerId: enemyShip.owner ? enemyShip.owner.id : null,
                attackerShipId: this.id,
                attackerX: this.x,
                attackerY: this.y
              });
            }
          }

          if (enemyShip.isCruiser) {
            enemyShip.shieldShowTimer = 30;
          }
          const roll = Math.random();
          if (roll < finalHitChance) {
            const rollMadeBy = finalHitChance - roll;
            const damageDealt = enemyShip.takeDamage(explosions, this, false, targetData.targetType || 'side', rollMadeBy);
            if (damageDealt && this.owner) {
              this.owner.addExperience(1);
              if (this.sourceShipId && allShips) {
                const launcher = allShips.find(sh => sh.id === this.sourceShipId && sh.active);
                if (launcher) {
                  launcher.gainXp(1, game);
                }
              }
            }

            if (lasers && lasersDrawn < 8) {
              const startPt = this.getLaserStartPoint();
              let startX = startPt.startX;
              let startY = startPt.startY;
              lasers.push({
                startX: startX,
                startY: startY,
                endX: enemyShip.x,
                endY: enemyShip.y,
                color: this.owner ? this.owner.color : '#fff',
                age: 0,
                duration: 0.8,
                sourceId: this.id,
                targetId: enemyShip.id,
                sourceCount: this.count || 1,
                targetCount: enemyShip.count || 1,
                sourceAngle: this.angle || 0,
                targetAngle: enemyShip.angle || 0,
                sourceFormation: this.formation || 'arrow',
                targetFormation: enemyShip.formation || 'arrow',
                sourceIsCruiser: this.isCruiser || false,
                targetIsCruiser: enemyShip.isCruiser || false,
                sourceIsAmoeba: this.isAmoeba || false,
                targetIsAmoeba: enemyShip.isAmoeba || false,
                sourceIsBomber: this.isBomber || false,
                targetIsBomber: enemyShip.isBomber || false,
                sourceMaxHealth: this.maxHealth,
                targetMaxHealth: enemyShip.maxHealth,
                cruiserStyle: this.isCruiser ? (this.cruiserStyle || (this.owner ? this.owner.cruiserStyle : 'Klingon')) : (this.owner ? this.owner.cruiserStyle : null),
                index: lasersDrawn
              });
              lasersDrawn++;
            }

            if (!enemyShip.active) {
              validTargets.splice(targetIndex, 1);
            }
          }
        }
      } else {
        // Stagger shots: multi-shot ships fire 1 shot per sub-interval
        let cooldownMultiplier = 1.0;
        const hasSupplies = (this.supplies || 0) > 0;
        if (this.maxHealth > 0 && !this.isAmoeba && this.bombs <= 0 && !hasSupplies) {
          const isFirstVal = (this.volleyShotIndex === 0 || this.volleyShotIndex === undefined);
          if (isFirstVal && validTargets.length > 0) {
            if ((this.fuel || 0) >= 0.05) {
              this.fuel = Math.max(0, this.fuel - 0.05);
              this.volleyPaidFuel = true;
            } else {
              this.volleyPaidFuel = false;
            }
          }
          if (!this.volleyPaidFuel) {
            cooldownMultiplier = 2.0;
          }
        }
        this.fireCooldown = (shotsPerVolley > 1 ? (1.0 / shotsPerVolley) : 1.0) * cooldownMultiplier;
        maxShots = 1; // Fire only 1 shot per trigger

         let usedBomb = false;
         let selectedTargetIndex = -1;
         let isFirstVolleyShot = false;

        if (validTargets.length > 0) {
          this.combatCooldown = 1.1;
          this.lastTimeAttacking = Date.now();

          if (this.maxHealth > 0 && !this.isAmoeba) {
            // Cruiser: Prioritize front > side > aft targets
            const frontTargets = [];
            const sideTargets = [];
            const aftTargets = [];
            
            for (let i = 0; i < validTargets.length; i++) {
              const vt = validTargets[i];
              if (vt.targetType === 'front') frontTargets.push(i);
              else if (vt.targetType === 'side') sideTargets.push(i);
              else if (vt.targetType === 'aft') aftTargets.push(i);
            }
            
            if (frontTargets.length > 0) {
              selectedTargetIndex = frontTargets[Math.floor(Math.random() * frontTargets.length)];
            } else if (sideTargets.length > 0) {
              selectedTargetIndex = sideTargets[Math.floor(Math.random() * sideTargets.length)];
            } else if (aftTargets.length > 0) {
              selectedTargetIndex = aftTargets[Math.floor(Math.random() * aftTargets.length)];
            }
          }
          
          if (selectedTargetIndex === -1) {
            selectedTargetIndex = Math.floor(Math.random() * validTargets.length);
          }

          const targetData = validTargets[selectedTargetIndex];
          const targetType = targetData.targetType || 'side';

           if (this.volleyShotIndex === undefined) this.volleyShotIndex = 0;
           isFirstVolleyShot = (this.volleyShotIndex === 0);
          
          const isAftCruiserShot = (this.maxHealth > 0 && !this.isAmoeba && targetType === 'aft');
          
          let isWithinBombRange = true;
          if (this.maxHealth > 0 && !this.isAmoeba) {
            let strategyThreshold = 0.75; // Normal default
            if (this.strategy === 'short') {
              strategyThreshold = 0.50;
            } else if (this.strategy === 'long') {
              strategyThreshold = 1.00;
            }
            
            const targetDist = Math.sqrt(targetData.distSq);
            const maxTargetRange = targetData.targetRange;
            const distRatio = maxTargetRange > 0 ? Math.min(1.0, targetDist / maxTargetRange) : 0;
            isWithinBombRange = (distRatio <= strategyThreshold);
          }

          let bombConsumption = 0.5;
          if (this.maxHealth > 0 && !this.isAmoeba) {
            if (this.tactics === 'patient') {
              bombConsumption = 0.25;
            } else if (this.tactics === 'frenzied') {
              bombConsumption = 1.0;
            }
          }
          if (targetType === 'side') {
            bombConsumption *= 0.5;
          }

          if (this.maxHealth > 0 && this.bombs > 0 && this.volleyShotIndex === 0 && !this.isAmoeba && !isAftCruiserShot && isWithinBombRange) {
            usedBomb = true;
            this.bombs -= bombConsumption;
            if (this.bombs < 0) this.bombs = 0;
            if (this.specialbombs > 0) {
              this.specialbombs -= bombConsumption;
              if (this.specialbombs < 0) this.specialbombs = 0;
            }
          }

          this.volleyShotIndex = (this.volleyShotIndex + 1) % shotsPerVolley;
        }

        const hazardPenalty = this.getHazardAccuracyReduction(ionStorms);

        while (shotsFired < maxShots && validTargets.length > 0) {
          if (selectedTargetIndex === -1) {
            selectedTargetIndex = Math.floor(Math.random() * validTargets.length);
          }
          const targetIndex = selectedTargetIndex;
          const targetData = validTargets[targetIndex];
          const enemyShip = targetData.ship;
          const targetType = targetData.targetType || 'side';
          
          shotsFired++;
          
          let finalHitChance = hitChance;
          if (this.maxHealth > 0 && !this.isAmoeba) {
            // Firing aft: do not gain accuracy advantages of munitions
            let cruiserBaseHitChance = hitChance;
            let bombAccuracyBonus = 0;
            if (this.bombs > 0) {
              bombAccuracyBonus = 0.10;
              if (this.tactics === 'patient') {
                bombAccuracyBonus = 0.07;
              } else if (this.tactics === 'frenzied') {
                bombAccuracyBonus = 0.20;
              }
            }
            if (targetType === 'aft' && this.bombs > 0) {
              cruiserBaseHitChance = Math.max(0, cruiserBaseHitChance - bombAccuracyBonus);
            }
            
            // Double the hit chance for cruisers eliminated per user request
            finalHitChance = cruiserBaseHitChance;
            
            // Apply front/aft accuracy multipliers (+30% front instead of +20%)
            if (targetType === 'front') {
              finalHitChance *= 1.3;
            } else if (targetType === 'aft') {
              finalHitChance *= 0.85;
            }
            finalHitChance = Math.min(1.0, finalHitChance);
          }

          const targetDist = Math.sqrt(targetData.distSq);
          const maxTargetRange = targetData.targetRange;
          let distRatio = 0;
          if (maxTargetRange > 25) {
            distRatio = Math.min(1.0, Math.max(0, targetDist - 25) / (maxTargetRange - 25));
          }
          
          let falloff = 1.0 - 0.5 * distRatio;
          if (this.maxHealth > 0 && !this.isAmoeba) {
            if (this.package === 'brute') {
              falloff = 1.5 - 0.5 * distRatio;
            } else if (this.package === 'sniper') {
              falloff = 0.75 - 0.25 * distRatio;
            }
          }

          // Separating out bomb accuracy bonus from the falloff calculation
          let bombBonusInFinal = 0;
          if (this.maxHealth > 0 && !this.isAmoeba) {
            if (targetType !== 'aft' && this.bombs > 0) {
              let bonus = 0.10;
              if (this.tactics === 'patient') {
                bonus = 0.07;
              } else if (this.tactics === 'frenzied') {
                bonus = 0.20;
              }
              
              let factor = 1;
              if (targetType === 'front') {
                factor *= 1.3;
              } else if (targetType === 'aft') {
                factor *= 0.85;
              }
              bombBonusInFinal = bonus * factor;
            }
          } else if (this.maxHealth === 0) {
            const bombBonus = (this.bombs && this.bombs > 0) ? (this.bombs * 3) : 0;
            bombBonusInFinal = bombBonus / 100;
          }

          const nonBombHitChance = Math.max(0, finalHitChance - bombBonusInFinal);
          finalHitChance = nonBombHitChance * falloff + bombBonusInFinal;

          const friendlyPlanetBoost = this.getGravityWellBonusAt(this.x, this.y, this.owner, allPlanets);
          const defenderPlanetPenalty = this.getGravityWellBonusAt(enemyShip.x, enemyShip.y, enemyShip.owner, allPlanets);
          const minHitChance = (this.maxHealth > 0 && !this.isAmoeba) ? 0.10 : 0.01;
          finalHitChance = Math.max(minHitChance, finalHitChance + friendlyPlanetBoost - defenderPlanetPenalty - hazardPenalty);
          
          if (this.isCruiser) {
            this.shieldShowTimer = 30;
          }
          if (enemyShip.isCruiser) {
            enemyShip.shieldShowTimer = 30;
          }
          const roll = Math.random();
          const isHit = roll < finalHitChance;
          if (isFirstVolleyShot) {
            if (game && game.accuracyEvents) {
              game.accuracyEvents.push({
                x: enemyShip.x,
                y: enemyShip.y,
                accuracy: Math.round(finalHitChance * 100),
                isCruiser: true,
                attackerOwnerId: this.owner ? this.owner.id : null,
                targetOwnerId: enemyShip.owner ? enemyShip.owner.id : null,
                isBombAttack: usedBomb,
                hit: isHit,
                attackerShipId: this.id,
                attackerX: this.x,
                attackerY: this.y
              });
            }
          }

          if (isHit) {
            const rollMadeBy = finalHitChance - roll;
            const damageDealt = enemyShip.takeDamage(explosions, this, false, targetType, rollMadeBy);
            if (damageDealt) {
              const isAttackerCruiser = this.maxHealth > 0 && !this.isAmoeba;
              if (isAttackerCruiser) {
                const isTargetCruiserOrAmoeba = enemyShip.maxHealth > 0;
                const killedShip = !isTargetCruiserOrAmoeba || !enemyShip.active;
                if (killedShip) {
                  this.gainXp(0.05, game);
                }
              }

              if (this.owner) {
                // XP for damaging amoebas and cruisers
                if (enemyShip.isAmoeba && enemyShip.maxHealth > 0) {
                  this.owner.addExperience(enemyShip.maxHealth / 2);
                  if (this.sourceShipId && allShips) {
                    const launcher = allShips.find(sh => sh.id === this.sourceShipId && sh.active);
                    if (launcher) {
                      launcher.gainXp(enemyShip.maxHealth / 2, game);
                    }
                  }
                } else if (enemyShip.maxHealth > 0 && !enemyShip.isAmoeba) {
                  this.owner.addExperience(enemyShip.maxHealth / 2);
                  if (this.sourceShipId && allShips) {
                    const launcher = allShips.find(sh => sh.id === this.sourceShipId && sh.active);
                    if (launcher) {
                      launcher.gainXp(enemyShip.maxHealth / 2, game);
                    }
                  }
                }
              }
              // If attacker is a cruiser, and target is a cruiser or amoeba, and target is not destroyed:
              if (this.maxHealth > 0 && !this.isAmoeba) {
                const isTargetCruiserOrAmoeba = enemyShip.isAmoeba || (enemyShip.maxHealth > 0);
                if (isTargetCruiserOrAmoeba && enemyShip.active && explosions) {
                  explosions.push({
                    x: enemyShip.x,
                    y: enemyShip.y,
                    color: enemyShip.owner ? enemyShip.owner.color : (enemyShip.isAmoeba ? 'amoeba' : '#fff'),
                    age: 0
                  });
                }
              }
            }
            // Defender XP when cruiser is attacked (hit or shrug)
            if (enemyShip.maxHealth > 0 && !enemyShip.isAmoeba && enemyShip.owner) {
              enemyShip.owner.addExperience(0.25);
              enemyShip.gainXp(0.25, game);
            }
            if (!enemyShip.active) {
              if (this.owner) {
                this.owner.addExperience(1);
                if (this.sourceShipId && allShips) {
                  const launcher = allShips.find(sh => sh.id === this.sourceShipId && sh.active);
                  if (launcher) {
                    launcher.gainXp(1, game);
                  }
                }
              } else if (this.isAmoeba) {
                if (!this.amoebaGrowCooldown || this.amoebaGrowCooldown <= 0) {
                  this.maxHealth += 1;
                  this.health += 1;
                  this.amoebaGrowCooldown = amoebaTimer;
                  const techBonus = this.owner ? Math.sqrt(this.owner.techScore || 0) : 0;
                  const threshold = Math.max(4, techBonus);
                  if (this.maxHealth >= threshold) {
                    if (Math.random() < 0.5) {
                      this.needsSplit = true;
                    }
                  }
                }
              }
            }
          }
          
          if (lasers) {
            let startX = this.x;
            let startY = this.y;
            if (!usedBomb) {
              const startPt = this.getLaserStartPoint();
              startX = startPt.startX;
              startY = startPt.startY;
            }
            lasers.push({
              startX: startX,
              startY: startY,
              endX: enemyShip.x,
              endY: enemyShip.y,
              color: this.owner ? this.owner.color : (this.isAmoeba ? 'amoeba' : '#fff'),
              age: 0,
              duration: usedBomb ? 3 * Math.max(0.8, 0.4 + (shotsPerVolley * 0.08)) : Math.max(0.8, 0.4 + (shotsPerVolley * 0.08)),
              width: usedBomb ? 8 : undefined,
              isBombAttack: usedBomb,
              cruiserStyle: this.cruiserStyle || (this.owner ? this.owner.cruiserStyle : 'Klingon'),
              isAmoebaAttack: !!this.isAmoeba,
              sourceId: this.id,
              targetId: enemyShip.id,
              sourceCount: this.count || 1,
              targetCount: enemyShip.count || 1,
              sourceAngle: this.angle || 0,
              targetAngle: enemyShip.angle || 0,
              sourceFormation: this.formation || 'arrow',
              targetFormation: enemyShip.formation || 'arrow',
              sourceIsCruiser: this.isCruiser || false,
              targetIsCruiser: enemyShip.isCruiser || false,
              sourceIsAmoeba: this.isAmoeba || false,
              targetIsAmoeba: enemyShip.isAmoeba || false,
              sourceIsBomber: this.isBomber || false,
              targetIsBomber: enemyShip.isBomber || false,
              sourceMaxHealth: this.maxHealth,
              targetMaxHealth: enemyShip.maxHealth,
              index: shotsFired - 1
            });
          }
          
          if (!enemyShip.active) {
            validTargets.splice(targetIndex, 1);
          }
        }
      }

      if (this.maxHealth > 0 && shotsFired < maxShots && allPlanets && this.bombs > 0) {
        const isCruiser = !this.isAmoeba;
        let enemyNearby = false;
        if (isCruiser && allShips) {
          const sensorRange = this.cruiserRadarRange();
          const rangeSq = sensorRange * sensorRange;

          const candidateThreats = (typeof allShips.getShipsInRadiusSq === 'function')
            ? allShips.getShipsInRadiusSq(this.x, this.y, rangeSq)
            : allShips;

          for (const otherShip of candidateThreats) {
            if (otherShip.active && otherShip.owner !== this.owner && !otherShip.isMaterializing) {
              const odx = otherShip.x - this.x;
              const ody = otherShip.y - this.y;
              if (odx * odx + ody * ody <= rangeSq) {
                enemyNearby = true;
                break;
              }
            }
          }
        }
        let isCruiserBombing = false;
        if (isCruiser) {
          if (this.cruiserTargetType === 'planet' && this.cruiserTargetId !== null) {
            isCruiserBombing = true;
          }
        }
        if (!isCruiser || (isCruiserBombing && this.bombs >= 1 && (!this.planetBombardTimer || this.planetBombardTimer <= 0) && !enemyNearby)) {
          let validPlanets = [];
          for (const p of allPlanets) {
            if (p.owner && this.owner && p.owner.id === this.owner.id) continue;
            if (this.isAmoeba && !p.owner && (this.amoebaGrowCooldown || 0) > 0) continue;
            if (p.ships > 0) {
              if (isCruiser && p.id !== this.cruiserTargetId) continue;
              const pdx = p.x - this.x;
              const pdy = p.y - this.y;
              const distSq = pdx * pdx + pdy * pdy;
              const combinedRange = effectiveRange + p.radius;
              if (distSq < combinedRange * combinedRange) {
                validPlanets.push(p);
              }
            }
          }

          let firedAtPlanet = false;
          while (shotsFired < maxShots && validPlanets.length > 0) {
            firedAtPlanet = true;
            let p;
            if (this.cruiserTargetType === 'planet' && this.cruiserTargetId) {
              p = validPlanets.find(pl => pl.id === this.cruiserTargetId);
            }
            if (!p) {
              const targetIndex = Math.floor(Math.random() * validPlanets.length);
              p = validPlanets[targetIndex];
            }
            
            if (p.owner && this.owner && p.owner.id !== this.owner.id) {
              this.lastAttackTimeByPlayer = this.lastAttackTimeByPlayer || {};
              this.lastAttackTimeByPlayer[p.owner.id] = Date.now();
            }
            
            shotsFired++;
            if (this.isCruiser) {
              this.shieldShowTimer = 30;
            }
            
            let destroyedDefender = false;
            let finalPlanetHitChance = this.isAmoeba ? (hitChance / 2) : hitChance;
            if (!this.isAmoeba && this.maxHealth > 0) {
              const munitionsBonus = (this.munitions || 0) * 0.10;
              finalPlanetHitChance = Math.min(1.0, finalPlanetHitChance * 2 + munitionsBonus);
            }
            if (Math.random() < finalPlanetHitChance) {
              if (p.ships > 0) {
                if (isCruiser) {
                  // For cruisers, delay decrementing p.ships until the explosion (arrival)
                  destroyedDefender = true;
                } else {
                  p.ships -= 1;
                  destroyedDefender = true;
                }
              }
              if (this.isAmoeba) {
                  if (!this.amoebaGrowCooldown || this.amoebaGrowCooldown <= 0) {
                    this.maxHealth += 1;
                    this.health += 1;
                    this.amoebaGrowCooldown = amoebaTimer;
                    const techBonus = this.owner ? Math.sqrt(this.owner.techScore || 0) : 0;
                    const threshold = Math.max(4, techBonus);
                    if (this.maxHealth >= threshold) {
                      if (Math.random() < 0.5) {
                        this.needsSplit = true;
                      }
                    }
                  }
                }
              }
            if (lasers) {
              if (isCruiser) {
                lasers.push({
                  startX: this.x, startY: this.y,
                  endX: p.x + (Math.random() - 0.5) * p.radius, 
                  endY: p.y + (Math.random() - 0.5) * p.radius,
                  color: 'cruiser-projectile',
                  age: 0, duration: 3.0, width: 8,
                  isBombAttack: true,
                  cruiserStyle: this.cruiserStyle || (this.owner ? this.owner.cruiserStyle : 'Klingon'),
                  sourceMaxHealth: this.maxHealth,
                  destroysDefender: destroyedDefender,
                  targetPlanetId: p.id,
                  sourceShipId: this.id,
                  splashDamage: this.splashDamage || 0,
                  accuracy: Math.round(finalPlanetHitChance * 100),
                  attackerOwnerId: this.owner ? this.owner.id : null,
                  targetOwnerId: p.owner ? p.owner.id : null
                });
              } else {
                lasers.push({
                  startX: this.x, startY: this.y,
                  endX: p.x + (Math.random() - 0.5) * p.radius, 
                  endY: p.y + (Math.random() - 0.5) * p.radius,
                  color: this.owner ? this.owner.color : (this.isAmoeba ? 'amoeba' : '#fff'),
                  age: 0, duration: 0.6, width: 8,
                  isAmoebaAttack: !!this.isAmoeba,
                  cruiserStyle: this.owner ? this.owner.cruiserStyle : null
                });
              }
            }
          }
          if (firedAtPlanet) {
            if (isCruiser) {
              this.bombs--;
              if (this.bombs < 0) this.bombs = 0;
              if (this.specialbombs > 0) {
                this.specialbombs--;
                if (this.specialbombs < 0) this.specialbombs = 0;
              }
              this.planetBombardTimer = 2.0;
            } else {
              this.bombs--;
            }
          }
        }
      }
    }
    
    if (!this.isPatrolling) {
      this.patrolFuelRetreating = false;
      this.patrolFuelRetreatTargetPlanetId = null;
    }
    
    if (!this.isScouting) {
      this.scoutFuelRetreating = false;
      this.scoutFuelRetreatTargetPlanetId = null;
      this.scoutFuelRetreatTargetShipId = null;
      this.scoutTargetX = null;
      this.scoutTargetY = null;
    }
    
    if (!this.isResearching) {
      this.researchFuelRetreating = false;
      this.researchFuelRetreatTargetPlanetId = null;
      this.researchRearming = false;
      this.researchRearmTargetPlanetId = null;
    }

    if (!this.isDiplomacy) {
      this.diplomacyFuelRetreating = false;
      this.diplomacyFuelRetreatTargetPlanetId = null;
    }
    
    if (this.maxHealth > 0 && this.labs > 0 && !this.isAmoeba && this.owner && !this.owner.isMonster && this.owner.id !== 'monsters') {
      const isIdle = !this.isPatrolling && !this.isScouting && !this.isDiplomacy && !this.isRetreating &&
                     this.targetX === null && this.targetY === null && this.targetPlanet === null &&
                     (!this.orderQueue || this.orderQueue.length === 0);
      if (isIdle) {
        this.isResearching = true;
      } else {
        this.isResearching = false;
      }
    }

    // Cruiser Patrol Mode Decision Engine
    if (this.maxHealth > 0 && !this.isAmoeba && this.owner && !this.owner.isMonster && this.owner.id !== 'monsters' && this.isPatrolling && !this.isRetreating) {
      // Check if fuel is 1 or less while patrolling
      const hasSupplies = (this.supplies || 0) > 0;
      const withinSensorRangeOfSupplyShip = this.isWithinSensorRangeOfSupplyShip(allShips);
      if (false && this.fuel <= 1 && !hasSupplies && !withinSensorRangeOfSupplyShip && (!this.playerMoveOrderRetreatCooldown || this.playerMoveOrderRetreatCooldown <= 0)) {
        this.patrolFuelRetreating = true;
        this.patrolReloading = false;
        this.patrolReloadTargetPlanetId = null;
      }
      
      // If we are fuel retreating, we remain in this state until fuel is fully replenished (fuel >= getMaxFuel())
      if (this.patrolFuelRetreating) {
        if (this.fuel >= this.getMaxFuel()) {
          this.patrolFuelRetreating = false;
        }
      }

      if (this.patrolFuelRetreating) {
        const wasFuelRetreating = this.patrolFuelRetreating;
        let needNewTarget = this.targetX === null || this.targetY === null || !this.patrolFuelRetreatTargetPlanetId;
        if (!needNewTarget && this.patrolFuelRetreatTargetPlanetId !== null && this.patrolFuelRetreatTargetPlanetId !== undefined) {
          const tp = allPlanets ? allPlanets.find(p => p.id === this.patrolFuelRetreatTargetPlanetId) : null;
          if (!tp || !tp.owner || tp.owner.id !== this.owner.id) {
            needNewTarget = true;
          }
        }

        if (needNewTarget) {
          const friendlyPlanets = allPlanets ? allPlanets.filter(p => p.owner && p.owner.id === this.owner.id) : [];
          let bestCandidate = null;

          if (friendlyPlanets.length > 0) {
            const findBestCandidate = (radius, minEnemyDistReq, strictSafe) => {
              const candidates = [];
              for (let attempt = 0; attempt < 250 && candidates.length < 15; attempt++) {
                const p = friendlyPlanets[Math.floor(Math.random() * friendlyPlanets.length)];
                const gRad = p.getGravityRadius();
                const theta = Math.random() * Math.PI * 2;
                const r = Math.random() * gRad * 0.7;
                const tx = p.x + r * Math.cos(theta);
                const ty = p.y + r * Math.sin(theta);
                
                const dx = tx - this.x;
                const dy = ty - this.y;
                if (dx * dx + dy * dy <= radius * radius) {
                  let minEnemyDistSq = Infinity;
                  if (allShips) {
                    for (const other of allShips) {
                      if (other.active && other.id !== this.id) {
                        const isEnemy = (other.owner && other.owner.id !== this.owner.id) || other.isAmoeba;
                        if (isEnemy) {
                          const edx = other.x - tx;
                          const edy = other.y - ty;
                          const distSq = edx * edx + edy * edy;
                          if (distSq < minEnemyDistSq) {
                            minEnemyDistSq = distSq;
                          }
                        }
                      }
                    }
                  }
                  
                  if (!strictSafe || minEnemyDistSq >= minEnemyDistReq * minEnemyDistReq) {
                    candidates.push({ x: tx, y: ty, planet: p, minEnemyDistSq });
                  }
                }
              }
              
              if (candidates.length > 0) {
                candidates.sort((a, b) => b.minEnemyDistSq - a.minEnemyDistSq);
                return candidates[0];
              }
              return null;
            };

            // Stage 1: Search within 300px, requiring at least 150px safety distance from enemies
            bestCandidate = findBestCandidate(300, 150, true);
            
            // Stage 2: If none found within 300px that are >= 150px away from enemies, expand search to 500px
            if (!bestCandidate) {
              bestCandidate = findBestCandidate(500, 150, true);
            }

            // Stage 3: If STILL none found that are >= 150px away, fallback to best overall within 300px
            if (!bestCandidate) {
              bestCandidate = findBestCandidate(300, 0, false);
            }

            // Stage 4: If STILL none, fallback to best overall within 500px
            if (!bestCandidate) {
              bestCandidate = findBestCandidate(500, 0, false);
            }
          }
          
          if (bestCandidate) {
            this.targetPlanet = null; // don't go directly to the planet
            this.patrolFuelRetreatTargetPlanetId = bestCandidate.planet.id;
            this.targetX = bestCandidate.x;
            this.targetY = bestCandidate.y;
            this.cruiserTargetType = null;
            this.cruiserTargetId = null;
          } else {
            // Fallback: If no friendly planet gravity well is within 500px, find the closest friendly planet and go to it
            let closestFriendly = null;
            let minFriendlyDistSq = Infinity;
            if (friendlyPlanets.length > 0) {
              for (const p of friendlyPlanets) {
                const dx = p.x - this.x;
                const dy = p.y - this.y;
                const distSq = dx * dx + dy * dy;
                if (distSq < minFriendlyDistSq) {
                  minFriendlyDistSq = distSq;
                  closestFriendly = p;
                }
              }
            }
            if (closestFriendly) {
              this.targetPlanet = closestFriendly;
              this.targetX = closestFriendly.x;
              this.targetY = closestFriendly.y;
              this.patrolFuelRetreatTargetPlanetId = closestFriendly.id;
              this.cruiserTargetType = null;
              this.cruiserTargetId = null;
            }
          }
        }
      } else {
        this.patrolFuelRetreating = false;
        this.patrolFuelRetreatTargetPlanetId = null;

        // 1. Check if out of bombs -> Reloading State, or low health -> Retreat to repair
        const supplyShip = this.findNearbySupplyShip(allShips);
        const hasNearbySupply = supplyShip && (supplyShip.supplies || 0) >= 1.0;
        const hasSupplies = (this.supplies || 0) > 0;
        const withinSensorRangeOfSupplyShip = this.isWithinSensorRangeOfSupplyShip(allShips);
        const needsHealthRetreat = this.health < this.maxHealth * 0.5;
        const needsHealthFinish = this.health < this.maxHealth;
        const coolingReload = this.playerMoveOrderRetreatCooldown && this.playerMoveOrderRetreatCooldown > 0;
        if (!coolingReload && (needsHealthRetreat || (this.bombs <= 0 && !hasNearbySupply && !hasSupplies && !withinSensorRangeOfSupplyShip) || (this.patrolReloading && (this.bombs < this.getMaxBombs() || needsHealthFinish)))) {
        const wasReloading = this.patrolReloading;
        this.patrolReloading = true;
        
        let needNewTarget = !wasReloading || this.targetX === null || this.targetY === null;
        if (!needNewTarget && this.patrolReloadTargetPlanetId !== null && this.patrolReloadTargetPlanetId !== undefined) {
          const tp = allPlanets ? allPlanets.find(p => p.id === this.patrolReloadTargetPlanetId) : null;
          if (!tp || !tp.owner || tp.owner.id !== this.owner.id) {
            needNewTarget = true;
          }
        }
        
        if (needNewTarget) {
          const friendlyPlanets = allPlanets ? allPlanets.filter(p => p.owner && p.owner.id === this.owner.id) : [];
          let bestCandidate = null;

          if (friendlyPlanets.length > 0) {
            const findBestCandidate = (radius, minEnemyDistReq, strictSafe) => {
              const candidates = [];
              for (let attempt = 0; attempt < 250 && candidates.length < 15; attempt++) {
                const p = friendlyPlanets[Math.floor(Math.random() * friendlyPlanets.length)];
                const gRad = p.getGravityRadius();
                const theta = Math.random() * Math.PI * 2;
                const r = Math.random() * gRad * 0.7;
                const tx = p.x + r * Math.cos(theta);
                const ty = p.y + r * Math.sin(theta);
                
                const dx = tx - this.x;
                const dy = ty - this.y;
                if (dx * dx + dy * dy <= radius * radius) {
                  let minEnemyDistSq = Infinity;
                  if (allShips) {
                    for (const other of allShips) {
                      if (other.active && other.id !== this.id) {
                        const isEnemy = (other.owner && other.owner.id !== this.owner.id) || other.isAmoeba;
                        if (isEnemy) {
                          const edx = other.x - tx;
                          const edy = other.y - ty;
                          const distSq = edx * edx + edy * edy;
                          if (distSq < minEnemyDistSq) {
                            minEnemyDistSq = distSq;
                          }
                        }
                      }
                    }
                  }
                  
                  if (!strictSafe || minEnemyDistSq >= minEnemyDistReq * minEnemyDistReq) {
                    candidates.push({ x: tx, y: ty, planet: p, minEnemyDistSq });
                  }
                }
              }
              
              if (candidates.length > 0) {
                candidates.sort((a, b) => b.minEnemyDistSq - a.minEnemyDistSq);
                return candidates[0];
              }
              return null;
            };

            // Stage 1: Search within 300px, requiring at least 150px safety distance from enemies
            bestCandidate = findBestCandidate(300, 150, true);
            
            // Stage 2: If none found within 300px that are >= 150px away from enemies, expand search to 500px
            if (!bestCandidate) {
              bestCandidate = findBestCandidate(500, 150, true);
            }

            // Stage 3: If STILL none found that are >= 150px away, fallback to best overall within 300px
            if (!bestCandidate) {
              bestCandidate = findBestCandidate(300, 0, false);
            }

            // Stage 4: If STILL none, fallback to best overall within 500px
            if (!bestCandidate) {
              bestCandidate = findBestCandidate(500, 0, false);
            }
          }
          
          if (bestCandidate) {
            this.targetPlanet = null; // don't go directly to the planet
            this.patrolReloadTargetPlanetId = bestCandidate.planet.id;
            this.targetX = bestCandidate.x;
            this.targetY = bestCandidate.y;
            this.cruiserTargetType = null;
            this.cruiserTargetId = null;
          } else {
            // Fallback: If no friendly planet gravity well is within 500px, find the closest friendly planet and go to it
            let closestFriendly = null;
            let minFriendlyDistSq = Infinity;
            if (friendlyPlanets.length > 0) {
              for (const p of friendlyPlanets) {
                const dx = p.x - this.x;
                const dy = p.y - this.y;
                const distSq = dx * dx + dy * dy;
                if (distSq < minFriendlyDistSq) {
                  minFriendlyDistSq = distSq;
                  closestFriendly = p;
                }
              }
            }
            if (closestFriendly) {
              this.targetPlanet = closestFriendly;
              this.targetX = closestFriendly.x;
              this.targetY = closestFriendly.y;
              this.patrolReloadTargetPlanetId = closestFriendly.id;
              this.cruiserTargetType = null;
              this.cruiserTargetId = null;
            }
          }
        }
      } else {
        this.patrolReloading = false;
        this.patrolReloadTargetPlanetId = null;
        
        let closestEnemy = null;
        let minEnemyDistSq = 500 * 500; // max engagement range is 500px
        
        if (allShips) {
          const candidateShips = (typeof allShips.getShipsInRadiusSq === 'function')
            ? allShips.getShipsInRadiusSq(this.x, this.y, 500 * 500)
            : allShips;
            
          for (const other of candidateShips) {
            if (other.active && other.id !== this.id) {
              const isEnemy = (other.owner && other.owner.id !== this.owner.id) || other.isAmoeba;
              if (isEnemy) {
                let isVisible = true;
                if (game && typeof game.isShipVisibleTo === 'function') {
                  isVisible = game.isShipVisibleTo(other, this.owner);
                }
                if (!isVisible) continue;
                let skipPursuing = false;
                if (other.isCruiser && other.health < 2) {
                  let isBoardingCandidate = other.isUnderBoarding;
                  if (!isBoardingCandidate && allShips) {
                    for (const s of allShips) {
                      if (s.active && s.isCruiser && s.owner && s.owner.id === this.owner.id && (s.marineCount || 0) > 0 && s.scoutAttackEnabled === true) {
                        const dx = s.x - other.x;
                        const dy = s.y - other.y;
                        if (dx * dx + dy * dy <= 500 * 500) {
                          isBoardingCandidate = true;
                          break;
                        }
                      }
                    }
                  }
                  if (isBoardingCandidate) {
                    skipPursuing = true;
                  }
                } else {
                  if (allShips) {
                    for (const pod of allShips) {
                      if (pod.active && (pod.isBoardingFleet || pod.isMarineFleet) && pod.targetShipId === other.id && pod.owner && (pod.owner.id === this.owner.id || pod.owner === this.owner)) {
                        skipPursuing = true;
                        break;
                      }
                    }
                  }
                  if (!skipPursuing && other.isUnderBoarding && other.boardingPlayer && (other.boardingPlayer.id === this.owner.id || other.boardingPlayer === this.owner || other.boardingPlayer === this.owner.id)) {
                    skipPursuing = true;
                  }
                }
                if (skipPursuing) continue;

                let allowedToPursue = (this.scoutAttackEnabled === true);
                if (!allowedToPursue) {
                  let inFriendlyGravityWell = false;
                  if (allPlanets) {
                    for (const pl of allPlanets) {
                      if (pl.owner && pl.owner.id === this.owner.id) {
                        const gr = pl.getGravityRadius();
                        const pdx = other.x - pl.x;
                        const pdy = other.y - pl.y;
                        if (pdx * pdx + pdy * pdy <= gr * gr) {
                          inFriendlyGravityWell = true;
                          break;
                        }
                      }
                    }
                  }
                  
                  const recentlyAttackedPlayer = !!(other.lastAttackTimeByPlayer && (Date.now() - (other.lastAttackTimeByPlayer[this.owner.id] || 0) < 15000));
                  const recentlyAttackedByUs = !!(this.lastAttackTimeOnShip && (Date.now() - (this.lastAttackTimeOnShip[other.id] || 0) < 15000));
                  
                  allowedToPursue = inFriendlyGravityWell || recentlyAttackedPlayer || recentlyAttackedByUs;
                }
                if (!allowedToPursue) continue;

                const dx = other.x - this.x;
                const dy = other.y - this.y;
                const distSq = dx * dx + dy * dy;
                
                let eligible = (distSq <= 500 * 500);
                
                if (eligible && distSq < minEnemyDistSq) {
                  minEnemyDistSq = distSq;
                  closestEnemy = other;
                }
              }
            }
          }
        }
        
        if (closestEnemy) {
          this.cruiserTargetType = 'ship';
          this.cruiserTargetId = closestEnemy.id;
          this.targetX = closestEnemy.x;
          this.targetY = closestEnemy.y;
          this.targetPlanet = null;
        } else {
          // No active targets, clear lock so we can hold position or follow manual coordinate order if set
          this.cruiserTargetType = null;
          this.cruiserTargetId = null;
          
          if (this.patrolStationX !== null && this.patrolStationY !== null) {
            this.targetX = this.patrolStationX;
            this.targetY = this.patrolStationY;
            this.targetPlanet = null;
          }
        }
      }
      }
    }
    
    // Cruiser Scout Mode Decision Engine
    if (this.maxHealth > 0 && !this.isAmoeba && this.owner && !this.owner.isMonster && this.owner.id !== 'monsters' && this.isScouting && !this.isRetreating) {
      // 1. Refueling & Rearming & Health Retreat Check: if fuel is half or less, OR if attack is on and bombs are depleted, OR health is below 1/2 maxhealth
      const hasSupplies = (this.supplies || 0) > 0;
      const withinSensorRangeOfSupplyShip = this.isWithinSensorRangeOfSupplyShip(allShips);
      const maxFuel = this.getMaxFuel();
      const needsRefuel = (this.fuel < maxFuel * 0.25) && !hasSupplies && !withinSensorRangeOfSupplyShip;
      const supplyShip = this.findNearbySupplyShip(allShips);
      const hasNearbySupply = supplyShip && (supplyShip.supplies || 0) >= 1.0;
      const needsRearm = (this.scoutAttackEnabled === true) && this.bombs <= 0 && !hasNearbySupply && !hasSupplies && !withinSensorRangeOfSupplyShip;
      const needsHealthRetreat = this.health < this.maxHealth * 0.5;
      const coolingScout = this.playerMoveOrderRetreatCooldown && this.playerMoveOrderRetreatCooldown > 0;
      if (!coolingScout && (needsRefuel || needsRearm || needsHealthRetreat)) {
        this.scoutFuelRetreating = true;
        this.scoutTargetX = null;
        this.scoutTargetY = null;
      }
      
      // If we are fuel/rearm/health retreating, remain in this state until fuel, bombs (if attack is enabled), and health are fully replenished
      if (this.scoutFuelRetreating) {
        const fullyFueled = this.fuel >= this.getMaxFuel() * 0.97;
        const fullyArmed = (this.scoutAttackEnabled !== true) || this.bombs >= this.getMaxBombs();
        const fullyHealed = this.health >= this.maxHealth;
        if (fullyFueled && fullyArmed && fullyHealed) {
          this.scoutFuelRetreating = false;
        }
      }

      // Helper: Check if a cell coordinate overlaps with any active ion storm or minefield (radius + 100px buffer)
      const isCellInStorm = (tx, ty) => {
        if (ionStorms) {
          for (const storm of ionStorms) {
            const dx = tx - storm.x;
            const dy = ty - storm.y;
            const safeDist = storm.radius + 100;
            if (dx * dx + dy * dy <= safeDist * safeDist) {
              const knowledge = storm.knowledge[this.owner ? this.owner.id : ''] || 0;
              const tRed = this.owner ? Math.sqrt(this.owner.techScore || 0) : 0;
              const eRed = this.owner ? Math.sqrt(this.owner.expScore || 0) : 0;
              const sRed = this.getLocalXpBonus();
              const effectiveIntensity = Math.max(0, storm.intensity - knowledge - (tRed + eRed) / 2 - sRed);
              if (effectiveIntensity >= 5) {
                return true;
              }
            }
          }
        }
        return false;
      };

      if (this.scoutFuelRetreating) {
        let needNewTarget = this.targetX === null || this.targetY === null || (!this.scoutFuelRetreatTargetPlanetId && !this.scoutFuelRetreatTargetShipId);
        if (!needNewTarget) {
          if (this.scoutFuelRetreatTargetPlanetId !== null && this.scoutFuelRetreatTargetPlanetId !== undefined) {
            const tp = allPlanets ? allPlanets.find(p => p.id === this.scoutFuelRetreatTargetPlanetId) : null;
            if (!tp || !tp.owner || tp.owner.id !== this.owner.id) {
              needNewTarget = true;
            }
          } else if (this.scoutFuelRetreatTargetShipId !== null && this.scoutFuelRetreatTargetShipId !== undefined) {
            const ts = allShips ? allShips.find(s => s.id === this.scoutFuelRetreatTargetShipId) : null;
            if (!ts || !ts.active || !ts.owner || ts.owner.id !== this.owner.id) {
              needNewTarget = true;
            } else {
              // Update target coords dynamically to follow the moving ship!
              this.targetX = ts.x;
              this.targetY = ts.y;
            }
          }
        }

        if (needNewTarget) {
          const candidates = [];

          // 1. Gather friendly ship candidates (supplies > 0 OR fuel > 4)
          if (allShips && this.owner) {
            for (const other of allShips) {
              if (other.active && other !== this && other.isCruiser && other.owner && other.owner.id === this.owner.id) {
                const hasS = (other.supplies || 0) > 0;
                const hasF = (other.fuel || 0) > 4;
                if (hasS || hasF) {
                  const dx = other.x - this.x;
                  const dy = other.y - this.y;
                  candidates.push({
                    type: 'ship',
                    ship: other,
                    x: other.x,
                    y: other.y,
                    distSq: dx * dx + dy * dy
                  });
                }
              }
            }
          }

          // 2. Gather safe friendly gravity well candidates
          const friendlyPlanets = allPlanets ? allPlanets.filter(p => p.owner && p.owner.id === this.owner.id) : [];
          if (friendlyPlanets.length > 0) {
            // Safe helper
            const findSafeLocInWell = (planet, minEnemyDistReq, strictSafe) => {
              const gRad = planet.getGravityRadius();
              let bestLoc = null;
              let maxMinEnemyDistSq = -1;
              for (let attempt = 0; attempt < 50; attempt++) {
                const theta = Math.random() * Math.PI * 2;
                const r = Math.random() * gRad * 0.7;
                const tx = planet.x + r * Math.cos(theta);
                const ty = planet.y + r * Math.sin(theta);
                
                let minEnemyDistSq = Infinity;
                if (allShips) {
                  for (const other of allShips) {
                    if (other.active && other.id !== this.id) {
                      const isEnemy = (other.owner && other.owner.id !== this.owner.id) || other.isAmoeba;
                      if (isEnemy) {
                        let isVisible = true;
                        if (game && typeof game.isShipVisibleTo === 'function') {
                          isVisible = game.isShipVisibleTo(other, this.owner);
                        }
                        if (!isVisible) continue;
                        const edx = other.x - tx;
                        const edy = other.y - ty;
                        const distSq = edx * edx + edy * edy;
                        if (distSq < minEnemyDistSq) {
                          minEnemyDistSq = distSq;
                        }
                      }
                    }
                  }
                }
                
                if (!strictSafe || minEnemyDistSq >= minEnemyDistReq * minEnemyDistReq) {
                  if (minEnemyDistSq > maxMinEnemyDistSq) {
                    maxMinEnemyDistSq = minEnemyDistSq;
                    bestLoc = { x: tx, y: ty };
                  }
                }
              }
              return bestLoc;
            };

            // First pass: try safe gravity wells
            let wells = [];
            for (const p of friendlyPlanets) {
              const loc = findSafeLocInWell(p, 150, true);
              if (loc) {
                const dx = loc.x - this.x;
                const dy = loc.y - this.y;
                wells.push({
                  type: 'planet',
                  planet: p,
                  x: loc.x,
                  y: loc.y,
                  distSq: dx * dx + dy * dy
                });
              }
            }

            // Fallback: if no strictly safe wells found, try unsafe wells
            if (wells.length === 0) {
              for (const p of friendlyPlanets) {
                const loc = findSafeLocInWell(p, 0, false) || { x: p.x, y: p.y };
                const dx = loc.x - this.x;
                const dy = loc.y - this.y;
                wells.push({
                  type: 'planet',
                  planet: p,
                  x: loc.x,
                  y: loc.y,
                  distSq: dx * dx + dy * dy
                });
              }
            }

            candidates.push(...wells);
          }

          // 3. Choose the closest candidate refueling source
          if (candidates.length > 0) {
            candidates.sort((a, b) => a.distSq - b.distSq);
            const best = candidates[0];
            if (best.type === 'ship') {
              this.targetPlanet = null;
              this.scoutFuelRetreatTargetShipId = best.ship.id;
              this.scoutFuelRetreatTargetPlanetId = null;
              this.targetX = best.x;
              this.targetY = best.y;
            } else {
              this.targetPlanet = null;
              this.scoutFuelRetreatTargetPlanetId = best.planet.id;
              this.scoutFuelRetreatTargetShipId = null;
              this.targetX = best.x;
              this.targetY = best.y;
            }
            this.cruiserTargetType = null;
            this.cruiserTargetId = null;
          } else {
            // Absolute fallback: if no candidate planets/ships exist, hold position
            this.targetPlanet = null;
            this.scoutFuelRetreatTargetPlanetId = null;
            this.scoutFuelRetreatTargetShipId = null;
          }
        }
      } else {
        // Active Scouting (Not retreating)
        this.scoutFuelRetreating = false;
        this.scoutFuelRetreatTargetPlanetId = null;
        this.scoutFuelRetreatTargetShipId = null;
        this.targetPlanet = null;

        // A. Attack / Engage Logic vs Flee Logic
        let enemyNearby = null;
        let closestEnemyDistSq = Infinity;
        if (allShips) {
          for (const other of allShips) {
            if (other.active && other.id !== this.id) {
              const isEnemy = (other.owner && other.owner.id !== this.owner.id) || other.isAmoeba;
              if (isEnemy) {
                let isVisible = true;
                if (game && typeof game.isShipVisibleTo === 'function') {
                  isVisible = game.isShipVisibleTo(other, this.owner);
                }
                if (!isVisible) continue;
                const dx = other.x - this.x;
                const dy = other.y - this.y;
                const distSq = dx * dx + dy * dy;
                const detectionRange = (this.scoutAttackEnabled === true) ? 500 : 300;
                if (distSq <= detectionRange * detectionRange && distSq < closestEnemyDistSq) {
                  closestEnemyDistSq = distSq;
                  enemyNearby = other;
                }
              }
            }
          }
        }

        if (enemyNearby) {
          if ((this.scoutAttackEnabled === true) && this.bombs > 0) {
            // ENGAGE: Lock onto the closest enemy unit
            this.cruiserTargetType = 'ship';
            this.cruiserTargetId = enemyNearby.id;
            this.targetX = enemyNearby.x;
            this.targetY = enemyNearby.y;
            this.targetPlanet = null;
          } else {
            // FLEE: Avoid enemy units within 300px
            // Sum threat vectors of all enemies within 300px to escape in the exact opposite direction
            let sumDx = 0;
            let sumDy = 0;
            let count = 0;
            if (allShips) {
              for (const other of allShips) {
                if (other.active && other.id !== this.id) {
                  const isEnemy = (other.owner && other.owner.id !== this.owner.id) || other.isAmoeba;
                  if (isEnemy) {
                    let isVisible = true;
                    if (game && typeof game.isShipVisibleTo === 'function') {
                      isVisible = game.isShipVisibleTo(other, this.owner);
                    }
                    if (!isVisible) continue;
                    const dx = other.x - this.x;
                    const dy = other.y - this.y;
                    if (dx * dx + dy * dy <= 300 * 300) {
                      sumDx += dx;
                      sumDy += dy;
                      count++;
                    }
                  }
                }
              }
            }

            if (count > 0) {
              const avgDx = sumDx / count;
              const avgDy = sumDy / count;
              const escapeAngle = Math.atan2(-avgDy, -avgDx); // Point away from average threat
              this.targetPlanet = null;
              this.targetX = this.x + Math.cos(escapeAngle) * 200;
              this.targetY = this.y + Math.sin(escapeAngle) * 200;
              this.cruiserTargetType = null;
              this.cruiserTargetId = null;
              this.scoutTargetX = null; // force recalculating scout target once threat is cleared
              this.scoutTargetY = null;
            }
          }
        } else {
          // B. Normal Scouting movement (No threat nearby)
          let needNewTarget = this.targetX === null || this.targetY === null || this.scoutTargetX === null || this.scoutTargetY === null;
          
          // Invalidate target if it drifts inside an active ion storm or minefield
          if (this.scoutTargetX !== null && this.scoutTargetY !== null) {
            if (isCellInStorm(this.scoutTargetX, this.scoutTargetY)) {
              needNewTarget = true;
            }
          }

          if (!needNewTarget) {
            const dx = this.scoutTargetX - this.x;
            const dy = this.scoutTargetY - this.y;
            if (dx * dx + dy * dy < 20 * 20) {
              needNewTarget = true;
            } else {
              this.targetX = this.scoutTargetX;
              this.targetY = this.scoutTargetY;
              this.targetPlanet = null;
            }
          }

          if (needNewTarget) {
            const cellSize = 100;
            const numCells = Math.ceil(mapWidth / cellSize);
            const candidates = [];
            const now = Date.now();
            const fiveMinutesAgo = now - 300000;

            for (let cx = 0; cx < numCells; cx++) {
              for (let cy = 0; cy < numCells; cy++) {
                const key = `${this.owner.id}_${cx}_${cy}`;
                const lastExplored = (game && game.exploredGrid && game.exploredGrid[key]) || 0;
                candidates.push({ cx, cy, lastExplored });
              }
            }

            // Claiming mechanic: identify cells currently targeted by other friendly scouts
            const claimedCells = new Set();
            if (allShips) {
              for (const other of allShips) {
                if (other.active && other.id !== this.id && other.owner && this.owner && other.owner.id === this.owner.id && other.isScouting && other.scoutTargetX !== null && other.scoutTargetY !== null) {
                  const ccx = Math.floor(other.scoutTargetX / cellSize);
                  const ccy = Math.floor(other.scoutTargetY / cellSize);
                  claimedCells.add(`${ccx}_${ccy}`);
                }
              }
            }

            // Filter for unexplored AND safe from storms/minefields AND unclaimed
            let eligible = candidates.filter(c => {
              const tx = c.cx * cellSize + cellSize / 2;
              const ty = c.cy * cellSize + cellSize / 2;
              const isClaimed = claimedCells.has(`${c.cx}_${c.cy}`);
              return !isClaimed && c.lastExplored < fiveMinutesAgo && !isCellInStorm(tx, ty);
            });

            // Claim fallback: if no unclaimed cells are eligible, allow claimed ones
            if (eligible.length === 0) {
              eligible = candidates.filter(c => {
                const tx = c.cx * cellSize + cellSize / 2;
                const ty = c.cy * cellSize + cellSize / 2;
                return c.lastExplored < fiveMinutesAgo && !isCellInStorm(tx, ty);
              });
            }
            
            let targetCell = null;

            if (eligible.length > 0) {
              const friendlyPlanets = allPlanets ? allPlanets.filter(p => p.owner && p.owner.id === this.owner.id) : [];

              // Find the nearest friendly planet to the scout
              let nearestFriendlyPlanet = null;
              let minPlanetDistSq = Infinity;
              for (const p of friendlyPlanets) {
                const dx = p.x - this.x;
                const dy = p.y - this.y;
                const distSq = dx * dx + dy * dy;
                if (distSq < minPlanetDistSq) {
                  minPlanetDistSq = distSq;
                  nearestFriendlyPlanet = p;
                }
              }

              eligible.forEach(c => {
                const tx = c.cx * cellSize + cellSize / 2;
                const ty = c.cy * cellSize + cellSize / 2;
                
                // Distance to scout
                const dxScout = tx - this.x;
                const dyScout = ty - this.y;
                c.distToScout = Math.sqrt(dxScout * dxScout + dyScout * dyScout);

                // Distance to nearest friendly planet from scout
                if (nearestFriendlyPlanet) {
                  const dxPlanet = tx - nearestFriendlyPlanet.x;
                  const dyPlanet = ty - nearestFriendlyPlanet.y;
                  c.distToPlanet = Math.sqrt(dxPlanet * dxPlanet + dyPlanet * dyPlanet);
                } else {
                  c.distToPlanet = 0;
                }

                const neverExplored = c.lastExplored === 0;
                c.penalty = neverExplored ? 0 : 1500 * 1500;
              });

              // Sort by composite criteria:
              // 1. Exploration penalty (never explored first)
              // 2. Closest to himself (scout) - binned by cell size so secondary sorting can break ties
              // 3. Closest to the nearest friendly planet from himself
              eligible.sort((a, b) => {
                if (a.penalty !== b.penalty) {
                  return a.penalty - b.penalty;
                }
                const binA = Math.floor(a.distToScout / cellSize);
                const binB = Math.floor(b.distToScout / cellSize);
                if (binA !== binB) {
                  return binA - binB;
                }
                return a.distToPlanet - b.distToPlanet;
              });
              
              // No randomization - pick the absolute best candidate!
              targetCell = eligible[0];
            } else {
              // Fall back to oldest explored cells that are safe from storms (and unclaimed if possible)
              let noStormCandidates = candidates.filter(c => {
                const tx = c.cx * cellSize + cellSize / 2;
                const ty = c.cy * cellSize + cellSize / 2;
                const isClaimed = claimedCells.has(`${c.cx}_${c.cy}`);
                return !isClaimed && !isCellInStorm(tx, ty);
              });

              if (noStormCandidates.length === 0) {
                noStormCandidates = candidates.filter(c => {
                  const tx = c.cx * cellSize + cellSize / 2;
                  const ty = c.cy * cellSize + cellSize / 2;
                  return !isCellInStorm(tx, ty);
                });
              }

              if (noStormCandidates.length > 0) {
                // Find nearest friendly planet
                let nearestFriendlyPlanet = null;
                let minPlanetDistSq = Infinity;
                if (allPlanets) {
                  const friendlyPlanets = allPlanets.filter(p => p.owner && p.owner.id === this.owner.id);
                  for (const p of friendlyPlanets) {
                    const dx = p.x - this.x;
                    const dy = p.y - this.y;
                    const distSq = dx * dx + dy * dy;
                    if (distSq < minPlanetDistSq) {
                      minPlanetDistSq = distSq;
                      nearestFriendlyPlanet = p;
                    }
                  }
                }

                noStormCandidates.forEach(c => {
                  const tx = c.cx * cellSize + cellSize / 2;
                  const ty = c.cy * cellSize + cellSize / 2;
                  const dx = tx - this.x;
                  const dy = ty - this.y;
                  c.distToScout = Math.sqrt(dx * dx + dy * dy);
                  if (nearestFriendlyPlanet) {
                    const dxPlanet = tx - nearestFriendlyPlanet.x;
                    const dyPlanet = ty - nearestFriendlyPlanet.y;
                    c.distToPlanet = Math.sqrt(dxPlanet * dxPlanet + dyPlanet * dyPlanet);
                  } else {
                    c.distToPlanet = 0;
                  }
                });

                noStormCandidates.sort((a, b) => {
                  if (a.lastExplored !== b.lastExplored) {
                    return a.lastExplored - b.lastExplored;
                  }
                  const binA = Math.floor(a.distToScout / cellSize);
                  const binB = Math.floor(b.distToScout / cellSize);
                  if (binA !== binB) {
                    return binA - binB;
                  }
                  return a.distToPlanet - b.distToPlanet;
                });
                targetCell = noStormCandidates[0];
              } else {
                // Ultimate fallback
                candidates.sort((a, b) => a.lastExplored - b.lastExplored);
                targetCell = candidates[0];
              }
            }

            if (targetCell) {
              const tx = targetCell.cx * cellSize + cellSize / 2;
              const ty = targetCell.cy * cellSize + cellSize / 2;
              this.targetPlanet = null;
              this.targetX = tx;
              this.targetY = ty;
              this.scoutTargetX = tx;
              this.scoutTargetY = ty;
              this.cruiserTargetType = null;
              this.cruiserTargetId = null;
            }
          }
        }
      }
    }

    // Cruiser Research Mode Decision Engine
    if (this.maxHealth > 0 && !this.isAmoeba && this.owner && !this.owner.isMonster && this.owner.id !== 'monsters' && this.isResearching && this.labs > 0 && !this.isRetreating) {
      // Disabled: Do not automatically give move orders to researching ships.
    }



    // Cruiser Bombard Mode Decision Engine (Disabled)
    this.bombardRearming = false;
    this.bombardRearmTargetPlanetId = null;
    
    if (this.maxHealth > 0 && !this.isAmoeba && !this.cruiserTargetType) {
      this.isSniperKiting = false;
      this.sniperKiteX = null;
      this.sniperKiteY = null;
    }
    
    // Cruiser Target Lock State Machine
    if (this.maxHealth > 0 && !this.isAmoeba && this.cruiserTargetType) {
      let targetObj = null;
      let isPlanet = false;
      let tx = 0;
      let ty = 0;
      
      if (this.cruiserTargetType === 'planet') {
        targetObj = allPlanets ? allPlanets.find(p => p.id === this.cruiserTargetId) : null;
        isPlanet = true;
        if (targetObj) {
          tx = this.cruiserTargetClickX !== null && this.cruiserTargetClickX !== undefined ? this.cruiserTargetClickX : targetObj.x;
          ty = this.cruiserTargetClickY !== null && this.cruiserTargetClickY !== undefined ? this.cruiserTargetClickY : targetObj.y;
        }
      } else if (this.cruiserTargetType === 'ship') {
        targetObj = allShips ? allShips.find(s => s.id === this.cruiserTargetId) : null;
        isPlanet = false;
        if (targetObj) {
          tx = targetObj.x;
          ty = targetObj.y;
        }
      }
      
      if (targetObj && targetObj.active !== false && (!isPlanet || (targetObj.owner && this.owner && targetObj.owner.id === this.owner.id) || (targetObj.owner && (!this.owner || targetObj.owner.id !== this.owner.id) && this.canSeeStats(targetObj, allPlanets, allShips, game)) || (!targetObj.owner && this.canSeeStats(targetObj, allPlanets, allShips, game)))) {
        // Target is valid! Calculate distance
        const tdx = tx - this.x;
        const tdy = ty - this.y;
        const dist = Math.sqrt(tdx * tdx + tdy * tdy);
        
        // Calculate angle to target
        const targetAngle = Math.atan2(tdy, tdx);
        let diff = targetAngle - (this.angle || 0);
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;
        
        // Stop range check: just inside the max firing range in the front firing arc
        const maxFrontRange = (effectiveRange * 1.3) + (isPlanet ? targetObj.radius : 0);
        const isTargetInFront = (Math.abs(diff) <= Math.PI / 4);
        
        if (isPlanet) {
          const isOwnPlanet = !!(targetObj.owner && this.owner && targetObj.owner.id === this.owner.id);
          let stopDist = isOwnPlanet ? (targetObj.radius + 20) : ((effectiveRange + targetObj.radius) * 0.5);
          if (this.isPatrolling && this.bombs > 0 && this.package === 'brute') {
            stopDist = targetObj.radius + 15;
          }
          if (dist <= stopDist + 2) {
            // Already close enough! Stop moving
            this.targetX = this.x;
            this.targetY = this.y;
            this.targetPlanet = null;
          } else {
            // Move to stopDist from the planet
            const angle = Math.atan2(tdy, tdx);
            this.targetX = targetObj.x - Math.cos(angle) * stopDist;
            this.targetY = targetObj.y - Math.sin(angle) * stopDist;
            this.targetPlanet = null;
          }
        } else {
          // Ship target
          const isMonsterEnemy = targetObj.owner && (targetObj.owner.id === 'monsters' || targetObj.owner.isMonster);
          const enemyHealth = targetObj.maxHealth > 0 ? targetObj.health : targetObj.count;
          const sensorRange = this.cruiserRadarRange ? this.cruiserRadarRange() : 150;
          const isResearchMovement = isMonsterEnemy &&
                                     enemyHealth < 4 &&
                                     this.health > this.maxHealth * 0.5 &&
                                     (this.labs || 0) > 0 &&
                                     dist > sensorRange;

          if (isResearchMovement) {
            // Move within sensor range of the target
            this.targetX = tx;
            this.targetY = ty;
            this.targetPlanet = null;
          } else if (this.isSniperKiting) {
            const distToKite = Math.sqrt((this.x - this.sniperKiteX) * (this.x - this.sniperKiteX) + (this.y - this.sniperKiteY) * (this.y - this.sniperKiteY));
            if (distToKite < 10) {
              this.isSniperKiting = false;
              this.sniperKiteX = null;
              this.sniperKiteY = null;
              
              // Recalculate target position immediately to avoid 1-tick delay
              this.targetX = tx;
              this.targetY = ty;
              this.targetPlanet = null;
            } else {
              this.targetX = this.sniperKiteX;
              this.targetY = this.sniperKiteY;
              this.targetPlanet = null;
            }
          } else if (this.package === 'sniper' && dist < maxFrontRange * 0.5 && (targetObj.maxHealth > 0 ? (targetObj.health > targetObj.maxHealth * 0.75) : true)) {
            this.isSniperKiting = true;
            const angle = Math.atan2(tdy, tdx);
            this.sniperKiteX = this.x - Math.cos(angle) * 100;
            this.sniperKiteY = this.y - Math.sin(angle) * 100;
            this.targetX = this.sniperKiteX;
            this.targetY = this.sniperKiteY;
            this.targetPlanet = null;
          } else if (this.package === 'sniper' && dist < maxFrontRange * 0.4) {
            // Fallback standard kiting for low health enemies if they get even closer (within 40%)
            const angle = Math.atan2(tdy, tdx);
            this.targetX = this.x - Math.cos(angle) * 100;
            this.targetY = this.y - Math.sin(angle) * 100;
            this.targetPlanet = null;
          } else {
            // Determine strength and close-in decision
            const cruiserStrength = this.health + (this.armorPoints || 0);
            let enemyTargetStrength = targetObj.isAmoeba 
              ? ((Math.floor(targetObj.health) + (targetObj.maxHealth * (targetObj.maxHealth - 1)) / 2) * 2)
              : (targetObj.maxHealth > 0 ? (targetObj.health + (targetObj.armorPoints || 0)) : (targetObj.count || 1));
            
            let totalEnemyStrength = enemyTargetStrength;
            if (allShips) {
              for (const other of allShips) {
                if (other.active && other.id !== this.id && other.id !== targetObj.id && other.owner && other.owner.id !== this.owner.id) {
                  const dx = other.x - this.x;
                  const dy = other.y - this.y;
                  if (dx * dx + dy * dy <= 400 * 400) {
                    const otherStrength = other.isAmoeba 
                      ? ((Math.floor(other.health) + (other.maxHealth * (other.maxHealth - 1)) / 2) * 2)
                      : (other.maxHealth > 0 ? (other.health + (other.armorPoints || 0)) : (other.count || 1));
                    totalEnemyStrength += otherStrength;
                  }
                }
              }
            }

            let shouldCloseIn = false;
            if (this.package === 'brute') {
              shouldCloseIn = (enemyTargetStrength <= cruiserStrength * 1.5);
            } else {
              shouldCloseIn = (totalEnemyStrength < cruiserStrength);
            }

            if (shouldCloseIn) {
              // Close in to 15px range for the kill
              if (dist <= 15) {
                this.targetX = this.x;
                this.targetY = this.y;
                this.targetPlanet = null;
              } else {
                this.targetX = tx;
                this.targetY = ty;
                this.targetPlanet = null;
              }
            } else {
              // Stay at range
              if (this.isPatrolling && this.bombs > 0) {
                let strategyThreshold = 0.75; // Normal default
                if (this.strategy === 'short') {
                  strategyThreshold = 0.50;
                } else if (this.strategy === 'long') {
                  strategyThreshold = 1.00;
                }
                const bombEngagementRange = Math.max(15, (maxFrontRange * strategyThreshold) - 15);
                
                if (dist <= bombEngagementRange && isTargetInFront && this.package !== 'sniper') {
                  this.targetX = this.x;
                  this.targetY = this.y;
                  this.targetPlanet = null;
                } else {
                  const angle = Math.atan2(tdy, tdx);
                  this.targetX = targetObj.x - Math.cos(angle) * bombEngagementRange;
                  this.targetY = targetObj.y - Math.sin(angle) * bombEngagementRange;
                  this.targetPlanet = null;
                }
              } else {
                // Standard non-bomb or non-patrolling movement
                if (isTargetInFront && dist <= maxFrontRange - 5) {
                  this.targetX = this.x;
                  this.targetY = this.y;
                  this.targetPlanet = null;
                } else {
                  this.targetX = tx;
                  this.targetY = ty;
                  this.targetPlanet = null;
                }
              }
            }
          }
        }
      } else {
        // Target was conquered/destroyed or doesn't exist anymore! Stop moving
        this.cruiserTargetType = null;
        this.cruiserTargetId = null;
        this.isSniperKiting = false;
        this.sniperKiteX = null;
        this.sniperKiteY = null;
        this.targetX = this.x;
        this.targetY = this.y;
        this.targetPlanet = null;
        this.executeNextOrder(allPlanets, allShips, game);
      }
    }

    if (this.isMarineFleet && this.targetShipId) {
      const target = allShips ? allShips.find(s => s.id === this.targetShipId && s.active) : null;
      if (target) {
        this.targetX = target.x;
        this.targetY = target.y;
        this.targetPlanet = null;
        
        if (!target.isAmoeba) {
          const tdx = target.x - this.x;
          const tdy = target.y - this.y;
          const dist = Math.sqrt(tdx * tdx + tdy * tdy);

          if (target.isCruiser && target.health >= 2) {
            // Acts like a fighter squadron targeting a healthy cruiser!
            if (dist <= 50) {
              this.damageAccumulator = (this.damageAccumulator || 0) + (deltaTime / 1000);
              if (this.damageAccumulator >= 0.5) {
                this.damageAccumulator -= 0.5;
                const hitsCount = Math.max(1, Math.floor((this.count / 10) * (1 + (this.expScore || 0) / 100)));
                for (let i = 0; i < hitsCount; i++) {
                  target.takeDamage(explosions, this, false, 'side', 0);
                }
                this.count = Math.max(0, this.count - 0.5);
                if (this.count <= 0) {
                  this.active = false;
                }
                if (explosions && Math.random() < 0.3) {
                  explosions.push({
                    x: target.x + (Math.random() - 0.5) * 30,
                    y: target.y + (Math.random() - 0.5) * 30,
                    color: this.owner ? this.owner.color : '#fff',
                    age: 0
                  });
                }
              }
            }
            return;
          }

          if (dist < 15) {
            if (!target.boardingCooldown || target.boardingCooldown <= 0) {
              // Trigger boarding on target ship!
              target.isUnderBoarding = true;
              target.boardingPlayer = this.owner;
              target.boardingMarines = (target.boardingMarines || 0) + this.count;
              target.boardingSourceId = this.sourceShipId;
              target.boardingCooldown = 60.0;
              console.log(`[MARINE FLEET BOARDING IMPACT] Marine fleet collided with target ship ${target.id}, boarding with ${this.count} marines.`);
            } else {
              console.log(`[MARINE FLEET BOARDING REJECTED] Marine fleet collided with target ship ${target.id}, but target is on boarding cooldown.`);
            }
            this.active = false; // consume marine fleet
            
            if (explosions) {
              explosions.push({
                x: this.x,
                y: this.y,
                color: this.owner ? this.owner.color : '#fff',
                age: 0
              });
            }
            return;
          }
        }
      } else {
        // Target is destroyed
        this.active = false;
        return;
      }
    }

    let destX = this.targetPlanet ? (this.targetPlanet.x + (this.cruiserTargetOffsetX || 0)) : (this.targetX !== null ? this.targetX : this.x);
    let destY = this.targetPlanet ? (this.targetPlanet.y + (this.cruiserTargetOffsetY || 0)) : (this.targetY !== null ? this.targetY : this.y);

    const finalDestX = destX + (this.isCruiser ? 0 : (this.isBomber ? this.bomberTargetOffsetX : this.endOffsetX));
    const finalDestY = destY + (this.isCruiser ? 0 : (this.isBomber ? this.bomberTargetOffsetY : this.endOffsetY));

    const totalDx = finalDestX - this.startX;
    const totalDy = finalDestY - this.startY;
    const totalDist = Math.sqrt(totalDx * totalDx + totalDy * totalDy);
    
    const distToTarget = Math.sqrt((finalDestX - this.x)*(finalDestX - this.x) + (finalDestY - this.y)*(finalDestY - this.y));
    const targetHitRadius = this.targetPlanet ? this.targetPlanet.radius : 5;
    let progress = 1;
    if (totalDist > targetHitRadius) {
      progress = Math.max(0, Math.min(1, 1 - ((distToTarget - targetHitRadius) / (totalDist - targetHitRadius))));
    }
    
    let spreadFactor;
    if (this.isBomber) {
      spreadFactor = 4 * progress * (1 - progress);
    } else {
      if (progress < 0.333) {
        spreadFactor = Math.sin((progress / 0.333) * (Math.PI / 2));
      } else {
        const remaining = (progress - 0.333) / 0.667;
        spreadFactor = Math.cos(remaining * (Math.PI / 2));
      }
    }
    
    const px = -totalDy / (totalDist || 1);
    const py = totalDx / (totalDist || 1);

    destX = finalDestX + px * (this.bomberOffsetMag || 0) * spreadFactor;
    destY = finalDestY + py * (this.bomberOffsetMag || 0) * spreadFactor;
    
    const dx = destX - this.x;
    const dy = destY - this.y;
    let moveDistanceToDest = Math.sqrt(dx * dx + dy * dy);
    
    // For collision detection, we use actual distance to target planet center (or coordinate target)
    const baseTargetDx = finalDestX - this.x;
    const baseTargetDy = finalDestY - this.y;
    let distance = Math.sqrt(baseTargetDx * baseTargetDx + baseTargetDy * baseTargetDy);

    if (this.isCruiser && !this.isUpgrading) {
      if (this.orderQueue && this.orderQueue.length > 0) {
        let shouldPopNext = false;
        if (!this.cruiserTargetType) {
          if (this.targetPlanet) {
            const isFriendly = this.targetPlanet.owner && this.owner && this.targetPlanet.owner.id === this.owner.id;
            if (isFriendly && distance < this.targetPlanet.radius + 45) {
              shouldPopNext = true;
            }
          } else {
            if (moveDistanceToDest < 15) {
              shouldPopNext = true;
            }
          }
        }
        if (shouldPopNext) {
          this.executeNextOrder(allPlanets, allShips, game);
          destX = this.targetPlanet ? (this.targetPlanet.x + (this.cruiserTargetOffsetX || 0)) : this.targetX;
          destY = this.targetPlanet ? (this.targetPlanet.y + (this.cruiserTargetOffsetY || 0)) : this.targetY;
          const newDx = destX - this.x;
          const newDy = destY - this.y;
          moveDistanceToDest = Math.sqrt(newDx * newDx + newDy * newDy);
          
          const newFinalDestX = destX + (this.isCruiser ? 0 : (this.isBomber ? this.bomberTargetOffsetX : this.endOffsetX));
          const newFinalDestY = destY + (this.isCruiser ? 0 : (this.isBomber ? this.bomberTargetOffsetY : this.endOffsetY));
          const newBaseTargetDx = newFinalDestX - this.x;
          const newBaseTargetDy = newFinalDestY - this.y;
          distance = Math.sqrt(newBaseTargetDx * newBaseTargetDx + newBaseTargetDy * newBaseTargetDy);
        }
      } else {
        if (!this.cruiserTargetType && !this.targetPlanet && this.targetX !== null && this.targetY !== null) {
          if (moveDistanceToDest < 15) {
            this.targetX = null;
            this.targetY = null;
            moveDistanceToDest = 0;
          }
        }
      }
    }
    
    if (moveDistanceToDest > 0) {
      let desiredAngle = Math.atan2(dy, dx);
      if (this.isCruiser && !this.isUpgrading) {
        let targetObj = null;
        if (this.targetPlanet) {
          targetObj = this.targetPlanet;
        } else if (this.cruiserTargetType === 'planet' && this.cruiserTargetId) {
          targetObj = allPlanets ? allPlanets.find(p => p.id === this.cruiserTargetId) : null;
        } else if (this.cruiserTargetType === 'ship' && this.cruiserTargetId) {
          targetObj = allShips ? allShips.find(s => s.id === this.cruiserTargetId) : null;
        }
        
        if (targetObj && targetObj.active !== false && targetObj.owner !== this.owner) {
          const targetAngle = Math.atan2(targetObj.y - this.y, targetObj.x - this.x);
          let angleDiff = desiredAngle - targetAngle;
          while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
          while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
          
          if (Math.abs(angleDiff) > Math.PI / 2) {
            this.isMovingBackward = true;
            desiredAngle = targetAngle;
          }
        }
      }

      if (this.isAmoeba) {
        this.angle = desiredAngle;
      } else {
        const turnRateDeg = this.isCruiser ? Math.max(15, 60 - (this.maxHealth || 0) + (this.engine || 0) * 3) : 60;
        const turnRateRad = turnRateDeg * Math.PI / 180;
        const maxRotation = turnRateRad * (deltaTime / 1000);

        let diff = desiredAngle - this.angle;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;

        if (Math.abs(diff) <= maxRotation) {
          this.angle = desiredAngle;
        } else {
          this.angle += Math.sign(diff) * maxRotation;
        }
      }
    }

    // Cosmetic lasers back and forth between attacking ship and defending planet
    if (this.targetPlanet && this.targetPlanet.owner && this.targetPlanet.owner !== this.owner && distance < this.targetPlanet.radius + 40) {
      if (Math.random() < 0.5 * (deltaTime / 1000)) { // 50% chance per sec from planet to ship
        if (lasers) {
          lasers.push({
            startX: this.targetPlanet.x,
            startY: this.targetPlanet.y,
            endX: this.x,
            endY: this.y,
            color: this.targetPlanet.owner.color,
            age: 0,
            duration: 0.8,
            targetId: this.id,
            targetCount: this.count || 1,
            targetAngle: this.angle || 0,
            targetFormation: this.formation || 'arrow',
            targetIsCruiser: this.isCruiser || false,
            targetIsAmoeba: this.isAmoeba || false,
            targetIsBomber: this.isBomber || false,
            targetMaxHealth: this.maxHealth,
            sourceIsPlanet: true,
            cruiserStyle: this.targetPlanet.owner ? this.targetPlanet.owner.cruiserStyle : null,
            index: 0
          });
        }
      }
      if (Math.random() < 0.5 * (deltaTime / 1000)) { // 50% chance per sec from ship to planet
        if (lasers) {
          const startPt = this.getLaserStartPoint();
          let startX = startPt.startX;
          let startY = startPt.startY;
          lasers.push({
            startX: startX,
            startY: startY,
            endX: this.targetPlanet.x,
            endY: this.targetPlanet.y,
            color: this.owner ? this.owner.color : (this.isAmoeba ? 'amoeba' : '#fff'),
            age: 0,
            duration: 0.8,
            isAmoebaAttack: !!this.isAmoeba,
            sourceId: this.id,
            sourceCount: this.count || 1,
            sourceAngle: this.angle || 0,
            sourceFormation: this.formation || 'arrow',
            sourceIsCruiser: this.isCruiser || false,
            sourceIsAmoeba: this.isAmoeba || false,
            sourceIsBomber: this.isBomber || false,
            sourceMaxHealth: this.maxHealth,
            targetIsPlanet: true,
            cruiserStyle: this.owner ? this.owner.cruiserStyle : null,
            index: 0
          });
        }
      }
    }

    if (this.maxHealth > 0 && !this.isAmoeba) {
      this.activeSupplySourceId = null;
      this.activeSupplySourceType = null;
      this.activeFuelDonorId = null;
      this.crew = Math.min(this.crew || 0, this.maxHealth + this.health);
      if (this.fuel < this.maxHealth && allShips) {
        const sensorRange = this.cruiserRadarRange();
        const rangeSq = sensorRange * sensorRange;
        const candidateOthers = (typeof allShips.getShipsInRadiusSq === 'function')
          ? allShips.getShipsInRadiusSq(this.x, this.y, rangeSq)
          : allShips;

        for (const other of candidateOthers) {
          if (other.active && other.maxHealth > 0 && !other.isAmoeba && other.id !== this.id && other.owner && this.owner && other.owner.id === this.owner.id) {
            let canDonate = false;
            if (this.fuel <= 0 && other.fuel > 1) {
              canDonate = true;
            } else if (this.fuel > 0 && other.fuel > other.maxHealth) {
              canDonate = true;
            }

            if (canDonate) {
              const dx = other.x - this.x;
              const dy = other.y - this.y;
              const dist = Math.sqrt(dx * dx + dy * dy);
              if (dist <= sensorRange) {
                const donorSpecial = other.specialfuel || 0;
                const donorFuel = other.fuel || 0;
                other.fuel -= 1;
                this.fuel += 1;
                if (donorSpecial >= donorFuel) {
                  const specTransfer = Math.min(donorSpecial, 1);
                  other.specialfuel = Math.max(0, donorSpecial - specTransfer);
                  this.specialfuel = (this.specialfuel || 0) + specTransfer;
                }
                this.activeFuelDonorId = other.id;
                break;
              }
            }
          }
        }
      }

      if (this.bombs === undefined) {
        this.bombs = this.getMaxBombs();
        this.bombReloadTimer = 0;
      }
      if (this.bombReloadTimer === undefined) {
        this.bombReloadTimer = 0;
      }
      
      // Don't convert fuel to munitions.
      
      // Load supplies if in friendly gravity well, up to maxsupplies, 1 every 5 seconds, only if not near enemies.
      let hasEnemyNear = false;
      if (allShips && this.owner) {
        const candidateShips = (typeof allShips.getShipsInRadiusSq === 'function')
          ? allShips.getShipsInRadiusSq(this.x, this.y, 200 * 200)
          : allShips;
        for (const other of candidateShips) {
          if (other.active && other.id !== this.id) {
            const isEnemy = (other.owner && other.owner.id !== this.owner.id) || other.isAmoeba;
            if (isEnemy) {
              const dx = other.x - this.x;
              const dy = other.y - this.y;
              if (dx * dx + dy * dy < 200 * 200) {
                hasEnemyNear = true;
                break;
              }
            }
          }
        }
      }

      const canResupply = this.inFriendlyWell || (neutralWellPlanet && (neutralWellPlanet.supplies || 0) >= 1.0);
      if (this.maxsupplies > 0 && this.supplies < this.maxsupplies && canResupply && !this.isWarp && !hasEnemyNear) {
        const planetSource = friendlyWellPlanet || neutralWellPlanet;
        if (planetSource && (planetSource.supplies || 0) >= 1.0) {
          const owner = this.owner;
          const discount = (this.supply_ship || 0) > 0 ? (0.25 + 0.10 * this.supply_ship) : 0;
          const costMultiplier = Math.max(0, 1.0 - discount);
          
          let canAfford = false;
          if (friendlyWellPlanet) {
            if (owner && owner.useCredits !== false) {
              const costCredits = 1.0 * costMultiplier;
              const minAllowedCredits = allPlanets && owner ? (allPlanets.some(p => p.homeworldOf === owner.id && p.owner && p.owner.id === owner.id) ? -(1000 + Math.floor(owner.totalShips || 0)) : 0) : 0;
              if ((owner.credits || 0) - costCredits >= minAllowedCredits) {
                canAfford = true;
              }
            } else if (friendlyWellPlanet.ships >= 1.0 * costMultiplier) {
              canAfford = true;
            }
          } else if (neutralWellPlanet) {
            const costCredits = 2.0 * costMultiplier;
            const minAllowedCredits = allPlanets && owner ? (allPlanets.some(p => p.homeworldOf === owner.id && p.owner && p.owner.id === owner.id) ? -(1000 + Math.floor(owner.totalShips || 0)) : 0) : 0;
            if (owner && (owner.credits || 0) - costCredits >= minAllowedCredits) {
              canAfford = true;
            }
          }

          if (canAfford) {
            this.activeSupplySourceId = planetSource.id;
            this.activeSupplySourceType = 'planet';
          }
        }
        this.supplyLoadAccumulator = (this.supplyLoadAccumulator || 0) + deltaTime;
        while (this.supplyLoadAccumulator >= 5000 && this.supplies < this.maxsupplies) {
          const owner = this.owner;
          if (owner) {
            const discount = (this.supply_ship || 0) > 0 ? (0.25 + 0.10 * this.supply_ship) : 0;
            const costMultiplier = Math.max(0, 1.0 - discount);
            let loaded = false;

            let canAffordResupply = false;
            let purchaseFromNeutral = false;

            const minAllowedCredits = allPlanets && owner ? (allPlanets.some(p => p.homeworldOf === owner.id && p.owner && p.owner.id === owner.id) ? -(1000 + Math.floor(owner.totalShips || 0)) : 0) : 0;

            if (friendlyWellPlanet && (friendlyWellPlanet.supplies || 0) >= 1.0) {
              if (owner.useCredits !== false) {
                const costCredits = 1.0 * costMultiplier;
                if ((owner.credits || 0) - costCredits >= minAllowedCredits) {
                  canAffordResupply = true;
                }
              } else if (friendlyWellPlanet.ships >= 1.0 * costMultiplier) {
                canAffordResupply = true;
              }
            } else if (neutralWellPlanet && (neutralWellPlanet.supplies || 0) >= 1.0) {
              const costCredits = 2.0 * costMultiplier;
              if ((owner.credits || 0) - costCredits >= minAllowedCredits) {
                canAffordResupply = true;
                purchaseFromNeutral = true;
              }
            }

            if (canAffordResupply) {
              if (purchaseFromNeutral) {
                neutralWellPlanet.supplies = Math.max(0, neutralWellPlanet.supplies - 1.0);
                const costCredits = 2.0 * costMultiplier;
                owner.credits -= costCredits;
                this.supplies++;
                loaded = true;
              } else {
                friendlyWellPlanet.supplies = Math.max(0, friendlyWellPlanet.supplies - 1.0);
                if (owner.useCredits !== false) {
                  const costCredits = 1.0 * costMultiplier;
                  owner.credits -= costCredits;
                  this.supplies++;
                  loaded = true;
                } else if (friendlyWellPlanet) {
                  const costShips = 1.0 * costMultiplier;
                  friendlyWellPlanet.ships -= costShips;
                  this.supplies++;
                  loaded = true;
                }
              }
            }

            if (loaded) {
              this.supplyLoadAccumulator -= 5000;
            } else {
              break;
            }
          } else {
            break;
          }
        }
      } else {
        this.supplyLoadAccumulator = 0;
      }
      
      const inCombat = this.combatCooldown && this.combatCooldown > 0;
      let finalHealRate = 0;

      if (this.inFriendlyWell && (!inCombat || (this.damagecontrol || 0) > 0)) {
        finalHealRate = 6 * (1 + 0.50 * (this.damagecontrol || 0));
      } else {
        finalHealRate = 6 * (0.20 * (this.damagecontrol || 0));
      }

      if (this.health < this.maxHealth) {
        const owner = this.owner;

        // Check for nearby supply ship first!
        const supplyShip = this.findNearbySupplyShip(allShips);

        // If there is a supply ship and not in combat (or has damage control), allow healing at the full rate even in deep space!
        if (supplyShip && (!inCombat || (this.damagecontrol || 0) > 0)) {
          finalHealRate = Math.max(finalHealRate, 6 * (1 + 0.50 * (this.damagecontrol || 0)));
        }

        let canAffordHeal = false;
        let activeHealSource = null; // 'supplyShip' or 'planet'

        if (supplyShip && (supplyShip.supplies || 0) > 0) {
          canAffordHeal = true;
          activeHealSource = 'supplyShip';
        } else if (friendlyWellPlanet && (friendlyWellPlanet.supplies || 0) > 0) {
          if (owner && owner.useCredits !== false) {
            canAffordHeal = true;
            activeHealSource = 'planet';
          } else if (friendlyWellPlanet.ships > 0) {
            canAffordHeal = true;
            activeHealSource = 'planet';
          }
        }

        if (finalHealRate > 0 && canAffordHeal) {
          let healAmount = (deltaTime / 60000) * finalHealRate;
          
          let suppliesAvailable = 0;
          if (activeHealSource === 'supplyShip') {
            suppliesAvailable = supplyShip.supplies || 0;
          } else if (activeHealSource === 'planet') {
            suppliesAvailable = friendlyWellPlanet.supplies || 0;
          }
          
          healAmount = Math.min(healAmount, suppliesAvailable);

          const oldHealth = this.health || 0;
          this.health = Math.min(this.maxHealth, this.health + healAmount);
          const amountHealed = this.health - oldHealth;
          if (amountHealed > 0) {
            if (activeHealSource === 'supplyShip' && supplyShip !== this) {
              this.activeSupplySourceId = supplyShip.id;
              this.activeSupplySourceType = 'ship';
            } else if (activeHealSource === 'planet' && friendlyWellPlanet) {
              this.activeSupplySourceId = friendlyWellPlanet.id;
              this.activeSupplySourceType = 'planet';
            }
            if (activeHealSource === 'supplyShip') {
              const suppliesUsed = amountHealed;
              if (supplyShip.supplies >= suppliesUsed) {
                supplyShip.supplies -= suppliesUsed;
              } else {
                const remainingHeal = suppliesUsed - supplyShip.supplies;
                supplyShip.supplies = 0;
                if (owner && !owner.isMonster && owner.id !== 'monsters') {
                  if (owner.useCredits !== false) {
                    owner.credits = (owner.credits || 0) - 1.0 * remainingHeal;
                  } else if (friendlyWellPlanet) {
                    friendlyWellPlanet.ships = Math.max(0, friendlyWellPlanet.ships - 1.0 * remainingHeal);
                  }
                }
              }
            } else if (activeHealSource === 'planet') {
              const suppliesUsed = amountHealed;
              friendlyWellPlanet.supplies = Math.max(0, friendlyWellPlanet.supplies - suppliesUsed);
              if (owner && !owner.isMonster && owner.id !== 'monsters') {
                if (owner.useCredits !== false) {
                  owner.credits = (owner.credits || 0) - 1.0 * amountHealed;
                } else if (friendlyWellPlanet) {
                  friendlyWellPlanet.ships = Math.max(0, friendlyWellPlanet.ships - 1.0 * amountHealed);
                }
              }
            }
          }
        }
      }

      let supplyShipForFuel = this.findNearbySupplyShip(allShips, true);
      if (this.supply_ship > 0 && (this.supplies || 0) > 0 && ((this.timeNotMoved || 0) >= 3.0 || this.waitingForSupplyFuelConversion)) {
        supplyShipForFuel = this;
      }
      if (supplyShipForFuel === this) {
        if (this.waitingForSupplyFuelConversion || (this.fuel || 0) <= this.getMaxFuel() - 2) {
          this.isSelfRefueling = true;
        } else if ((this.fuel || 0) >= this.getMaxFuel()) {
          this.isSelfRefueling = false;
        }
        if (!this.isSelfRefueling) {
          supplyShipForFuel = null;
        }
      } else {
        this.isSelfRefueling = false;
      }
      let fuelSourceShip = null;
      if (allShips && this.owner) {
        let closestSource = null;
        let closestDistSq = Infinity;
        const radarRange = this.cruiserRadarRange();
        const radarRangeSq = radarRange * radarRange;
        for (const other of allShips) {
          if (other.active && other.id !== this.id && other.isCruiser && other.owner && other.owner.id === this.owner.id && (other.fuel || 0) > 4 && (other.fuel || 0) > (this.fuel || 0) + 2) {
            const dx = other.x - this.x;
            const dy = other.y - this.y;
            const distSq = dx * dx + dy * dy;
            if (distSq <= radarRangeSq && distSq < closestDistSq) {
              closestDistSq = distSq;
              closestSource = other;
            }
          }
        }
        fuelSourceShip = closestSource;
      }

      if (this.inFriendlyWell || supplyShipForFuel || fuelSourceShip) {
        if (this.armorPoints < this.maxArmor && this.inFriendlyWell && friendlyWellPlanet && (friendlyWellPlanet.supplies || 0) > 0) {
          let armorHealRate = (deltaTime / 60000) * 3;
          let costMultiplier = 0.3;
          if (this.supply_ship && this.supply_ship > 0) {
            costMultiplier = Math.max(0, 0.3 * (1.0 - (0.50 + 0.10 * this.supply_ship)));
          }
          
          const maxArmorFromSupplies = friendlyWellPlanet.supplies / costMultiplier;
          let actualArmorHeal = Math.min(armorHealRate, maxArmorFromSupplies);
          
          const oldArmor = this.armorPoints || 0;
          this.armorPoints = Math.min(this.maxArmor, oldArmor + actualArmorHeal);
          const amountRepaired = this.armorPoints - oldArmor;
          
          if (amountRepaired > 0) {
            this.activeSupplySourceId = friendlyWellPlanet.id;
            this.activeSupplySourceType = 'planet';
            const suppliesUsed = amountRepaired * costMultiplier;
            friendlyWellPlanet.supplies = Math.max(0, friendlyWellPlanet.supplies - suppliesUsed);
          }
        }
        
        // Cruisers don't recover bombs or fuel while in warp
        if (!this.isWarp) {
          const recoveryRate = (this.combatCooldown && this.combatCooldown > 0) ? 0.5 : 1.0;
          const oldFuel = this.fuel || 0;

          const owner = this.owner;
          const canUseRes = !!(this.useResources || (owner && owner.tradeLimitToggle === true));
          const hasExcessDeuterium = canUseRes && owner && owner.resources && (owner.resources.deuterium || 0) >= 0.1;
          const deuteriumSellPrice = owner ? (owner.offerPrice?.deuterium ?? 3) : 3;

          let canAffordRefuel = false;
          let activeFuelSource = null; // 'supplyShip', 'donorShip', or 'planet'

          if (supplyShipForFuel && (supplyShipForFuel.supplies || 0) > 0) {
            canAffordRefuel = true;
            activeFuelSource = 'supplyShip';
          } else if (fuelSourceShip && (fuelSourceShip.fuel || 0) > 4) {
            canAffordRefuel = true;
            activeFuelSource = 'donorShip';
          } else if (friendlyWellPlanet && (friendlyWellPlanet.supplies || 0) > 0) {
            if (owner && (owner.isMonster || owner.id === 'monsters')) {
              canAffordRefuel = true;
              activeFuelSource = 'planet';
            } else if (hasExcessDeuterium && deuteriumSellPrice < 12) {
              canAffordRefuel = true;
              activeFuelSource = 'planet';
            } else if (owner && owner.useCredits !== false) {
              canAffordRefuel = true;
              activeFuelSource = 'planet';
            } else if (friendlyWellPlanet.ships > 0) {
              canAffordRefuel = true;
              activeFuelSource = 'planet';
            }
          }

          if (canAffordRefuel) {
            let fuelToGain = ((deltaTime / 1000) / 10) * recoveryRate;
            let costMultiplier = 1.0;
            if (this.supply_ship && this.supply_ship > 0) {
              costMultiplier = Math.max(0, 1.0 - (0.50 + 0.10 * this.supply_ship));
            }

            if (activeFuelSource === 'supplyShip') {
              const maxFuel = supplyShipForFuel.supplies / costMultiplier;
              fuelToGain = Math.min(fuelToGain, maxFuel);
            } else if (activeFuelSource === 'planet') {
              const maxFuel = friendlyWellPlanet.supplies / costMultiplier;
              fuelToGain = Math.min(fuelToGain, maxFuel);
            }

            this.fuel = Math.min(this.getMaxFuel(), oldFuel + fuelToGain);
            const amountRefueled = (this.fuel || 0) - oldFuel;
            if (amountRefueled > 0) {
              if (activeFuelSource === 'supplyShip' && supplyShipForFuel && supplyShipForFuel !== this) {
                this.activeSupplySourceId = supplyShipForFuel.id;
                this.activeSupplySourceType = 'ship';
              } else if (activeFuelSource === 'planet' && friendlyWellPlanet) {
                this.activeSupplySourceId = friendlyWellPlanet.id;
                this.activeSupplySourceType = 'planet';
              } else if (activeFuelSource === 'donorShip' && fuelSourceShip) {
                this.activeFuelDonorId = fuelSourceShip.id;
              }

              if (activeFuelSource === 'supplyShip') {
                const suppliesUsed = amountRefueled * costMultiplier;
                if (supplyShipForFuel.supplies >= suppliesUsed) {
                  supplyShipForFuel.supplies -= suppliesUsed;
                  if (supplyShipForFuel === this && this.waitingForSupplyFuelConversion) {
                    this.suppliesConvertedToFuel = (this.suppliesConvertedToFuel || 0) + suppliesUsed;
                  }
                } else {
                  const remainingRefuel = suppliesUsed - supplyShipForFuel.supplies;
                  if (supplyShipForFuel === this && this.waitingForSupplyFuelConversion) {
                    this.suppliesConvertedToFuel = (this.suppliesConvertedToFuel || 0) + supplyShipForFuel.supplies;
                  }
                  supplyShipForFuel.supplies = 0;
                  if (owner && !owner.isMonster && owner.id !== 'monsters') {
                    if (hasExcessDeuterium && deuteriumSellPrice < 12) {
                      const consumed = (1/12) * remainingRefuel;
                      owner.resources.deuterium = (owner.resources.deuterium || 0) - consumed;
                      this.specialfuel = (this.specialfuel || 0) + remainingRefuel;
                    } else if (owner.useCredits !== false) {
                      owner.credits = (owner.credits || 0) - 1.0 * remainingRefuel;
                    } else if (friendlyWellPlanet) {
                      friendlyWellPlanet.ships = Math.max(0, friendlyWellPlanet.ships - 1.0 * remainingRefuel);
                    }
                  }
                }
              } else if (activeFuelSource === 'donorShip') {
                const donorSpecial = fuelSourceShip.specialfuel || 0;
                const donorFuel = fuelSourceShip.fuel || 0;
                const fuelTaken = amountRefueled;
                const actualFuelTaken = Math.min(fuelTaken, Math.max(0, donorFuel - 4));
                fuelSourceShip.fuel = donorFuel - actualFuelTaken;
                if (donorSpecial >= donorFuel) {
                  const specTransfer = Math.min(donorSpecial, actualFuelTaken);
                  fuelSourceShip.specialfuel = donorSpecial - specTransfer;
                  this.specialfuel = (this.specialfuel || 0) + specTransfer;
                }
              } else if (activeFuelSource === 'planet') {
                const suppliesUsed = amountRefueled * costMultiplier;
                friendlyWellPlanet.supplies = Math.max(0, friendlyWellPlanet.supplies - suppliesUsed);
                if (owner && !owner.isMonster && owner.id !== 'monsters') {
                  if (hasExcessDeuterium && deuteriumSellPrice < 12) {
                    const consumed = (1/12) * amountRefueled * costMultiplier;
                    owner.resources.deuterium = (owner.resources.deuterium || 0) - consumed;
                    this.specialfuel = (this.specialfuel || 0) + amountRefueled;
                  } else if (owner.useCredits !== false) {
                    owner.credits = (owner.credits || 0) - 1.0 * amountRefueled * costMultiplier;
                  } else if (friendlyWellPlanet) {
                    friendlyWellPlanet.ships = Math.max(0, friendlyWellPlanet.ships - 1.0 * amountRefueled * costMultiplier);
                  }
                }
              }
            }
          }
          if (this.waitingForSupplyFuelConversion) {
            if ((this.suppliesConvertedToFuel || 0) >= 1.0 || (this.supplies || 0) <= 0 || (this.fuel || 0) >= this.getMaxFuel()) {
              this.waitingForSupplyFuelConversion = false;
              this.suppliesConvertedToFuel = 0;
            }
          }
        }
      } else {
        let fuelDrain = this.isWarp ? 8 : 4;
        if (this.isCruiser && distance < 5) {
          fuelDrain *= 0.25;
        }
        const sizeModifier = (this.maxHealth || 25) / 25;
        let fuelConsumed = sizeModifier * (deltaTime / 1000) / (60 / fuelDrain);
        if (this.isCruiser && (this.supplies || 0) > 0) {
          const suppliesToDrain = Math.min(this.supplies, fuelConsumed);
          this.supplies -= suppliesToDrain;
          fuelConsumed -= suppliesToDrain;
        }
        if (fuelConsumed > 0) {
          this.fuel = (this.fuel || 0) - fuelConsumed;
          if (this.specialfuel && this.specialfuel > 0) {
            this.specialfuel = Math.max(0, this.specialfuel - fuelConsumed);
          }
          if (this.fuel <= 0) {
            this.fuel = 0;
            if (this.isWarp) {
              this.isWarp = false;
            }
          }
        }
      }

      // Bomb reloading logic (independent of fuel/armor refueling blocks)
      if (!this.isWarp) {
        const supplyShipForBombs = this.findNearbySupplyShip(allShips);
        if (this.bombs < this.getMaxBombs() && (friendlyWellPlanet || supplyShipForBombs)) {
          let activeBombSourceForRay = null;
          if (supplyShipForBombs && supplyShipForBombs.supplies >= 1.0) {
            activeBombSourceForRay = 'supplyShip';
          } else if (friendlyWellPlanet && (friendlyWellPlanet.supplies || 0) >= 1.0) {
            const owner = this.owner;
            const style = this.cruiserStyle || (owner ? owner.cruiserStyle : null);
            let bombResource = 'merculite';
            if (style === 'Romulan' || style === 'Gorn') {
              bombResource = 'antimatter';
            } else if (style === 'Tholian' || style === 'Lyran') {
              bombResource = 'dilithium';
            }
            const canUseRes = !!(this.useResources || (owner && owner.tradeLimitToggle === true));
            const hasExcessResource = canUseRes && owner && owner.resources && (owner.resources[bombResource] || 0) >= 0.1;
            const resourceSellPrice = owner ? (owner.offerPrice?.[bombResource] ?? 3) : 3;

            if (owner && (owner.isMonster || owner.id === 'monsters')) {
              activeBombSourceForRay = 'planet';
            } else if (hasExcessResource && resourceSellPrice < 12) {
              activeBombSourceForRay = 'planet';
            } else if (owner && owner.useCredits !== false) {
              const minAllowedCredits = allPlanets && owner ? (allPlanets.some(p => p.homeworldOf === owner.id && p.owner && p.owner.id === owner.id) ? -(1000 + Math.floor(owner.totalShips || 0)) : 0) : 0;
              if ((owner.credits || 0) - 1.0 >= minAllowedCredits) {
                activeBombSourceForRay = 'planet';
              }
            } else if (friendlyWellPlanet.ships >= 1.0) {
              activeBombSourceForRay = 'planet';
            }
          }
          if (activeBombSourceForRay === 'supplyShip' && supplyShipForBombs && supplyShipForBombs !== this) {
            this.activeSupplySourceId = supplyShipForBombs.id;
            this.activeSupplySourceType = 'ship';
          } else if (activeBombSourceForRay === 'planet' && friendlyWellPlanet) {
            this.activeSupplySourceId = friendlyWellPlanet.id;
            this.activeSupplySourceType = 'planet';
          }

          const maxBombs = this.getMaxBombs();
          const reloadMultiplier = 0.5 * (1 + 0.1 * maxBombs);
          const recoveryRate = (this.combatCooldown && this.combatCooldown > 0) ? 0.5 : 1.0;
          this.bombReloadTimer = (this.bombReloadTimer || 0) + (deltaTime / 1000) * reloadMultiplier * recoveryRate;
          if (this.bombReloadTimer >= 5) {
            let bombResource = 'merculite';
            const owner = this.owner;
            const style = this.cruiserStyle || (owner ? owner.cruiserStyle : null);
            if (style === 'Romulan' || style === 'Gorn') {
              bombResource = 'antimatter';
            } else if (style === 'Tholian' || style === 'Lyran') {
              bombResource = 'dilithium';
            }

            const canUseRes = !!(this.useResources || (owner && owner.tradeLimitToggle === true));
            const hasExcessResource = canUseRes && owner && owner.resources && (owner.resources[bombResource] || 0) >= 0.1;
            const resourceSellPrice = owner ? (owner.offerPrice?.[bombResource] ?? 3) : 3;

            let canAffordReload = false;
            let activeBombSource = null; // 'supplyShip' or 'planet'

            if (supplyShipForBombs && supplyShipForBombs.supplies >= 1.0) {
              canAffordReload = true;
              activeBombSource = 'supplyShip';
            } else if (friendlyWellPlanet && (friendlyWellPlanet.supplies || 0) >= 1.0) {
              if (owner && (owner.isMonster || owner.id === 'monsters')) {
                canAffordReload = true;
                activeBombSource = 'planet';
              } else if (hasExcessResource && resourceSellPrice < 12) {
                canAffordReload = true;
                activeBombSource = 'planet';
              } else if (owner && owner.useCredits !== false) {
                const minAllowedCredits = allPlanets && owner ? (allPlanets.some(p => p.homeworldOf === owner.id && p.owner && p.owner.id === owner.id) ? -(1000 + Math.floor(owner.totalShips || 0)) : 0) : 0;
                if ((owner.credits || 0) - 1.0 >= minAllowedCredits) {
                  canAffordReload = true;
                  activeBombSource = 'planet';
                }
              } else if (friendlyWellPlanet.ships >= 1.0) {
                canAffordReload = true;
                activeBombSource = 'planet';
              }
            }

            if (canAffordReload) {
              this.bombReloadTimer = 0;
              this.bombs++;

              if (activeBombSource === 'supplyShip') {
                supplyShipForBombs.supplies -= 1.0;
              } else if (activeBombSource === 'planet') {
                friendlyWellPlanet.supplies = Math.max(0, friendlyWellPlanet.supplies - 1.0);
                if (owner && !owner.isMonster && owner.id !== 'monsters') {
                  if (hasExcessResource && resourceSellPrice < 12) {
                    const consumed = 1/12;
                    owner.resources[bombResource] = (owner.resources[bombResource] || 0) - consumed;
                    this.specialbombs = (this.specialbombs || 0) + 1;
                    if (!this.resourceConsumeEvents) this.resourceConsumeEvents = { deuterium: 0, tritanium: 0, merculite: 0, antimatter: 0, dilithium: 0 };
                    if (!this.resourceAccumulators) this.resourceAccumulators = { deuterium: 0, tritanium: 0, merculite: 0, antimatter: 0, dilithium: 0 };
                    this.resourceAccumulators[bombResource] = (this.resourceAccumulators[bombResource] || 0) + consumed;
                    if (this.resourceAccumulators[bombResource] >= 0.0833) {
                      this.resourceConsumeEvents[bombResource] = (this.resourceConsumeEvents[bombResource] || 0) + 1;
                      this.resourceAccumulators[bombResource] -= 0.0833;
                    }
                  } else if (owner.useCredits !== false) {
                    owner.credits = (owner.credits || 0) - 1.0;
                  } else if (friendlyWellPlanet) {
                    friendlyWellPlanet.ships = Math.max(0, friendlyWellPlanet.ships - 1.0);
                  }
                }
              }
            } else {
              this.bombReloadTimer = 5;
            }
          }
        }
      }

      // Shield regeneration
      const maxShields = this.getMaxShields();
      if ((this.shields || 0) > 0 && (this.shieldPoints || 0) < maxShields && (this.shieldRegenCooldown || 0) <= 0) {
        const hasFuelOrCruiserSupplies = (this.fuel || 0) > 0 || (this.isCruiser && (this.supplies || 0) > 0);
        if (!this.inEffectiveStorm && hasFuelOrCruiserSupplies) {
          const averageShields = (maxShields + (this.shieldPoints || 0)) / 2;
          const regenRatePerSec = 0.05 * averageShields * (1 + 0.50 * (this.damagecontrol || 0));
          let shieldRegenAmount = (deltaTime / 1000) * regenRatePerSec;
          const neededShields = maxShields - (this.shieldPoints || 0);
          shieldRegenAmount = Math.min(shieldRegenAmount, neededShields);
          const availableEnergy = (this.isCruiser && (this.supplies || 0) > 0) ? ((this.fuel || 0) + this.supplies) : (this.fuel || 0);
          const maxShieldsFromEnergy = availableEnergy / 0.1;
          shieldRegenAmount = Math.min(shieldRegenAmount, maxShieldsFromEnergy);
          if (shieldRegenAmount > 0) {
            this.shieldPoints = (this.shieldPoints || 0) + shieldRegenAmount;
            let energyToDrain = 0.1 * shieldRegenAmount;
            if (this.isCruiser && (this.supplies || 0) > 0) {
              const suppliesToDrain = Math.min(this.supplies, energyToDrain);
              this.supplies -= suppliesToDrain;
              energyToDrain -= suppliesToDrain;
            }
            if (energyToDrain > 0) {
              this.fuel = Math.max(0, (this.fuel || 0) - energyToDrain);
            }
          }
        }
      }
    }

    if (this.targetPlanet) {
      if (distance < this.targetPlanet.radius) {
        if (this.maxHealth > 0 && this.health >= 0) {
          if (this.isWarp) {
            this.isWarp = false;
          }
          return;
        }

        // Normal fleet real-time attack / reinforce
        if (this.count > 0) {
          if (this.isWarp) {
            this.isWarp = false;
          }
          const isFriendly = !!(this.targetPlanet.owner && this.owner && this.targetPlanet.owner.id === this.owner.id);
          const dt = deltaTime / 1000;

          if (isFriendly) {
            // Gradual Reinforcing
            const rate = Math.max(10, this.count / 4);
            let N_reinf = rate * dt;
            N_reinf = Math.min(this.count, N_reinf);

            let actualReinf = N_reinf;

            const isTargetHuman = this.targetPlanet.owner && !this.targetPlanet.owner.isAI;
            const reinfCap = (isTargetHuman && this.targetPlanet.focusMode === 'garrison') ? this.targetPlanet.maxShips * 2 : this.targetPlanet.maxShips;
            const spaceLeft = Math.max(0, reinfCap - this.targetPlanet.ships);
            const toAdd = Math.min(spaceLeft, actualReinf);
            const sacrificed = actualReinf - toAdd;

            this.targetPlanet.ships += toAdd;
            this.count -= N_reinf;



            if (sacrificed > 0) {
              this.targetPlanet.sacrificedShips = (this.targetPlanet.sacrificedShips || 0) + sacrificed;
              const upgrades = Math.floor(this.targetPlanet.sacrificedShips / 20);
              if (upgrades > 0) {
                this.targetPlanet.sacrificedShips %= 20;
                this.targetPlanet.increaseMaxShips(upgrades);
              }
              if (explosions && Math.random() < 0.1) {
                explosions.push({
                  x: this.targetPlanet.x + (Math.random() - 0.5) * this.targetPlanet.radius,
                  y: this.targetPlanet.y + (Math.random() - 0.5) * this.targetPlanet.radius,
                  color: '#fff',
                  age: 0
                });
              }
            }

            if (this.count <= 0 || distance < 5) {
              // Complete reinforcement dump
              if (this.count > 0) {
                let dumpCount = this.count;
                const isTargetHuman = this.targetPlanet.owner && !this.targetPlanet.owner.isAI;
                const reinfCap = (isTargetHuman && this.targetPlanet.focusMode === 'garrison') ? this.targetPlanet.maxShips * 2 : this.targetPlanet.maxShips;
                const finalSpaceLeft = Math.max(0, reinfCap - this.targetPlanet.ships);
                const finalToAdd = Math.min(finalSpaceLeft, dumpCount);
                const finalSacrificed = dumpCount - finalToAdd;

                this.targetPlanet.ships += finalToAdd;
                if (finalSacrificed > 0) {
                  this.targetPlanet.sacrificedShips = (this.targetPlanet.sacrificedShips || 0) + finalSacrificed;
                  const upgrades = Math.floor(this.targetPlanet.sacrificedShips / 20);
                  if (upgrades > 0) {
                    this.targetPlanet.sacrificedShips %= 20;
                    this.targetPlanet.increaseMaxShips(upgrades);
                  }
                }
              }
              this.count = 0;
              this.active = false;
              return;
            }
          } else {
            // Gradual Attack
            if (this.targetPlanet.owner && this.owner && this.targetPlanet.owner !== this.owner) {
              this.owner.triggerWarWith(this.targetPlanet.owner);
            }
            // Calculate kill chance
            let nearbyFriendlyCount = 0;
            if (allShips) {
              const candidateFriendlies = (typeof allShips.getShipsInRadiusSq === 'function')
                ? allShips.getShipsInRadiusSq(this.x, this.y, 10000)
                : allShips;

              for (const ship of candidateFriendlies) {
                if (ship !== this && ship.owner && this.owner && ship.owner.id === this.owner.id && ship.active) {
                  const sdx = ship.x - this.x;
                  const sdy = ship.y - this.y;
                  const sDistSq = sdx * sdx + sdy * sdy;
                  if (sDistSq < 10000) {
                    nearbyFriendlyCount += (ship.count || 1);
                  }
                }
              }
            }

            let friendlyPlanetBoost = 0;
            let defenderPlanetPenalty = 0;
            if (allPlanets) {
              for (const planet of allPlanets) {
                if (planet !== this.targetPlanet) {
                  const pdx = planet.x - this.targetPlanet.x;
                  const pdy = planet.y - this.targetPlanet.y;
                  const pDistSq = pdx * pdx + pdy * pdy;
                  const gravityRadius = planet.getGravityRadius();
                  
                  if (pDistSq < gravityRadius * gravityRadius) {
                    if (planet.owner && this.owner && planet.owner.id === this.owner.id) {
                      let mult = 0.002;
                      if (planet.isMilitary || planet.focusMode === 'garrison') {
                        if (planet.ships >= planet.maxShips * 2 - 10) {
                          mult = 0.0045;
                        } else if (planet.ships >= planet.maxShips) {
                          mult = 0.003;
                        }
                      }
                      friendlyPlanetBoost += mult * Math.floor(planet.ships / 10);
                    } else if (planet.owner && this.targetPlanet.owner && planet.owner.id === this.targetPlanet.owner.id) {
                      let mult = 0.002;
                      if (planet.isMilitary || planet.focusMode === 'garrison') {
                        if (planet.ships >= planet.maxShips * 2 - 10) {
                          mult = 0.0045;
                        } else if (planet.ships >= planet.maxShips) {
                          mult = 0.003;
                        }
                      }
                      defenderPlanetPenalty += mult * Math.floor(planet.ships / 10);
                    }
                  }
                }
              }
            }

            const advantage = 0.01 * Math.floor(nearbyFriendlyCount / 10);
            const attackerTechBonus = 0.01 * Math.sqrt(this.owner.techScore || 0);
            const attackerExpBonus = 0.01 * Math.sqrt(this.owner.expScore || 0);
            
            let defenderTechPenalty = 0.01 * Math.sqrt(this.targetPlanet.owner ? (this.targetPlanet.owner.techScore || 0) : 0);
            let defenderExpPenalty = 0.01 * Math.sqrt(this.targetPlanet.owner ? (this.targetPlanet.owner.expScore || 0) : 0);
            
            const attackerLocalExpBonus = 0.01 * this.getLocalXpBonus();
            let defenderLocalExpPenalty = 0.01 * Math.sqrt(this.targetPlanet.expScore || 0);

            const humanInvolved = (!this.owner.isAI) || (this.targetPlanet.owner && !this.targetPlanet.owner.isAI);
            const humanVsHuman = (!this.owner.isAI) && (this.targetPlanet.owner && !this.targetPlanet.owner.isAI);
            let survivingAICount = 0;
            if (humanVsHuman && allPlanets) {
              const aiOwners = new Set();
              for (const p of allPlanets) {
                if (p.owner && p.owner.isAI) {
                  aiOwners.add(p.owner.id);
                }
              }
              survivingAICount = aiOwners.size;
            }
            let humanDefenderBonus = humanVsHuman ? (0.02 * survivingAICount) : 0;
            
            let lastStandPenalty = (humanInvolved && this.targetPlanet.owner && this.targetPlanet.owner.planetCount === 1) ? 0.15 : 0;
            
            let defenderHomeworldPenalty = (humanInvolved && this.targetPlanet.owner && this.targetPlanet.owner.id === this.targetPlanet.homeworldOf) ? 0.15 : 0;
            const attackerHomeworldBonus = (humanInvolved && this.owner && this.owner.id === this.targetPlanet.homeworldOf && this.targetPlanet.owner !== this.owner) ? 0.15 : 0;

            const minKillChance = attackerTechBonus + attackerExpBonus + attackerLocalExpBonus;

            let hazardPenalty = 0;
            if (ionStorms) {
              for (const storm of ionStorms) {
                if (storm.type === 'minefield') continue;
                const sdx = this.targetPlanet.x - storm.x;
                const sdy = this.targetPlanet.y - storm.y;
                if (sdx * sdx + sdy * sdy <= storm.radius * storm.radius) {
                  const knowledge = storm.knowledge[this.owner.id] || 0;
                  const tRed = Math.sqrt(this.owner.techScore || 0);
                  const eRed = Math.sqrt(this.owner.expScore || 0);
                  const sRed = this.getLocalXpBonus();
                  const eff = Math.max(0, storm.intensity - knowledge - (tRed + eRed) / 2 - sRed);
                  hazardPenalty += eff / 100;
                }
              }
            }
            
            if (humanInvolved && this.targetPlanet.owner && this.targetPlanet.owner.planetCount === 1) {
              const now = Date.now();
              if (!this.targetPlanet.lastStandTime || now - this.targetPlanet.lastStandTime > 5000) {
                this.targetPlanet.lastStandEvent = true;
                this.targetPlanet.lastStandTime = now;
              }
            }

            if (humanInvolved && this.targetPlanet.homeworldOf) {
              const hwId = this.targetPlanet.homeworldOf;
              const isAttacker = this.owner && this.owner.id === hwId;
              const isDefender = this.targetPlanet.owner && this.targetPlanet.owner.id === hwId;
              if (isAttacker || isDefender) {
                const now = Date.now();
                if (!this.targetPlanet.homeworldTime || now - this.targetPlanet.homeworldTime > 5000) {
                  this.targetPlanet.homeworldEvent = true;
                  this.targetPlanet.homeworldTime = now;
                }
              }
            }

            if (this.isBomber) {
              // Bombers deal gradual eco/ship damage and deactivate
              const rate = this.isMarineFleet ? Math.max(10, this.count / 4) : Math.sqrt(this.count);
              const expectedToConsume = rate * dt;
              
              const baseConsume = Math.floor(expectedToConsume);
              const remainder = expectedToConsume - baseConsume;
              let numToConsume = baseConsume + (Math.random() < remainder ? 1 : 0);
              
              numToConsume = Math.min(Math.ceil(this.count), numToConsume);
              
              if (numToConsume > 0) {
                let ecoDamage = 0;
                let shipDamage = 0;
                for (let b = 0; b < numToConsume; b++) {
                  if (this.bomberType === 'eco' || this.bomberType === true) {
                    ecoDamage += Math.floor(Math.random() * 2) + 1;
                  } else if (this.bomberType === 'ships') {
                    shipDamage += Math.floor(Math.random() * 4) + 1;
                  }
                }
                
                this.count = Math.max(0, this.count - numToConsume);
                if (this.owner && this.owner.attackedPlanets && this.targetPlanet) {
                  const currentTimer = this.owner.attackedPlanets.get(this.targetPlanet.id) || 0;
                  this.owner.attackedPlanets.set(this.targetPlanet.id, currentTimer + numToConsume * 60000);
                  if (this.targetPlanet.owner && this.targetPlanet.owner !== this.owner) {
                    this.targetPlanet.owner.lastAttackerPlayerId = this.owner.id;
                  }
                }
                
                if (ecoDamage > 0) {
                  this.targetPlanet.decreaseMaxShips(ecoDamage);
                  if (this.targetPlanet.maxShips < 5) {
                    this.targetPlanet.dead = true;
                    if (this.targetPlanet.homeworldOf && this.owner) {
                      this.owner.expScore = (this.owner.expScore || 0) + 100;
                    }
                  }
                  if (explosions) {
                    for (let i = 0; i < Math.min(ecoDamage, 15); i++) {
                      explosions.push({
                        x: this.targetPlanet.x + (Math.random() - 0.5) * this.targetPlanet.radius,
                        y: this.targetPlanet.y + (Math.random() - 0.5) * this.targetPlanet.radius,
                        color: '#ffaa00',
                        age: 0
                      });
                    }
                  }
                }
                
                if (shipDamage > 0) {
                  this.targetPlanet.ships -= shipDamage;
                  if (this.targetPlanet.ships < 0) this.targetPlanet.ships = 0;
                  if (explosions) {
                    for (let i = 0; i < Math.min(shipDamage, 15); i++) {
                      explosions.push({
                        x: this.targetPlanet.x + (Math.random() - 0.5) * this.targetPlanet.radius,
                        y: this.targetPlanet.y + (Math.random() - 0.5) * this.targetPlanet.radius,
                        color: '#ff00aa',
                        age: 0
                      });
                    }
                  }
                }
              }
              
              if (this.count <= 0) {
                this.active = false;
              }
              return;
            }

            // Main assault attack rate
            const rate = this.isMarineFleet ? Math.max(10, this.count / 4) : Math.sqrt(this.count);
            let N_att = rate * dt;
            N_att = Math.min(this.count, N_att);

            let penalty = 0.01 * Math.floor(this.targetPlanet.ships / 5);
            const matchesAttacker = this.targetPlanet.racialAffinity && ((this.cruiserStyle === this.targetPlanet.racialAffinity) || (this.owner && this.owner.cruiserStyle === this.targetPlanet.racialAffinity));
            let racialDefenseBonus = (this.targetPlanet.racialAffinity && !matchesAttacker) ? 0.15 : 0;

            if (this.targetPlanet.inRevolt) {
              penalty *= 0.5;
              defenderPlanetPenalty *= 0.5;
              defenderTechPenalty *= 0.5;
              defenderExpPenalty *= 0.5;
              defenderLocalExpPenalty *= 0.5;
              lastStandPenalty *= 0.5;
              defenderHomeworldPenalty *= 0.5;
              humanDefenderBonus *= 0.5;
              racialDefenseBonus *= 0.5;
            }

            let killChance = Math.max(minKillChance, 0.8 - penalty + advantage + friendlyPlanetBoost - defenderPlanetPenalty + attackerTechBonus + attackerExpBonus + attackerLocalExpBonus + attackerHomeworldBonus - defenderTechPenalty - defenderExpPenalty - defenderLocalExpPenalty - lastStandPenalty - defenderHomeworldPenalty - humanDefenderBonus - racialDefenseBonus);
            killChance = Math.max(minKillChance, killChance - hazardPenalty);

            let defendersKilled = N_att * killChance;
            this.count -= N_att;
             if (this.owner && this.owner.attackedPlanets && this.targetPlanet) {
               const currentTimer = this.owner.attackedPlanets.get(this.targetPlanet.id) || 0;
               this.owner.attackedPlanets.set(this.targetPlanet.id, currentTimer + N_att * 60000);
             }

            const oldShips = this.targetPlanet.ships;
            this.targetPlanet.ships = Math.max(0, this.targetPlanet.ships - defendersKilled);
            const actualKilled = oldShips - this.targetPlanet.ships;

            if (this.owner) {
              this.owner.addExperience(actualKilled);
              if (this.targetPlanet.owner && this.targetPlanet.owner !== this.owner) {
                this.targetPlanet.owner.lastAttackerPlayerId = this.owner.id;
              }
              if (this.sourceShipId && allShips) {
                const launcher = allShips.find(sh => sh.id === this.sourceShipId && sh.active);
                if (launcher) {
                  launcher.expScore = (launcher.expScore || 0) + actualKilled;
                }
              }
            }
            if (this.targetPlanet.owner) this.targetPlanet.owner.addExperience(actualKilled);

            // Grant target planet defense experience
            this.targetPlanet.addExperience(actualKilled + N_att);

            // Capacity decrease chance
            const expectedCapacityDecrease = actualKilled * 0.08;
            let capacityDrops = Math.floor(expectedCapacityDecrease);
            const remainderDrops = expectedCapacityDecrease - capacityDrops;
            if (Math.random() < remainderDrops) {
              capacityDrops += 1;
            }
            if (capacityDrops > 0 && this.targetPlanet.owner !== null) {
              const actualDrops = Math.min(capacityDrops, this.targetPlanet.maxShips - 4);
              if (actualDrops > 0) {
                this.targetPlanet.decreaseMaxShips(actualDrops);
                if (this.targetPlanet.maxShips < 5) {
                  this.targetPlanet.dead = true;
                  if (this.targetPlanet.homeworldOf && this.owner) {
                    this.owner.expScore = (this.owner.expScore || 0) + 100;
                  }
                }
              }
            }

            if (explosions && actualKilled > 0) {
              // Spawn explosions during active attack
              const expCount = Math.ceil(actualKilled * 0.25); // 25% of losses show explosions
              for (let k = 0; k < expCount; k++) {
                if (Math.random() < 0.25) {
                  explosions.push({
                    x: this.targetPlanet.x + (Math.random() - 0.5) * this.targetPlanet.radius,
                    y: this.targetPlanet.y + (Math.random() - 0.5) * this.targetPlanet.radius,
                    color: this.targetPlanet.owner ? this.targetPlanet.owner.color : '#555',
                    age: 0
                  });
                }
              }
            }

            if (this.targetPlanet.ships <= 0) {
              // Capture!
              this.targetPlanet.ships = 0;
              const previousOwner = this.targetPlanet.owner;
              if (previousOwner !== null) {
                this.targetPlanet.maxShips--;
                if (this.targetPlanet.maxShips < 5) {
                  this.targetPlanet.dead = true;
                  if (this.targetPlanet.homeworldOf && this.owner) {
                    this.owner.expScore = (this.owner.expScore || 0) + 100;
                  }
                }
              } else {
                // Conquered a neutral planet
                const roll = Math.random();
                if (roll < 0.10) {
                  this.targetPlanet.isResearch = true;
                } else if (roll < 0.20) {
                  this.targetPlanet.isMilitary = true;
                } else if (roll < 0.30) {
                  this.targetPlanet.isSpeedPlanet = true;
                }
              }
              if (!this.targetPlanet.racialAffinity) {
                this.targetPlanet.racialAffinity = this.cruiserStyle || (this.owner ? this.owner.cruiserStyle : null);
              }
              this.targetPlanet.owner = this.owner;
              this.targetPlanet.ships = 0; // starts at 0, next lines will reinforce if ships remaining
              this.targetPlanet.rampageBoost = false;
              this.targetPlanet.rampageEvent = false;

              // Check if previous owner was eliminated
              if (previousOwner && previousOwner !== this.owner && allPlanets) {
                const hasRemaining = allPlanets.some(p => p !== this.targetPlanet && p.owner === previousOwner);
                if (!hasRemaining) {
                  this.targetPlanet.defeatEvent = { name: previousOwner.name, color: previousOwner.color };
                  this.owner.expScore = (this.owner.expScore || 0) + 100;
                }
              }

              // Conquered! Do not instantly dump all remaining ships.
              // Just return here, and in subsequent frames, the fleet will continue to gradually reinforce this newly conquered friendly planet.
              return;
            }

            if (this.count <= 0) {
              this.active = false;
              this.count = 0;
              return;
            }
          }
        }
      }
    } else {
      if (distance < 5) {
        if (this.maxHealth > 0 && !this.isAmoeba) {
          this.isWarp = false;
        }
        if (this.isCruiser) {
          this.x = finalDestX;
          this.y = finalDestY;
        }
        if (this.isAmoeba && allPlanets && allPlanets.length > 0) {
          const target = allPlanets[Math.floor(Math.random() * allPlanets.length)];
          this.targetX = target.x + (Math.random() - 0.5) * 400;
          this.targetY = target.y + (Math.random() - 0.5) * 400;
          this.startX = this.x;
          this.startY = this.y;
          return;
        }
        
        
        return;
      }
    }
    
    if (this.isAmoeba) {
      this.health += deltaTime / 30000;
      if (this.health > this.maxHealth) this.health = this.maxHealth;
      
      if ((this.amoebaGrowCooldown || 0) > 0) {
        this.amoebaGrowCooldown -= deltaTime / 1000;
      }
      
      if (this.bombs === undefined) this.bombs = this.maxHealth;
      if (this.bombs < this.maxHealth) {
        const amoebaCountForBombs = (allShips && allShips.amoebaCount !== undefined) ? allShips.amoebaCount : (allShips ? allShips.filter(s => s.active && s.isAmoeba).length : 1);
        const mapScaleForBombs = 1600 / (mapWidth || 1600);
        const bombTimer = 10 * amoebaCountForBombs * mapScaleForBombs;
        this.amoebaBombTimer = (this.amoebaBombTimer || 0) + (deltaTime / 1000);
        if (this.amoebaBombTimer >= bombTimer) {
          this.amoebaBombTimer = 0;
          this.bombs++;
        }
      }
    }

    if (this.isCruiser && !this.isAmoeba) {
      const wantsToMove = (moveDistanceToDest > 1.0);
      if (wantsToMove && (this.fuel || 0) <= 0 && (this.supplies || 0) > 0) {
        if (!this.waitingForSupplyFuelConversion) {
          this.waitingForSupplyFuelConversion = true;
          this.suppliesConvertedToFuel = 0;
        }
      } else if (!wantsToMove) {
        this.waitingForSupplyFuelConversion = false;
        this.suppliesConvertedToFuel = 0;
      }
    }

    const speedTechBonus = this.owner ? (0.01 * Math.sqrt(this.owner.techScore || 0)) : 0;
    let effectiveSpeed = this.speed * (1 + speedTechBonus);
    let engineBonus = (this.engine || 0) * 3;
    effectiveSpeed += engineBonus;
    effectiveSpeed += (this.commandPoints || 0) * 0.5;
    if (this.isWarp) {
      effectiveSpeed += this.warpBonus || 0;
    }
    if (this.supply_ship && this.supply_ship > 0) {
      effectiveSpeed = Math.max(5, effectiveSpeed - this.supply_ship * 3);
    }
    if (this.specialfuel && this.specialfuel > 0) {
      effectiveSpeed += 10;
    }
    if (this.speedModifier) {
      effectiveSpeed *= this.speedModifier;
    }
    if (this.owner && (this.owner.isMonster || this.owner.id === 'monsters')) {
      if (this.isCruiser) {
        effectiveSpeed *= 0.5;
      }
    }
    if (this.isRefueling || this.waitingForSupplyFuelConversion) {
      effectiveSpeed = 0;
    }
    if (this.maxHealth > 0 && this.fuel <= 0) {
      effectiveSpeed *= 0.25;
    }

    if (this.groupSpeedLimit !== undefined && this.groupSpeedLimit !== null) {
      effectiveSpeed = Math.min(effectiveSpeed, this.groupSpeedLimit);
    }

    if (this.targetPlanet && distance < this.targetPlanet.radius && this.maxHealth === 0) {
      effectiveSpeed *= 0.1;
    }

    if (!this.insideHazards) {
      this.insideHazards = new Set();
    }

    this.inEffectiveStorm = false;

    // Hazard checks (Nebula slowdown + Entry damage roll for Storms/Minefields)
    if (ionStorms) {
      const currentHazards = new Set();
      for (const h of ionStorms) {
        const hdx = this.x - h.x;
        const hdy = this.y - h.y;
        if (hdx * hdx + hdy * hdy <= h.radius * h.radius) {
          currentHazards.add(h.id);

          if (h.type === 'storm' || h.type === 'nebula' || h.type === 'minefield') {
            if (!this.insideHazards.has(h.id)) {
              if (this.isWarp) {
                const dmg = Math.floor(Math.random() * 6) + 1;
                if (this.maxHealth > 0) {
                  // Cruiser
                  this.health -= dmg;
                  if (this.health <= 0) {
                    this.health = 0;
                    this.active = false;
                  }
                } else {
                  // Standard fleet
                  this.count = Math.max(0, this.count - dmg);
                  if (this.count <= 0) {
                    this.active = false;
                  }
                }
                this.isWarp = false;
                effectiveSpeed = Math.max(0, effectiveSpeed - (this.warpBonus || 0));
                if (explosions) {
                  explosions.push({ x: this.x, y: this.y, color: '#ff3300', age: 0, isMassive: true });
                }
                if (!this.active) {
                  this.insideHazards = currentHazards;
                  return;
                }
              }
            }
          }

          if (h.type === 'nebula') {
            const knowledge = h.knowledge[this.owner ? this.owner.id : ''] || 0;
            const tRed = this.owner ? Math.sqrt(this.owner.techScore || 0) : 0;
            const eRed = this.owner ? Math.sqrt(this.owner.expScore || 0) : 0;
            const sRed = this.getLocalXpBonus();
            const effectiveIntensity = Math.max(0, h.intensity - sRed - (eRed + tRed) / 2 - knowledge);
            if (effectiveIntensity > 0) {
              this.inEffectiveStorm = true;
            }
            const V0 = effectiveSpeed;
            let speed = V0;
            let remaining = effectiveIntensity;

            // Phase 1: reduce by effective intensity down to half speed
            const maxRed1 = 0.5 * V0;
            if (remaining <= maxRed1) {
              speed -= remaining;
              remaining = 0;
            } else {
              speed -= maxRed1;
              remaining -= maxRed1;
            }

            // Phase 2: reduce with 1/2 of remaining effective intensity down to 1/4 speed
            if (remaining > 0) {
              const maxRed2 = 0.25 * V0;
              const maxIntensity2 = maxRed2 / 0.5;
              if (remaining <= maxIntensity2) {
                speed -= remaining * 0.5;
                remaining = 0;
              } else {
                speed -= maxRed2;
                remaining -= maxIntensity2;
              }
            }

            // Phase 3: reduce by 1/4 of remaining effective intensity down to a minimum of 3
            if (remaining > 0) {
              speed -= remaining * 0.25;
            }

            effectiveSpeed = Math.max(Math.min(3, V0), speed);
          } else if (h.type === 'storm') {
            // Ion Storm speed reduction
            const knowledge = h.knowledge[this.owner ? this.owner.id : ''] || 0;
            const tRed = this.owner ? Math.sqrt(this.owner.techScore || 0) : 0;
            const eRed = this.owner ? Math.sqrt(this.owner.expScore || 0) : 0;
            const sRed = this.getLocalXpBonus();

            const effectiveIntensity = Math.max(0, h.intensity - knowledge - (tRed + eRed) / 2 - sRed);
            if (effectiveIntensity > 0) {
              this.inEffectiveStorm = true;
            }
            const normalSpeed = effectiveSpeed;
            const safeSpeed = normalSpeed - effectiveIntensity;
            effectiveSpeed = Math.max(5, safeSpeed);
          }
        }
      }
      this.insideHazards = currentHazards;
    }

    if (this.maxHealth > 0 && !this.isAmoeba) {
      let penaltyFactor = 1.0;
      if (this.damagecontrol > 0) {
        penaltyFactor = 1 / (1 + this.damagecontrol);
      }
      const basePenalty = 0.5 * (1 - this.health / this.maxHealth);
      const finalPenalty = basePenalty * penaltyFactor;
      effectiveSpeed *= (1 - finalPenalty);
    }

    if (moveDistanceToDest > 0 && !this.isAmoeba && !this.isUpgrading) {
      let destX = this.targetPlanet ? (this.targetPlanet.x + (this.cruiserTargetOffsetX || 0)) : this.targetX;
      let destY = this.targetPlanet ? (this.targetPlanet.y + (this.cruiserTargetOffsetY || 0)) : this.targetY;

      const isRetreatingToRefuel = this.isRetreating ||
                                   this.patrolFuelRetreating ||
                                   this.scoutFuelRetreating ||
                                   this.researchFuelRetreating ||
                                   this.diplomacyFuelRetreating;

      if (isRetreatingToRefuel && allShips && destX !== null && destY !== null) {
        const activeAmoebas = allShips.filter(s => s.active && s.isAmoeba);
        if (activeAmoebas.length > 0) {
          const blockers = [];
          const selfX = this.x;
          const selfY = this.y;
          const vX = destX - selfX;
          const vY = destY - selfY;
          const len = Math.sqrt(vX * vX + vY * vY);

          if (len > 0.01) {
            const uX = vX / len;
            const uY = vY / len;

            for (const amoeba of activeAmoebas) {
              const amoebaRange = typeof amoeba.getWeaponRange === 'function' ? amoeba.getWeaponRange() : 40;
              const dangerRadius = amoebaRange + 45;

              const distToAmoeba = Math.sqrt((amoeba.x - selfX) * (amoeba.x - selfX) + (amoeba.y - selfY) * (amoeba.y - selfY));
              
              if (distToAmoeba < dangerRadius) {
                // Already inside danger radius: flee directly away from it while heading towards target
                const targetDirX = uX;
                const targetDirY = uY;
                
                let repelDirX = selfX - amoeba.x;
                let repelDirY = selfY - amoeba.y;
                const repelLen = Math.sqrt(repelDirX * repelDirX + repelDirY * repelDirY);
                if (repelLen > 0.01) {
                  repelDirX /= repelLen;
                  repelDirY /= repelLen;
                }
                
                let blendedX = targetDirX + repelDirX * 2.0;
                let blendedY = targetDirY + repelDirY * 2.0;
                const blendedLen = Math.sqrt(blendedX * blendedX + blendedY * blendedY);
                if (blendedLen > 0.01) {
                  blendedX /= blendedLen;
                  blendedY /= blendedLen;
                }

                destX = selfX + blendedX * 100;
                destY = selfY + blendedY * 100;
                blockers.length = 0;
                break;
              } else {
                // Check if segment intersects the danger circle
                const cX = amoeba.x - selfX;
                const cY = amoeba.y - selfY;
                const t = cX * uX + cY * uY;
                const tClamped = Math.max(0, Math.min(len, t));
                const pX = selfX + tClamped * uX;
                const pY = selfY + tClamped * uY;
                const distSq = (pX - amoeba.x) * (pX - amoeba.x) + (pY - amoeba.y) * (pY - amoeba.y);

                if (distSq < dangerRadius * dangerRadius) {
                  blockers.push({
                    amoeba: amoeba,
                    dangerRadius: dangerRadius,
                    tClamped: tClamped,
                    pX: pX,
                    pY: pY
                  });
                }
              }
            }

            if (blockers.length > 0) {
              blockers.sort((a, b) => a.tClamped - b.tClamped);
              const closestBlocker = blockers[0];
              const amoeba = closestBlocker.amoeba;
              const dangerRadius = closestBlocker.dangerRadius;
              
              let cpX = closestBlocker.pX - amoeba.x;
              let cpY = closestBlocker.pY - amoeba.y;
              const distCP = Math.sqrt(cpX * cpX + cpY * cpY);
              
              let perpX = 0;
              let perpY = 0;
              if (distCP > 0.01) {
                perpX = cpX / distCP;
                perpY = cpY / distCP;
              } else {
                perpX = -uY;
                perpY = uX;
              }

              destX = amoeba.x + perpX * dangerRadius;
              destY = amoeba.y + perpY * dangerRadius;
            }
          }
        }
      }
      
      if (this.circlingDestX !== destX || this.circlingDestY !== destY) {
        this.circling = false;
        this.circlingDestX = destX;
        this.circlingDestY = destY;
      }
      
      const desiredAngle = Math.atan2(destY - this.y, destX - this.x);
      const turnRateDeg = this.isCruiser ? Math.max(15, 60 - (this.maxHealth || 0) + (this.engine || 0) * 3) : 60;
      const turnRateRad = turnRateDeg * Math.PI / 180;
      
      let diff = desiredAngle - this.angle;
      while (diff < -Math.PI) diff += Math.PI * 2;
      while (diff > Math.PI) diff -= Math.PI * 2;
      
      const turningRadius = effectiveSpeed / turnRateRad;
      if (!this.circling) {
        if (moveDistanceToDest < 1.8 * turningRadius && Math.abs(diff) > 40 * Math.PI / 180) {
          this.circling = true;
        }
      }
      
      if (this.circling) {
        if (Math.abs(diff) < 0.15) {
          this.circling = false;
        } else {
          effectiveSpeed *= 0.25;
        }
      }
    }

    // Cruisers stop when at the appropriate firing range from a target while they have bombs and are not retreating
    if (this.isCruiser && this.bombs > 0) {
      const isRetreatingNow = this.isRetreating ||
                              this.patrolFuelRetreating ||
                              this.bombardRearming ||
                              this.scoutFuelRetreating ||
                              this.researchFuelRetreating ||
                              this.researchRearming ||
                              this.diplomacyFuelRetreating ||
                              this.diplomacyFleeing;
      if (!isRetreatingNow) {
        let currentTarget = null;
        let isPlanetTarget = false;
        if (this.targetPlanet) {
          currentTarget = this.targetPlanet;
          isPlanetTarget = true;
        } else if (this.cruiserTargetType === 'planet' && this.cruiserTargetId) {
          currentTarget = allPlanets ? allPlanets.find(p => p.id === this.cruiserTargetId) : null;
          isPlanetTarget = true;
        } else if (this.cruiserTargetType === 'ship' && this.cruiserTargetId) {
          currentTarget = allShips ? allShips.find(s => s.id === this.cruiserTargetId) : null;
          isPlanetTarget = false;
        }

        if (currentTarget && currentTarget.active !== false) {
          const isFriendly = (isPlanetTarget && currentTarget.owner && this.owner && currentTarget.owner.id === this.owner.id) ||
                             (!isPlanetTarget && currentTarget.owner && this.owner && currentTarget.owner.id === this.owner.id);
          if (!isFriendly) {
            const tdx = currentTarget.x - this.x;
            const tdy = currentTarget.y - this.y;
            const dist = Math.sqrt(tdx * tdx + tdy * tdy);
            
            // Calculate relative target direction (angle relative to cruiser's current heading)
            const targetAngle = Math.atan2(tdy, tdx);
            let diff = targetAngle - (this.angle || 0);
            while (diff < -Math.PI) diff += Math.PI * 2;
            while (diff > Math.PI) diff -= Math.PI * 2;
            const absDiff = Math.abs(diff);

            let targetingRangeBonus = 0;
            if (this.targeting > 0) {
              targetingRangeBonus += 0.05;
              if (this.targeting > 1) {
                targetingRangeBonus += 0.025;
              }
              if (this.targeting > 2) {
                targetingRangeBonus += 0.025;
              }
            }

            let targetRange = effectiveRange;
            if (absDiff <= Math.PI / 4) {
              // Front arc (+30% range bonus)
              targetRange = effectiveRange * 1.3;
            } else if (absDiff >= 3 * Math.PI / 4) {
              // Aft arc: standard range without munitions bonus (cannot fire bombs backward)
              let rangeWithoutMunitions = effectiveRange;
              if (this.bombs > 0) {
                const xpRangeBonus = (expBonus + shipExpBonus) * 0.01;
                const baseDogfightRange = 40 * (1 + laserTechBonus + xpRangeBonus);
                const munitionsBonus = baseDogfightRange * 0.10 * (1 + targetingRangeBonus);
                rangeWithoutMunitions = Math.max(0, effectiveRange - munitionsBonus);
              }
              targetRange = rangeWithoutMunitions * 0.85;
            } else {
              // Side arc
              const xpRangeBonus = (expBonus + shipExpBonus) * 0.01;
              const baseDogfightRange = 40 * (1 + laserTechBonus + xpRangeBonus);
              let bombRangeBoost = 0;
              if (this.bombs > 0) {
                bombRangeBoost = baseDogfightRange * 0.10 * (1 + targetingRangeBonus);
              }
              let specialBombRangeBoost = 0;
              if (this.specialbombs > 0) {
                specialBombRangeBoost = 10;
              }
              let packageMult = 1.0;
              if (this.package === 'brute') {
                packageMult = 0.5;
              } else if (this.package === 'sniper') {
                packageMult = 1.5;
              }
              bombRangeBoost *= packageMult;
              specialBombRangeBoost *= packageMult;

              targetRange = effectiveRange - 0.5 * bombRangeBoost - 0.5 * specialBombRangeBoost;
            }

            const range = targetRange + (isPlanetTarget ? currentTarget.radius : 0);
            if (dist <= range && !this.isMovingBackward) {
              effectiveSpeed = 0;
            }
          }
        }
      }
    }

    if (this.isCruiser && this.isMovingBackward) {
      effectiveSpeed *= 1/3;
    }

    if (this.isCruiser && this.cruiserTargetType === 'ship' && this.cruiserTargetId) {
      const targetObj = allShips ? allShips.find(s => s.id === this.cruiserTargetId) : null;
      if (targetObj && targetObj.isCruiser && !targetObj.isAmoeba && targetObj.active) {
        const tdx = targetObj.x - this.x;
        const tdy = targetObj.y - this.y;
        const dist = Math.sqrt(tdx * tdx + tdy * tdy);
        if (dist <= 23 && !this.isMovingBackward) {
          effectiveSpeed = 0;
        }
      }
    }

    if (this.pioneerWarpIn) {
      effectiveSpeed = 70;
    }

    if (this.isUpgrading || this.isDismantling) {
      effectiveSpeed = 0;
    }

    const moveDistance = effectiveSpeed * (deltaTime / 1000);
    if (moveDistanceToDest > 0) {
      if (this.isAmoeba) {
        this.x += (dx / moveDistanceToDest) * moveDistance;
        this.y += (dy / moveDistanceToDest) * moveDistance;
      } else {
        if (this.isCruiser && this.isMovingBackward) {
          this.x -= Math.cos(this.angle) * moveDistance;
          this.y -= Math.sin(this.angle) * moveDistance;
        } else {
          this.x += Math.cos(this.angle) * moveDistance;
          this.y += Math.sin(this.angle) * moveDistance;
        }
      }
    }
    const isMoving = (moveDistanceToDest > 0 && effectiveSpeed > 0);
    this.currentSpeed = isMoving ? effectiveSpeed : 0;
    if (isMoving) {
      this.timeSinceLastMoved = 0;
    } else {
      this.timeSinceLastMoved = (this.timeSinceLastMoved || 0) + (deltaTime / 1000);
    }

  }

  tryAutoResourceConversion() {
    if (!this.inFriendlyWell) return;
    const canUseRes = !!(this.useResources || (this.owner && this.owner.tradeLimitToggle === true));
    if (!canUseRes) return;
    if (!this.owner || !this.owner.resources) return;

    const initEvents = () => {
      if (!this.resourceConsumeEvents) {
        this.resourceConsumeEvents = { deuterium: 0, tritanium: 0, duranium: 0, merculite: 0, antimatter: 0, dilithium: 0 };
      }
      if (!this.resourceAccumulators) {
        this.resourceAccumulators = { deuterium: 0, tritanium: 0, duranium: 0, merculite: 0, antimatter: 0, dilithium: 0 };
      }
    };

    if (this.nextConversionIndex === undefined) {
      this.nextConversionIndex = 0;
    }

    for (let i = 0; i < 3; i++) {
      const typeIndex = (this.nextConversionIndex + i) % 3;
      
      if (typeIndex === 0) {
        // 0: Duranium -> specialduranium
        if (this.armorPoints > (this.specialduranium || 0)) {
          const consumed = 1/12;
          if ((this.owner.resources.duranium || 0) >= consumed) {
            this.owner.resources.duranium -= consumed;
            this.specialduranium = (this.specialduranium || 0) + 1;
            initEvents();
            this.resourceConsumeEvents.duranium = (this.resourceConsumeEvents.duranium || 0) + 1;
            this.nextConversionIndex = (typeIndex + 1) % 3;
            return;
          }
        }
      } else if (typeIndex === 1) {
        // 1: Deuterium -> specialfuel
        if (this.fuel > (this.specialfuel || 0)) {
          let costMultiplier = 1.0;
          if (this.supply_ship && this.supply_ship > 0) {
            costMultiplier = Math.max(0, 1.0 - (0.50 + 0.10 * this.supply_ship));
          }
          const consumed = ((1/12) * costMultiplier) / 3;
          if ((this.owner.resources.deuterium || 0) >= consumed) {
            this.owner.resources.deuterium -= consumed;
            this.specialfuel = (this.specialfuel || 0) + 1;
            initEvents();
            this.resourceConsumeEvents.deuterium = (this.resourceConsumeEvents.deuterium || 0) + 1;
            this.nextConversionIndex = (typeIndex + 1) % 3;
            return;
          }
        }
      } else if (typeIndex === 2) {
        // 2: Weapon Resource -> specialbombs
        let bombResource = 'merculite';
        const style = this.cruiserStyle || (this.owner ? this.owner.cruiserStyle : null);
        if (style === 'Romulan' || style === 'Gorn') {
          bombResource = 'antimatter';
        } else if (style === 'Tholian' || style === 'Lyran') {
          bombResource = 'dilithium';
        }

        if (this.bombs > (this.specialbombs || 0)) {
          const consumed = (1/12) / 3;
          if ((this.owner.resources[bombResource] || 0) >= consumed) {
            this.owner.resources[bombResource] -= consumed;
            this.specialbombs = (this.specialbombs || 0) + 1;
            initEvents();
            this.resourceConsumeEvents[bombResource] = (this.resourceConsumeEvents[bombResource] || 0) + 1;
            this.nextConversionIndex = (typeIndex + 1) % 3;
            return;
          }
        }
      }
    }
  }

  takeDamage(explosions, attacker = null, isHazard = false, targetType = null, hitRollMadeBy = 0) {
    if (this.health >= 0) {
      if (this.isCruiser) {
        this.shieldShowTimer = 30;
      }
      if (attacker) {
        if (attacker.isCruiser) {
          attacker.shieldShowTimer = 30;
        }
        if (attacker.owner !== this.owner) {
          this.lastTimeAttacked = Date.now();
          if (this.owner && attacker.owner) {
            this.owner.lastAttackerPlayerId = attacker.owner.id;
          }
        }
        attacker.lastAttackTimeOnShip = attacker.lastAttackTimeOnShip || {};
        attacker.lastAttackTimeOnShip[this.id] = Date.now();
        if (this.owner) {
          attacker.lastAttackTimeByPlayer = attacker.lastAttackTimeByPlayer || {};
          attacker.lastAttackTimeByPlayer[this.owner.id] = Date.now();
        }
      }
      if (this.isCruiser && attacker && attacker.owner && this.owner && attacker.owner !== this.owner) {
        attacker.owner.triggerWarWith(this.owner);
      }
      if (this.isAmoeba && attacker && attacker.active && attacker.owner !== this.owner) {
        this.pursueTarget = attacker;
        this.targetPlanet = null;
        this.targetX = attacker.x;
        this.targetY = attacker.y;
        this.startX = this.x;
        this.startY = this.y;
      }
      if (this.maxHealth > 0) {
        const techBonus = this.owner ? Math.sqrt(this.owner.techScore || 0) : 0;
        const expBonus = this.owner ? Math.sqrt(this.owner.expScore || 0) : 0;
        const shipExpBonus = this.getLocalXpBonus();
        let shrugChance = 0;
        if (!this.isAmoeba) {
          const baseDeflection = this.maxHealth + (techBonus + shipExpBonus);
          shrugChance = baseDeflection / 100;
          if ((this.bombs || 0) < 1) {
            shrugChance /= 2;
          }
          if (this.specialduranium && this.specialduranium > 0) {
            shrugChance += 0.10;
          }
          shrugChance = Math.min(0.90, shrugChance);
          if (attacker && attacker.isAmoeba) {
            shrugChance /= 2;
          }
        } else {
          shrugChance = Math.min(0.95, 0.50 + this.maxHealth * 0.01 + (techBonus + expBonus + shipExpBonus) * 0.01);
        }
        const isAttackerCruiser = attacker && attacker.maxHealth > 0 && !attacker.isAmoeba;
        const isDefenderCruiserOrAmoeba = this.maxHealth > 0;
        if (isAttackerCruiser && isDefenderCruiserOrAmoeba && hitRollMadeBy > 0) {
          shrugChance = Math.max(0, shrugChance - hitRollMadeBy / 3);
        }
        if (Math.random() < shrugChance) {
          // Damage shrugged off
          if (this.isAmoeba && explosions) {
            const size = (6 + (this.maxHealth || 0) * 1.5);
            const angle = Math.random() * Math.PI * 2;
            const dist = Math.random() * size;
            const offsetX = Math.cos(angle) * dist;
            const offsetY = Math.sin(angle) * dist;
            explosions.push({
              x: this.x + offsetX,
              y: this.y + offsetY,
              color: 'amoeba-shrug',
              age: 0
            });
          }
          return false;
        }
      }
            if (this.count > 1) {
        this.count -= 1;
        if (attacker && attacker.maxHealth > 0 && !attacker.isAmoeba && (attacker.bombs || 0) > 0 && (attacker.splashDamage || 0) > 0) {
          let baseSplash = attacker.splashDamage;
          if (targetType === 'side') {
            baseSplash *= 0.5;
          }
          const splashLimit = Math.floor(this.count / 50);
          const splash = Math.min(baseSplash, splashLimit);
          const toDestroy = Math.min(this.count, splash);
          this.count -= toDestroy;
        }
        if (this.count <= 0) {
          this.count = 0;
          this.active = false;
          if (explosions) {
            explosions.push({
              x: this.x,
              y: this.y,
              color: this.owner ? this.owner.color : '#fff',
              age: 0
            });
          }
        }
        return true;
      }

      const cruiserCheck = this.maxHealth > 0 && !this.isAmoeba;
      let damageAmt = (cruiserCheck && isHazard) ? (Math.floor(Math.random() * 6) + 1) : 1;
      
      // 0. Deplete shields first (if shields are active and working)
      const shieldsActive = cruiserCheck && (this.shields || 0) > 0 && !this.inEffectiveStorm && (this.fuel || 0) > 0 && (this.shieldPoints || 0) > 0;
      if (shieldsActive && damageAmt > 0) {
        if (this.shieldPoints >= damageAmt) {
          this.shieldPoints -= damageAmt;
          damageAmt = 0;
        } else {
          damageAmt -= this.shieldPoints;
          this.shieldPoints = 0;
        }
        if (this.shieldPoints === 0) {
          const d3 = Math.floor(Math.random() * 3) + 1;
          const cooldown = Math.max(0, d3 - (this.damagecontrol || 0));
          this.shieldRegenCooldown = cooldown;
        }
      }

      // 1. Deplete armor second
      if (cruiserCheck && (this.armorPoints || 0) > 0 && damageAmt > 0) {
        if (this.armorPoints >= damageAmt) {
          this.armorPoints -= damageAmt;
          damageAmt = 0;
        } else {
          damageAmt -= this.armorPoints;
          this.armorPoints = 0;
        }
      }
      
      // 2. Deplete special duranium second (armor layer between armor and health)
      if (damageAmt > 0 && this.isCruiser && (this.specialduranium || 0) > 0) {
        if (this.specialduranium >= damageAmt) {
          this.specialduranium -= damageAmt;
          damageAmt = 0;
        } else {
          damageAmt -= this.specialduranium;
          this.specialduranium = 0;
        }
      }
      
      // 3. Deplete health last
      this.health -= damageAmt;

      if (attacker && attacker.maxHealth > 0 && !attacker.isAmoeba && (attacker.bombs || 0) > 0 && (attacker.splashDamage || 0) > 0) {
        let baseSplash = attacker.splashDamage;
        if (targetType === 'side') {
          baseSplash *= 0.5;
        }
        const splashLimit = Math.floor(this.health / 50);
        const splash = Math.min(baseSplash, splashLimit);
        for (let i = 0; i < splash; i++) {
          if (this.armorPoints && this.armorPoints > 0) {
            this.armorPoints -= 1;
          } else if (this.isCruiser && this.specialduranium && this.specialduranium > 0) {
            this.specialduranium -= 1;
          } else if (this.health > 0) {
            this.health -= 1;
            if (this.health <= 0 && this.isAmoeba && this.maxHealth > 0) {
              this.maxHealth -= 1;
              if (this.maxHealth > 0) {
                this.health = this.maxHealth;
              } else {
                this.health = -1;
              }
            }
          }
        }
      }

      if (this.health <= 0 && this.isAmoeba && this.maxHealth > 0) {
        this.maxHealth -= 1;
        if (this.maxHealth > 0) {
          this.health = this.maxHealth;
        } else {
          this.health = -1;
        }
      }
      const isCruiser = this.isCruiser || (this.maxHealth > 0 && !this.isAmoeba);
      const isAmoeba = this.isAmoeba;
      if (this.health < 0) {
        this.active = false;
        if (explosions) {
          if (isCruiser) {
            explosions.push({
              x: this.x,
              y: this.y,
              color: this.owner ? this.owner.color : '#fff',
              age: 0,
              isCruiserDeath: true,
              maxHealth: this.maxHealth || 30,
              duration: 1.0 + (this.maxHealth || 30) * 0.005
            });
          } else {
            explosions.push({
              x: this.x,
              y: this.y,
              color: this.owner ? this.owner.color : (this.isAmoeba ? 'amoeba' : '#fff'),
              age: 0
            });
          }
        }
      } else if ((isCruiser || isAmoeba) && explosions) {
        explosions.push({
          x: this.x,
          y: this.y,
          color: this.owner ? this.owner.color : (this.isAmoeba ? 'amoeba' : '#fff'),
          age: 0
        });
      }
      return true;
    }
    return false;
  }


  draw(ctx) {
    if (!this.active) return;

    ctx.fillStyle = this.owner.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}
