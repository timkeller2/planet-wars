export class Player {
  constructor(id, color, isAI) {
    this.id = id;
    this.color = color;
    this.isAI = isAI;
    this.techScore = 0;
    this.expScore = 0;
    this.expProgress = 0;
    this.cruiserStyle = null;
    this.upgradeModifiers = {
      sensorarray: 0,
      lab: 0,
      armor: 0,
      shield: 0,
      engine: 0,
      munitions: 0,
      targeting: 0,
      damagecontrol: 0,
      fueltanker: 0,
      diplomat: 0,
      marines: 0
    };
    this.prevTechBonus = 0;
    if (this.isAI) {
      this.name = id;
    } else {
      this.name = id === 'p1' ? 'Player 1' : 'Player ' + id;
    }
  }

  addExperience(kills) {
    this.expProgress += kills;
    while (this.expProgress >= 20) {
      this.expProgress -= 20;
      this.expScore++;
    }
  }
}
