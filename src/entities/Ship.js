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
    this.planetBombardTimer = 0;
    this.combatCooldown = 0;
    this.bomberOffsetMag = 0; // Assigned in game.js during launch
    const endSpreadRadius = targetPlanet ? targetPlanet.radius / 2 : 25;
    this.bomberTargetOffsetX = (Math.random() - 0.5) * endSpreadRadius * 2;
    this.bomberTargetOffsetY = (Math.random() - 0.5) * endSpreadRadius * 2;
    this.endOffsetX = (Math.random() - 0.5) * 20;
    this.endOffsetY = (Math.random() - 0.5) * 20;
    this.count = 1;
    const formations = ['straight line', 'chevron', 'arrow', 'hex', 'circle', 'double line'];
    this.formation = formations[Math.floor(Math.random() * formations.length)];
  }

  checkSurvivalRoll() {
    if (this.maxHealth > 0) return true;
    if (this.speedModifier === 0.25 && Math.random() < 0.90) return true;
    if (this.speedModifier === 0.50 && Math.random() < 0.75) return true;
    return false;
  }

  update(deltaTime, allShips, explosions, allPlanets, lasers, ionStorms, mapWidth) {
    if (!this.active) return;

    if (this.isAssaulting) {
      this.assaultTimer -= (deltaTime / 1000);
      if (this.assaultTimer <= 0) {
        this.assaultTimer = 0;
      }
      
      const elapsedFraction = 1.0 - (this.assaultTimer / 3.0);
      
      // Attacker losses
      const targetAttackerLosses = Math.floor(this.totalAttackerLosses * elapsedFraction);
      const attackerLossesToApply = targetAttackerLosses - this.attackerLossesSpawned;
      if (attackerLossesToApply > 0) {
        this.count = Math.max(this.finalAttackerCount, this.count - attackerLossesToApply);
        this.attackerLossesSpawned += attackerLossesToApply;
        
        if (explosions && !this.isFriendlyAssault) {
          for (let i = 0; i < attackerLossesToApply; i++) {
            explosions.push({
              x: this.x + (Math.random() - 0.5) * 15,
              y: this.y + (Math.random() - 0.5) * 15,
              color: this.owner ? this.owner.color : '#fff',
              age: 0
            });
          }
        }
      }
      
      // Defender losses
      const targetDefenderLosses = Math.floor(this.totalDefenderLosses * elapsedFraction);
      const defenderLossesToApply = targetDefenderLosses - this.defenderLossesSpawned;
      const isPlanetHostile = !this.targetPlanet.owner || (this.owner && this.targetPlanet.owner.id !== this.owner.id);
      if (defenderLossesToApply > 0 && isPlanetHostile) {
        this.targetPlanet.ships = Math.max(0, this.targetPlanet.ships - defenderLossesToApply);
        this.defenderLossesSpawned += defenderLossesToApply;
        
        if (explosions && !this.isFriendlyAssault) {
          for (let i = 0; i < defenderLossesToApply; i++) {
            explosions.push({
              x: this.targetPlanet.x + (Math.random() - 0.5) * this.targetPlanet.radius,
              y: this.targetPlanet.y + (Math.random() - 0.5) * this.targetPlanet.radius,
              color: this.targetPlanet.owner ? this.targetPlanet.owner.color : '#555',
              age: 0
            });
          }
        }
      }
      
      // Friendly reinforcements increment
      if (this.isFriendlyAssault && this.totalReinforcements > 0) {
        const targetReinforcements = Math.floor(this.totalReinforcements * elapsedFraction);
        const reinforcementsToApply = targetReinforcements - this.reinforcementsApplied;
        if (reinforcementsToApply > 0) {
          this.targetPlanet.ships = Math.min(this.finalTargetPlanetShips, this.targetPlanet.ships + reinforcementsToApply);
          this.reinforcementsApplied += reinforcementsToApply;
        }
      }
      
      if (this.assaultTimer <= 0) {
        this.isAssaulting = false;
        
        this.targetPlanet.owner = this.finalTargetPlanetOwner;
        this.targetPlanet.ships = this.finalTargetPlanetShips;
        this.targetPlanet.maxShips = this.finalTargetPlanetMaxShips;
        this.targetPlanet.dead = this.finalTargetPlanetDead;
        this.targetPlanet.isResearch = this.finalTargetPlanetIsResearch;
        this.targetPlanet.isMilitary = this.finalTargetPlanetIsMilitary;
        this.targetPlanet.isSpeedPlanet = this.finalTargetPlanetIsSpeedPlanet;
        this.targetPlanet.sacrificedShips = this.finalTargetPlanetSacrificedShips;
        this.targetPlanet.rampageBoost = this.finalTargetPlanetRampageBoost;
        this.targetPlanet.rampageEvent = this.finalTargetPlanetRampageEvent;
        this.targetPlanet.defeatEvent = this.finalTargetPlanetDefeatEvent;
        
        this.count = 0;
        this.active = false;
        return;
      }
      
      // Strafing/Assault glide: slow down to a near stop, continue straight along same trajectory
      const strafingSpeed = 5; // near stop
      this.x += this.strafingDirX * strafingSpeed * (deltaTime / 1000);
      this.y += this.strafingDirY * strafingSpeed * (deltaTime / 1000);
      this.angle = Math.atan2(this.strafingDirY, this.strafingDirX);
      
      return;
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
          const tb = 0.01 * Math.sqrt(planet.owner.techScore || 0);
          const eb = 0.005 * Math.sqrt(planet.owner.expScore || 0);
          const gravityRadius = (planet.maxShips * 1.5) * (1 + tb + eb);
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
    } else {
      const bombBonus = (this.bombs && this.bombs > 0) ? (this.bombs * 3) : 0;
      const interceptorBonus = this.isInterceptor ? 5 : 0;
      hitChance = (10 + techBonus + expBonus + shipExpBonus + this.maxHealth * 5 + interceptorBonus + bombBonus) / 100;
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
        let hitsToDeal = 0;
        for (let s = 0; s < totalShots; s++) {
          if (Math.random() < hitChance) {
            hitsToDeal++;
          }
        }

        let lasersDrawn = 0;
        while (hitsToDeal > 0 && validTargets.length > 0) {
          const targetIndex = Math.floor(Math.random() * validTargets.length);
          const enemyShip = validTargets[targetIndex].ship;
          
          const damageDealt = enemyShip.takeDamage(explosions, this);
          hitsToDeal--;

          if (damageDealt && this.owner) {
            this.owner.addExperience(1);
          }

          if (lasers && lasersDrawn < 5) {
            lasers.push({
              startX: this.x + (Math.random() - 0.5) * 15, startY: this.y + (Math.random() - 0.5) * 15,
              endX: enemyShip.x + (Math.random() - 0.5) * 15, endY: enemyShip.y + (Math.random() - 0.5) * 15,
              color: this.owner ? this.owner.color : '#fff',
              age: 0, duration: 0.2
            });
            lasersDrawn++;
          }

          if (!enemyShip.active) {
            validTargets.splice(targetIndex, 1);
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

        while (shotsFired < maxShots && validTargets.length > 0) {
          const targetIndex = Math.floor(Math.random() * validTargets.length);
          const targetData = validTargets[targetIndex];
          const enemyShip = targetData.ship;
          
          shotsFired++;
          
          let finalHitChance = hitChance;
          if (this.maxHealth > 0 && !this.isAmoeba) {
            finalHitChance = Math.min(1.0, finalHitChance * 2);
          }
          
          if (Math.random() < finalHitChance) {
            const damageDealt = enemyShip.takeDamage(explosions, this);
            if (damageDealt) {
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
              startX: this.x, startY: this.y,
              endX: enemyShip.x, endY: enemyShip.y,
              color: this.owner ? this.owner.color : (this.isAmoeba ? 'amoeba' : '#fff'),
              age: 0, duration: usedBomb ? 0.6 : 0.2, width: usedBomb ? 8 : undefined,
              isAmoebaAttack: !!this.isAmoeba
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
          const shipExpBonus = (this.expScore || 0) * 2;
          let cruiserRadar = Math.min(250, 5 * this.maxHealth) + shipExpBonus;
          if (this.isWarp) cruiserRadar *= 0.25;

          const playerTechBonus = 0.01 * techBonus;
          const playerExpBonus = 0.01 * expBonus;
          const sensorRange = cruiserRadar * (1 + playerTechBonus + playerExpBonus);
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
            if (p.ships > p.maxShips / 2) {
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
                  destroysDefender: destroyedDefender,
                  targetPlanetId: p.id
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
    let destX = this.targetPlanet ? this.targetPlanet.x : this.targetX;
    let destY = this.targetPlanet ? this.targetPlanet.y : this.targetY;

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
            startX: this.targetPlanet.x + (Math.random() - 0.5) * this.targetPlanet.radius,
            startY: this.targetPlanet.y + (Math.random() - 0.5) * this.targetPlanet.radius,
            endX: this.x, endY: this.y,
            color: this.targetPlanet.owner.color,
            age: 0, duration: 0.2
          });
        }
      }
      if (Math.random() < 0.5 * (deltaTime / 1000)) { // 50% chance per sec from ship to planet
        if (lasers) {
          lasers.push({
            startX: this.x, startY: this.y,
            endX: this.targetPlanet.x + (Math.random() - 0.5) * this.targetPlanet.radius,
            endY: this.targetPlanet.y + (Math.random() - 0.5) * this.targetPlanet.radius,
            color: this.owner ? this.owner.color : (this.isAmoeba ? 'amoeba' : '#fff'),
            age: 0, duration: 0.2,
            isAmoebaAttack: !!this.isAmoeba
          });
        }
      }
    }


    if (this.maxHealth > 0 && !this.isAmoeba) {
      if (this.bombs === undefined) {
        this.bombs = this.maxHealth / 5;
        this.bombReloadTimer = 0;
      }
      
      if (this.inFriendlyWell) {
        if (this.health < this.maxHealth) {
          let healRate = (deltaTime / 60000) * 6;
          this.health = Math.min(this.maxHealth, this.health + healRate);
        }
        
        // Cruisers don't recover bombs or fuel while in warp
        if (!this.isWarp) {
          const recoveryRate = (this.combatCooldown && this.combatCooldown > 0) ? 0.5 : 1.0;
          this.fuel = Math.min(this.maxHealth / 5, (this.fuel || 0) + ((deltaTime / 1000) / 10) * recoveryRate);
          
          if (this.bombs < (this.maxHealth / 5) && friendlyWellPlanet) {
            const maxBombs = Math.floor(this.maxHealth / 5);
            const reloadMultiplier = 0.5 * (1 + 0.1 * maxBombs);
            this.bombReloadTimer += (deltaTime / 1000) * reloadMultiplier * recoveryRate;
            if (this.bombReloadTimer >= 5) {
              this.bombReloadTimer = 0;
              this.bombs++;
            }
          }
        }
      } else {
        const fuelDrain = this.isWarp ? 2 : 1;
        this.fuel = (this.fuel || 0) - (deltaTime / 1000) / (60 / fuelDrain);
        if (this.fuel <= 0) {
          this.fuel = 0;
          if (this.isWarp) {
            this.isWarp = false;
          }
          this.health -= deltaTime / 60000;
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
        
        if (!this.isAssaulting) {
          this.isAssaulting = true;
          this.assaultTimer = 3.0;
          this.initialAssaultCount = this.count;
          
          const originalTargetPlanetOwner = this.targetPlanet.owner;
          const originalTargetPlanetShips = this.targetPlanet.ships;
          const originalTargetPlanetMaxShips = this.targetPlanet.maxShips;
          const originalTargetPlanetDead = this.targetPlanet.dead;
          const originalTargetPlanetIsResearch = this.targetPlanet.isResearch;
          const originalTargetPlanetIsMilitary = this.targetPlanet.isMilitary;
          const originalTargetPlanetIsSpeedPlanet = this.targetPlanet.isSpeedPlanet;
          const originalTargetPlanetSacrificedShips = this.targetPlanet.sacrificedShips;
          const originalTargetPlanetRampageBoost = this.targetPlanet.rampageBoost;
          const originalTargetPlanetRampageEvent = this.targetPlanet.rampageEvent;
          const originalTargetPlanetDefeatEvent = this.targetPlanet.defeatEvent;
          const originalCount = this.count;
          
          this.resolveCombat(allShips, null, allPlanets, ionStorms);
          
          this.finalTargetPlanetOwner = this.targetPlanet.owner;
          this.finalTargetPlanetShips = this.targetPlanet.ships;
          this.finalTargetPlanetMaxShips = this.targetPlanet.maxShips;
          this.finalTargetPlanetDead = this.targetPlanet.dead;
          this.finalTargetPlanetIsResearch = this.targetPlanet.isResearch;
          this.finalTargetPlanetIsMilitary = this.targetPlanet.isMilitary;
          this.finalTargetPlanetIsSpeedPlanet = this.targetPlanet.isSpeedPlanet;
          this.finalTargetPlanetSacrificedShips = this.targetPlanet.sacrificedShips;
          this.finalTargetPlanetRampageBoost = this.targetPlanet.rampageBoost;
          this.finalTargetPlanetRampageEvent = this.targetPlanet.rampageEvent;
          this.finalTargetPlanetDefeatEvent = this.targetPlanet.defeatEvent;
          this.finalAttackerCount = this.count;
          
          this.targetPlanet.owner = originalTargetPlanetOwner;
          this.targetPlanet.ships = originalTargetPlanetShips;
          this.targetPlanet.maxShips = originalTargetPlanetMaxShips;
          this.targetPlanet.dead = originalTargetPlanetDead;
          this.targetPlanet.isResearch = originalTargetPlanetIsResearch;
          this.targetPlanet.isMilitary = originalTargetPlanetIsMilitary;
          this.targetPlanet.isSpeedPlanet = originalTargetPlanetIsSpeedPlanet;
          this.targetPlanet.sacrificedShips = originalTargetPlanetSacrificedShips;
          this.targetPlanet.rampageBoost = originalTargetPlanetRampageBoost;
          this.targetPlanet.rampageEvent = originalTargetPlanetRampageEvent;
          this.targetPlanet.defeatEvent = originalTargetPlanetDefeatEvent;
          this.count = originalCount;
          this.active = true;
          
          this.totalAttackerLosses = Math.max(0, this.count - this.finalAttackerCount);
          const isFriendly = !!(originalTargetPlanetOwner && this.owner && (originalTargetPlanetOwner === this.owner || originalTargetPlanetOwner.id === this.owner.id));
          if (!isFriendly) {
            const planetCaptured = !originalTargetPlanetOwner || (this.finalTargetPlanetOwner && this.finalTargetPlanetOwner.id !== originalTargetPlanetOwner.id);
            if (planetCaptured) {
              this.totalDefenderLosses = originalTargetPlanetShips;
            } else {
              this.totalDefenderLosses = Math.max(0, originalTargetPlanetShips - this.finalTargetPlanetShips);
            }
          } else {
            this.totalDefenderLosses = 0;
          }
          
          if (isFriendly) {
            this.totalReinforcements = Math.max(0, this.finalTargetPlanetShips - originalTargetPlanetShips);
            this.reinforcementsApplied = 0;
          } else {
            this.totalReinforcements = 0;
            this.reinforcementsApplied = 0;
          }
          
          const pdx = this.targetPlanet.x - this.x;
          const pdy = this.targetPlanet.y - this.y;
          const dist = Math.sqrt(pdx * pdx + pdy * pdy);
          this.strafingDirX = pdx / (dist || 1);
          this.strafingDirY = pdy / (dist || 1);
          this.isFriendlyAssault = isFriendly;
          
          this.attackerLossesSpawned = 0;
          this.defenderLossesSpawned = 0;
          
          if (this.isWarp) {
            this.isWarp = false;
          }
        }
        return;
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
    if (this.maxHealth > 0 && this.fuel <= 0) {
      effectiveSpeed = Math.max(5, effectiveSpeed - 10);
    }
    if (this.isWarp) {
      effectiveSpeed += this.warpBonus || 0;
    }
    if (this.speedModifier) {
      effectiveSpeed *= this.speedModifier;
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
            const chance = (h.intensity - knowledge - (tRed + eRed) / 2 - sRed) / 1000;
            let rollChance = chance * 10;
            let speedMod = effectiveSpeed / 35;
            if (effectiveSpeed > 35) {
              speedMod *= 3;
            }
            
            if (h.type === 'minefield') {
              rollChance *= speedMod;
            } else if (!h.type || h.type === 'storm') {
                rollChance *= speedMod;
              }
            
            if (this.isAmoeba) {
              rollChance = 0;
            }
            
            if ((!this.hazardCooldown || this.hazardCooldown <= 0) && rollChance > 0 && Math.random() < rollChance) {
              if (!this.checkSurvivalRoll()) {
                if (this.health > 0) {
                  this.health -= 1;
                  this.hazardCooldown = 1000;
                  if (this.health <= 0 && this.isAmoeba && this.maxHealth > 0) {
                    this.maxHealth -= 1;
                    if (this.maxHealth > 0) {
                      this.health = this.maxHealth;
                    }
                  }
                  if (explosions) {
                    const explosionColor = h.type === 'minefield' ? '#44f' : '#ff0';
                    explosions.push({ x: this.x, y: this.y, color: explosionColor, age: 0 });
                  }
                } else {
                  if (this.count > 1) {
                    this.count--;
                  } else {
                    this.active = false;
                  }
                  if (explosions) {
                    const explosionColor = h.type === 'minefield' ? '#44f' : '#ff0';
                    explosions.push({ x: this.x, y: this.y, color: explosionColor, age: 0 });
                    if (lasers) {
                      const boltX = this.x + (Math.random() - 0.5) * 80;
                      const boltY = this.y - 30 - Math.random() * 50;
                      const midX = (this.x + boltX) / 2 + (Math.random() - 0.5) * 40;
                      const midY = (this.y + boltY) / 2 + (Math.random() - 0.5) * 20;
                      lasers.push({ startX: boltX, startY: boltY, endX: midX, endY: midY, color: explosionColor, age: 0, duration: 0.4 });
                      lasers.push({ startX: midX, startY: midY, endX: this.x, endY: this.y, color: explosionColor, age: 0, duration: 0.4 });
                    }
                  }
                  if (!this.active) {
                    return; // Ship destroyed
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
      effectiveSpeed *= (this.health + this.maxHealth) / (2 * this.maxHealth);
    }

    const moveDistance = effectiveSpeed * (deltaTime / 1000);
    if (moveDistanceToDest > 0) {
      this.x += (dx / moveDistanceToDest) * moveDistance;
      this.y += (dy / moveDistanceToDest) * moveDistance;
    }
  }

  takeDamage(explosions, attacker = null) {
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
          shrugChance = Math.min(0.75, (this.maxHealth + (techBonus + expBonus + shipExpBonus)) / 100);
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

      this.health -= 1;
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

  resolveCombat(allShips, explosions, allPlanets, ionStorms) {
    if (this.targetPlanet.owner !== this.owner && this.maxHealth > 0) {
      // Ships with health > 0 may not attack planets, they just stay in orbit
      return;
    }
    if (this.targetPlanet.owner === this.owner) {
      if (this.count > 1) {
        let activeCount = this.count;
        if (this.isInterceptor) {
          activeCount = 0;
          for (let i = 0; i < this.count; i++) {
            if (Math.random() < 0.3) {
              if (explosions) {
                explosions.push({
                  x: this.targetPlanet.x + (Math.random() - 0.5) * this.targetPlanet.radius,
                  y: this.targetPlanet.y + (Math.random() - 0.5) * this.targetPlanet.radius,
                  color: '#ff5555',
                  age: 0
                });
              }
            } else {
              activeCount++;
            }
          }
        }
        const spaceLeft = Math.max(0, this.targetPlanet.maxShips - this.targetPlanet.ships);
        const reinforced = Math.min(spaceLeft, activeCount);
        const sacrificed = activeCount - reinforced;
        this.targetPlanet.ships += reinforced;

        if (sacrificed > 0) {
          this.targetPlanet.sacrificedShips = (this.targetPlanet.sacrificedShips || 0) + sacrificed;
          const upgrades = Math.floor(this.targetPlanet.sacrificedShips / 20);
          if (upgrades > 0) {
            this.targetPlanet.sacrificedShips %= 20;
            this.targetPlanet.increaseMaxShips(upgrades);
          }
          if (explosions) {
            explosions.push({
              x: this.targetPlanet.x,
              y: this.targetPlanet.y,
              color: '#fff',
              age: 0
            });
          }
        }
        this.count = 0;
        this.active = false;
        return;
      }

      if (this.isInterceptor && Math.random() < 0.3) {
        if (explosions) {
          explosions.push({
            x: this.targetPlanet.x + (Math.random() - 0.5) * this.targetPlanet.radius,
            y: this.targetPlanet.y + (Math.random() - 0.5) * this.targetPlanet.radius,
            color: '#ff5555',
            age: 0
          });
        }
        return;
      }
      if (this.targetPlanet.ships < this.targetPlanet.maxShips) {
        this.targetPlanet.ships++;
      } else {
        // Hard cap reached, sacrifice ship
        if (explosions) {
          explosions.push({
            x: this.targetPlanet.x + (Math.random() - 0.5) * this.targetPlanet.radius,
            y: this.targetPlanet.y + (Math.random() - 0.5) * this.targetPlanet.radius,
            color: '#fff',
            age: 0
          });
        }
        this.targetPlanet.sacrificedShips = (this.targetPlanet.sacrificedShips || 0) + 1;
        if (this.targetPlanet.sacrificedShips >= 20) {
          this.targetPlanet.sacrificedShips -= 20;
          this.targetPlanet.increaseMaxShips(1);
        }
      }
    } else {
      // Attack
      if (!this.owner.attackedPlanets) {
        this.owner.attackedPlanets = new Map();
      }
      const currentTimer = this.owner.attackedPlanets.get(this.targetPlanet.id) || 0;
      const addedTimer = this.count > 1 ? this.count * 60000 : 60000;
      this.owner.attackedPlanets.set(this.targetPlanet.id, currentTimer + addedTimer); // add 60 seconds per ship

      if (this.targetPlanet.ships > 0) {
        let nearbyFriendlyCount = 0;
        if (allShips) {
          for (const ship of allShips) {
            if (ship !== this && ship.owner === this.owner && ship.active) {
              const dx = ship.x - this.x;
              const dy = ship.y - this.y;
              const distSq = dx * dx + dy * dy;
              if (distSq < 10000) { // 100 pixels squared
                nearbyFriendlyCount += (ship.count || 1);
              }
            }
          }
        }
        let friendlyPlanetBoost = 0;
        let defenderPlanetPenalty = 0;
        if (allPlanets) {
          let friendlyCumulativeCapacity = 0;
          let defenderCumulativeCapacity = 0;
          for (const planet of allPlanets) {
            if (planet !== this.targetPlanet) {
              const dx = planet.x - this.targetPlanet.x;
              const dy = planet.y - this.targetPlanet.y;
              const distSq = dx * dx + dy * dy;
              const techBonus = planet.owner ? (0.01 * Math.sqrt(planet.owner.techScore || 0)) : 0;
              const expBonus = planet.owner ? (0.005 * Math.sqrt(planet.owner.expScore || 0)) : 0;
              const gravityRadius = (planet.maxShips * 1.5) * (1 + techBonus + expBonus);
              
              if (distSq < gravityRadius * gravityRadius) { // Distance < modified gravity radius
                if (planet.owner === this.owner) {
                  friendlyCumulativeCapacity += planet.maxShips;
                } else if (planet.owner === this.targetPlanet.owner) {
                  defenderCumulativeCapacity += planet.maxShips;
                }
              }
            }
          }
          friendlyPlanetBoost = 0.01 * Math.floor(friendlyCumulativeCapacity / 50);
          defenderPlanetPenalty = 0.01 * Math.floor(defenderCumulativeCapacity / 50);
        }

        const advantage = 0.01 * Math.floor(nearbyFriendlyCount / 10);
        const attackerTechBonus = 0.01 * Math.sqrt(this.owner.techScore || 0);
        const attackerExpBonus = 0.005 * Math.sqrt(this.owner.expScore || 0);
        
        const defenderTechPenalty = 0.01 * Math.sqrt(this.targetPlanet.owner ? (this.targetPlanet.owner.techScore || 0) : 0);
        const defenderExpPenalty = 0.005 * Math.sqrt(this.targetPlanet.owner ? (this.targetPlanet.owner.expScore || 0) : 0);
        
        const attackerLocalExpBonus = 0.005 * Math.sqrt(this.expScore || 0);
        const defenderLocalExpPenalty = 0.005 * Math.sqrt(this.targetPlanet.expScore || 0);

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
            const dx = this.targetPlanet.x - storm.x;
            const dy = this.targetPlanet.y - storm.y;
            if (dx * dx + dy * dy <= storm.radius * storm.radius) {
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
          let totalEcoDamage = 0;
          let totalShipDamage = 0;
          for (let b = 0; b < this.count; b++) {
            if (this.bomberType === 'eco' || this.bomberType === true) {
              totalEcoDamage += Math.floor(Math.random() * 2) + 1;
            } else if (this.bomberType === 'ships') {
              totalShipDamage += Math.floor(Math.random() * 4) + 1;
            }
          }
          if (totalEcoDamage > 0) {
            this.targetPlanet.maxShips -= totalEcoDamage;
            this.targetPlanet.capacityDecreaseEvent = true;
            if (this.targetPlanet.maxShips < 55) {
              this.targetPlanet.dead = true;
              if (this.targetPlanet.homeworldOf && this.owner) {
                this.owner.expScore = (this.owner.expScore || 0) + 100;
              }
            }
            if (explosions) {
              for (let i = 0; i < Math.min(totalEcoDamage, 15); i++) {
                explosions.push({
                  x: this.targetPlanet.x + (Math.random() - 0.5) * this.targetPlanet.radius,
                  y: this.targetPlanet.y + (Math.random() - 0.5) * this.targetPlanet.radius,
                  color: '#ffaa00',
                  age: 0
                });
              }
            }
          }
          if (totalShipDamage > 0) {
            this.targetPlanet.ships -= totalShipDamage;
            if (this.targetPlanet.ships < 0) this.targetPlanet.ships = 0;
            if (explosions) {
              for (let i = 0; i < Math.min(totalShipDamage, 15); i++) {
                explosions.push({
                  x: this.targetPlanet.x + (Math.random() - 0.5) * this.targetPlanet.radius,
                  y: this.targetPlanet.y + (Math.random() - 0.5) * this.targetPlanet.radius,
                  color: '#ff00aa',
                  age: 0
                });
              }
            }
          }
          this.count = 0;
          this.active = false;
          return;
        }

        if (this.count > 1) {
          let attackersLeft = this.count;
          while (attackersLeft > 0 && this.targetPlanet.ships > 0) {
            const penalty = 0.01 * Math.floor(this.targetPlanet.ships / 5);
            let killChance = Math.max(minKillChance, 0.8 - penalty + advantage + friendlyPlanetBoost - defenderPlanetPenalty + attackerTechBonus + attackerExpBonus + attackerLocalExpBonus + attackerHomeworldBonus - defenderTechPenalty - defenderExpPenalty - defenderLocalExpPenalty - lastStandPenalty - defenderHomeworldPenalty - humanDefenderBonus);
            if (this.isInterceptor) {
              killChance *= 0.5;
            }
            killChance = Math.max(minKillChance, killChance - hazardPenalty);

            if (Math.random() < killChance) {
              this.targetPlanet.ships--;
              if (this.owner) this.owner.addExperience(1);
              if (this.targetPlanet.owner) this.targetPlanet.owner.addExperience(1);
              
              if (Math.random() < 0.08 && this.targetPlanet.owner !== null) {
                this.targetPlanet.maxShips--;
                this.targetPlanet.capacityDecreaseEvent = true;
                if (this.targetPlanet.maxShips < 55) {
                  this.targetPlanet.dead = true;
                  if (this.targetPlanet.homeworldOf && this.owner) {
                    this.owner.expScore = (this.owner.expScore || 0) + 100;
                  }
                }
              }
              
              if (explosions && Math.random() < 0.1) {
                explosions.push({
                  x: this.targetPlanet.x + (Math.random() - 0.5) * this.targetPlanet.radius,
                  y: this.targetPlanet.y + (Math.random() - 0.5) * this.targetPlanet.radius,
                  color: this.targetPlanet.owner ? this.targetPlanet.owner.color : '#555',
                  age: 0
                });
              }
            } else {
              if (this.targetPlanet.owner) {
                this.targetPlanet.owner.addExperience(1);
              }
              this.targetPlanet.expScore = (this.targetPlanet.expScore || 0) + 1;
            }
            attackersLeft--;
          }
          this.count = attackersLeft;
        } else {
          const penalty = 0.01 * Math.floor(this.targetPlanet.ships / 5);
          let killChance = Math.max(minKillChance, 0.8 - penalty + advantage + friendlyPlanetBoost - defenderPlanetPenalty + attackerTechBonus + attackerExpBonus + attackerLocalExpBonus + attackerHomeworldBonus - defenderTechPenalty - defenderExpPenalty - defenderLocalExpPenalty - lastStandPenalty - defenderHomeworldPenalty - humanDefenderBonus);
          if (this.isInterceptor) {
            killChance *= 0.5;
          }
          killChance = Math.max(minKillChance, killChance - hazardPenalty);

          if (Math.random() < killChance) {
            this.targetPlanet.ships--;
            if (this.owner) this.owner.addExperience(1);
            if (this.targetPlanet.owner) this.targetPlanet.owner.addExperience(1);
            
            if (Math.random() < 0.08 && this.targetPlanet.owner !== null) {
              this.targetPlanet.maxShips--;
              this.targetPlanet.capacityDecreaseEvent = true;
              if (this.targetPlanet.maxShips < 55) {
                this.targetPlanet.dead = true;
                if (this.targetPlanet.homeworldOf && this.owner) {
                  this.owner.expScore = (this.owner.expScore || 0) + 100;
                }
              }
            }
            
            if (explosions) {
              explosions.push({
                x: this.targetPlanet.x + (Math.random() - 0.5) * this.targetPlanet.radius,
                y: this.targetPlanet.y + (Math.random() - 0.5) * this.targetPlanet.radius,
                color: this.targetPlanet.owner ? this.targetPlanet.owner.color : '#555',
                age: 0
              });
            }
          } else {
            if (this.targetPlanet.owner) {
              this.targetPlanet.owner.addExperience(1);
            }
            this.targetPlanet.expScore = (this.targetPlanet.expScore || 0) + 1;
          }
          this.count = 0;
          this.active = false;
        }
      }

      if (this.targetPlanet.ships <= 0) {
        // Capture
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
        this.targetPlanet.ships = this.count > 0 ? this.count : 1;
        this.targetPlanet.rampageBoost = false;
        this.targetPlanet.rampageEvent = false;
        this.count = 0;
        this.active = false;

        // Check if previous owner was eliminated
        if (previousOwner && previousOwner !== this.owner && allPlanets) {
          const hasRemaining = allPlanets.some(p => p !== this.targetPlanet && p.owner === previousOwner);
          if (!hasRemaining) {
            this.targetPlanet.defeatEvent = { name: previousOwner.name, color: previousOwner.color };
            this.owner.expScore = (this.owner.expScore || 0) + 100;
          }
        }
      } else {
        // Defender survived
        this.count = 0;
        this.active = false;
      }
    }
  }

  draw(ctx) {
    if (!this.active) return;

    ctx.fillStyle = this.owner.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}
