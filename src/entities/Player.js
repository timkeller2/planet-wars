export class Player {
  constructor(id, color, isAI) {
    this.id = id;
    this.color = color;
    this.isAI = isAI;
    const aiNames = ['Zorgon', 'Centauri', 'Nova', 'Hyperion', 'Vortex', 'Nebula', 'Quasar', 'Pulsar', 'Andromeda', 'Orion', 'Sirius', 'Vega', 'Draco', 'Lyra', 'Cygnus'];
    if (this.isAI) {
      this.name = aiNames[Math.floor(Math.random() * aiNames.length)];
    } else {
      this.name = 'Player ' + id;
    }
    this.techScore = 0;
    this.expScore = 0;
    this.expProgress = 0;
    this.cruiserStyle = null;
  }

  addExperience(kills) {
    this.expProgress += kills;
    while (this.expProgress >= 20) {
      this.expProgress -= 20;
      this.expScore++;
    }
  }
}
