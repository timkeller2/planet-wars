import { getEffectiveSympathy } from '../game.js';

export function getHabName(habitability) {
  const hab = habitability || 0;
  if (hab < 20) return 'Toxic';
  if (hab < 30) return 'Radiated';
  if (hab < 40) return 'Barren';
  if (hab < 50) return 'Desert';
  if (hab < 60) return 'Tundra';
  if (hab < 70) return 'Swamp';
  if (hab < 80) return 'Jungle';
  if (hab < 90) return 'Ocean';
  if (hab < 100) return 'Arid';
  if (hab < 141) return 'Terran';
  return 'Gaia';
}

/**
 * Apply one +1 habitability step with terraforming class skips
 * (Jungle→Ocean→Terran 100, Desert→Tundra→Arid 90, Ocean→Arid→Terran 100).
 * Caps at 100 (same as planet Focus terraforming). Returns true if applied.
 */
export function applyHabTerraformingStep(planet, game = null) {
  if (!planet) return false;
  const oldHab = planet.habitability || 0;
  if (oldHab >= 100) return false;

  planet.habitability = oldHab + 1;

  const oldName = getHabName(oldHab);
  const steppedName = getHabName(planet.habitability);
  if (oldName === 'Jungle' && steppedName === 'Ocean') {
    planet.habitability = 100; // Terran skip
  } else if (oldName === 'Desert' && steppedName === 'Tundra') {
    planet.habitability = 90; // Arid skip
  } else if (oldName === 'Ocean' && steppedName === 'Arid') {
    planet.habitability = 100; // Terran skip
  }

  planet.habitability = Math.min(100, Math.max(0, planet.habitability));

  const newName = getHabName(planet.habitability);
  if (oldName !== newName && game) {
    game.pendingHabClassChanges = game.pendingHabClassChanges || [];
    game.pendingHabClassChanges.push({
      planetId: planet.id,
      planetName: planet.name,
      ownerId: planet.owner ? planet.owner.id : null,
      oldClass: oldName,
      newClass: newName,
      x: planet.x,
      y: planet.y
    });
  }
  return true;
}

export function getMineralsName(minerals) {
  switch (minerals) {
    case 1: return 'Destitute';
    case 2: return 'Very Poor';
    case 3: return 'Poor';
    case 4: return 'Typical';
    case 5: return 'Rich';
    case 6: return 'Very Rich';
    case 7: return 'Ultra Rich';
    default: return 'Typical';
  }
}

function randomWeightedMiddle(min, max, iterations = 3) {
  let sum = 0;
  for (let i = 0; i < iterations; i++) {
    sum += Math.random();
  }
  return Math.round(min + (sum / iterations) * (max - min));
}


export class Planet {
  get owner() {
    return this._owner;
  }
  set owner(val) {
    if (this._owner && this._owner.ownedPlanets) {
      const idx = this._owner.ownedPlanets.indexOf(this);
      if (idx !== -1) {
        this._owner.ownedPlanets.splice(idx, 1);
      }
    }
    this._owner = val;
    if (val) {
      val.hasOwnedPlanet = true;
      if (val.ownedPlanets && !val.ownedPlanets.includes(this)) {
        val.ownedPlanets.push(this);
      }
    }
  }

