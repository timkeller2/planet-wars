export class Ship {
  constructor(id, x, y, targetPlanet, owner, targetX = null, targetY = null) {
    this.id = id;
    this.x = x;
    this.y = y;
    this.targetPlanet = targetPlanet;
    this.targetX = targetX;
    this.targetY = targetY;
    this.owner = owner;
    this.speed = 35; // Halved from 70
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
    this.bombPlanetsEnabled = false;
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
    this.scoutFuelRetreatTargetPlanetId = null;
    this.scoutAttackEnabled = false;
    this.isResearching = false;
    this.researchFuelRetreating = false;
    this.researchFuelRetreatTargetPlanetId = null;
    this.researchRearming = false;
    this.researchRearmTargetPlanetId = null;
    this.isDiplomacy = false;
    this.diplomacyFuelRetreating = false;
    this.diplomacyFuelRetreatTargetPlanetId = null;
    this.diplomacyFleeing = false;
    this.diplomacyFleeTargetPlanetId = null;
    this.fireSideLeft = false;
    this.labs = 0;
    this.accumulatedTech = 0;
    this.beakerIncreaseEvent = 0;
    this.sensorarrays = 0;
    this.armor = 0;
    this.maxArmor = 0;
    this.armorPoints = 0;
    this.shields = 0;
    this.engine = 0;
    this.munitions = 0;
    this.splashDamage = 0;
    this.targeting = 0;
    this.damagecontrol = 0;
    this.fuel_tanker = 0;
    this.supplies = 0;
    this.maxsupplies = 0;
    this.diplomat = 0;
    this.marines = 0;
    this.specialfuel = 0;
    this.specialbombs = 0;
    this.specialduranium = 0;
    this.resourceConsumeEvents = { deuterium: 0, tritanium: 0, duranium: 0, merculite: 0, antimatter: 0, dilithium: 0 };
    this.resourceAccumulators = { deuterium: 0, tritanium: 0, duranium: 0, merculite: 0, antimatter: 0, dilithium: 0 };
    this.crew = 0;
    this.marineCount = 0;
    this._cruiserStyle = null;
    this.package = 'ranged';
    this.tactics = 'normal';
    this.strategy = 'normal';
    this.isUpgrading = false;
    this.upgradeTimer = 0;
    this.upgradeProp = null;
    this.upgradeType = null;
    this.upgradePlanetId = null;
    this.upgradeShipsPaid = 0;
    this.upgradeAccumulator = 0;
    this.patrolReloadTargetPlanetId = null;
    this.planetBombardTimer = 0;
    this.combatCooldown = 0;
    this.name = null;
    this.expScore = 0;
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

  findNearbySupplyShip(allShips) {
    if (!allShips || !this.owner) return null;
    let closestSupplyShip = null;
    let closestDistSq = Infinity;
    const radarRange = this.cruiserRadarRange();
    const radarRangeSq = radarRange * radarRange;

    for (const other of allShips) {
      if (other.active && other.isCruiser && other.owner && other.owner.id === this.owner.id && (other.supplies || 0) > 0) {
        const dx = other.x - this.x;
        const dy = other.y - this.y;
        const distSq = dx * dx + dy * dy;
        if (distSq <= radarRangeSq) {
          if (distSq < closestDistSq) {
            closestDistSq = distSq;
            closestSupplyShip = other;
          }
        }
      }
    }
    return closestSupplyShip;
  }

  getMaxBombs() {
    const baseMax = Math.floor(this.maxHealth / 5);
    const bonus = this.munitions || 0;
    return baseMax + bonus;
  }

  getMaxFuel() {
    const baseFuel = this.maxHealth / 5;
    return baseFuel + (this.fuel_tanker || 0) * 5;
  }

  cruiserRadarRange() {
    if (this.maxHealth <= 0) return 0;
    let baseCruiserRadar = 75 + this.maxHealth * 2;
    let range = baseCruiserRadar + 25 * (this.sensorarrays || 0);
    range *= (1 + 0.25 * (this.sensorarrays || 0));
    if (this.isWarp) {
      range *= 0.25;
    }
    const techBonus = this.owner ? (0.01 * Math.sqrt(this.owner.techScore || 0)) : 0;
    range *= (1 + techBonus);
    return range;
  }

  executeNextOrder(allPlanets, allShips, game = null) {
    if (!this.orderQueue || this.orderQueue.length === 0) {
      return;
    }
    const order = this.orderQueue.shift();
    if (order.type === 'moveSpace') {
      this.targetPlanet = null;
      this.cruiserTargetOffsetX = 0;
      this.cruiserTargetOffsetY = 0;
      this.cruiserTargetType = null;
      this.cruiserTargetId = null;
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
        this.targetPlanet = planet;
        this.targetX = null;
        this.targetY = null;
        this.cruiserTargetType = null;
        this.cruiserTargetId = null;
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
      this.cruiserTargetType = order.targetType;
      this.cruiserTargetId = order.targetId;
      this.cruiserTargetClickX = order.clickX !== undefined ? order.clickX : null;
      this.cruiserTargetClickY = order.clickY !== undefined ? order.clickY : null;
      this.targetPlanet = null;
      
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
        totalBonus += mult * Math.floor(gp.ships / 10);
    }
    return totalBonus;
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
        const sRed = Math.sqrt(this.expScore || 0);
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

  update(deltaTime, allShips, explosions, allPlanets, lasers, ionStorms, mapWidth, game = null) {
    if (!this.active) return;

    if (this.isMaterializing) {
      const dt = deltaTime / 1000;
      this.materializeProgress = Math.min(1.0, this.materializeProgress + dt / this.materializeDuration);
      this.health = Math.max(1, Math.floor(this.materializeProgress * this.maxHealth));
      
      const remainingProgressTime = this.materializeDuration * (1.0 - this.materializeProgress + (dt / this.materializeDuration));
      if (this.materializeProgress < 1.0) {
        if (this.buildCostShipsRemaining > 0) {
          const shipsDeduction = (this.buildCostShipsRemaining / (remainingProgressTime / dt));
          const actualDeduction = Math.min(this.buildCostShipsRemaining, shipsDeduction);
          if (this.sourcePlanet && this.sourcePlanet.owner === this.owner) {
            this.sourcePlanet.ships = Math.max(0, this.sourcePlanet.ships - actualDeduction);
          }
          this.buildCostShipsRemaining = Math.max(0, this.buildCostShipsRemaining - actualDeduction);
        }
        if (this.buildCostCreditsRemaining > 0) {
          const creditsDeduction = (this.buildCostCreditsRemaining / (remainingProgressTime / dt));
          const actualDeduction = Math.min(this.buildCostCreditsRemaining, creditsDeduction);
          if (this.owner) {
            this.owner.credits = Math.max(0, (this.owner.credits || 0) - actualDeduction);
          }
          this.buildCostCreditsRemaining = Math.max(0, this.buildCostCreditsRemaining - actualDeduction);
        }
      } else {
        if (this.buildCostShipsRemaining > 0) {
          if (this.sourcePlanet && this.sourcePlanet.owner === this.owner) {
            this.sourcePlanet.ships = Math.max(0, this.sourcePlanet.ships - this.buildCostShipsRemaining);
          }
          this.buildCostShipsRemaining = 0;
        }
        if (this.buildCostCreditsRemaining > 0) {
          if (this.owner) {
            this.owner.credits = Math.max(0, (this.owner.credits || 0) - this.buildCostCreditsRemaining);
          }
          this.buildCostCreditsRemaining = 0;
        }
        this.health = this.maxHealth;
        this.isMaterializing = false;
        console.log(`[Capital Ship Materialized] ${this.id} finished construction. Final HP: ${this.health}`);
      }
      this.currentSpeed = 0;
      return;
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
        const scX = Math.floor(this.x / 200);
        const scY = Math.floor(this.y / 200);
        const radarRange = this.isCruiser ? this.cruiserRadarRange() : 50;
        const cellRadius = Math.max(1, Math.ceil(radarRange / 200));
        for (let dx = -cellRadius; dx <= cellRadius; dx++) {
          for (let dy = -cellRadius; dy <= cellRadius; dy++) {
            const cx = scX + dx;
            const cy = scY + dy;
            game.exploredGrid[`${pId}_${cx}_${cy}`] = now;
          }
        }
      }
    }

    // Pirate Cruiser AI
    if (this.isCruiser && this.owner && (this.owner.isMonster || this.owner.id === 'monsters')) {
      this.bombPlanetsEnabled = false;

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
            if (other.active && other.owner && other.owner !== this.owner && !other.isAmoeba && !other.isReturnPod && !other.isBoardingFleet && !other.isMaterializing) {
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
      const planet = allPlanets ? allPlanets.find(p => p.id === this.upgradePlanetId) : null;
      const creditsAvailable = (this.owner && this.owner.useCredits !== false && this.owner.credits !== undefined) ? this.owner.credits : 0;
      if (planet && planet.owner && this.owner && planet.owner.id === this.owner.id && (planet.ships >= 1 || creditsAvailable >= 1)) {
        this.upgradeAccumulator += deltaTime / 1000;
        while (this.upgradeAccumulator >= 0.2 && this.upgradeTimer > 0) {
          const currentCredits = (this.owner.useCredits !== false) ? (this.owner.credits || 0) : 0;
          if (currentCredits >= 1) {
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
            if (this.owner && this.owner.resources && (this.owner.resources.duranium || 0) > duraniumThreshold) {
              this.owner.resources.duranium = Math.max(0, (this.owner.resources.duranium || 0) - duraniumThreshold);
              bonus *= 1.5;
              console.log(`[Armor Upgrade Boosted] Consumed ${duraniumThreshold} duranium. Boosted bonus by 50% to ${bonus}`);
            }
            this.maxArmor = (this.maxArmor || 0) + bonus;
            this.armorPoints = (this.armorPoints || 0) + bonus;
          } else if (this.upgradeProp === 'munitions') {
            this.splashDamage = this.munitions;
          } else if (this.upgradeProp === 'fuel_tanker') {
            this.fuel = Math.min(this.getMaxFuel(), (this.fuel || 0) + 5);
            this.maxsupplies = (this.fuel_tanker || 0) * 15;
          } else if (this.upgradeProp === 'marines') {
            // Just capacity increases; do not load free marines upon upgrade completion
          }
          
          console.log(`[Cruiser Upgrade Complete] Ship ${this.id} upgraded ${this.upgradeProp} to level ${this[this.upgradeProp]}`);
          this.upgradeProp = null;
          this.upgradeType = null;
          this.upgradePlanetId = null;
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
              if (other.active && other.isCruiser && other.owner === this.originalAttackingPlayer && other !== originalTarget && !other.isMaterializing) {
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
                if (planet.owner === this.originalAttackingPlayer) {
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

    this.flightTime += deltaTime / 1000;

    const techBonus = this.owner ? Math.sqrt(this.owner.techScore || 0) : 0;
    const expBonus = this.owner ? Math.sqrt(this.owner.expScore || 0) : 0;
    const safeTime = techBonus + expBonus;

    let friendlyWellPlanet = null;
    if (allPlanets && this.owner) {
      for (const planet of allPlanets) {
        if (planet.owner && planet.owner === this.owner) {
          const pdx = this.x - planet.x;
          const pdy = this.y - planet.y;
          const gravityRadius = planet.getGravityRadius();
          if (pdx * pdx + pdy * pdy < gravityRadius * gravityRadius) {
            friendlyWellPlanet = planet;
            break;
          }
        }
      }
    }
    this.inFriendlyWell = friendlyWellPlanet !== null;

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
    const shipExpBonus = Math.sqrt(this.expScore || 0);
    
    // Range Calculation
    let effectiveRange = 40 * (1 + laserTechBonus);
    if (this.isAmoeba) {
      effectiveRange = 50;
    } else if (this.maxHealth > 0) {
      const xpRangeBonus = (expBonus + shipExpBonus) * 0.10;
      const baseDogfightRange = 40 * (1 + laserTechBonus + xpRangeBonus);
      effectiveRange = baseDogfightRange * 1.10;
      if (this.bombs > 0) {
        effectiveRange += baseDogfightRange * 0.10;
      }
      const targetingRangeBonus = (this.targeting || 0) * 0.05;
      effectiveRange *= (1 + targetingRangeBonus);
      if (this.fuel_tanker && this.fuel_tanker > 0) {
        effectiveRange = Math.max(5, effectiveRange - this.fuel_tanker * 5);
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
          bombAccuracyBonus = 0.05;
        } else if (this.tactics === 'frenzied') {
          bombAccuracyBonus = 0.20;
        }
      }
      hitChance += bombAccuracyBonus;
      hitChance += (techBonus + expBonus + shipExpBonus) / 100;
      const targetingBonus = (this.targeting || 0) * 0.05;
      hitChance += targetingBonus;
      if (this.fuel_tanker && this.fuel_tanker > 0) {
        hitChance -= this.fuel_tanker * 0.05;
      }
      if (this.specialbombs && this.specialbombs > 0) {
        hitChance += 0.10;
      }
    } else {
      const bombBonus = (this.bombs && this.bombs > 0) ? (this.bombs * 3) : 0;
      hitChance = (10 + techBonus + expBonus + shipExpBonus + this.maxHealth * 5 + bombBonus) / 100;
    }
    hitChance = Math.min(1.0, hitChance);

    // Rate of Fire (maxShots)
    let maxShots = 1;
    if (this.maxHealth > 0 && !this.isAmoeba) {
      maxShots = Math.max(1, Math.floor((this.maxHealth + this.health) / 6));
    } else if (this.maxHealth > 0) {
      maxShots = Math.max(1, Math.floor(this.health));
    }
    const shotsPerVolley = maxShots;
    let shotsFired = 0;

    this.fireCooldown -= (deltaTime / 1000);
    if (this.fireCooldown <= 0) {
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
          if (!enemyShip.active || enemyShip.owner === this.owner || enemyShip.isMaterializing) continue;
          if (this.isAmoeba && enemyShip.isAmoeba) continue;
          
          if (this.owner) {
            let targetedByOurBoarding = false;
            if (allShips) {
              for (const other of allShips) {
                if (other.active && other.isBoardingFleet && other.targetShipId === enemyShip.id && other.owner && other.owner.id === this.owner.id) {
                  targetedByOurBoarding = true;
                  break;
                }
              }
            }
            if (enemyShip.isUnderBoarding && enemyShip.boardingPlayer && enemyShip.boardingPlayer.id === this.owner.id && (enemyShip.boardingMarines || 0) > 0) {
              targetedByOurBoarding = true;
            }
            if (targetedByOurBoarding) continue;
          }

          if (this.owner && !this.owner.isMonster && this.owner.id !== 'monsters') {
            const isNeutralOrMonsterOrAmoeba = !enemyShip.owner || 
                                               enemyShip.ownerId === 'neutral' || 
                                               enemyShip.owner.isMonster || 
                                               enemyShip.owner.id === 'monsters' || 
                                               enemyShip.isAmoeba;
            if (!isNeutralOrMonsterOrAmoeba) {
              if (game && typeof game.isShipVisibleTo === 'function') {
                if (!game.isShipVisibleTo(enemyShip, this.owner)) {
                  continue;
                }
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
            const xpRangeBonus = (expBonus + shipExpBonus) * 0.10;
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
          const falloff = 1.0 - 0.75 * distRatio;

          const bombBonusInFinal = ((this.bombs && this.bombs > 0) ? (this.bombs * 3) : 0) / 100;
          const nonBombHitChance = Math.max(0, hitChance - bombBonusInFinal);
          const baseHitChance = nonBombHitChance * falloff + bombBonusInFinal;
          const finalHitChance = Math.min(1.0, Math.max(0.01, baseHitChance + friendlyPlanetBoost - defenderPlanetPenalty - hazardPenalty));
          
          if (s === 0) {
            if (game && game.accuracyEvents) {
              game.accuracyEvents.push({
                x: enemyShip.x,
                y: enemyShip.y,
                accuracy: Math.round(finalHitChance * 100),
                isCruiser: false,
                attackerOwnerId: this.owner ? this.owner.id : null,
                targetOwnerId: enemyShip.owner ? enemyShip.owner.id : null
              });
            }
          }

          if (Math.random() < finalHitChance) {
            const damageDealt = enemyShip.takeDamage(explosions, this, false, targetData.targetType || 'side');
            if (damageDealt && this.owner) {
              this.owner.addExperience(1);
              if (this.sourceShipId && allShips) {
                const launcher = allShips.find(sh => sh.id === this.sourceShipId && sh.active);
                if (launcher) {
                  launcher.expScore = (launcher.expScore || 0) + 1;
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
        if (this.maxHealth > 0 && !this.isAmoeba && this.bombs <= 0) {
          cooldownMultiplier = 2.0;
        }
        this.fireCooldown = (shotsPerVolley > 1 ? (1.0 / shotsPerVolley) : 1.0) * cooldownMultiplier;
        maxShots = 1; // Fire only 1 shot per trigger

         let usedBomb = false;
         let selectedTargetIndex = -1;
         let isFirstVolleyShot = false;

        if (validTargets.length > 0) {
          this.combatCooldown = 1.1;

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
              bombConsumption = 0.5 / 6;
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
                bombAccuracyBonus = 0.05;
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
          
          let falloff = 1.0 - 0.75 * distRatio;
          if (this.maxHealth > 0 && !this.isAmoeba) {
            if (this.package === 'brute') {
              falloff = 1.5 - 0.75 * distRatio;
            } else if (this.package === 'sniper') {
              falloff = 0.5 - 0.25 * distRatio;
            }
          }

          // Separating out bomb accuracy bonus from the falloff calculation
          let bombBonusInFinal = 0;
          if (this.maxHealth > 0 && !this.isAmoeba) {
            if (targetType !== 'aft' && this.bombs > 0) {
              let bonus = 0.10;
              if (this.tactics === 'patient') {
                bonus = 0.05;
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
          finalHitChance = Math.min(1.0, Math.max(minHitChance, finalHitChance + friendlyPlanetBoost - defenderPlanetPenalty - hazardPenalty));
          
          if (isFirstVolleyShot) {
            if (game && game.accuracyEvents) {
              game.accuracyEvents.push({
                x: enemyShip.x,
                y: enemyShip.y,
                accuracy: Math.round(finalHitChance * 100),
                isCruiser: true,
                attackerOwnerId: this.owner ? this.owner.id : null,
                targetOwnerId: enemyShip.owner ? enemyShip.owner.id : null
              });
            }
          }

          if (Math.random() < finalHitChance) {
            const damageDealt = enemyShip.takeDamage(explosions, this, false, targetType);
            if (damageDealt) {
              const isAttackerCruiser = this.maxHealth > 0 && !this.isAmoeba;
              if (isAttackerCruiser) {
                const isTargetCruiserOrAmoeba = enemyShip.maxHealth > 0;
                const killedShip = !isTargetCruiserOrAmoeba || !enemyShip.active;
                if (killedShip) {
                  this.expScore = (this.expScore || 0) + 0.05;
                }
              }

              if (this.owner) {
                // XP for damaging amoebas and cruisers
                if (enemyShip.isAmoeba && enemyShip.maxHealth > 0) {
                  this.owner.addExperience(enemyShip.maxHealth / 2);
                  if (this.sourceShipId && allShips) {
                    const launcher = allShips.find(sh => sh.id === this.sourceShipId && sh.active);
                    if (launcher) {
                      launcher.expScore = (launcher.expScore || 0) + enemyShip.maxHealth / 2;
                    }
                  }
                } else if (enemyShip.maxHealth > 0 && !enemyShip.isAmoeba) {
                  this.owner.addExperience(enemyShip.maxHealth / 2);
                  if (this.sourceShipId && allShips) {
                    const launcher = allShips.find(sh => sh.id === this.sourceShipId && sh.active);
                    if (launcher) {
                      launcher.expScore = (launcher.expScore || 0) + enemyShip.maxHealth / 2;
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
              enemyShip.expScore = (enemyShip.expScore || 0) + 0.25;
            }
            if (!enemyShip.active) {
              if (this.owner) {
                this.owner.addExperience(1);
                if (this.sourceShipId && allShips) {
                  const launcher = allShips.find(sh => sh.id === this.sourceShipId && sh.active);
                  if (launcher) {
                    launcher.expScore = (launcher.expScore || 0) + 1;
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
              duration: 0.8,
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
              index: 0
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
          let cruiserRadar = Math.min(250, 5 * this.maxHealth);
          if (this.isWarp) cruiserRadar *= 0.25;

          const playerTechBonus = 0.01 * Math.floor(techBonus);
          const playerExpBonus = 0.01 * expBonus;
          const baseRange = cruiserRadar * (1 + playerTechBonus + playerExpBonus);
          const shipXpBonus = Math.sqrt(this.expScore || 0);
          const sensorRange = baseRange * (100 + shipXpBonus * 3) / 100;
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
        if (!isCruiser || (this.bombPlanetsEnabled !== false && this.bombs >= 1 && (!this.planetBombardTimer || this.planetBombardTimer <= 0) && !enemyNearby)) {
          let validPlanets = [];
          for (const p of allPlanets) {
            if (p.owner === this.owner) continue;
            if (this.isAmoeba && !p.owner && (this.amoebaGrowCooldown || 0) > 0) continue;
            if (p.ships > 0) {
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
            const targetIndex = Math.floor(Math.random() * validPlanets.length);
            const p = validPlanets[targetIndex];
            
            if (p.owner && this.owner && p.owner.id !== this.owner.id) {
              this.lastAttackTimeByPlayer = this.lastAttackTimeByPlayer || {};
              this.lastAttackTimeByPlayer[p.owner.id] = Date.now();
            }
            
            shotsFired++;
            
            let destroyedDefender = false;
            let finalPlanetHitChance = this.isAmoeba ? (hitChance / 2) : hitChance;
            if (!this.isAmoeba && this.maxHealth > 0) {
              finalPlanetHitChance = Math.min(1.0, finalPlanetHitChance * 2);
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
                  age: 0, duration: 1.0, width: 8,
                  isBombAttack: true,
                  cruiserStyle: this.cruiserStyle || (this.owner ? this.owner.cruiserStyle : 'Klingon'),
                  sourceMaxHealth: this.maxHealth,
                  destroysDefender: destroyedDefender,
                  targetPlanetId: p.id,
                  sourceShipId: this.id,
                  splashDamage: this.splashDamage || 0
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
    
    // Cruiser Patrol Mode Decision Engine
    if (this.maxHealth > 0 && !this.isAmoeba && this.owner && !this.owner.isMonster && this.owner.id !== 'monsters' && this.isPatrolling) {
      // Check if fuel is 1 or less while patrolling
      if (this.fuel <= 1) {
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

        // 1. Check if out of bombs -> Reloading State
        const supplyShip = this.findNearbySupplyShip(allShips);
        const hasNearbySupply = supplyShip && (supplyShip.supplies || 0) >= 1.0;
        if ((this.bombs <= 0 && !hasNearbySupply) || (this.patrolReloading && this.bombs < this.getMaxBombs())) {
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
                const isNeutralOrMonsterOrAmoeba = !other.owner || 
                                                   other.ownerId === 'neutral' || 
                                                   other.owner.isMonster || 
                                                   other.owner.id === 'monsters' || 
                                                   other.isAmoeba;
                if (!isNeutralOrMonsterOrAmoeba) {
                  if (game && typeof game.isShipVisibleTo === 'function') {
                    isVisible = game.isShipVisibleTo(other, this.owner);
                  }
                }
                if (!isVisible) continue;
                let beingBoardedByUs = false;
                if (allShips) {
                  for (const pod of allShips) {
                    if (pod.active && pod.isBoardingFleet && pod.targetShipId === other.id && pod.owner && pod.owner.id === this.owner.id) {
                      beingBoardedByUs = true;
                      break;
                    }
                  }
                }
                if (other.isUnderBoarding && other.boardingPlayer && other.boardingPlayer.id === this.owner.id && (other.boardingMarines || 0) > 0) {
                  beingBoardedByUs = true;
                }
                if (beingBoardedByUs) continue;

                let allowedToPursue = this.scoutAttackEnabled;
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
    if (this.maxHealth > 0 && !this.isAmoeba && this.owner && !this.owner.isMonster && this.owner.id !== 'monsters' && this.isScouting) {
      // 1. Refueling & Rearming Retreat Check: if fuel is half or less, OR if attack is on and bombs are depleted
      const needsRefuel = this.fuel <= this.getMaxFuel() * 0.5;
      const supplyShip = this.findNearbySupplyShip(allShips);
      const hasNearbySupply = supplyShip && (supplyShip.supplies || 0) >= 1.0;
      const needsRearm = this.scoutAttackEnabled && this.bombs <= 0 && !hasNearbySupply;
      if (needsRefuel || needsRearm) {
        this.scoutFuelRetreating = true;
        this.scoutTargetX = null;
        this.scoutTargetY = null;
      }
      
      // If we are fuel/rearm retreating, remain in this state until fuel and bombs (if attack is enabled) are fully replenished
      if (this.scoutFuelRetreating) {
        const fullyFueled = this.fuel >= this.getMaxFuel();
        const fullyArmed = !this.scoutAttackEnabled || this.bombs >= this.getMaxBombs();
        if (fullyFueled && fullyArmed) {
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
              return true;
            }
          }
        }
        return false;
      };

      if (this.scoutFuelRetreating) {
        let needNewTarget = this.targetX === null || this.targetY === null || !this.scoutFuelRetreatTargetPlanetId;
        if (!needNewTarget && this.scoutFuelRetreatTargetPlanetId !== null && this.scoutFuelRetreatTargetPlanetId !== undefined) {
          const tp = allPlanets ? allPlanets.find(p => p.id === this.scoutFuelRetreatTargetPlanetId) : null;
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

            bestCandidate = findBestCandidate(300, 150, true);
            if (!bestCandidate) bestCandidate = findBestCandidate(500, 150, true);
            if (!bestCandidate) bestCandidate = findBestCandidate(300, 0, false);
            if (!bestCandidate) bestCandidate = findBestCandidate(500, 0, false);
          }
          
          if (bestCandidate) {
            this.targetPlanet = null;
            this.scoutFuelRetreatTargetPlanetId = bestCandidate.planet.id;
            this.targetX = bestCandidate.x;
            this.targetY = bestCandidate.y;
            this.cruiserTargetType = null;
            this.cruiserTargetId = null;
          } else {
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
              this.scoutFuelRetreatTargetPlanetId = closestFriendly.id;
              this.cruiserTargetType = null;
              this.cruiserTargetId = null;
            }
          }
        }
      } else {
        // Active Scouting (Not retreating)
        this.scoutFuelRetreating = false;
        this.scoutFuelRetreatTargetPlanetId = null;

        // A. Attack / Engage Logic vs Flee Logic
        let enemyNearby = null;
        let closestEnemyDistSq = Infinity;
        if (allShips) {
          for (const other of allShips) {
            if (other.active && other.id !== this.id) {
              const isEnemy = (other.owner && other.owner.id !== this.owner.id) || other.isAmoeba;
              if (isEnemy) {
                const dx = other.x - this.x;
                const dy = other.y - this.y;
                const distSq = dx * dx + dy * dy;
                const detectionRange = this.scoutAttackEnabled ? 500 : 300;
                if (distSq <= detectionRange * detectionRange && distSq < closestEnemyDistSq) {
                  closestEnemyDistSq = distSq;
                  enemyNearby = other;
                }
              }
            }
          }
        }

        if (enemyNearby) {
          if (this.scoutAttackEnabled && this.bombs > 0) {
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
            }
          }

          if (needNewTarget) {
            const cellSize = 200;
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

             // Filter for unexplored AND safe from storms/minefields
            let eligible = candidates.filter(c => {
              const tx = c.cx * cellSize + cellSize / 2;
              const ty = c.cy * cellSize + cellSize / 2;
              return c.lastExplored < fiveMinutesAgo && !isCellInStorm(tx, ty);
            });
            
            let targetCell = null;

            if (eligible.length > 0) {
              const friendlyPlanets = allPlanets ? allPlanets.filter(p => p.owner && p.owner.id === this.owner.id) : [];
              const friendlyShips = allShips ? allShips.filter(other => other.active && other.owner && other.owner.id === this.owner.id && other.id !== this.id) : [];

              const getMinFriendlyDistSq = (tx, ty) => {
                let minDistSq = Infinity;
                for (const p of friendlyPlanets) {
                  const dx = tx - p.x;
                  const dy = ty - p.y;
                  const distSq = dx * dx + dy * dy;
                  if (distSq < minDistSq) minDistSq = distSq;
                }
                for (const other of friendlyShips) {
                  const dx = tx - other.x;
                  const dy = ty - other.y;
                  const distSq = dx * dx + dy * dy;
                  if (distSq < minDistSq) minDistSq = distSq;
                }
                // Fallback to distance from current ship itself
                if (minDistSq === Infinity) {
                  const dx = tx - this.x;
                  const dy = ty - this.y;
                  minDistSq = dx * dx + dy * dy;
                }
                return minDistSq;
              };

              eligible.forEach(c => {
                const tx = c.cx * cellSize + cellSize / 2;
                const ty = c.cy * cellSize + cellSize / 2;
                const fDistSq = getMinFriendlyDistSq(tx, ty);
                
                // Primary priority: close to friendly space
                // Secondary priority: never explored (lastExplored === 0)
                const neverExplored = c.lastExplored === 0;
                const penalty = neverExplored ? 0 : 1500 * 1500;
                
                c.score = fDistSq + penalty;
              });

              // Sort by composite score (lowest score first)
              eligible.sort((a, b) => a.score - b.score);
              
              // Pick a random cell among the 5 closest to avoid congestion
              const pool = eligible.slice(0, Math.min(5, eligible.length));
              targetCell = pool[Math.floor(Math.random() * pool.length)];
            } else {
              // Fall back to oldest explored cells that are safe from storms
              let noStormCandidates = candidates.filter(c => {
                const tx = c.cx * cellSize + cellSize / 2;
                const ty = c.cy * cellSize + cellSize / 2;
                return !isCellInStorm(tx, ty);
              });

              if (noStormCandidates.length > 0) {
                noStormCandidates.sort((a, b) => a.lastExplored - b.lastExplored);
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
    if (this.maxHealth > 0 && !this.isAmoeba && this.owner && !this.owner.isMonster && this.owner.id !== 'monsters' && this.isResearching && this.labs > 0) {
      // 1. Refueling Retreat Check: if fuel is less than 2
      if (this.fuel < 2) {
        this.researchFuelRetreating = true;
      }
      
      // If we are fuel retreating, remain in this state until fuel is fully replenished
      if (this.researchFuelRetreating) {
        if (this.fuel >= this.getMaxFuel()) {
          this.researchFuelRetreating = false;
          this.researchFuelRetreatTargetPlanetId = null;
        }
      }

      if (this.researchFuelRetreating) {
        let needNewTarget = this.targetX === null || this.targetY === null || !this.researchFuelRetreatTargetPlanetId;
        if (!needNewTarget && this.researchFuelRetreatTargetPlanetId) {
          const tp = allPlanets ? allPlanets.find(p => p.id === this.researchFuelRetreatTargetPlanetId) : null;
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

            bestCandidate = findBestCandidate(300, 150, true);
            if (!bestCandidate) bestCandidate = findBestCandidate(500, 150, true);
            if (!bestCandidate) bestCandidate = findBestCandidate(300, 0, false);
            if (!bestCandidate) bestCandidate = findBestCandidate(500, 0, false);
          }

          if (bestCandidate) {
            this.targetPlanet = null;
            this.researchFuelRetreatTargetPlanetId = bestCandidate.planet.id;
            this.targetX = bestCandidate.x;
            this.targetY = bestCandidate.y;
            this.cruiserTargetType = null;
            this.cruiserTargetId = null;
          } else {
            let closestFriendly = null;
            let minFriendlyDistSq = Infinity;
            for (const p of friendlyPlanets) {
              const dx = p.x - this.x;
              const dy = p.y - this.y;
              const distSq = dx * dx + dy * dy;
              if (distSq < minFriendlyDistSq) {
                minFriendlyDistSq = distSq;
                closestFriendly = p;
              }
            }
            if (closestFriendly) {
              this.targetPlanet = closestFriendly;
              this.targetX = closestFriendly.x;
              this.targetY = closestFriendly.y;
              this.researchFuelRetreatTargetPlanetId = closestFriendly.id;
              this.cruiserTargetType = null;
              this.cruiserTargetId = null;
            }
          }
        }
      } else {
        // 2. Rearming Retreat Check: if attack mode is also on and bombs are depleted
        const supplyShip = this.findNearbySupplyShip(allShips);
        const hasNearbySupply = supplyShip && (supplyShip.supplies || 0) >= 1.0;
        const needsRearm = this.scoutAttackEnabled && this.bombs <= 0 && !hasNearbySupply;
        if (needsRearm || this.researchRearming) {
          this.researchRearming = true;
          if (this.bombs >= this.getMaxBombs()) {
            this.researchRearming = false;
            this.researchRearmTargetPlanetId = null;
          }
        }

        if (this.researchRearming) {
          let needNewTarget = this.targetX === null || this.targetY === null || !this.researchRearmTargetPlanetId;
          if (!needNewTarget && this.researchRearmTargetPlanetId) {
            const tp = allPlanets ? allPlanets.find(p => p.id === this.researchRearmTargetPlanetId) : null;
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

              bestCandidate = findBestCandidate(300, 150, true);
              if (!bestCandidate) bestCandidate = findBestCandidate(500, 150, true);
              if (!bestCandidate) bestCandidate = findBestCandidate(300, 0, false);
              if (!bestCandidate) bestCandidate = findBestCandidate(500, 0, false);
            }

            if (bestCandidate) {
              this.targetPlanet = null;
              this.researchRearmTargetPlanetId = bestCandidate.planet.id;
              this.targetX = bestCandidate.x;
              this.targetY = bestCandidate.y;
              this.cruiserTargetType = null;
              this.cruiserTargetId = null;
            } else {
              let closestFriendly = null;
              let minFriendlyDistSq = Infinity;
              for (const p of friendlyPlanets) {
                const dx = p.x - this.x;
                const dy = p.y - this.y;
                const distSq = dx * dx + dy * dy;
                if (distSq < minFriendlyDistSq) {
                  minFriendlyDistSq = distSq;
                  closestFriendly = p;
                }
              }
              if (closestFriendly) {
                this.targetPlanet = closestFriendly;
                this.targetX = closestFriendly.x;
                this.targetY = closestFriendly.y;
                this.researchRearmTargetPlanetId = closestFriendly.id;
                this.cruiserTargetType = null;
                this.cruiserTargetId = null;
              }
            }
          }
        } else {
          // 3. Normal actions
          let didAction = false;

          // If attack mode is also on, seek active amoebas
          if (this.scoutAttackEnabled && this.bombs > 0) {
            let nearestAmoeba = null;
            let minAmoebaDistSq = Infinity;
            if (allShips) {
              for (const other of allShips) {
                if (other.active && other.isAmoeba) {
                  const dx = other.x - this.x;
                  const dy = other.y - this.y;
                  const distSq = dx * dx + dy * dy;
                  if (distSq <= 500 * 500) {
                    const isFogEnabled = game && game.settings && game.settings.fogOfWar;
                    const isVisible = !isFogEnabled || (this.owner && this.owner.isAI) || (game && typeof game.isCoordinateVisible === 'function' && game.isCoordinateVisible(other.x, other.y, this.owner));
                    if (isVisible && distSq < minAmoebaDistSq) {
                      minAmoebaDistSq = distSq;
                      nearestAmoeba = other;
                    }
                  }
                }
              }
            }
            if (nearestAmoeba) {
              this.targetPlanet = null;
              this.targetX = nearestAmoeba.x;
              this.targetY = nearestAmoeba.y;
              this.cruiserTargetType = 'ship';
              this.cruiserTargetId = nearestAmoeba.id;
              didAction = true;
            }
          }

          // Seek active hazards to research and park outside of them
          if (!didAction) {
            let bestHazard = null;
            let minHazardDistSq = Infinity;
            if (ionStorms) {
              for (const storm of ionStorms) {
                const k = storm.knowledge[this.owner.id] || 0;
                const tR = Math.sqrt(this.owner.techScore || 0);
                const eR = Math.sqrt(this.owner.expScore || 0);
                const effectiveIntensity = Math.max(0, storm.intensity - k - (tR + eR) / 2);
                if (effectiveIntensity > 0) {
                  const isFogEnabled = game && game.settings && game.settings.fogOfWar;
                  const isVisible = !isFogEnabled || (this.owner && this.owner.isAI) || (game && typeof game.isCoordinateVisible === 'function' && game.isCoordinateVisible(storm.x, storm.y, this.owner));
                  if (isVisible) {
                    const dx = storm.x - this.x;
                    const dy = storm.y - this.y;
                    const distSq = dx * dx + dy * dy;
                    if (distSq < minHazardDistSq) {
                      minHazardDistSq = distSq;
                      bestHazard = storm;
                    }
                  }
                }
              }
            }

            if (bestHazard) {
              const dx = this.x - bestHazard.x;
              const dy = this.y - bestHazard.y;
              const d = Math.sqrt(dx * dx + dy * dy);
              
              let cruiserRadar = Math.min(250, 5 * this.maxHealth);
              if (this.isWarp) cruiserRadar *= 0.25;
              if (this.sensorarrays > 0) {
                cruiserRadar *= (1.0 + this.sensorarrays * 0.20);
              }
              const shipXpBonus = Math.sqrt(this.expScore || 0);
              const finalCruiserRadar = cruiserRadar * (100 + shipXpBonus * 3) / 100;
              const parkingDist = bestHazard.radius + Math.max(20, finalCruiserRadar - 40);

              this.targetPlanet = null;
              if (d > 0) {
                this.targetX = bestHazard.x + (dx / d) * parkingDist;
                this.targetY = bestHazard.y + (dy / d) * parkingDist;
              } else {
                this.targetX = bestHazard.x + parkingDist;
                this.targetY = bestHazard.y;
              }
              this.cruiserTargetType = null;
              this.cruiserTargetId = null;
              didAction = true;
            }
          }

          // If no hazards or amoebas, park at the closest friendly planet
          if (!didAction) {
            const friendlyPlanets = allPlanets ? allPlanets.filter(p => p.owner && p.owner.id === this.owner.id) : [];
            let closestFriendly = null;
            let minFriendlyDistSq = Infinity;
            for (const p of friendlyPlanets) {
              const dx = p.x - this.x;
              const dy = p.y - this.y;
              const distSq = dx * dx + dy * dy;
              if (distSq < minFriendlyDistSq) {
                minFriendlyDistSq = distSq;
                closestFriendly = p;
              }
            }
            if (closestFriendly) {
              this.targetPlanet = closestFriendly;
              this.targetX = closestFriendly.x;
              this.targetY = closestFriendly.y;
              this.cruiserTargetType = null;
              this.cruiserTargetId = null;
            }
          }
        }
      }
    }

    // Cruiser Diplomacy Mode Decision Engine
    if (this.maxHealth > 0 && !this.isAmoeba && this.owner && !this.owner.isMonster && this.owner.id !== 'monsters' && this.isDiplomacy && this.diplomat > 0) {
      // 1. Refueling Retreat Check
      if (this.fuel < 2) {
        this.diplomacyFuelRetreating = true;
      }
      
      if (this.diplomacyFuelRetreating) {
        if (this.fuel >= this.getMaxFuel()) {
          this.diplomacyFuelRetreating = false;
          this.diplomacyFuelRetreatTargetPlanetId = null;
        }
      }

      // 1b. Enemy Close Retreat Check (Diplomacy mode fleeing)
      let enemyClose = false;
      if (allShips) {
        for (const other of allShips) {
          if (other.active && other.id !== this.id) {
            const isEnemy = (other.owner && other.owner.id !== this.owner.id && !other.isMaterializing) || other.isAmoeba;
            if (isEnemy) {
              const dx = other.x - this.x;
              const dy = other.y - this.y;
              if (dx * dx + dy * dy <= 300 * 300) {
                enemyClose = true;
                break;
              }
            }
          }
        }
      }

      if (enemyClose && !this.scoutAttackEnabled) {
        this.diplomacyFleeing = true;
      }

      if (this.diplomacyFleeing) {
        // Stop fleeing if we are in a friendly gravity well and no enemies are close
        if (this.inFriendlyWell && !enemyClose) {
          this.diplomacyFleeing = false;
          this.diplomacyFleeTargetPlanetId = null;
        }
      }

      if (this.diplomacyFuelRetreating || this.diplomacyFleeing) {
        let needNewTarget = this.targetX === null || this.targetY === null || (!this.diplomacyFuelRetreatTargetPlanetId && !this.diplomacyFleeTargetPlanetId);
        if (!needNewTarget) {
          const targetId = this.diplomacyFuelRetreatTargetPlanetId || this.diplomacyFleeTargetPlanetId;
          const tp = allPlanets ? allPlanets.find(p => p.id === targetId) : null;
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

            bestCandidate = findBestCandidate(300, 150, true);
            if (!bestCandidate) bestCandidate = findBestCandidate(500, 150, true);
            if (!bestCandidate) bestCandidate = findBestCandidate(300, 0, false);
            if (!bestCandidate) bestCandidate = findBestCandidate(500, 0, false);
          }

          if (bestCandidate) {
            this.targetPlanet = null;
            if (this.diplomacyFuelRetreating) {
              this.diplomacyFuelRetreatTargetPlanetId = bestCandidate.planet.id;
            } else {
              this.diplomacyFleeTargetPlanetId = bestCandidate.planet.id;
            }
            this.targetX = bestCandidate.x;
            this.targetY = bestCandidate.y;
            this.cruiserTargetType = null;
            this.cruiserTargetId = null;
          } else {
            let closestFriendly = null;
            let minFriendlyDistSq = Infinity;
            for (const p of friendlyPlanets) {
              const dx = p.x - this.x;
              const dy = p.y - this.y;
              const distSq = dx * dx + dy * dy;
              if (distSq < minFriendlyDistSq) {
                minFriendlyDistSq = distSq;
                closestFriendly = p;
              }
            }
            if (closestFriendly) {
              this.targetPlanet = closestFriendly;
              this.targetX = closestFriendly.x;
              this.targetY = closestFriendly.y;
              if (this.diplomacyFuelRetreating) {
                this.diplomacyFuelRetreatTargetPlanetId = closestFriendly.id;
              } else {
                this.diplomacyFleeTargetPlanetId = closestFriendly.id;
              }
              this.cruiserTargetType = null;
              this.cruiserTargetId = null;
            }
          }
        }
      } else {
        // 2. Normal Operations
        const diplomatCruisers = allShips ? allShips.filter(s => s.active && s.isCruiser && s.owner && s.owner.id === this.owner.id && s.diplomat > 0 && s.isDiplomacy) : [];
        const isMostExperienced = diplomatCruisers.every(s => s.id === this.id || s.expScore < this.expScore || (s.expScore === this.expScore && this.id < s.id));
        
        let didAction = false;
        
        // Helper to check if the player has discovered/revealed the planet
        const isPlanetDiscovered = (p) => {
          const isFogEnabled = game && game.settings && game.settings.fogOfWar;
          if (!isFogEnabled || (this.owner && this.owner.isAI)) {
            return true;
          }
          return this.owner && this.owner.discoveredPlanets && this.owner.discoveredPlanets.has(p.id);
        };

        // Helper to check if a planet has enemies nearby (within 400px)
        const hasEnemiesNearby = (p) => {
          if (!allShips) return false;
          for (const s of allShips) {
            if (s.active && s.id !== this.id) {
              const isEnemy = (s.owner && s.owner.id !== this.owner.id) || s.isAmoeba;
              if (isEnemy) {
                const dx = s.x - p.x;
                const dy = s.y - p.y;
                if (dx * dx + dy * dy <= 400 * 400) {
                  return true;
                }
              }
            }
          }
          return false;
        };

        // Behavior A: Most Experienced cruiser seeks planet without disposition and parks outside
        if (isMostExperienced) {
          const noDispPlanets = allPlanets ? allPlanets.filter(p => p.owner !== this.owner && (!p.disposition || p.disposition[this.owner.id] === undefined) && isPlanetDiscovered(p)) : [];
          if (noDispPlanets.length > 0) {
            const sortedNoDisp = [...noDispPlanets].sort((a, b) => {
              const enemiesA = hasEnemiesNearby(a) ? 1 : 0;
              const enemiesB = hasEnemiesNearby(b) ? 1 : 0;
              if (enemiesA !== enemiesB) {
                return enemiesA - enemiesB; // 0 comes before 1
              }
              const distSqA = (a.x - this.x) * (a.x - this.x) + (a.y - this.y) * (a.y - this.y);
              const distSqB = (b.x - this.x) * (b.x - this.x) + (b.y - this.y) * (b.y - this.y);
              return distSqA - distSqB;
            });
            const closestPlanet = sortedNoDisp[0];
            if (closestPlanet) {
              // Calculate sensor range
              let cruiserRadar = Math.min(250, 5 * this.maxHealth);
              if (this.isWarp) cruiserRadar *= 0.25;
              if (this.sensorarrays > 0) {
                cruiserRadar *= (1.0 + this.sensorarrays * 0.20);
              }
              const playerTechBonus = 0.01 * Math.floor(Math.sqrt(this.owner.techScore || 0));
              const playerExpBonus = 0.01 * Math.sqrt(this.owner.expScore || 0);
              const baseRange = cruiserRadar * (1 + playerTechBonus + playerExpBonus);
              const shipXpBonus = Math.sqrt(this.expScore || 0);
              const sensorRange = baseRange * (100 + shipXpBonus * 3) / 100;
              const halfSensorRange = sensorRange / 2;
              
              const dx = this.x - closestPlanet.x;
              const dy = this.y - closestPlanet.y;
              const d = Math.sqrt(dx * dx + dy * dy);
              this.targetPlanet = null;
              if (d > 0) {
                this.targetX = closestPlanet.x + (dx / d) * halfSensorRange;
                this.targetY = closestPlanet.y + (dy / d) * halfSensorRange;
              } else {
                this.targetX = closestPlanet.x + halfSensorRange;
                this.targetY = closestPlanet.y;
              }
              this.cruiserTargetType = null;
              this.cruiserTargetId = null;
              didAction = true;
            }
          }
        }
        
        // Behavior B: Seek planet with highest disposition and sympathy less than ships
        if (!didAction) {
          const qualPlanets = allPlanets ? allPlanets.filter(p => p.owner !== this.owner && (p.sympathy ? (p.sympathy[this.owner.id] || 0) : 0) < p.ships && isPlanetDiscovered(p)) : [];
          if (qualPlanets.length > 0) {
            qualPlanets.sort((a, b) => {
              const enemiesA = hasEnemiesNearby(a) ? 1 : 0;
              const enemiesB = hasEnemiesNearby(b) ? 1 : 0;
              if (enemiesA !== enemiesB) {
                return enemiesA - enemiesB;
              }
              const dispA = a.disposition ? (a.disposition[this.owner.id] || 0) : 0;
              const dispB = b.disposition ? (b.disposition[this.owner.id] || 0) : 0;
              if (dispA !== dispB) {
                return dispB - dispA;
              }
              const distSqA = (a.x - this.x) * (a.x - this.x) + (a.y - this.y) * (a.y - this.y);
              const distSqB = (b.x - this.x) * (b.x - this.x) + (b.y - this.y) * (b.y - this.y);
              return distSqA - distSqB;
            });
            const bestPlanet = qualPlanets[0];
            this.targetPlanet = bestPlanet;
            this.targetX = bestPlanet.x;
            this.targetY = bestPlanet.y;
            this.cruiserTargetType = null;
            this.cruiserTargetId = null;
            didAction = true;
          }
        }
        
        // Idle Fallback
        if (!didAction) {
          const friendlyPlanets = allPlanets ? allPlanets.filter(p => p.owner && p.owner.id === this.owner.id) : [];
          let closestFriendly = null;
          let minFriendlyDistSq = Infinity;
          for (const p of friendlyPlanets) {
            const dx = p.x - this.x;
            const dy = p.y - this.y;
            const distSq = dx * dx + dy * dy;
            if (distSq < minFriendlyDistSq) {
              minFriendlyDistSq = distSq;
              closestFriendly = p;
            }
          }
          if (closestFriendly) {
            this.targetPlanet = closestFriendly;
            this.targetX = closestFriendly.x;
            this.targetY = closestFriendly.y;
            this.cruiserTargetType = null;
            this.cruiserTargetId = null;
          }
        }
      }
    }

    if (this.bombPlanetsEnabled === false || !this.scoutAttackEnabled) {
      this.bombardRearming = false;
      this.bombardRearmTargetPlanetId = null;
    }

    // Cruiser Bombard Mode Decision Engine
    if (this.maxHealth > 0 && !this.isAmoeba && this.owner && !this.owner.isMonster && this.owner.id !== 'monsters' && !this.isPatrolling && this.bombPlanetsEnabled !== false && this.scoutAttackEnabled) {
      // If out of bombs and not in a friendly gravity well, enter rearming retreat mode
      const supplyShip = this.findNearbySupplyShip(allShips);
      const hasNearbySupply = supplyShip && (supplyShip.supplies || 0) >= 1.0;
      if (this.bombs <= 0 && !this.inFriendlyWell && !hasNearbySupply) {
        this.bombardRearming = true;
      }
      
      // Exit rearming retreat mode once fully replenished
      if (this.bombardRearming) {
        if (this.bombs >= this.getMaxBombs()) {
          this.bombardRearming = false;
        }
      }
      
      if (this.bombardRearming) {
        // Retreat to friendly gravity well to replenish bombs
        let needNewTarget = this.targetX === null || this.targetY === null || !this.bombardRearmTargetPlanetId;
        if (!needNewTarget && this.bombardRearmTargetPlanetId !== null && this.bombardRearmTargetPlanetId !== undefined) {
          const tp = allPlanets ? allPlanets.find(p => p.id === this.bombardRearmTargetPlanetId) : null;
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
            
            bestCandidate = findBestCandidate(300, 150, true);
            if (!bestCandidate) bestCandidate = findBestCandidate(500, 150, true);
            if (!bestCandidate) bestCandidate = findBestCandidate(300, 0, false);
            if (!bestCandidate) bestCandidate = findBestCandidate(500, 0, false);
          }
          
          if (bestCandidate) {
            this.targetPlanet = null;
            this.bombardRearmTargetPlanetId = bestCandidate.planet.id;
            this.targetX = bestCandidate.x;
            this.targetY = bestCandidate.y;
            this.cruiserTargetType = null;
            this.cruiserTargetId = null;
          } else {
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
              this.bombardRearmTargetPlanetId = closestFriendly.id;
              this.cruiserTargetType = null;
              this.cruiserTargetId = null;
            }
          }
        }
      } else {
        this.bombardRearming = false;
        this.bombardRearmTargetPlanetId = null;
        
        // Find the lowest ship count enemy or neutral planet within 500px
        let bestTarget = null;
        let lowestShips = Infinity;
        
        if (allPlanets) {
          for (const p of allPlanets) {
            if (p.owner !== this.owner && this.canSeeStats(p, allPlanets, allShips, game)) {
              const dx = p.x - this.x;
              const dy = p.y - this.y;
              const distSq = dx * dx + dy * dy;
              if (distSq <= 500 * 500) {
                if (p.ships < lowestShips) {
                  lowestShips = p.ships;
                  bestTarget = p;
                }
              }
            }
          }
        }
        
        if (bestTarget) {
          const dx = this.x - bestTarget.x;
          const dy = this.y - bestTarget.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const bombRange = effectiveRange + bestTarget.radius;
          const stopDist = bombRange * 0.5;
          
          if (dist > stopDist + 2) {
            // Move to a distance from the planet equal to half the bombing range
            const angle = Math.atan2(dy, dx);
            this.targetPlanet = null;
            this.targetX = bestTarget.x + Math.cos(angle) * stopDist;
            this.targetY = bestTarget.y + Math.sin(angle) * stopDist;
            this.cruiserTargetType = null;
            this.cruiserTargetId = null;
          } else {
            // Already close enough! Stop moving and target the planet to bombard it
            this.targetPlanet = null;
            this.targetX = this.x;
            this.targetY = this.y;
            this.cruiserTargetType = 'planet';
            this.cruiserTargetId = bestTarget.id;
          }
        }
      }
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
      
      if (targetObj && targetObj.active !== false && (!isPlanet || targetObj.owner === this.owner || (targetObj.owner !== this.owner && this.canSeeStats(targetObj, allPlanets, allShips, game)))) {
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
          const isOwnPlanet = targetObj.owner === this.owner;
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
          if (this.isPatrolling && this.bombs > 0) {
            if (this.package === 'brute') {
              // Brute cruiser: attempt to get as near as possible (no stop range check except contact range 15px)
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
              // Non-brute patrolling cruiser with bombs: try to stay just within its bomb engagement range
              let strategyThreshold = 0.75; // Normal default
              if (this.strategy === 'short') {
                strategyThreshold = 0.50;
              } else if (this.strategy === 'long') {
                strategyThreshold = 1.00;
              }
              const bombEngagementRange = maxFrontRange * strategyThreshold;
              
              if (dist <= bombEngagementRange && isTargetInFront) {
                this.targetX = this.x;
                this.targetY = this.y;
                this.targetPlanet = null;
              } else {
                const angle = Math.atan2(tdy, tdx);
                this.targetX = targetObj.x - Math.cos(angle) * bombEngagementRange;
                this.targetY = targetObj.y - Math.sin(angle) * bombEngagementRange;
                this.targetPlanet = null;
              }
            }
          } else if (this.package === 'brute' && this.bombs > 0) {
            // Non-patrolling (dogfight) brute cruiser with bombs: get as near as possible (no stop range check except contact range 15px)
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
            // Standard non-patrolling or non-bomb ship target movement
            if (isTargetInFront && dist <= maxFrontRange - 5) {
              // Target is in range and in front arc! Stop moving
              this.targetX = this.x;
              this.targetY = this.y;
              this.targetPlanet = null;
            } else {
              // Target is either out of range or in side/aft arc! Move towards it to steer/close in
              this.targetX = tx;
              this.targetY = ty;
              this.targetPlanet = null;
            }
          }
        }
      } else {
        // Target was conquered/destroyed or doesn't exist anymore! Stop moving
        this.cruiserTargetType = null;
        this.cruiserTargetId = null;
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
        
        // Collision check
        const tdx = target.x - this.x;
        const tdy = target.y - this.y;
        const dist = Math.sqrt(tdx * tdx + tdy * tdy);
        if (dist < 15) {
          // Trigger boarding on target ship!
          target.isUnderBoarding = true;
          target.boardingPlayer = this.owner;
          target.boardingMarines = (target.boardingMarines || 0) + this.count;
          target.boardingSourceId = this.sourceShipId;
          this.active = false; // consume marine fleet
          console.log(`[MARINE FLEET BOARDING IMPACT] Marine fleet collided with target ship ${target.id}, boarding with ${this.count} marines.`);
          
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
      } else {
        // Target is destroyed
        this.active = false;
        return;
      }
    }

    let destX = this.targetPlanet ? (this.targetPlanet.x + (this.cruiserTargetOffsetX || 0)) : this.targetX;
    let destY = this.targetPlanet ? (this.targetPlanet.y + (this.cruiserTargetOffsetY || 0)) : this.targetY;

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

    if (this.isCruiser && !this.isUpgrading && this.orderQueue && this.orderQueue.length > 0) {
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
    }
    
    if (moveDistanceToDest > 0) {
      const desiredAngle = Math.atan2(dy, dx);
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
      this.crew = Math.min(this.crew || 0, 2 * this.health);
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
                other.fuel -= 1;
                this.fuel += 1;
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
      
      // Don't convert fuel to munitions.
      
      // Load supplies if in friendly gravity well, up to maxsupplies, 1 every 10 seconds.
      if (this.maxsupplies > 0 && this.supplies < this.maxsupplies && this.inFriendlyWell && !this.isWarp) {
        this.supplyLoadAccumulator = (this.supplyLoadAccumulator || 0) + deltaTime;
        while (this.supplyLoadAccumulator >= 10000 && this.supplies < this.maxsupplies) {
          const owner = this.owner;
          if (owner) {
            const discount = 0.10 * (this.fuel_tanker || 0);
            const costMultiplier = Math.max(0, 1.0 - discount);
            let loaded = false;

            if (owner.useCredits !== false) {
              const costCredits = 1.0 * costMultiplier;
              if ((owner.credits || 0) >= costCredits) {
                owner.credits -= costCredits;
                this.supplies++;
                loaded = true;
              }
            } else if (friendlyWellPlanet && friendlyWellPlanet.ships >= 1.0 * costMultiplier) {
              const costShips = 1.0 * costMultiplier;
              friendlyWellPlanet.ships -= costShips;
              this.supplies++;
              loaded = true;
            }

            if (loaded) {
              this.supplyLoadAccumulator -= 10000;
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

      if (this.inFriendlyWell && !inCombat) {
        finalHealRate = 6 * (1 + 0.50 * (this.damagecontrol || 0));
      } else {
        finalHealRate = 6 * (0.20 * (this.damagecontrol || 0));
      }

      if (this.health < this.maxHealth && finalHealRate > 0) {
        const owner = this.owner;
        const hasExcessDuranium = owner && owner.resources && (owner.resources.duranium || 0) >= 0.1;
        const duraniumSellPrice = owner ? (owner.offerPrice?.duranium ?? 3) : 3;

        // Check for nearby supply ship first!
        const supplyShip = this.findNearbySupplyShip(allShips);

        let canAffordHeal = false;
        if (supplyShip && (supplyShip.supplies || 0) > 0) {
          canAffordHeal = true;
        } else if (hasExcessDuranium && duraniumSellPrice < 12) {
          canAffordHeal = true;
        } else if (owner && owner.useCredits !== false) {
          canAffordHeal = true;
        } else if (friendlyWellPlanet && friendlyWellPlanet.ships > 0) {
          canAffordHeal = true;
        }

        if (canAffordHeal) {
          let healAmount = (deltaTime / 60000) * finalHealRate;
          const oldHealth = this.health || 0;
          this.health = Math.min(this.maxHealth, this.health + healAmount);
          const amountHealed = this.health - oldHealth;
          if (amountHealed > 0 && owner && !owner.isMonster && owner.id !== 'monsters') {
            if (supplyShip && (supplyShip.supplies || 0) > 0) {
              const suppliesUsed = amountHealed;
              if (supplyShip.supplies >= suppliesUsed) {
                supplyShip.supplies -= suppliesUsed;
              } else {
                const remainingHeal = suppliesUsed - supplyShip.supplies;
                supplyShip.supplies = 0;
                if (hasExcessDuranium && duraniumSellPrice < 12) {
                  const consumed = (1/12) * remainingHeal;
                  owner.resources.duranium = (owner.resources.duranium || 0) - consumed;
                  this.specialduranium = (this.specialduranium || 0) + remainingHeal;
                  if (!this.resourceConsumeEvents) this.resourceConsumeEvents = { deuterium: 0, tritanium: 0, duranium: 0, merculite: 0, antimatter: 0, dilithium: 0 };
                  if (!this.resourceAccumulators) this.resourceAccumulators = { deuterium: 0, tritanium: 0, duranium: 0, merculite: 0, antimatter: 0, dilithium: 0 };
                  this.resourceAccumulators.duranium = (this.resourceAccumulators.duranium || 0) + consumed;
                  if (this.resourceAccumulators.duranium >= 0.0833) {
                    this.resourceConsumeEvents.duranium = (this.resourceConsumeEvents.duranium || 0) + 1;
                    this.resourceAccumulators.duranium -= 0.0833;
                  }
                } else if (owner.useCredits !== false) {
                  owner.credits = (owner.credits || 0) - 1.0 * remainingHeal;
                } else if (friendlyWellPlanet) {
                  friendlyWellPlanet.ships = Math.max(0, friendlyWellPlanet.ships - 1.0 * remainingHeal);
                }
              }
            } else {
              if (hasExcessDuranium && duraniumSellPrice < 12) {
                const consumed = (1/12) * amountHealed;
                owner.resources.duranium = (owner.resources.duranium || 0) - consumed;
                this.specialduranium = (this.specialduranium || 0) + amountHealed;
                if (!this.resourceConsumeEvents) this.resourceConsumeEvents = { deuterium: 0, tritanium: 0, duranium: 0, merculite: 0, antimatter: 0, dilithium: 0 };
                if (!this.resourceAccumulators) this.resourceAccumulators = { deuterium: 0, tritanium: 0, duranium: 0, merculite: 0, antimatter: 0, dilithium: 0 };
                this.resourceAccumulators.duranium = (this.resourceAccumulators.duranium || 0) + consumed;
                if (this.resourceAccumulators.duranium >= 0.0833) {
                  this.resourceConsumeEvents.duranium = (this.resourceConsumeEvents.duranium || 0) + 1;
                  this.resourceAccumulators.duranium -= 0.0833;
                }
              } else if (owner.useCredits !== false) {
                owner.credits = (owner.credits || 0) - 1.0 * amountHealed;
              } else if (friendlyWellPlanet) {
                friendlyWellPlanet.ships = Math.max(0, friendlyWellPlanet.ships - 1.0 * amountHealed);
              }
            }
          }
        }
      }

      if (this.inFriendlyWell) {
        if (this.armorPoints < this.maxArmor) {
          let armorHealRate = (deltaTime / 60000) * 3;
          this.armorPoints = Math.min(this.maxArmor, (this.armorPoints || 0) + armorHealRate);
        }
        
        // Cruisers don't recover bombs or fuel while in warp
        if (!this.isWarp) {
          const recoveryRate = (this.combatCooldown && this.combatCooldown > 0) ? 0.5 : 1.0;
          const oldFuel = this.fuel || 0;

          const owner = this.owner;
          const hasExcessDeuterium = owner && owner.resources && (owner.resources.deuterium || 0) >= 0.1;
          const deuteriumSellPrice = owner ? (owner.offerPrice?.deuterium ?? 3) : 3;

          let canAffordRefuel = false;
          if (hasExcessDeuterium && deuteriumSellPrice < 12) {
            canAffordRefuel = true;
          } else if (owner && owner.useCredits !== false) {
            canAffordRefuel = true;
          } else if (friendlyWellPlanet && friendlyWellPlanet.ships > 0) {
            canAffordRefuel = true;
          }

          if (canAffordRefuel) {
            const fuelToGain = ((deltaTime / 1000) / 10) * recoveryRate;
            this.fuel = Math.min(this.getMaxFuel(), oldFuel + fuelToGain);
            const amountRefueled = (this.fuel || 0) - oldFuel;
            if (amountRefueled > 0 && owner && !owner.isMonster && owner.id !== 'monsters') {
              let costMultiplier = 1.0;
              if (this.fuel_tanker && this.fuel_tanker > 0) {
                costMultiplier = Math.max(0, 1.0 - (0.50 + 0.10 * this.fuel_tanker));
              }

              if (hasExcessDeuterium && deuteriumSellPrice < 12) {
                const consumed = (1/12) * amountRefueled * costMultiplier;
                owner.resources.deuterium = (owner.resources.deuterium || 0) - consumed;
                this.specialfuel = (this.specialfuel || 0) + amountRefueled;
                if (!this.resourceConsumeEvents) this.resourceConsumeEvents = { deuterium: 0, tritanium: 0, merculite: 0, antimatter: 0, dilithium: 0 };
                if (!this.resourceAccumulators) this.resourceAccumulators = { deuterium: 0, tritanium: 0, merculite: 0, antimatter: 0, dilithium: 0 };
                this.resourceAccumulators.deuterium = (this.resourceAccumulators.deuterium || 0) + consumed;
                if (this.resourceAccumulators.deuterium >= 0.0833) {
                  this.resourceConsumeEvents.deuterium = (this.resourceConsumeEvents.deuterium || 0) + 1;
                  this.resourceAccumulators.deuterium -= 0.0833;
                }
              } else if (owner.useCredits !== false) {
                owner.credits = (owner.credits || 0) - 1.0 * amountRefueled * costMultiplier;
              } else if (friendlyWellPlanet) {
                friendlyWellPlanet.ships = Math.max(0, friendlyWellPlanet.ships - 1.0 * amountRefueled * costMultiplier);
              }
            }
          }
          
          const supplyShipForBombs = this.findNearbySupplyShip(allShips);
          if (this.bombs < this.getMaxBombs() && (friendlyWellPlanet || supplyShipForBombs)) {
            const maxBombs = this.getMaxBombs();
            const reloadMultiplier = 0.5 * (1 + 0.1 * maxBombs);
            this.bombReloadTimer += (deltaTime / 1000) * reloadMultiplier * recoveryRate;
            if (this.bombReloadTimer >= 5) {
              let bombResource = 'merculite';
              const style = this.cruiserStyle || (owner ? owner.cruiserStyle : null);
              if (style === 'Romulan' || style === 'Gorn') {
                bombResource = 'antimatter';
              } else if (style === 'Tholian' || style === 'Lyran') {
                bombResource = 'dilithium';
              }

              const hasExcessResource = owner && owner.resources && (owner.resources[bombResource] || 0) >= 0.1;
              const resourceSellPrice = owner ? (owner.offerPrice?.[bombResource] ?? 3) : 3;

              let canAffordReload = false;
              if (supplyShipForBombs && supplyShipForBombs.supplies >= 1.0) {
                canAffordReload = true;
              } else if (hasExcessResource && resourceSellPrice < 12) {
                canAffordReload = true;
              } else if (owner && owner.useCredits !== false) {
                canAffordReload = true;
              } else if (friendlyWellPlanet && friendlyWellPlanet.ships >= 1.0) {
                canAffordReload = true;
              }

              if (canAffordReload) {
                this.bombReloadTimer = 0;
                this.bombs++;
                if (owner && !owner.isMonster && owner.id !== 'monsters') {
                  if (supplyShipForBombs && supplyShipForBombs.supplies >= 1.0) {
                    supplyShipForBombs.supplies -= 1.0;
                  } else if (hasExcessResource && resourceSellPrice < 12) {
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
              } else {
                this.bombReloadTimer = 5;
              }
            }
          }
        }
      } else {
        let fuelDrain = this.isWarp ? 8 : 4;
        if (this.isCruiser && distance < 5) {
          fuelDrain *= 0.25;
        }
        const sizeModifier = (this.maxHealth || 25) / 25;
        this.fuel = (this.fuel || 0) - sizeModifier * (deltaTime / 1000) / (60 / fuelDrain);
        if (this.fuel <= 0) {
          this.fuel = 0;
          if (this.isWarp) {
            this.isWarp = false;
          }
          const d6 = Math.floor(Math.random() * 6) + 1;
          this.health -= d6 * (deltaTime / 60000);
          if (this.health <= 0) {
            this.active = false;
            if (explosions) {
              explosions.push({
                x: this.x,
                y: this.y,
                color: this.owner ? this.owner.color : (this.isAmoeba ? 'amoeba' : '#fff'),
                age: 0
              });
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
                if (ship !== this && ship.owner === this.owner && ship.active) {
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
                    if (planet.owner === this.owner) {
                      let mult = 0.002;
                      if (planet.isMilitary || planet.focusMode === 'garrison') {
                        if (planet.ships >= planet.maxShips * 2 - 10) {
                          mult = 0.0045;
                        } else if (planet.ships >= planet.maxShips) {
                          mult = 0.003;
                        }
                      }
                      friendlyPlanetBoost += mult * Math.floor(planet.ships / 10);
                    } else if (planet.owner === this.targetPlanet.owner && this.targetPlanet.owner !== null) {
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
            
            const defenderTechPenalty = 0.01 * Math.sqrt(this.targetPlanet.owner ? (this.targetPlanet.owner.techScore || 0) : 0);
            const defenderExpPenalty = 0.01 * Math.sqrt(this.targetPlanet.owner ? (this.targetPlanet.owner.expScore || 0) : 0);
            
            const attackerLocalExpBonus = 0.01 * Math.sqrt(this.expScore || 0);
            const defenderLocalExpPenalty = 0.01 * Math.sqrt(this.targetPlanet.expScore || 0);

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
            const humanDefenderBonus = humanVsHuman ? (0.02 * survivingAICount) : 0;
            
            const lastStandPenalty = (humanInvolved && this.targetPlanet.owner && this.targetPlanet.owner.planetCount === 1) ? 0.15 : 0;
            
            const defenderHomeworldPenalty = (humanInvolved && this.targetPlanet.owner && this.targetPlanet.owner.id === this.targetPlanet.homeworldOf) ? 0.15 : 0;
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
                  const sRed = Math.sqrt(this.expScore || 0);
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
              const rate = Math.max(10, this.count / 4);
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
                }
                
                if (ecoDamage > 0) {
                  this.targetPlanet.decreaseMaxShips(ecoDamage);
                  if (this.targetPlanet.maxShips < 55) {
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
            const rate = Math.max(10, this.count / 4);
            let N_att = rate * dt;
            N_att = Math.min(this.count, N_att);

            const penalty = 0.01 * Math.floor(this.targetPlanet.ships / 5);
            const matchesAttacker = (this.cruiserStyle === this.targetPlanet.racialAffinity) || (this.owner && this.owner.cruiserStyle === this.targetPlanet.racialAffinity);
            const racialDefenseBonus = !matchesAttacker ? 0.15 : 0;
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
              const actualDrops = Math.min(capacityDrops, this.targetPlanet.maxShips - 54);
              if (actualDrops > 0) {
                this.targetPlanet.decreaseMaxShips(actualDrops);
                if (this.targetPlanet.maxShips < 55) {
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
                if (this.targetPlanet.maxShips < 55) {
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

    const speedTechBonus = this.owner ? (0.01 * Math.sqrt(this.owner.techScore || 0)) : 0;
    let effectiveSpeed = this.speed * (1 + speedTechBonus);
    let engineBonus = (this.engine || 0) * 3;
    effectiveSpeed += engineBonus;
    if (this.isWarp) {
      effectiveSpeed += this.warpBonus || 0;
    }
    if (this.fuel_tanker && this.fuel_tanker > 0) {
      effectiveSpeed = Math.max(5, effectiveSpeed - this.fuel_tanker * 3);
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
    if (this.isRefueling) {
      effectiveSpeed = 0;
    }
    if (this.maxHealth > 0 && this.fuel <= 0) {
      effectiveSpeed *= 0.25;
    }

    if (this.targetPlanet && distance < this.targetPlanet.radius && this.maxHealth === 0) {
      effectiveSpeed *= 0.1;
    }

    if (!this.insideHazards) {
      this.insideHazards = new Set();
    }

    // Hazard checks (Nebula slowdown + Entry damage roll for Storms/Minefields)
    if (ionStorms) {
      const currentHazards = new Set();
      for (const h of ionStorms) {
        const hdx = this.x - h.x;
        const hdy = this.y - h.y;
        if (hdx * hdx + hdy * hdy <= h.radius * h.radius) {
          currentHazards.add(h.id);

          if (h.type === 'nebula') {
            const knowledge = h.knowledge[this.owner ? this.owner.id : ''] || 0;
            const tRed = this.owner ? Math.sqrt(this.owner.techScore || 0) : 0;
            const eRed = this.owner ? Math.sqrt(this.owner.expScore || 0) : 0;
            const sRed = Math.sqrt(this.expScore || 0);
            const slowPct = Math.max(0, h.intensity - sRed - (eRed + tRed) / 2 - knowledge);
            effectiveSpeed *= Math.max(0.1, 1 - slowPct / 100);
          } else {
            // Ion Storm or Minefield speed reduction
            const knowledge = h.knowledge[this.owner ? this.owner.id : ''] || 0;
            const tRed = this.owner ? Math.sqrt(this.owner.techScore || 0) : 0;
            const eRed = this.owner ? Math.sqrt(this.owner.expScore || 0) : 0;
            const sRed = Math.sqrt(this.expScore || 0);

            const effectiveIntensity = Math.max(0, h.intensity - knowledge - (tRed + eRed) / 2 - sRed);
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
      const destX = this.targetPlanet ? (this.targetPlanet.x + (this.cruiserTargetOffsetX || 0)) : this.targetX;
      const destY = this.targetPlanet ? (this.targetPlanet.y + (this.cruiserTargetOffsetY || 0)) : this.targetY;
      
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

    if (this.isUpgrading) {
      effectiveSpeed = 0;
    }

    const moveDistance = effectiveSpeed * (deltaTime / 1000);
    if (moveDistanceToDest > 0) {
      if (this.isAmoeba) {
        this.x += (dx / moveDistanceToDest) * moveDistance;
        this.y += (dy / moveDistanceToDest) * moveDistance;
      } else {
        this.x += Math.cos(this.angle) * moveDistance;
        this.y += Math.sin(this.angle) * moveDistance;
      }
    }
    this.currentSpeed = effectiveSpeed;
  }

  takeDamage(explosions, attacker = null, isHazard = false, targetType = null) {
    if (this.health >= 0) {
      if (attacker) {
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
        const shipExpBonus = Math.sqrt(this.expScore || 0);
        let shrugChance = 0;
        if (!this.isAmoeba) {
          const baseDeflection = this.maxHealth + (techBonus + expBonus + shipExpBonus);
          const deflectionRem = 100 - baseDeflection;
          const shieldDeflectionBonus = (this.shields || 0) * (deflectionRem / 5);
          shrugChance = (baseDeflection + shieldDeflectionBonus) / 100;
          if ((this.bombs || 0) < 1) {
            shrugChance /= 2;
          }
          if (this.specialduranium && this.specialduranium > 0) {
            shrugChance += 0.10;
          }
          shrugChance = Math.min(0.90, shrugChance);
        } else {
          shrugChance = Math.min(0.95, 0.50 + this.maxHealth * 0.01 + (techBonus + expBonus + shipExpBonus) * 0.01);
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
      if (this.isCruiser && (this.specialduranium || 0) > 0) {
        this.specialduranium = Math.max(0, this.specialduranium - 1);
      }
      let damageAmt = (cruiserCheck && isHazard) ? (Math.floor(Math.random() * 6) + 1) : 1;
      if (cruiserCheck && (this.armorPoints || 0) > 0) {
        if (this.armorPoints >= damageAmt) {
          this.armorPoints -= damageAmt;
          damageAmt = 0;
        } else {
          damageAmt -= this.armorPoints;
          this.armorPoints = 0;
        }
      }
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
          explosions.push({
            x: this.x,
            y: this.y,
            color: this.owner ? this.owner.color : (this.isAmoeba ? 'amoeba' : '#fff'),
            age: 0
          });
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
