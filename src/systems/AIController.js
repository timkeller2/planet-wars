export class AIController {
  constructor(game, aiPlayer) {
    this.game = game;
    this.aiPlayer = aiPlayer;
    this.lastActionTime = 0;
    this.actionInterval = 2000; // Act every 2 seconds
    this.lastOverpopulatedTime = 0;
  }

  _rebuildBullseyeCache() {
    const activePlayers = this.game.allPlayers.filter(p => p.isAlive);
    const sortedPlayers = [...activePlayers].sort((a, b) => (b.totalCapacity || 0) - (a.totalCapacity || 0));
    const techSorted = [...activePlayers].sort((a, b) => (b.techScore || 0) - (a.techScore || 0));
    
    const techLead = techSorted.length > 1 ? ((techSorted[0].techScore || 0) - (techSorted[1].techScore || 0)) : (techSorted[0] ? (techSorted[0].techScore || 0) : 0);
    const techLeadingId = techLead >= 200 ? techSorted[0].id : null;
    const capLeadingId = sortedPlayers.length > 1 && (sortedPlayers[0].totalCapacity || 0) > 2 * (sortedPlayers[1].totalCapacity || 0) ? sortedPlayers[0].id : null;

    const bullseyeIds = new Set();
    if (techLeadingId) bullseyeIds.add(techLeadingId);
    if (capLeadingId) bullseyeIds.add(capLeadingId);
    for (const p of activePlayers) {
      if ((p.totalCapacity || 0) > 4500) bullseyeIds.add(p.id);
    }
    this._bullseyeIds = bullseyeIds;
  }

  getTargetScore(sourcePlanet, target) {
    const dx = target.x - sourcePlanet.x;
    const dy = target.y - sourcePlanet.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    const techBonus = 0.01 * Math.sqrt(this.aiPlayer.techScore || 0);
    const expBonus = 0.01 * Math.sqrt(this.aiPlayer.expScore || 0);
    const combinedBonus = techBonus + expBonus;
    
    // Higher bonus = lower distance penalty
    const distWeight = Math.max(0.01, 0.1 - (combinedBonus * 0.2));
    
    const techAttrBonus = Math.sqrt(this.aiPlayer.techScore || 0);
    const expAttrBonus = 0.5 * Math.sqrt(this.aiPlayer.expScore || 0);
    const safeDistance = (techAttrBonus + expAttrBonus) * 20;

    let targetShips = target.isCruiser ? (target.health || 10) : target.ships;
    let score = targetShips + (dist * distWeight);
    
    if (dist > safeDistance) {
      score += (dist - safeDistance) * 5; // Heavy penalty for exceeding safe range
    }

    if (target.owner && !target.owner.isAI) {
      score -= 15; // Slightly prefer human players
    }
    
    // Dominant leaders — cached once per AI update (was re-sorted on every score call)
    const bullseyeIds = this._bullseyeIds;
    if (bullseyeIds && target.owner && bullseyeIds.has(target.owner.id)) {
      score -= 200; // Strongly favor attacking the dominant leader(s)
    }
    
    if (target.homeworldOf === this.aiPlayer.id) {
      score -= 500; // Extremely high priority to retake own homeworld
    }

    // War preference: AI will prefer to attack players they are at war with, stronger preference for more duration
    if (target.owner && this.aiPlayer.atWarWith) {
      const expiry = this.aiPlayer.atWarWith[target.owner.id];
      const now = Date.now();
      if (expiry && expiry > now) {
        const remainingMin = (expiry - now) / 60000; // 0 to 10 minutes
        score -= 200 * remainingMin; // subtract up to 2000 points to strongly prioritize war targets!
      }
    }

    return score;
  }

  update(deltaTime) {
    this.lastActionTime += deltaTime;
    this.lastOverpopulatedTime += deltaTime;
    
    const aiPlanets = this.game.planets.filter(p => p.owner === this.aiPlayer);
    if (!this.aiPlayer.isAI || aiPlanets.length === 0) return;
    this._rebuildBullseyeCache();

    // Overpopulated planets (> 160 ships) 10% chance every 10 seconds
    if (this.lastOverpopulatedTime >= 10000) {
      this.lastOverpopulatedTime = 0;
      const overpopulated = aiPlanets.filter(p => {
        if (p.ships <= 160) return false;
        if (p.lastAiLaunchTime && Date.now() - p.lastAiLaunchTime < 5000) return false;
        const techBonus = Math.floor(Math.sqrt(this.aiPlayer.techScore || 0));
        const baseCost = 10 + (this.aiPlayer.planetCount || 0);
        const launchCost = Math.min(250, Math.max(0, baseCost - techBonus));
        const shipsAfterLaunch = Math.floor((p.ships - launchCost) / 2);
        return shipsAfterLaunch >= p.maxShips * 0.30;
      });
      for (const sourcePlanet of overpopulated) {
        if (Math.random() < 0.10) {
          const enemies = this.game.planets.filter(p => p.owner !== this.aiPlayer && p.owner !== null);
          const enemyCruisers = this.game.ships.filter(s => s.active && s.isCruiser && s.owner && s.owner !== this.aiPlayer);
          for (const ec of enemyCruisers) {
            const dx = ec.x - sourcePlanet.x;
            const dy = ec.y - sourcePlanet.y;
            if (dx * dx + dy * dy <= 400 * 400) {
              enemies.push(ec);
            }
          }
          if (enemies.length > 0) {
            enemies.sort((a, b) => this.getTargetScore(sourcePlanet, a) - this.getTargetScore(sourcePlanet, b));
            const aiTechBonus = Math.floor(Math.sqrt(this.aiPlayer.techScore || 0));
            const aiSpeedMod = aiTechBonus >= 7 ? 1.0 : 0.5;
            this.game.sendShips(sourcePlanet, enemies[0], false, aiSpeedMod);
            sourcePlanet.lastAiLaunchTime = Date.now();
          }
        }
      }
    }

    // Dynamic aggression: more planets = attack more often
    const planetCount = aiPlanets.length;
    
    // Base 2000ms, decreases by 200ms per planet, down to a minimum of 500ms
    this.actionInterval = Math.max(500, 2000 - (planetCount * 200));

    if (this.lastActionTime >= this.actionInterval) {
      this.lastActionTime = 0;
      this.performAction(aiPlanets);
    }
  }

  performAction(aiPlanets) {
    const sourceCandidates = aiPlanets.filter(p => {
      if (p.ships <= 12) return false;
      if (p.rampageEvent && p.maxShips >= 110 && p.ships < p.maxShips * 2) return false;
      if (aiPlanets.length < 4 && p.ships < p.maxShips * 0.75) return false;
      if (p.lastAiLaunchTime && Date.now() - p.lastAiLaunchTime < 5000) return false;
      return true;
    });
    if (sourceCandidates.length === 0) return;

    const reserveRatio = Math.max(0.35, 0.7 - (aiPlanets.length * 0.05));

    const validSources = sourceCandidates.filter(p => {
      const techBonus = Math.floor(Math.sqrt(this.aiPlayer.techScore || 0));
      const baseCost = 10 + (this.aiPlayer.planetCount || 0);
      const launchCost = Math.min(250, Math.max(0, baseCost - techBonus));
      const shipsAfterLaunch = Math.floor((p.ships - launchCost) / 2);
      
      // Always leave at least 30% of maxShips capacity
      if (shipsAfterLaunch < p.maxShips * 0.30) {
        return false;
      }

      if (shipsAfterLaunch < p.maxShips * reserveRatio) {
        let significantThreats = 0;
        for (const other of this.game.planets) {
          if (other.owner !== this.aiPlayer && other.owner !== null) {
            const dx = other.x - p.x;
            const dy = other.y - p.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 400 && other.ships > 15) {
              significantThreats++;
            }
          }
        }
        
        if (significantThreats > 0) {
          return Math.random() < 0.1; // Rarely launch
        }
      }
      
      if (p.rampageEvent && p.maxShips >= 110 && shipsAfterLaunch < p.maxShips) {
        return false;
      }
      
      return true;
    });

    if (validSources.length === 0) return;
    const sourcePlanet = validSources[Math.floor(Math.random() * validSources.length)];

    // Find targets (neutral or enemy planets)
    const targets = this.game.planets.filter(p => p.owner !== this.aiPlayer && !p.isDeepSpaceAnomaly);
    const enemyCruisers = this.game.ships.filter(s => s.active && s.isCruiser && s.owner && s.owner !== this.aiPlayer);
    for (const ec of enemyCruisers) {
      const dx = ec.x - sourcePlanet.x;
      const dy = ec.y - sourcePlanet.y;
      if (dx * dx + dy * dy <= 400 * 400) {
        targets.push(ec);
      }
    }
    if (targets.length === 0) return;

    targets.sort((a, b) => this.getTargetScore(sourcePlanet, a) - this.getTargetScore(sourcePlanet, b));
    
    // Pick from top 3 weakest targets to add some randomness
    const numTargets = Math.min(3, targets.length);
    const topTargets = targets.slice(0, numTargets);
    
    let targetPlanet;
    const homeworldTarget = topTargets.find(p => p.homeworldOf === this.aiPlayer.id);
    
    if (homeworldTarget) {
      if (Math.random() < 0.75) {
        targetPlanet = homeworldTarget;
      } else {
        const otherTargets = topTargets.filter(p => p !== homeworldTarget);
        if (otherTargets.length > 0) {
          targetPlanet = otherTargets[Math.floor(Math.random() * otherTargets.length)];
        } else {
          targetPlanet = homeworldTarget;
        }
      }
    } else {
      targetPlanet = topTargets[Math.floor(Math.random() * topTargets.length)];
    }

    // Added check to make sure launch is worth it
    const targetShips = targetPlanet.isCruiser ? (targetPlanet.health || 10) : targetPlanet.ships;
    if (sourcePlanet.ships > targetShips + 10) {
      const aiTechBonus = Math.floor(Math.sqrt(this.aiPlayer.techScore || 0));
      const aiSpeedMod = aiTechBonus >= 7 ? 1.0 : 0.5;
      this.game.sendShips(sourcePlanet, targetPlanet, false, aiSpeedMod);
      sourcePlanet.lastAiLaunchTime = Date.now();
    }
  }
}