  constructor(id, x, y, radius, owner, initialShips, mapWidth = 1920, mapHeight = 1620) {
    this.id = id;
    this.x = x;
    this.y = y;
    this.radius = radius;
    this._owner = null;
    this.owner = owner; // Player object or null
    this.ships = initialShips;

    this.sizeClass = Math.max(15, Math.round(this.radius * 4));
    this.maxShips = Math.max(15, this.radius * 4);
    this.supplies = Math.random() * this.maxShips;
    this.productionProgress = 0;
    this.capacityProgress = 0;
    this.sacrificedShips = 0;
    this.focusMode = 'economy';
    this.focusChanges = 0;
    this.sympathy = {};
    this.disposition = {};
    this.dispositionTimers = {};
    this.retainedShips = false;
    this.revoltWarmup = 0;
    this.revoltWarmupMax = 1;
    const resourcesList = ['dilithium', 'merculite', 'duranium', 'tritanium', 'antimatter', 'deuterium', 'latinum'];
    this.preferredResource = (Math.random() < 1/3) ? resourcesList[Math.floor(Math.random() * resourcesList.length)] : null;
    this.preferredResourceWantedEvent = false;
    const styles = ['Federation', 'Romulan', 'Klingon', 'Gorn', 'Tholian', 'Lyran'];
    this.racialAffinity = (Math.random() < 1/6) ? styles[Math.floor(Math.random() * styles.length)] : null;
    this.name = this.generatePlanetName();
    this.expScore = 0;
    this.expProgress = 0;
    this.diplomacyWarmupTimer = 0;
    this.activeDiplomatId = null;
    this.useResources = false;

    this.sizeClass = Math.floor(Math.random() * 91) + 60;
    this.habitability = Math.round(10 + Math.pow(Math.random(), 2) * 140);
    const mineralRolls = [1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 6, 7];
    this.minerals = mineralRolls[Math.floor(Math.random() * mineralRolls.length)];

    const potential = this.sizeClass * (this.habitability / 100);
    if (this.maxShips > potential) {
      const excess = this.maxShips - potential;
      this.maxShips = Math.max(15, this.maxShips - excess / 3);
    }

    // Cap initial radius to sizeClass
    this.radius = this.sizeClass / 4;
    this.supplies = Math.random() * this.maxShips;

    // Sci-Fi Planetary Resources System
    // Cascading chance allocation: 60% in the middle, dwindling down to 20% at the edges/corners.
    // 2nd and 3rd attempts are half of the previous successful chance.
    this.resources = [];
    const centerX = mapWidth / 2;
    const centerY = mapHeight / 2;
    const maxDist = Math.sqrt(centerX * centerX + centerY * centerY);
    const dx = this.x - centerX;
    const dy = this.y - centerY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const ratio = Math.min(1.0, dist / maxDist);
    let chance = 0.60 - ratio * 0.40;

    for (let i = 0; i < 3; i++) {
      if (Math.random() < chance) {
        // Pick a random resource not already assigned
        const available = resourcesList.filter(r => !this.resources.includes(r));
        if (available.length > 0) {
          this.resources.push(available[Math.floor(Math.random() * available.length)]);
        }
        chance /= 2;
      } else {
        break;
      }
    }

    // Planet Upgrades
    this.sensorarrays = 0;
    this.labs = 0;
    this.armor = 0;
    this.shields = 0;
    this.engine = 0;
    this.munitions = 0;
    this.targeting = 0;
    this.damagecontrol = 0;
    this.supply_ship = 0;
    this.extended_fuel = 0;
    this.diplomat = 0;
    this.marines = 0;
    this.command = 0;
  }

  generatePlanetName() {
    const prefixes = ['Aero', 'Zeta', 'Cor', 'Magna', 'Vel', 'Hel', 'Ceti', 'Gliese', 'Kepler', 'Altair', 'Vega', 'Sirius', 'Rigel', 'Deneb', 'Procyon', 'Lira', 'Orion', 'Cygnus', 'Lyra', 'Draco', 'Andro', 'Cassio', 'Ursa', 'Tauri', 'Leo'];
    const suffixes = [' Prime', ' Alpha', ' Beta', ' Gamma', ' Delta', ' Epsilon', ' Major', ' Minor', ' I', ' II', ' III', ' IV', ' V', ' X', ' Z', ' Station', ' Outpost', ' Haven', ' Core', ' Abyss'];
    
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const hasSuffix = Math.random() > 0.3; // 70% chance to have a suffix
    
    if (hasSuffix) {
      const suffix = suffixes[Math.floor(Math.random() * suffixes.length)];
      return prefix + suffix;
    }
    
    return prefix;
  }

  setRadius(newRadius) {
    this.maxShips = Math.max(15, newRadius * 4);
    this.radius = this.sizeClass ? this.sizeClass / 4 : newRadius;
  }

  increaseMaxShips(amount = 1) {
    const oldMax = this.maxShips;
    let increase = amount * (this.habitability / 100);
    const techBonus = this.owner ? Math.sqrt(this.owner.techScore || 0) : 0;
    const threshold = this.sizeClass * ((this.habitability + techBonus) / 100);
    if (this.maxShips >= threshold) {
      increase /= 3;
    }
    this.maxShips += increase;
    this.radius = this.sizeClass / 4;

    if (oldMax < 150 && this.maxShips >= 150) {
      this.preferredResourceWantedEvent = true;
      this.preferredResourceWantedChatQueued = false;
    }

  }

