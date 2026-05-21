export class InputHandler {
  constructor(canvas, game) {
    this.canvas = canvas;
    this.game = game;
    this.selectedPlanet = null;

    this.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
    window.addEventListener('keydown', this.handleKeyDown.bind(this));
  }

  handleKeyDown(event) {
    if (event.code === 'Pause') {
      event.preventDefault(); // Prevent scrolling
      if (this.game.isRunning) {
        this.game.isPaused = !this.game.isPaused;
      }
    }
  }

  handleMouseDown(event) {
    if (event.button !== 0) return; // Only process left clicks

    const rect = this.canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const clickedPlanet = this.getPlanetAt(x, y);

    if (clickedPlanet) {
      if (this.selectedPlanet) {
        if (clickedPlanet !== this.selectedPlanet) {
          // Send ships
          this.game.sendShips(this.selectedPlanet, clickedPlanet);
        }
        this.selectedPlanet = null;
        this.game.clearSelection();
      } else if (clickedPlanet.owner === this.game.humanPlayer) {
        this.selectedPlanet = clickedPlanet;
        this.game.setSelection(clickedPlanet);
      }
    } else {
      this.selectedPlanet = null;
      this.game.clearSelection();
    }
  }

  getPlanetAt(x, y) {
    for (const planet of this.game.planets) {
      const dx = planet.x - x;
      const dy = planet.y - y;
      if (Math.sqrt(dx * dx + dy * dy) <= planet.radius) {
        return planet;
      }
    }
    return null;
  }
}
