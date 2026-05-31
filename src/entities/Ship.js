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
    this.patrolStationX = null;
    this.patrolStationY = null;
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
    this.diplomat = 0;
    this.marines = 0;
    this.crew = 0;
    this.marineCount = 0;
    this.cruiserStyle = null;
    this.isUpgrading = false;
    this.upgradeTimer = 0;
    this.upgradeProp = null;
    this.upgradeType = null;
    this.upgradePlanetId = null;
    this.upgradeShipsPaid = 0;
    this.upgradeAccumulator = 0;
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
    let cruiserRadar = Math.min(250, 5 * this.maxHealth);
    if (this.isWarp) cruiserRadar *= 0.25;
    if (this.sensorarrays > 0) {
      let mult = 1.0 + this.sensorarrays * 0.25;
      cruiserRadar *= mult;
    }
    const techBonus = this.owner ? (0.01 * Math.sqrt(this.owner.techScore || 0)) : 0;
    const expBonus = this.owner ? (0.01 * Math.sqrt(this.owner.expScore || 0)) : 0;
    const baseRange = cruiserRadar * (1 + techBonus + expBonus);
    const shipXpBonus = Math.sqrt(this.expScore || 0);
    return baseRange * (100 + shipXpBonus * 3) / 100;
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

  update(deltaTime, allShips, explosions, allPlanets, lasers, ionStorms, mapWidth, game = null) {
    if (!this.active) return;

    // Pirate Cruiser AI
    if (this.isCruiser && this.owner && (this.owner.isMonster || this.owner.id === 'monsters')) {
      this.bombPlanetsEnabled = false;

      // Fuel, bombs, and health regeneration (1 per 30 seconds)
      this.pirateRegenTimer = (this.pirateRegenTimer || 0) + (deltaTime / 1000);
      if (this.pirateRegenTimer >= 30) {
        this.pirateRegenTimer -= 30;
        this.fuel = Math.min(this.getMaxFuel(), (this.fuel || 0) + 1);
        if (this.bombs !== undefined) {
          this.bombs = Math.min(this.maxHealth, this.bombs + 1);
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
        let cruiserRadar = Math.min(250, 5 * this.maxHealth);
        if (this.isWarp) cruiserRadar *= 0.25;
        
        const techBonus = this.owner ? Math.floor(Math.sqrt(this.owner.techScore || 0)) : 0;
        const expBonus = this.owner ? Math.floor(Math.sqrt(this.owner.expScore || 0)) : 0;
        const playerTechBonus = 0.01 * techBonus;
        const playerExpBonus = 0.01 * expBonus;
        const baseRange = cruiserRadar * (1 + playerTechBonus + playerExpBonus);
        const shipXpBonus = Math.sqrt(this.expScore || 0);
        const sensorRange = baseRange * (100 + shipXpBonus * 3) / 100;
        const rangeSq = sensorRange * sensorRange;

        let nearestEnemy = null;
        let nearestDistSq = rangeSq;

        if (allShips) {
          const candidateThreats = (typeof allShips.getShipsInRadiusSq === 'function')
            ? allShips.getShipsInRadiusSq(this.x, this.y, rangeSq)
            : allShips;

          for (const other of candidateThreats) {
            if (other.active && other.owner && other.owner !== this.owner && !other.isAmoeba && !other.isReturnPod && !other.isBoardingFleet) {
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
      const creditsAvailable = (this.owner && this.owner.credits !== undefined) ? this.owner.credits : 0;
      if (planet && planet.owner && this.owner && planet.owner.id === this.owner.id && (planet.ships >= 1 || creditsAvailable >= 1)) {
        this.upgradeAccumulator += deltaTime / 1000;
        while (this.upgradeAccumulator >= 0.2 && this.upgradeTimer > 0) {
          const currentCredits = this.owner.credits || 0;
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
            const bonus = 4 + 0.10 * this.maxHealth;
            this.maxArmor = (this.maxArmor || 0) + bonus;
            this.armorPoints = (this.armorPoints || 0) + bonus;
          } else if (this.upgradeProp === 'munitions') {
            this.splashDamage = this.munitions;
          } else if (this.upgradeProp === 'fuel_tanker') {
            this.fuel = Math.min(this.getMaxFuel(), (this.fuel || 0) + 5);
          }
          
          console.log(`[Cruiser Upgrade Complete] Ship ${this.id} upgraded ${this.upgradeProp} to level ${this[this.upgradeProp]}`);
          this.upgradeProp = null;
          this.upgradeType = null;
          this.upgradePlanetId = null;
        }
      }
    }


    if (this.isAmoeba && this.pursueTarget) {
      const pdx = this.pursueTarget.x - this.x;
      const pdy = this.pursueTarget.y - this.y;
      const pDistSq = pdx * pdx + pdy * pdy;
      if (this.pursueTarget.active && pDistSq <= 250000) {
        this.targetPlanet = null;
        this.targetX = this.pursueTarget.x;
        this.targetY = this.pursueTarget.y;
      } else {
        this.pursueTarget = null;
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
      const targetingRangeBonus = (this.targeting || 0) * 0.10;
      effectiveRange *= (1 + targetingRangeBonus);
    } else {
      const healthBonus = Math.floor(this.health);
      effectiveRange = 40 * (1 + laserTechBonus) * (1 + healthBonus * 0.10);
    }
    const squaredRange = effectiveRange * effectiveRange;
    
    // Hit Chance Calculation
    let hitChance = 0;
    if (this.maxHealth > 0 && !this.isAmoeba) {
      hitChance = 0.10;
      if (this.bombs > 0) hitChance += 0.10;
      hitChance += (techBonus + expBonus + shipExpBonus) / 100;
      const targetingBonus = (this.targeting || 0) * 0.10;
      hitChance += targetingBonus;
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
          maxQueryRange = effectiveRange * 1.2;
        }
        const queryRadiusSq = maxQueryRange * maxQueryRange;
        const candidateShips = (typeof allShips.getShipsInRadiusSq === 'function') 
          ? allShips.getShipsInRadiusSq(this.x, this.y, queryRadiusSq)
          : allShips;

        for (const enemyShip of candidateShips) {
          if (!enemyShip.active || enemyShip.owner === this.owner) continue;
          if (this.isAmoeba && enemyShip.isAmoeba) continue;
          
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
            if (absDiff <= Math.PI / 4) {
              targetType = 'front';
              targetRange = effectiveRange * 1.2;
            } else if (absDiff >= 3 * Math.PI / 4) {
              targetType = 'aft';
              // Firing aft: do not gain range advantages of munitions (bombs)
              let rangeWithoutMunitions = effectiveRange;
              if (this.bombs > 0) {
                const xpRangeBonus = (expBonus + shipExpBonus) * 0.10;
                const baseDogfightRange = 40 * (1 + laserTechBonus + xpRangeBonus);
                
                let targetingRangeBonus = 0;
                if (this.targeting > 0) {
                  targetingRangeBonus += 0.10;
                  if (this.targeting > 1) {
                    targetingRangeBonus += 0.05;
                  }
                  if (this.targeting > 2) {
                    targetingRangeBonus += 0.05;
                  }
                }
                
                const munitionsBonus = baseDogfightRange * 0.10 * (1 + targetingRangeBonus);
                rangeWithoutMunitions = Math.max(0, effectiveRange - munitionsBonus);
              }
              targetRange = rangeWithoutMunitions * 0.85;
            } else {
              targetType = 'side';
              targetRange = effectiveRange;
            }
          }
          
          if (distSq < targetRange * targetRange) {
            validTargets.push({ ship: enemyShip, distSq: distSq, targetType: targetType });
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
          const enemyShip = validTargets[targetIndex].ship;
          
          let defenderPlanetPenalty = penaltyCache.get(enemyShip.id);
          if (defenderPlanetPenalty === undefined) {
            defenderPlanetPenalty = this.getGravityWellBonusAt(enemyShip.x, enemyShip.y, enemyShip.owner, allPlanets);
            penaltyCache.set(enemyShip.id, defenderPlanetPenalty);
          }
          const finalHitChance = Math.min(1.0, Math.max(0.01, hitChance + friendlyPlanetBoost - defenderPlanetPenalty - hazardPenalty));
          
          if (Math.random() < finalHitChance) {
            const damageDealt = enemyShip.takeDamage(explosions, this);
            if (damageDealt && this.owner) {
              this.owner.addExperience(1);
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

          // Only consume a bomb on the first shot of each volley cycle
          if (!this.volleyShotIndex) this.volleyShotIndex = 0;
          
          const isAftCruiserShot = (this.maxHealth > 0 && !this.isAmoeba && targetType === 'aft');
          
          if (this.maxHealth > 0 && this.bombs > 0 && this.volleyShotIndex === 0 && !this.isAmoeba && !isAftCruiserShot) {
            usedBomb = true;
            this.bombs -= 0.5;
            if (this.bombs < 0) this.bombs = 0;
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
            if (targetType === 'aft' && this.bombs > 0) {
              cruiserBaseHitChance = Math.max(0, cruiserBaseHitChance - 0.10);
            }
            
            // Double the hit chance for cruisers
            finalHitChance = cruiserBaseHitChance * 2;
            
            // Apply front/aft accuracy multipliers
            if (targetType === 'front') {
              finalHitChance *= 1.2;
            } else if (targetType === 'aft') {
              finalHitChance *= 0.85;
            }
            finalHitChance = Math.min(1.0, finalHitChance);
          }

          const friendlyPlanetBoost = this.getGravityWellBonusAt(this.x, this.y, this.owner, allPlanets);
          const defenderPlanetPenalty = this.getGravityWellBonusAt(enemyShip.x, enemyShip.y, enemyShip.owner, allPlanets);
          const minHitChance = (this.maxHealth > 0 && !this.isAmoeba) ? 0.10 : 0.01;
          finalHitChance = Math.min(1.0, Math.max(minHitChance, finalHitChance + friendlyPlanetBoost - defenderPlanetPenalty - hazardPenalty));
          
          if (Math.random() < finalHitChance) {
            const damageDealt = enemyShip.takeDamage(explosions, this);
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
                } else if (enemyShip.maxHealth > 0 && !enemyShip.isAmoeba) {
                  this.owner.addExperience(enemyShip.maxHealth / 2);
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
            if (otherShip.active && otherShip.owner !== this.owner) {
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
                  isAmoebaAttack: !!this.isAmoeba
                });
              }
            }
          }
          if (firedAtPlanet) {
            if (isCruiser) {
              this.bombs--;
              if (this.bombs < 0) this.bombs = 0;
              this.planetBombardTimer = 2.0;
            } else {
              this.bombs--;
            }
          }
        }
      }
    }
    
    // Cruiser Patrol Mode Decision Engine
    if (this.maxHealth > 0 && !this.isAmoeba && this.owner && !this.owner.isMonster && this.owner.id !== 'monsters' && this.isPatrolling) {
      // 1. Check if out of bombs -> Reloading State
      if (this.bombs <= 0 || (this.patrolReloading && this.bombs < this.getMaxBombs())) {
        this.patrolReloading = true;
        
        // Check if an enemy unit is within 150px of the cruiser
        let enemyCloseToCruiser = false;
        if (allShips) {
          for (const other of allShips) {
            if (other.active && other.id !== this.id) {
              const isEnemy = (other.owner && other.owner.id !== this.owner.id) || other.isAmoeba;
              if (isEnemy) {
                const edx = other.x - this.x;
                const edy = other.y - this.y;
                if (edx * edx + edy * edy <= 150 * 150) {
                  enemyCloseToCruiser = true;
                  break;
                }
              }
            }
          }
        }

        // If an enemy unit is within 150px, find another random destination 
        // within a friendly gravity well and within 500px that is more than 200px away from any enemy unit.
        let divertedDestination = null;
        if (enemyCloseToCruiser) {
          const candidates = [];
          if (allPlanets) {
            for (const p of allPlanets) {
              if (p.owner && p.owner.id === this.owner.id) {
                const pdx = p.x - this.x;
                const pdy = p.y - this.y;
                const pDist = Math.sqrt(pdx * pdx + pdy * pdy);
                if (pDist <= 500 + p.getGravityRadius()) {
                  const gRad = p.getGravityRadius();
                  for (let attempt = 0; attempt < 20; attempt++) {
                    const theta = Math.random() * Math.PI * 2;
                    const r = Math.random() * gRad;
                    const tx = p.x + r * Math.cos(theta);
                    const ty = p.y + r * Math.sin(theta);
                    
                    const cdx = tx - this.x;
                    const cdy = ty - this.y;
                    if (cdx * cdx + cdy * cdy <= 500 * 500) {
                      let farFromEnemies = true;
                      if (allShips) {
                        for (const other of allShips) {
                          if (other.active && other.id !== this.id) {
                            const isEnemy = (other.owner && other.owner.id !== this.owner.id) || other.isAmoeba;
                            if (isEnemy) {
                              const odx = other.x - tx;
                              const ody = other.y - ty;
                              if (odx * odx + ody * ody <= 200 * 200) {
                                farFromEnemies = false;
                                break;
                              }
                            }
                          }
                        }
                      }
                      
                      if (farFromEnemies) {
                        candidates.push({ x: tx, y: ty, planet: p });
                      }
                    }
                  }
                }
              }
            }
          }
          
          if (candidates.length > 0) {
            divertedDestination = candidates[Math.floor(Math.random() * candidates.length)];
          }
        }

        if (divertedDestination) {
          this.targetPlanet = divertedDestination.planet;
          this.targetX = divertedDestination.x;
          this.targetY = divertedDestination.y;
          this.cruiserTargetType = null;
          this.cruiserTargetId = null;
        } else {
          // Normal retreat logic:
          // Check if there are enemies close to all the normal retreat locations (friendly planets within 500px)
          let allPlanetsUnsafe = true;
          const friendlyPlanetsInRange = [];
          
          if (allPlanets) {
            for (const p of allPlanets) {
              if (p.owner && p.owner.id === this.owner.id) {
                const dx = p.x - this.x;
                const dy = p.y - this.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist <= 500) {
                  friendlyPlanetsInRange.push({ planet: p, dist: dist });
                  
                  // Check if there is an enemy close to this planet's center (within 150px)
                  let isPlanetSafe = true;
                  if (allShips) {
                    for (const other of allShips) {
                      if (other.active && other.id !== this.id) {
                        const isEnemy = (other.owner && other.owner.id !== this.owner.id) || other.isAmoeba;
                        if (isEnemy) {
                          const edx = other.x - p.x;
                          const edy = other.y - p.y;
                          if (edx * edx + edy * edy <= 150 * 150) {
                            isPlanetSafe = false;
                            break;
                          }
                        }
                      }
                    }
                  }
                  if (isPlanetSafe) {
                    allPlanetsUnsafe = false;
                  }
                }
              }
            }
          }
          
          let alternateSafeDestination = null;
          // If enemies are close to all the normal retreat locations, attempt to find a safe reload place 
          // at exactly 80% of the gravity well radius away along a random heading.
          if (allPlanetsUnsafe && friendlyPlanetsInRange.length > 0) {
            const alternateCandidates = [];
            for (const item of friendlyPlanetsInRange) {
              const p = item.planet;
              const gRad = p.getGravityRadius();
              const r = gRad * 0.8;
              
              // Attempt 15 random headings
              for (let attempt = 0; attempt < 15; attempt++) {
                const theta = Math.random() * Math.PI * 2;
                const tx = p.x + r * Math.cos(theta);
                const ty = p.y + r * Math.sin(theta);
                
                // Ensure candidate coordinate is within 500px of the cruiser
                const cdx = tx - this.x;
                const cdy = ty - this.y;
                if (cdx * cdx + cdy * cdy <= 500 * 500) {
                  // Check if safe (no enemies within 150px of this candidate point)
                  let isSafe = true;
                  if (allShips) {
                    for (const other of allShips) {
                      if (other.active && other.id !== this.id) {
                        const isEnemy = (other.owner && other.owner.id !== this.owner.id) || other.isAmoeba;
                        if (isEnemy) {
                          const edx = other.x - tx;
                          const edy = other.y - ty;
                          if (edx * edx + edy * edy <= 150 * 150) {
                            isSafe = false;
                            break;
                          }
                        }
                      }
                    }
                  }
                  
                  if (isSafe) {
                    alternateCandidates.push({ x: tx, y: ty, planet: p, dist: item.dist });
                  }
                }
              }
            }
            
            if (alternateCandidates.length > 0) {
              alternateSafeDestination = alternateCandidates[Math.floor(Math.random() * alternateCandidates.length)];
            }
          }
          
          if (alternateSafeDestination) {
            this.targetPlanet = alternateSafeDestination.planet;
            this.targetX = alternateSafeDestination.x;
            this.targetY = alternateSafeDestination.y;
            this.cruiserTargetType = null;
            this.cruiserTargetId = null;
          } else {
            // Find friendly planet within 500px, avoiding destinations within 150px of an enemy if possible
            let bestFriendly = null;
            let bestFriendlyDist = Infinity;
            let bestFriendlyIsSafe = false;
            
            for (const item of friendlyPlanetsInRange) {
              const p = item.planet;
              const dist = item.dist;
              
              // Check if this friendly planet is "safe" (no enemy units within 150px of its center)
              let isSafe = true;
              if (allShips) {
                for (const other of allShips) {
                  if (other.active && other.id !== this.id) {
                    const isEnemy = (other.owner && other.owner.id !== this.owner.id) || other.isAmoeba;
                    if (isEnemy) {
                      const edx = other.x - p.x;
                      const edy = other.y - p.y;
                      if (edx * edx + edy * edy <= 150 * 150) {
                        isSafe = false;
                        break;
                      }
                    }
                  }
                }
              }
              
              // Prioritize safe planets.
              if (bestFriendly === null) {
                bestFriendly = p;
                bestFriendlyDist = dist;
                bestFriendlyIsSafe = isSafe;
              } else if (isSafe && !bestFriendlyIsSafe) {
                bestFriendly = p;
                bestFriendlyDist = dist;
                bestFriendlyIsSafe = isSafe;
              } else if (isSafe === bestFriendlyIsSafe) {
                if (dist < bestFriendlyDist) {
                  bestFriendly = p;
                  bestFriendlyDist = dist;
                }
              }
            }
            
            if (bestFriendly) {
              this.targetPlanet = bestFriendly;
              this.targetX = bestFriendly.x;
              this.targetY = bestFriendly.y;
              this.cruiserTargetType = null;
              this.cruiserTargetId = null;
            }
          }
        }
      } else {
        // We have bombs, so we can active patrol!
        this.patrolReloading = false;
        
        // Find closest enemy unit (standard ship, bomber, cruiser, or Space Amoeba)
        // that is BOTH within a friendly gravity well AND within 800px of this cruiser.
        let closestEnemy = null;
        let minEnemyDistSq = 800 * 800; // max engagement range is 800px
        
        if (allShips) {
          const candidateShips = (typeof allShips.getShipsInRadiusSq === 'function')
            ? allShips.getShipsInRadiusSq(this.x, this.y, 800 * 800)
            : allShips;
            
          for (const other of candidateShips) {
            if (other.active && other.id !== this.id) {
              const isEnemy = (other.owner && other.owner.id !== this.owner.id) || other.isAmoeba;
              if (isEnemy) {
                const dx = other.x - this.x;
                const dy = other.y - this.y;
                const distSq = dx * dx + dy * dy;
                
                let eligible = false;
                if (distSq <= 800 * 800 && allPlanets) {
                  for (const p of allPlanets) {
                    if (p.owner && p.owner.id === this.owner.id) {
                      const pdx = other.x - p.x;
                      const pdy = other.y - p.y;
                      const pDistSq = pdx * pdx + pdy * pdy;
                      const pGravityRadius = p.getGravityRadius();
                      if (pDistSq <= pGravityRadius * pGravityRadius) {
                        eligible = true;
                        break;
                      }
                    }
                  }
                }
                
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
      
      if (targetObj && targetObj.active !== false && (!isPlanet || targetObj.owner !== this.owner)) {
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
        const maxFrontRange = (effectiveRange * 1.2) + (isPlanet ? targetObj.radius : 0);
        const isTargetInFront = (Math.abs(diff) <= Math.PI / 4);
        
        if (!isPlanet && isTargetInFront && dist <= maxFrontRange - 5) {
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
      
      
      const inCombat = this.combatCooldown && this.combatCooldown > 0;
      let finalHealRate = 0;

      if (this.inFriendlyWell && !inCombat) {
        finalHealRate = 6 * (1 + 0.50 * (this.damagecontrol || 0));
      } else {
        finalHealRate = 6 * (0.20 * (this.damagecontrol || 0));
      }

      if (this.health < this.maxHealth && finalHealRate > 0) {
        let healAmount = (deltaTime / 60000) * finalHealRate;
        this.health = Math.min(this.maxHealth, this.health + healAmount);
      }

      if (this.inFriendlyWell) {
        if (this.armorPoints < this.maxArmor) {
          let armorHealRate = (deltaTime / 60000) * 3;
          this.armorPoints = Math.min(this.maxArmor, (this.armorPoints || 0) + armorHealRate);
        }
        
        // Cruisers don't recover bombs or fuel while in warp
        if (!this.isWarp) {
          const recoveryRate = (this.combatCooldown && this.combatCooldown > 0) ? 0.5 : 1.0;
          this.fuel = Math.min(this.getMaxFuel(), (this.fuel || 0) + ((deltaTime / 1000) / 10) * recoveryRate);
          
          if (this.bombs < this.getMaxBombs() && friendlyWellPlanet) {
            const maxBombs = this.getMaxBombs();
            const reloadMultiplier = 0.5 * (1 + 0.1 * maxBombs);
            this.bombReloadTimer += (deltaTime / 1000) * reloadMultiplier * recoveryRate;
            if (this.bombReloadTimer >= 5) {
              this.bombReloadTimer = 0;
              this.bombs++;
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
            let killChance = Math.max(minKillChance, 0.8 - penalty + advantage + friendlyPlanetBoost - defenderPlanetPenalty + attackerTechBonus + attackerExpBonus + attackerLocalExpBonus + attackerHomeworldBonus - defenderTechPenalty - defenderExpPenalty - defenderLocalExpPenalty - lastStandPenalty - defenderHomeworldPenalty - humanDefenderBonus);
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

            if (this.owner) this.owner.addExperience(actualKilled);
            if (this.targetPlanet.owner) this.targetPlanet.owner.addExperience(actualKilled);

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
          
          // Entry check
          if (!this.insideHazards.has(h.id) && h.type !== 'nebula') {
            const knowledge = h.knowledge[this.owner ? this.owner.id : ''] || 0;
            const tRed = this.owner ? Math.sqrt(this.owner.techScore || 0) : 0;
            const eRed = this.owner ? Math.sqrt(this.owner.expScore || 0) : 0;
            const sRed = Math.sqrt(this.expScore || 0);
            const effectiveIntensity = h.intensity - knowledge - (tRed + eRed) / 2 - sRed;

            if (this.maxHealth > 0) {
              if (!this.isAmoeba) {
                // Cruiser Exception
                if (!this.hazardCooldown || this.hazardCooldown <= 0) {
                  let rollChance = effectiveIntensity / 100;
                  let speedMod = effectiveSpeed / 35;
                  if (effectiveSpeed > 35) {
                    speedMod *= 3;
                  }
                  if (h.type === 'minefield' || !h.type || h.type === 'storm') {
                    rollChance *= speedMod;
                  }
                  if (rollChance > 0 && Math.random() < rollChance) {
                    const damage = Math.floor(Math.random() * 6) + 1;
                    this.health -= damage;
                    this.hazardCooldown = 1000;
                    if (explosions) {
                      const explosionColor = h.type === 'minefield' ? '#44f' : '#ff0';
                      explosions.push({ x: this.x, y: this.y, color: explosionColor, age: 0 });
                    }
                    if (this.health <= 0) {
                      this.active = false;
                    }
                  }
                }
              }
            } else if (!this.isAmoeba) {
              // Standard fleet entry checks: (effective intensity)% chance to destroy each ship
              const damageChance = Math.max(0, effectiveIntensity / 100);
              let destroyedCount = 0;
              const initialCount = this.count;
              for (let i = 0; i < initialCount; i++) {
                if (Math.random() < damageChance) {
                  if (!this.checkSurvivalRoll()) {
                    destroyedCount++;
                  }
                }
              }
              if (destroyedCount > 0) {
                this.count -= destroyedCount;
                if (this.count <= 0) {
                  this.count = 0;
                  this.active = false;
                }
                if (explosions) {
                  const explosionColor = h.type === 'minefield' ? '#44f' : '#ff0';
                  explosions.push({ x: this.x, y: this.y, color: explosionColor, age: 0 });
                  if (lasers && !this.active) {
                    const boltX = this.x + (Math.random() - 0.5) * 80;
                    const boltY = this.y - 30 - Math.random() * 50;
                    const midX = (this.x + boltX) / 2 + (Math.random() - 0.5) * 40;
                    const midY = (this.y + boltY) / 2 + (Math.random() - 0.5) * 20;
                    lasers.push({ startX: boltX, startY: boltY, endX: midX, endY: midY, color: explosionColor, age: 0, duration: 0.4 });
                    lasers.push({ startX: midX, startY: midY, endX: this.x, endY: this.y, color: explosionColor, age: 0, duration: 0.4 });
                  }
                }
              }
            }
          }

          if (h.type === 'nebula') {
            const knowledge = h.knowledge[this.owner ? this.owner.id : ''] || 0;
            const tRed = this.owner ? Math.sqrt(this.owner.techScore || 0) : 0;
            const eRed = this.owner ? Math.sqrt(this.owner.expScore || 0) : 0;
            const sRed = Math.sqrt(this.expScore || 0);
            const slowPct = Math.max(0, h.intensity - sRed - (eRed + tRed) / 2 - knowledge);
            effectiveSpeed *= Math.max(0.1, 1 - slowPct / 100);
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
  }

  takeDamage(explosions, attacker = null, isHazard = false) {
    if (this.health >= 0) {
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
          shrugChance = (this.maxHealth + (techBonus + expBonus + shipExpBonus)) / 100;
          let shieldBonus = (this.shields || 0) * 0.10;
          shrugChance += shieldBonus;
          shrugChance = Math.min(0.75, shrugChance);
          if ((this.bombs || 0) < 1) {
            shrugChance /= 2;
          }
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
          const baseSplash = attacker.splashDamage;
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
        const baseSplash = attacker.splashDamage;
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