  decreaseMaxShips(amount = 1, silent = false) {
    this.maxShips = Math.max(5, this.maxShips - amount);
    this.radius = this.sizeClass / 4;
    if (!silent) {
      this.capacityDecreaseEvent = true;
    }
    if (this.supplies !== undefined) {
      this.supplies = Math.min(this.supplies, this.maxShips);
    }
  }

  getFinalProductionRate(settings) {
    if (!this.owner) return 0;
    const isHuman = !this.owner.isAI;
    const focus = this.focusMode || 'economy';
    const growthLimit = (isHuman && focus === 'garrison') ? this.maxShips * 2 : this.maxShips;
    
    if (this.ships < growthLimit || this.owner.isAI) {
      const techBonus = this.owner.techScore ? 0.01 * Math.sqrt(this.owner.techScore) : 0;
      const prodDivisor = 250 / (settings?.productionMultiple || 1.0);
      let baseVal = Math.min(this.ships, this.maxShips) / prodDivisor;
      let rate = Math.max((this.habitability / 1000), baseVal) * (1 + techBonus);

      rate *= ((this.minerals || 4) / 4);
      return rate;
    }
    return 0;
  }

  update(deltaTime, allPlanets, settings, game) {
    if (this.isDeepSpaceAnomaly) {
      this.supplies = 0;
      return;
    }
    
    if (this.maxShips <= 0) {
      this.supplies = 0;
    } else {
      if (this.supplies === undefined) {
        this.supplies = Math.random() * this.maxShips;
      }
      // baseRate is supplies/min at maxShips=100, minerals=4 (50% of original 3 / 0.75)
      const baseRate = this.owner ? 1.5 : 0.375;
      let regenRatePerMs = (baseRate * (this.maxShips / 100) * ((this.minerals || 4) / 4)) / 60000;
      // Supply Production focus: 4× regen below full, 8× when full of ships
      if (this.owner && (this.focusMode || 'economy') === 'supply') {
        regenRatePerMs *= (this.ships >= this.maxShips) ? 8 : 4;
      }
      this.supplies = Math.min(this.maxShips, this.supplies + regenRatePerMs * deltaTime);
    }
    this.prorateSympathiesIfNeeded();

    if (!this.dispositionTimers) this.dispositionTimers = {};
    if (this.disposition) {
      for (const pId of Object.keys(this.disposition)) {
        if (this.dispositionTimers[pId] === undefined) {
          this.dispositionTimers[pId] = 600000;
        }
        this.dispositionTimers[pId] -= deltaTime;
        if (this.dispositionTimers[pId] <= 0) {
          delete this.disposition[pId];
          delete this.dispositionTimers[pId];
        }
      }
    }

    if (this.owner && this.focusMode === 'terraforming') {
      const techBonus = Math.floor(Math.sqrt(this.owner.techScore || 0));
      const isUnlimited = !settings || !settings.timedGameLimit || settings.timedGameLimit === 'unlimited';
      const timedLimitSecs = !isUnlimited ? parseFloat(settings.timedGameLimit) : null;
      const durationInMinutes = timedLimitSecs ? (timedLimitSecs / 60) : null;
      const multiplier = (durationInMinutes && durationInMinutes > 0) ? (600 / durationInMinutes) : 5;
      const capVal = Math.round(multiplier * techBonus);
      if (this.habitability > capVal) {
        this.focusMode = 'economy';
        this.focusTransition = null;
      }
    }
    // Handle focus mode transition
    if (this.focusTransition) {
      if (!this.owner || this.owner.id !== this.focusTransition.playerId) {
        this.focusTransition = null;
      } else {
        this.focusTransition.elapsed += deltaTime;
        const progress = Math.min(1.0, this.focusTransition.elapsed / 15000);
        const consumedSoFar = Math.floor(this.focusTransition.totalCost * progress);
        const alreadyConsumed = this.focusTransition.totalCost - this.focusTransition.costRemaining;
        const toConsume = consumedSoFar - alreadyConsumed;
        
        if (toConsume > 0) {
          let unpaid = toConsume;
          if (this.owner.useCredits !== false) {
            // Debt floor always from trade ships (no homeworld / totalShips floor)
            const minAllowedCredits = -Math.floor(this.owner.totalTradeShips || 0);
            const currentCreditsAvailable = Math.max(0, (this.owner.credits || 0) - minAllowedCredits);
            if (currentCreditsAvailable > 0) {
              const creditsToUse = Math.min(currentCreditsAvailable, unpaid);
              this.owner.credits -= creditsToUse;
              unpaid -= creditsToUse;
            }
          }
          if (unpaid > 0) {
            const actualConsume = Math.min(this.ships, unpaid);
            this.ships = Math.max(0, this.ships - actualConsume);
          }
          this.focusTransition.costRemaining -= toConsume;
        }
        
        if (progress >= 1.0) {
          const oldMode = this.focusMode || 'economy';
          this.focusMode = this.focusTransition.targetMode;
          this.focusChanges = (this.focusChanges || 0) + 1;
          
          if (this.focusMode === 'homeworld') {
            if (allPlanets) {
              for (const p of allPlanets) {
                if (p.homeworldOf === this.owner.id) {
                  p.homeworldOf = null;
                  if (p.focusMode === 'homeworld') {
                    p.focusMode = 'economy';
                  }
                }
              }
            }
            this.homeworldOf = this.owner.id;
            this.sympathy = this.sympathy || {};
            this.sympathy[this.owner.id] = this.maxShips;
          }

          this.focusTransition = null;
        }
      }
    }

    // Handle planet upgrade transition
    if (this.upgradeTransition) {
      if (!this.owner || this.owner.id !== this.upgradeTransition.playerId) {
        this.upgradeTransition = null;
      } else {
        this.upgradeTransition.elapsed += deltaTime;
        const progress = Math.min(1.0, this.upgradeTransition.elapsed / 30000);
        const consumedSoFar = Math.floor(this.upgradeTransition.totalCost * progress);
        const alreadyConsumed = this.upgradeTransition.totalCost - this.upgradeTransition.costRemaining;
        const toConsume = consumedSoFar - alreadyConsumed;
        
        if (toConsume > 0) {
          this.owner.credits = (this.owner.credits || 0) - toConsume;
          this.upgradeTransition.costRemaining -= toConsume;
        }
        
        if (progress >= 1.0) {
          const prop = this.upgradeTransition.prop;
          this[prop] = (this[prop] || 0) + 1;
          
          this.upgradeCompleted = {
            type: this.upgradeTransition.type,
            prop: prop,
            cost: this.upgradeTransition.totalCost
          };
          
          this.upgradeTransition = null;
        }
      }
    }

    const isHuman = this.owner && !this.owner.isAI;
    const focus = this.focusMode || 'economy';



    if (this.owner) {
      const growthLimit = (isHuman && focus === 'garrison') ? this.maxShips * 2 : this.maxShips;
      const techBonus = this.owner.techScore ? 0.01 * Math.sqrt(this.owner.techScore) : 0;
      const prodDivisor = 200 / (settings?.productionMultiple || 1.0);
      let term1 = Math.min(this.ships, 50);
      let term2 = Math.min(Math.max(0, this.maxShips - this.ships), 50);
      let rawSum = term1 + term2; // Omitted the anomalous '/ 250' from the prompt
      let cappedSum = Math.min(rawSum, this.ships * 2);
      let baseVal = cappedSum / prodDivisor;
      if (this.ships > 100) {
        const largeDivisor = 500 / (settings?.productionMultiple || 1.0);
        baseVal += (this.ships - 100) / largeDivisor;
      }
      let effectiveRate = Math.max((this.habitability / 1000), baseVal) * (1 + techBonus);

      if (this.preferredResource && this.owner.resources) {
        const qty = this.owner.resources[this.preferredResource] || 0;
        if (qty > 0) {
          let mult = 1;
          if (this.maxShips >= 150) mult = 4;
          else if (this.maxShips >= 120) mult = 3;
          else if (this.maxShips >= 100) mult = 2;
          effectiveRate *= (1 + (Math.sqrt(qty) * mult) / 100);
        }
      }
      if (this.racialAffinity && this.racialAffinity === this.owner.cruiserStyle) {
        effectiveRate *= 1.30;
      }
      effectiveRate *= ((this.minerals || 4) / 4);

      if (this.ships < growthLimit || (this.owner && this.owner.isAI)) {
        this.productionProgress += effectiveRate * (deltaTime / 1000);
        if (this.productionProgress >= 1) {
          let newShips = Math.floor(this.productionProgress);
          this.productionProgress -= newShips;
          this.ships += newShips;
          this.decreaseMaxShips(0.04 * newShips, true);
        }
      } else if (focus === 'rootoutspies') {
        this.productionProgress += effectiveRate * (deltaTime / 1000);
        let phantomShips = Math.floor(this.productionProgress);
        if (phantomShips >= 3) {
          let cycles = Math.floor(phantomShips / 3);
          this.productionProgress -= (cycles * 3);
          
          let highestSympathy = 0;
          let highestEnemyId = null;
          if (this.sympathy) {
            for (const playerId in this.sympathy) {
              if (playerId !== this.owner.id) {
                let sym = this.sympathy[playerId];
                if (sym > highestSympathy) {
                  highestSympathy = sym;
                  highestEnemyId = playerId;
                }
              }
            }
          }
          
          if (highestEnemyId) {
            this.sympathy[highestEnemyId] = Math.max(0, this.sympathy[highestEnemyId] - cycles);
            // Attribute pressure so if this drops their last foothold (>10 sympathy
            // with no planets/ships/pioneers), eliminatePlayer can credit the conqueror.
            if (this.owner && this.owner.id !== highestEnemyId) {
              const victim = game && game.allPlayers
                ? game.allPlayers.find(p => p.id === highestEnemyId)
                : null;
              if (victim) {
                victim.lastAttackerPlayerId = this.owner.id;
              }
            }
            if (this.owner) {
              this.owner.spyRootedEvents = this.owner.spyRootedEvents || new Set();
              this.owner.spyRootedEvents.add(this.id);
            }
          } else {
            this.focusMode = 'commerce';
          }
        }
      } else {
        if (!this.owner.isAI && (focus === 'economy' || focus === 'homeworld' || focus === 'terraforming')) {
          let shipsWouldBeProduced = effectiveRate * (deltaTime / 1000);
          
          if (this.useResources && (this.owner.credits || 0) > 0) {
            const dtSec = deltaTime / 1000;
            const creditsToUse = Math.min(this.owner.credits, dtSec);
            this.owner.credits -= creditsToUse;
            shipsWouldBeProduced += creditsToUse;
          }

          if (focus === 'economy' || focus === 'homeworld') {
            this.productionProgress = 0;
            const rawTech = this.owner.techScore ? Math.sqrt(this.owner.techScore) : 0;
            const threshold = this.sizeClass * ((this.habitability + rawTech) / 100);
            const conversionRate = (this.maxShips >= threshold) ? (1 / 15) : (1 / 5);
            
            let increase = shipsWouldBeProduced * conversionRate;
            this.maxShips += increase;
            this.radius = this.sizeClass / 4;
          } else if (focus === 'terraforming') {
            this.productionProgress += shipsWouldBeProduced;
            if (this.productionProgress >= 15) {
              const cycles = Math.floor(this.productionProgress / 15);
              this.productionProgress -= (cycles * 15);

              for (let i = 0; i < cycles; i++) {
                if (!applyHabTerraformingStep(this, game)) break;
              }
            }
          }
        } else {
          this.productionProgress = 0;
        }
      }
    } else {
      this.productionProgress = 0;
    }

    // Increase max capacity, tech score, or maintain garrison mode if full
    const isFull = this.owner && (this.ships >= (isHuman && focus === 'garrison' ? this.maxShips * 2 : this.maxShips));
    if (isFull || (this.owner && this.owner.isAI && this.ships >= this.maxShips)) {
      const timeToIncrease = focus === 'terraforming' ? 30 : (focus === 'research' ? 15 : 10);
      this.capacityProgress += (deltaTime / 1000);
      if (this.capacityProgress >= timeToIncrease) {
        if (isHuman) {
          if (focus === 'research') {
            let galacticCapacity = 0;
            if (allPlanets) {
              for (const p of allPlanets) {
                galacticCapacity += p.maxShips;
              }
            }
            const capacityPercent = galacticCapacity > 0 ? ((this.owner.totalCapacity || 0) / galacticCapacity) * 100 : 0;
            const failChance = capacityPercent * 2;

            const r = this.ships / 100;
            const shipsPercent = r <= 1.0 ? r : 1.0 + (r - 1.0) / 3;

            if (Math.random() * 100 >= failChance) {
              const baseIncrease = this.isResearch ? 2 : 1;
              const increaseAmount = baseIncrease * shipsPercent;
              this.owner.techScore = (this.owner.techScore || 0) + increaseAmount;
              if (this.isResearch) {
                this.techDoubleIncreaseEvent = true;
              } else {
                this.techIncreaseEvent = true;
              }
            } else {
              if (this.isResearch) {
                this.owner.techScore = (this.owner.techScore || 0) + 1;
                this.techIncreaseEvent = true;
              }
            }
          } else if (focus === 'economy' || focus === 'homeworld') {
            // Max capacity growth is now continuous in the production block
            if (this.rampageEvent) {
              this.decreaseMaxShips(1);
              if (this.maxShips < 5) this.dead = true;
            }
          }
        } else {
          // AI controlled planets continue to operate as they have before
          if (this.rampageEvent) {
            this.decreaseMaxShips(1);
            if (this.maxShips < 5) this.dead = true;
          } else {
            if (focus === 'terraforming') {
              applyHabTerraformingStep(this, game);
            } else {
              const increaseAmount = this.homeworldOf ? 2 : 1;
              this.increaseMaxShips(increaseAmount);
              if (this.owner && allPlanets) {
                let galacticCapacity = 0;
                for (const p of allPlanets) {
                  galacticCapacity += p.maxShips;
                }
                const capacityPercent = galacticCapacity > 0 ? ((this.owner.totalCapacity || 0) / galacticCapacity) * 100 : 0;
                const failChance = capacityPercent * 2;
                
                // Always deduct 2 ships on any tech increase attempt
                this.ships = Math.max(0, this.ships - 2);

                const r = this.ships / 100;
                const shipsPercent = r <= 1.0 ? r : 1.0 + (r - 1.0) / 3;

                if (Math.random() * 100 >= failChance) {
                  const baseIncrease = this.isResearch ? 2 : 1;
                  const increaseAmount = baseIncrease * shipsPercent;
                  this.owner.techScore = (this.owner.techScore || 0) + increaseAmount;
                  if (this.isResearch) {
                    this.techDoubleIncreaseEvent = true;
                  } else {
                    this.techIncreaseEvent = true;
                  }
                } else if (this.isResearch) {
                  this.owner.techScore = (this.owner.techScore || 0) + 1;
                  this.techIncreaseEvent = true;
                }
              }
            }
          }
        }
        this.capacityProgress -= timeToIncrease;
      }
    } else {
      this.capacityProgress = 0;
    }

    if (!this.inRevolt) {
      let sympathyForeign = 0;
      let sympathyOwner = 0;
      
      if (game && game.allPlayers) {
        for (const player of game.allPlayers) {
          if (player.id === 'monsters') continue;
          const symVal = getEffectiveSympathy(this, player.id, game.ships, player, game);
          if (this.owner && player.id === this.owner.id) {
            sympathyOwner = symVal;
          } else {
            sympathyForeign += symVal;
          }
        }
      } else if (this.sympathy) {
        for (const [pId, symVal] of Object.entries(this.sympathy)) {
          if (pId === 'monsters') continue;
          if (!this.owner || pId !== this.owner.id) {
            sympathyForeign += symVal;
          }
        }
        sympathyOwner = (this.owner && this.sympathy) ? (this.sympathy[this.owner.id] || 0) : 0;
      }
      
      const ships = this.ships;
      const ratePerMinute = sympathyForeign - (ships / 3) - sympathyOwner;
      const maxRatePerMinute = Math.max(30, ships);
      
      if (ratePerMinute > 0) {
        const clampedRatePerMinute = Math.min(ratePerMinute, maxRatePerMinute);
        const increment = clampedRatePerMinute * (deltaTime / 60000);
        this.revoltWarmup = (this.revoltWarmup || 0) + increment;
      } else {
        // Cooldown/decay when suppressed (minimum of 5 units per minute decay so it is visible and cleans up)
        const decayRate = Math.max(5, Math.abs(ratePerMinute));
        const decrement = decayRate * (deltaTime / 60000);
        this.revoltWarmup = Math.max(0, (this.revoltWarmup || 0) - decrement);
      }
      this.revoltWarmupMax = Math.max(30, ships);

      if (this.revoltWarmup >= this.revoltWarmupMax) {
        this.revoltWarmup = 0;
        if (game && typeof game.checkSinglePlanetSympathyRevolt === 'function') {
          game.checkSinglePlanetSympathyRevolt(this);
        }
      }
    } else {
      this.revoltWarmupMax = Math.max(30, this.ships);
    }

    if (this.justAssigned) {
      this.justAssignedTimer = (this.justAssignedTimer || 0) + deltaTime;
      if (this.justAssignedTimer > 1000) {
        this.justAssigned = false;
        this.justAssignedTimer = 0;
      }
    }

    // Passive & Active Resource Extraction Tick
    // Base rate: 1/1000 of a resource per ship per minute
    // Mining focus: 3x, Planet full: 3x, Tech bonus, Preferred resource bonus
    if (this.owner && this.owner.resources && this.resources && this.resources.length > 0) {
      const baseRatePerMinute = this.ships / 1000; // 1/1000 per ship per minute
      const techBonus = this.owner.techScore ? 0.01 * Math.sqrt(this.owner.techScore) : 0;
      let rate = baseRatePerMinute * (1 + techBonus);
      if (focus === 'mining') rate *= 2;
      if (this.ships >= this.maxShips && focus === 'mining') rate *= 2;
      rate *= ((this.minerals || 4) / 4);

      // Convert from per-minute to per-millisecond and apply deltaTime
      const perMs = rate / 60000;
      for (const res of this.resources) {
        let resRate = perMs;
        // Preferred resource bonus
        if (res === this.preferredResource && this.owner.resources[res] > 0) {
          let mult = 1;
          if (this.maxShips >= 150) mult = 4;
          else if (this.maxShips >= 120) mult = 3;
          else if (this.maxShips >= 100) mult = 2;
          resRate *= (1 + (Math.sqrt(this.owner.resources[res]) * mult) / 100);
        }
        if (this.racialAffinity && this.racialAffinity === this.owner.cruiserStyle) {
          resRate *= 1.30;
        }
        this.owner.resources[res] = (this.owner.resources[res] || 0) + resRate * deltaTime;
      }
    }

    const isHumanOwner = this.owner && !this.owner.isAI;
    const decayLimit = (isHumanOwner && this.focusMode === 'garrison') ? this.maxShips * 2 : this.maxShips;
    if (this.owner && this.ships > decayLimit && !this.retainedShips) {
      const overage = this.ships - decayLimit;
      const decayRate = overage / 50; // ships per second
      this.ships -= decayRate * (deltaTime / 1000);
      if (this.ships < decayLimit) this.ships = decayLimit;
    }

    if (this.preferredResourceWantedEvent && game && !this.preferredResourceWantedChatQueued) {
      this.preferredResourceWantedChatQueued = true;
      if (this.owner && !this.owner.isAI) {
        const emojis = {
          antimatter: '🌀',
          tritanium: '🔩',
          merculite: '☄️',
          dilithium: '💎',
          duranium: '🔲',
          deuterium: '💧',
          latinum: '🏺'
        };
        const emoji = emojis[this.preferredResource] || '💎';
        game.pendingChatMessages = game.pendingChatMessages || [];
        game.pendingChatMessages.push({
          playerId: this.owner.id,
          text: `${this.name} wants ${emoji}!`
        });
      }
    }
  }

