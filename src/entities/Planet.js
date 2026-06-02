export class Planet {
  constructor(id, x, y, radius, owner, initialShips) {
    this.id = id;
    this.x = x;
    this.y = y;
    this.radius = radius;
    this.owner = owner; // Player object or null
    this.ships = initialShips;

    this.maxShips = Math.max(60, this.radius * 4);
    this.productionProgress = 0;
    this.capacityProgress = 0;
    this.sacrificedShips = 0;
    const modes = ['economy', 'research', 'garrison'];
    this.focusMode = modes[Math.floor(Math.random() * modes.length)];
    this.focusChanges = 0;
    this.sympathy = {};
    this.disposition = {};
    this.retainedShips = false;
    this.revoltCooldown = 0;
    const resourcesList = ['dilithium', 'merculite', 'duranium', 'tritanium', 'antimatter', 'deuterium', 'latinum'];
    this.preferredResource = resourcesList[Math.floor(Math.random() * resourcesList.length)];
    this.name = this.generatePlanetName();
    this.expScore = 0;
    this.expProgress = 0;

    // Sci-Fi Planetary Resources System
    // Cascading chance allocation: 35% first, then half for each subsequent resource
    this.resources = [];
    let chance = 0.35;
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
    this.radius = newRadius;
    this.maxShips = Math.max(60, this.radius * 4);
  }

  increaseMaxShips(amount = 1) {
    this.maxShips += amount;
    this.radius = this.maxShips / 4;
  }

  decreaseMaxShips(amount = 1) {
    this.maxShips -= amount;
    this.radius = this.maxShips / 4;
    this.capacityDecreaseEvent = true;
  }

  update(deltaTime, allPlanets, settings) {
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
          const currentCredits = this.owner.credits || 0;
          if (currentCredits > 0) {
            const creditsToUse = Math.min(currentCredits, unpaid);
            this.owner.credits -= creditsToUse;
            unpaid -= creditsToUse;
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

    if (this.owner && focus === 'commerce' && this.ships >= this.maxShips) {
      const shipsOver100 = Math.max(0, this.ships - 100);
      const tradingBonus = this.owner.tradingBonus || 0;
      const techBonus = this.owner.techScore ? 0.01 * Math.sqrt(this.owner.techScore) : 0;
      let generatedCredits = (shipsOver100 / 100) * (deltaTime / 1000) * (1 + tradingBonus) * (1 + techBonus);
      if (this.preferredResource && this.owner.resources) {
        const qty = this.owner.resources[this.preferredResource] || 0;
        if (qty > 0) {
          generatedCredits *= (1 + (Math.sqrt(qty) * 3) / 100);
        }
      }
      this.owner.credits = (this.owner.credits || 0) + generatedCredits;
    }

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
        if (!this.owner.isAI) {
          if (effectiveRate > 1.0) {
            effectiveRate = 1.0 + ((effectiveRate - 1.0) / 3);
          }
        }
        if (this.preferredResource && this.owner.resources) {
          const qty = this.owner.resources[this.preferredResource] || 0;
          if (qty > 0) {
            effectiveRate *= (1 + (Math.sqrt(qty) * 3) / 100);
          }
        }
        this.productionProgress += effectiveRate * (deltaTime / 1000);
        if (this.productionProgress >= 1) {
          let newShips = Math.floor(this.productionProgress);
          this.productionProgress -= newShips;
          if (this.owner.credits < 0) {
            let shipsBuilt = 0;
            for (let i = 0; i < newShips; i++) {
              if (this.owner.credits < 0) {
                this.owner.credits += 1;
              } else {
                shipsBuilt++;
              }
            }
            this.ships += shipsBuilt;
          } else {
            this.ships += newShips;
          }
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
      const timeToIncrease = this.maxShips / 10;
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
          } else if (focus === 'economy') {
            // Grow max capacity, no tech score
            if (this.rampageEvent) {
              this.decreaseMaxShips(1);
              if (this.maxShips < 55) this.dead = true;
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
          }
        } else {
          // AI controlled planets continue to operate as they have before
          if (this.rampageEvent) {
            this.decreaseMaxShips(1);
            if (this.maxShips < 55) this.dead = true;
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
        this.capacityProgress -= timeToIncrease;
      }
    } else {
      this.capacityProgress = 0;
    }

    if (this.revoltCooldown > 0) {
      this.revoltCooldown = Math.max(0, this.revoltCooldown - deltaTime);
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
      if (focus === 'mining') rate *= 3;
      if (this.ships >= this.maxShips) rate *= 3;

      // Convert from per-minute to per-millisecond and apply deltaTime
      const perMs = rate / 60000;
      for (const res of this.resources) {
        let resRate = perMs;
        // Preferred resource bonus: sqrt(qty) * 3 percent
        if (res === this.preferredResource && this.owner.resources[res] > 0) {
          resRate *= (1 + (Math.sqrt(this.owner.resources[res]) * 3) / 100);
        }
        this.owner.resources[res] = (this.owner.resources[res] || 0) + resRate * deltaTime;
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
    return baseRadius * (1 + tb + eb);
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
    const text = `${Math.floor(this.ships)} / ${this.maxShips}`;
    ctx.font = `bold ${Math.max(10, this.radius * 0.45)}px Orbitron`;
    const textWidth = ctx.measureText(text).width;

    ctx.fillStyle = 'rgba(17, 11, 11, 0.6)';
    const pillHeight = Math.max(14, this.radius * 0.55);
    ctx.fillRect(this.x - textWidth / 2 - 6, this.y - pillHeight / 2, textWidth + 12, pillHeight);

    ctx.fillStyle = '#000';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, this.x, this.y);
  }
}
