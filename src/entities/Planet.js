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
    this._owner = val;
    if (val) {
      val.hasOwnedPlanet = true;
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

    this.maxShips = Math.max(60, this.radius * 4);
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
    this.racialAffinity = styles[Math.floor(Math.random() * styles.length)];
    this.name = this.generatePlanetName();
    this.expScore = 0;
    this.expProgress = 0;
    this.diplomacyWarmupTimer = 0;
    this.activeDiplomatId = null;
    this.useResources = false;

    this.sizeClass = Math.floor(Math.random() * 91) + 60;
    this.habitability = Math.round(10 + Math.pow(Math.random(), 2) * 140);

    // Cap initial radius to sizeClass
    this.radius = Math.min(this.sizeClass, this.maxShips) / 4;

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
    this.maxShips = Math.max(60, newRadius * 4);
    this.radius = this.sizeClass ? Math.min(this.sizeClass, this.maxShips) / 4 : newRadius;
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
    this.radius = Math.min(this.sizeClass, this.maxShips) / 4;

    if (oldMax < 150 && this.maxShips >= 150) {
      this.preferredResourceWantedEvent = true;
      this.preferredResourceWantedChatQueued = false;
    }

  }

  decreaseMaxShips(amount = 1, silent = false) {
    this.maxShips = Math.max(5, this.maxShips - amount);
    this.radius = Math.min(this.sizeClass, this.maxShips) / 4;
    if (!silent) {
      this.capacityDecreaseEvent = true;
    }
  }

  update(deltaTime, allPlanets, settings, game) {
    if (this.isDeepSpaceAnomaly) return;
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
            let minAllowedCredits = 0;
            if (game && game.planets) {
              const ownsHw = game.planets.some(p => p.homeworldOf === this.owner.id && p.owner === this.owner);
              if (ownsHw) {
                minAllowedCredits = -(1000 + Math.floor(this.owner.totalShips || 0));
              }
            }
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
          }

          if (oldMode === 'garrison' && this.focusMode !== 'garrison' && this.ships > this.maxShips) {
            const extraShips = this.ships - this.maxShips;
            this.ships = this.maxShips;
            this.sacrificedShips = (this.sacrificedShips || 0) + extraShips;
            const upgrades = Math.floor(this.sacrificedShips / 20);
            if (upgrades > 0) {
              this.sacrificedShips %= 20;
              this.increaseMaxShips(upgrades);
            }
          }
          this.focusTransition = null;
        }
      }
    }

    const isHuman = this.owner && !this.owner.isAI;
    const focus = this.focusMode || 'economy';



    if (this.owner) {
      const growthLimit = (isHuman && focus === 'garrison') ? this.maxShips * 2 : this.maxShips;
      if (this.ships < growthLimit || (this.owner && this.owner.isAI)) {
        const techBonus = this.owner.techScore ? 0.01 * Math.sqrt(this.owner.techScore) : 0;
        const lowPopMultiplier = Math.min(1.0, 0.10 + 0.02 * Math.max(0, this.ships - 5));
        const effectiveMaxShips = this.rampageBoost ? this.maxShips * 3 : this.maxShips;
        const prodDivisor = 100 / (settings?.productionMultiple || 1.0);
        let effectiveRate = (Math.max(10, effectiveMaxShips - this.ships) / prodDivisor) * (1 + techBonus) * lowPopMultiplier;
        if (this.homeworldOf === this.owner.id) {
          effectiveRate *= 2;
        }
        if (this.habitability > 140) {
          effectiveRate *= 2;
        }
        if (!this.owner.isAI) {
          if (effectiveRate > 1.0) {
            effectiveRate = 1.0 + ((effectiveRate - 1.0) / 3);
          }
        }
        const canUseRes = !!(this.useResources || (this.owner && this.owner.tradeLimitToggle === true));

        if (canUseRes && this.preferredResource && this.owner.resources) {
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
        effectiveRate *= ((50 + this.habitability / 2) / 100);
        this.productionProgress += effectiveRate * (deltaTime / 1000);
        if (this.productionProgress >= 1) {
          let newShips = Math.floor(this.productionProgress);
          this.productionProgress -= newShips;
          this.ships += newShips;
          this.decreaseMaxShips(0.04 * newShips, true);
        }
      } else {
        this.productionProgress = 0;
      }
    } else {
      this.productionProgress = 0;
    }

    // Increase max capacity, tech score, or maintain garrison mode if full
    const isFull = this.owner && (this.ships >= (isHuman && focus === 'garrison' ? this.maxShips * 2 : this.maxShips));
    if (isFull || (this.owner && this.owner.isAI && this.ships >= this.maxShips)) {
      const timeToIncrease = focus === 'terraforming' ? 30 : 10;
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

            if (Math.random() * 100 >= failChance) {
              const increaseAmount = this.isResearch ? 2 : 1;
              this.owner.techScore = (this.owner.techScore || 0) + increaseAmount;
              if (this.isResearch) {
                this.techDoubleIncreaseEvent = true;
              } else {
                this.techIncreaseEvent = true;
              }
              this.ships = Math.max(0, this.ships - 2);
            } else {
              if (this.isResearch) {
                this.owner.techScore = (this.owner.techScore || 0) + 1;
                this.techIncreaseEvent = true;
              }
              this.ships = Math.max(0, this.ships - 1);
            }
            // Decay ships back to maxShips (or twice maxShips if Garrison)
            const limit = (this.owner && !this.owner.isAI && this.focusMode === 'garrison') ? this.maxShips * 2 : this.maxShips;
            if (this.ships > limit && !this.retainedShips) {
              this.ships = limit;
            }
          } else if (focus === 'economy' || focus === 'homeworld') {
            // Grow max capacity, no tech score
            if (this.rampageEvent) {
              this.decreaseMaxShips(1);
              if (this.maxShips < 5) this.dead = true;
            } else {
              const increaseAmount = this.homeworldOf ? 2 : 1;
              this.increaseMaxShips(increaseAmount);
            }
            // Decay ships back to maxShips (or twice maxShips if Garrison)
            const limit = (this.owner && !this.owner.isAI && this.focusMode === 'garrison') ? this.maxShips * 2 : this.maxShips;
            if (this.ships > limit && !this.retainedShips) {
              this.ships = limit;
            }
          } else if (focus === 'garrison') {
            // Grow up to twice max capacity, no grow max capacity or tech score
            // Decay ships back to twice maxShips
            const cap = this.maxShips * 2;
            if (this.ships > cap) {
              this.ships = cap;
            }
          } else if (focus === 'commerce') {
            // Decay ships back to maxShips
            const limit = this.maxShips;
            if (this.ships > limit && !this.retainedShips) {
              this.ships = limit;
            }
          } else if (focus === 'terraforming') {
            const oldHab = this.habitability;
            this.habitability += 1;
            
            const oldName = getHabName(oldHab);
            if (oldName === 'Jungle' && getHabName(this.habitability) === 'Ocean') {
              this.habitability = 100; // Terran
            } else if (oldName === 'Desert' && getHabName(this.habitability) === 'Tundra') {
              this.habitability = 90; // Arid
            } else if (oldName === 'Ocean' && getHabName(this.habitability) === 'Arid') {
              this.habitability = 100; // Terran
            }

            const newName = getHabName(this.habitability);
            if (oldName !== newName && game) {
              game.pendingHabClassChanges = game.pendingHabClassChanges || [];
              game.pendingHabClassChanges.push({
                planetId: this.id,
                planetName: this.name,
                ownerId: this.owner ? this.owner.id : null,
                oldClass: oldName,
                newClass: newName,
                x: this.x,
                y: this.y
              });
            }

            // Decay ships back to maxShips
            const limit = this.maxShips;
            if (this.ships > limit && !this.retainedShips) {
              this.ships = limit;
            }
          }
        } else {
          // AI controlled planets continue to operate as they have before
          if (this.rampageEvent) {
            this.decreaseMaxShips(1);
            if (this.maxShips < 5) this.dead = true;
          } else {
            if (focus === 'terraforming') {
              const oldHab = this.habitability;
              this.habitability += 1;
              
              const oldName = getHabName(oldHab);
              if (oldName === 'Jungle' && getHabName(this.habitability) === 'Ocean') {
                this.habitability = 100; // Terran
              } else if (oldName === 'Desert' && getHabName(this.habitability) === 'Tundra') {
                this.habitability = 90; // Arid
              } else if (oldName === 'Ocean' && getHabName(this.habitability) === 'Arid') {
                this.habitability = 100; // Terran
              }

              const newName = getHabName(this.habitability);
              if (oldName !== newName && game) {
                game.pendingHabClassChanges = game.pendingHabClassChanges || [];
                game.pendingHabClassChanges.push({
                  planetId: this.id,
                  planetName: this.name,
                  ownerId: this.owner ? this.owner.id : null,
                  oldClass: oldName,
                  newClass: newName,
                  x: this.x,
                  y: this.y
                });
              }
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

                if (Math.random() * 100 >= failChance) {
                  const increaseAmount = this.isResearch ? 2 : 1;
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