  addExperience(amount) {
    this.expProgress += amount;
    while (this.expProgress >= 20) {
      this.expProgress -= 20;
      this.expScore++;
    }
  }

  addSympathy(playerId, increaseAmt) {
    if (increaseAmt <= 0) return 0;
    this.sympathy = this.sympathy || {};
    const currentSym = this.sympathy[playerId] || 0;
    
    const limit = Math.max(this.maxShips, this.ships || 0);
    
    if (currentSym >= limit) {
      return 0;
    }
    
    let totalSympathy = 0;
    for (const val of Object.values(this.sympathy)) {
      totalSympathy += val;
    }
    
    const spaceRemaining = Math.max(0, limit - totalSympathy);
    const spaceUsed = Math.min(spaceRemaining, increaseAmt);
    let newSym = currentSym + spaceUsed;
    
    let remaining = increaseAmt - spaceUsed;
    let actualIncrease = spaceUsed;
    
    if (remaining > 0) {
      const reduction = Math.ceil(remaining / 2);
      remaining = Math.max(0, remaining - reduction);
      
      if (remaining > 0) {
        let steps = Math.ceil(remaining);
        const otherSyms = [];
        for (const [pId, symVal] of Object.entries(this.sympathy)) {
          if (pId !== playerId && symVal > 0) {
            otherSyms.push({ id: pId, sympathy: symVal });
          }
        }
        
        if (otherSyms.length > 0) {
          otherSyms.sort((a, b) => b.sympathy - a.sympathy);
          let distributedReduction = 0;
          while (steps > 0) {
            let reducedAny = false;
            for (const enemy of otherSyms) {
              if (steps <= 0) break;
              const currentEnemySym = this.sympathy[enemy.id] || 0;
              if (currentEnemySym > 0) {
                const toReduce = Math.min(1, currentEnemySym);
                this.sympathy[enemy.id] = Math.max(0, currentEnemySym - toReduce);
                steps -= toReduce;
                distributedReduction += toReduce;
                reducedAny = true;
              }
            }
            if (!reducedAny) break;
          }
          newSym += distributedReduction;
          actualIncrease += distributedReduction;
        }
      }
    }
    
    this.sympathy[playerId] = Math.min(limit, newSym);
    this.prorateSympathiesIfNeeded();
    return actualIncrease;
  }

