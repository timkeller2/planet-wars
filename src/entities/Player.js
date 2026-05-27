export class Player {
  constructor(id, color, isAI) {
    this.id = id;
    this.color = color;
    this.isAI = isAI;
    this.techScore = 0;
    this.expScore = 0;
    this.expProgress = 0;
    this.cruiserStyle = null;
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
