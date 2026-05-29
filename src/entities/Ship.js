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
    this.angle = 0;
    this.fireCooldown = Math.random(); // Start randomly staggered
    this.isCruiser = false;
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

  getMaxBombs() {
    const baseMax = Math.floor(this.maxHealth / 5);
    let bonus = 0;
    if (this.munitions > 0) {
      bonus += 2;
      if (this.munitions > 1) {
        bonus += 1;
      }
      if (this.munitions > 2) {
        bonus += 1;
      }
    }
    return baseMax + bonus;
  }

  getMaxFuel() {
    const baseFuel = this.maxHealth / 5;
    let bonus = 0;
    if (this.engine > 0) {
      bonus += 2;
      if (this.engine > 1) {
        bonus += 1;
      }
      if (this.engine > 2) {
        bonus += 1;
      }
    }
    return baseFuel + bonus + (this.fuel_tanker || 0) * 5;
  }

  cruiserRadarRange() {
    if (this.maxHealth <= 0) return 0;
    let cruiserRadar = Math.min(250, 5 * this.maxHealth);
    if (this.isWarp) cruiserRadar *= 0.25;
    if (this.sensorarrays > 0) {
      let mult = 1.0;
      mult += 0.50;
      if (this.sensorarrays > 1) {
        mult += 0.25;
      }
      if (this.sensorarrays > 2) {
        mult += 0.25;
      }
      cruiserRadar *= mult;
    }
    const techBonus = this.owner ? (0.01 * Math.sqrt(this.owner.techScore || 0)) : 0;
    const expBonus = this.owner ? (0.01 * Math.sqrt(this.owner.expScore || 0)) : 0;
    const baseRange = cruiserRadar * (1 + techBonus + expBonus);
    const shipXpBonus = Math.sqrt(this.expScore || 0);
    return baseRange * (100 + shipXpBonus * 3) / 100;
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
      if (dx * dx + dy * dy < gravityRadius * gravityRadius) {
        const mult = (gp.isMilitary && gp.ships >= gp.maxShips) ? 0.003 : 0.002;
        totalBonus += mult * Math.floor(gp.ships / 10);
      }
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

  update(deltaTime, allShips, explosions, allPlanets, lasers, ionStorms, mapWidth) {
    if (!this.active) return;

    if (this.isCruiser && this.isUpgrading) {
      const planet = allPlanets ? allPlanets.find(p => p.id === this.upgradePlanetId) : null;
      if (planet && planet.owner && this.owner && planet.owner.id === this.owner.id && planet.ships >= 1) {
        this.upgradeAccumulator += deltaTime / 1000;
        while (this.upgradeAccumulator >= 0.2 && this.upgradeTimer > 0) {
          if (planet.ships >= 1) {
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
            const bonus = (currentLevel === 0) ? (2 + 0.10 * this.maxHealth) : (1 + 0.10 * this.maxHealth);
            this.maxArmor = (this.maxArmor || 0) + bonus;
            this.armorPoints = (this.armorPoints || 0) + bonus;
          } else if (this.upgradeProp === 'engine') {
            const fuelBonusMap = { 0: 2, 1: 1, 2: 1 };
            const bonus = fuelBonusMap[currentLevel] || 1;
            this.fuel = (this.fuel || 0) + bonus;
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
    const expBonus = this.owner ? 0.5 * Math.sqrt(this.owner.expScore || 0) : 0;
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

    const laserTechBonus = 0.01 * techBonus;
    const shipExpBonus = 0.5 * Math.sqrt(this.expScore || 0);
    
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
      let targetingBonus = 0;
      if (this.targeting > 0) {
        targetingBonus += 0.10;
        if (this.targeting > 1) {
          targetingBonus += 0.05;
        }
        if (this.targeting > 2) {
          targetingBonus += 0.05;
        }
      }
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
      const amoebaCount = allShips ? allShips.filter(s => s.active && s.isAmoeba).length : 1;
      const mapScale = 1600 / (mapWidth || 1600);
      const amoebaTimer = 10 * amoebaCount * mapScale;

      let validTargets = [];
      if (allShips) {
        for (const enemyShip of allShips) {
          if (!enemyShip.active || enemyShip.owner === this.owner) continue;
          if (this.isAmoeba && enemyShip.isAmoeba) continue;
          
          const edx = enemyShip.x - this.x;
          const edy = enemyShip.y - this.y;
          const distSq = edx * edx + edy * edy;
          if (distSq < squaredRange) {
            validTargets.push({ ship: enemyShip, distSq: distSq });
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

        for (let s = 0; s < totalShots; s++) {
          if (validTargets.length === 0) break;
          const targetIndex = Math.floor(Math.random() * validTargets.length);
          const enemyShip = validTargets[targetIndex].ship;
          
          const defenderPlanetPenalty = this.getGravityWellBonusAt(enemyShip.x, enemyShip.y, enemyShip.owner, allPlanets);
          const finalHitChance = Math.min(1.0, Math.max(0.01, hitChance + friendlyPlanetBoost - defenderPlanetPenalty - hazardPenalty));
          
          if (Math.random() < finalHitChance) {
            const damageDealt = enemyShip.takeDamage(explosions, this);
            if (damageDealt && this.owner) {
              this.owner.addExperience(1);
            }

            if (lasers && lasersDrawn < 8) {
              lasers.push({
                startX: this.x,
                startY: this.y,
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
        if (validTargets.length > 0) {
          this.combatCooldown = 1.1;
          // Only consume a bomb on the first shot of each volley cycle
          if (!this.volleyShotIndex) this.volleyShotIndex = 0;
          if (this.maxHealth > 0 && this.bombs > 0 && this.volleyShotIndex === 0 && !this.isAmoeba) {
            usedBomb = true;
            this.bombs -= 0.5;
            if (this.bombs < 0) this.bombs = 0;
          }
          this.volleyShotIndex = (this.volleyShotIndex + 1) % shotsPerVolley;
        }

        const hazardPenalty = this.getHazardAccuracyReduction(ionStorms);

        while (shotsFired < maxShots && validTargets.length > 0) {
          const targetIndex = Math.floor(Math.random() * validTargets.length);
          const targetData = validTargets[targetIndex];
          const enemyShip = targetData.ship;
          
          shotsFired++;
          
          let finalHitChance = hitChance;
          if (this.maxHealth > 0 && !this.isAmoeba) {
            finalHitChance = Math.min(1.0, finalHitChance * 2);
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
            lasers.push({
              startX: this.x,
              startY: this.y,
              endX: enemyShip.x,
              endY: enemyShip.y,
              color: this.owner ? this.owner.color : (this.isAmoeba ? 'amoeba' : '#fff'),
              age: 0,
              duration: 0.8,
              width: usedBomb ? 8 : undefined,
              isBombAttack: usedBomb,
              cruiserStyle: this.owner ? this.owner.cruiserStyle : 'Klingon',
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

          const playerTechBonus = 0.01 * techBonus;
          const playerExpBonus = 0.01 * expBonus;
          const baseRange = cruiserRadar * (1 + playerTechBonus + playerExpBonus);
          const shipXpBonus = Math.sqrt(this.expScore || 0);
          const sensorRange = baseRange * (100 + shipXpBonus * 3) / 100;
          const rangeSq = sensorRange * sensorRange;

          for (const otherShip of allShips) {
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
        if (!isCruiser || (this.bombs >= 1 && (!this.planetBombardTimer || this.planetBombardTimer <= 0) && !enemyNearby)) {
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
                  cruiserStyle: this.owner ? this.owner.cruiserStyle : 'Klingon',
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
    const moveDistanceToDest = Math.sqrt(dx * dx + dy * dy);
    
    // For collision detection, we use actual distance to target planet center (or coordinate target)
    const baseTargetDx = finalDestX - this.x;
    const baseTargetDy = finalDestY - this.y;
    const distance = Math.sqrt(baseTargetDx * baseTargetDx + baseTargetDy * baseTargetDy);
    
    if (moveDistanceToDest > 0) {
      this.angle = Math.atan2(dy, dx);
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
          lasers.push({
            startX: this.x,
            startY: this.y,
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
      if (this.fuel <= 0 && allShips) {
        for (const other of allShips) {
          if (other.active && other.maxHealth > 0 && !other.isAmoeba && other.id !== this.id && other.owner && this.owner && other.owner.id === this.owner.id && other.fuel > 1) {
            const dx = other.x - this.x;
            const dy = other.y - this.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const sensorRange = this.cruiserRadarRange();
            if (dist <= sensorRange) {
              other.fuel -= 1;
              this.fuel += 1;
              break;
            }
          }
        }
      }

      if (this.bombs === undefined) {
        this.bombs = this.getMaxBombs();
        this.bombReloadTimer = 0;
      }
      
      // Don't convert fuel to munitions.
      
      
      if (this.inFriendlyWell) {
        if (this.health < this.maxHealth) {
          let baseHeal = 6 + (this.damagecontrol || 0);
          let healRate = (deltaTime / 60000) * baseHeal;
          this.health = Math.min(this.maxHealth, this.health + healRate);
        }
        
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
          fuelDrain *= 0.5;
        }
        this.fuel = (this.fuel || 0) - (deltaTime / 1000) / (60 / fuelDrain);
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
              for (const ship of allShips) {
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
                      const mult = (planet.isMilitary && planet.ships >= planet.maxShips) ? 0.003 : 0.002;
                      friendlyPlanetBoost += mult * Math.floor(planet.ships / 10);
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
                  if (storm.type === 'nebula') {
                    hazardPenalty += (eff / 4) / 100;
                  } else {
                    hazardPenalty += (eff / 2) / 100;
                  }
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
        const amoebaCountForBombs = allShips ? allShips.filter(s => s.active && s.isAmoeba).length : 1;
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
    let engineBonus = 0;
    if (this.engine > 0) {
      engineBonus += 10;
      if (this.engine > 1) {
        engineBonus += 5;
      }
      if (this.engine > 2) {
        engineBonus += 5;
      }
    }
    effectiveSpeed += engineBonus;
    if (this.isWarp) {
      effectiveSpeed += this.warpBonus || 0;
    }
    if (this.speedModifier) {
      effectiveSpeed *= this.speedModifier;
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
        if (this.damagecontrol === 1) {
          penaltyFactor = 0.5;
        } else if (this.damagecontrol === 2) {
          penaltyFactor = 1 / 3;
        } else if (this.damagecontrol === 3) {
          penaltyFactor = 0.25;
        }
      }
      const basePenalty = 0.5 * (1 - this.health / this.maxHealth);
      const finalPenalty = basePenalty * penaltyFactor;
      effectiveSpeed *= (1 - finalPenalty);
    }

    if (this.isUpgrading) {
      effectiveSpeed = 0;
    }

    const moveDistance = effectiveSpeed * (deltaTime / 1000);
    if (moveDistanceToDest > 0) {
      this.x += (dx / moveDistanceToDest) * moveDistance;
      this.y += (dy / moveDistanceToDest) * moveDistance;
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
        const expBonus = this.owner ? 0.5 * Math.sqrt(this.owner.expScore || 0) : 0;
        const shipExpBonus = 0.5 * Math.sqrt(this.expScore || 0);
        let shrugChance = 0;
        if (!this.isAmoeba) {
          shrugChance = (this.maxHealth + (techBonus + expBonus + shipExpBonus)) / 100;
          let shieldBonus = 0;
          if (this.shields > 0) {
            shieldBonus += 0.10;
            if (this.shields > 1) {
              shieldBonus += 0.05;
            }
            if (this.shields > 2) {
              shieldBonus += 0.05;
            }
          }
          shrugChance += shieldBonus;
          shrugChance = Math.min(0.75, shrugChance);
          if ((this.bombs || 0) < 1) {
            shrugChance /= 2;
          }
        } else {
          shrugChance = Math.min(0.90, 0.50 + this.maxHealth * 0.03 + (techBonus + expBonus + shipExpBonus) * 0.02);
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