  prorateSympathiesIfNeeded() {
    if (!this.sympathy) return;
    const limit = Math.max(this.maxShips, this.ships || 0);
    let totalSympathy = 0;
    for (const val of Object.values(this.sympathy)) {
      totalSympathy += val;
    }
    if (totalSympathy > limit && totalSympathy > 0) {
      const scale = limit / totalSympathy;
      for (const [pId, val] of Object.entries(this.sympathy)) {
        this.sympathy[pId] = val * scale;
      }
    }
  }

  isBeingInvaded(game) {
    if (!game || !game.ships) return false;
    if (!this.owner) return false;
    
    for (const ship of game.ships) {
      if (!ship.active) continue;
      if (ship.isScouting || ship.isDiplomacy) continue;
      
      let isHostile = false;
      if (ship.owner && ship.owner.id !== this.owner.id) {
        isHostile = true;
      } else if (ship.isAmoeba) {
        isHostile = true;
      }
      
      if (isHostile) {
        if (ship.targetPlanet === this) {
          return true;
        }
        const dx = ship.x - this.x;
        const dy = ship.y - this.y;
        const distSq = dx * dx + dy * dy;
        const activeRange = this.radius + 50;
        if (distSq <= activeRange * activeRange) {
          return true;
        }
      }
    }
    return false;
  }

  getGravityRadius(mapScale = 1.0) {
    let baseRadius = this.maxShips * 1.5 * mapScale;
    if (this.isMilitary && this.ships >= this.maxShips) {
      baseRadius *= 1.5;
    }
    const isHuman = this.owner && !this.owner.isAI;
    if (isHuman && this.focusMode === 'garrison' && this.ships >= this.maxShips) {
      baseRadius += (this.ships / 2) * mapScale;
    }
    const tb = 0.01 * Math.sqrt(this.owner ? (this.owner.techScore || 0) : 0);
    const eb = 0.01 * Math.sqrt(this.owner ? (this.owner.expScore || 0) : 0);
    let r = baseRadius * (1 + tb + eb);
    if (!this.owner) {
      r *= 0.5;
    }
    return r;
  }

  draw(ctx, isSelected) {
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);

    if (this.owner) {
      ctx.fillStyle = this.owner.color;
      ctx.shadowColor = this.owner.color;
      ctx.shadowBlur = 15;
    } else {
      ctx.fillStyle = '#555';
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
    }

    ctx.fill();

    if (isSelected) {
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    // Reset shadow
    ctx.shadowBlur = 0;

    // Draw ship count backdrop pill
    const text = `${Math.floor(this.ships)} / ${Math.round(this.maxShips)}`;
    ctx.font = `bold ${Math.max(10, this.radius * 0.45)}px Orbitron`;
    const textWidth = ctx.measureText(text).width;

    ctx.fillStyle = 'rgba(17, 11, 11, 0.6)';
    const pillHeight = Math.max(14, this.radius * 0.55);
    ctx.fillRect(this.x - textWidth / 2 - 6, this.y - pillHeight / 2, textWidth + 12, pillHeight);

    const techBonus = this.owner ? Math.sqrt(this.owner.techScore || 0) : 0;
    const threshold = this.sizeClass * ((this.habitability + techBonus) / 100);
    if (this.maxShips >= threshold) {
      ctx.fillStyle = '#00ff00'; // green for dark background
    } else {
      ctx.fillStyle = '#000';
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, this.x, this.y);
  }
}
