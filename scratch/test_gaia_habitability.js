import { Planet, getHabName } from '../src/entities/Planet.js';
import { Player } from '../src/entities/Player.js';

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

console.log("=== Testing Planet Habitability and Size Class Roll updates ===");

const owner = new Player('p1', '#0ff', false);

// 1. Verify getHabName ranges (Terran 100 - 140, Gaia > 140)
{
  const pToxic = new Planet(1, 100, 100, 10, null, 10);
  pToxic.habitability = 19;
  assert(getHabName(pToxic.habitability) === 'Toxic', "19 should be Toxic");

  const pArid = new Planet(2, 100, 100, 10, null, 10);
  pArid.habitability = 99;
  assert(getHabName(pArid.habitability) === 'Arid', "99 should be Arid");

  const pTerranMin = new Planet(3, 100, 100, 10, null, 10);
  pTerranMin.habitability = 100;
  assert(getHabName(pTerranMin.habitability) === 'Terran', "100 should be Terran");

  const pTerranMax = new Planet(4, 100, 100, 10, null, 10);
  pTerranMax.habitability = 140;
  assert(getHabName(pTerranMax.habitability) === 'Terran', "140 should be Terran");

  const pGaiaMin = new Planet(5, 100, 100, 10, null, 10);
  pGaiaMin.habitability = 141;
  assert(getHabName(pGaiaMin.habitability) === 'Gaia', "141 should be Gaia");

  console.log("-> Test 1 Passed: Habitability ranges correct (Terran 100-140, Gaia 141+)");
}

// 2. Verify Size Class is evenly random (60 to 150) and Habitability is random (10 to 150)
{
  const sizes = [];
  const habs = [];
  for (let i = 0; i < 500; i++) {
    const p = new Planet(i, 100, 100, 10, null, 10);
    assert(p.sizeClass >= 60 && p.sizeClass <= 150, `sizeClass ${p.sizeClass} out of bounds (60-150)`);
    assert(p.habitability >= 10 && p.habitability <= 150, `habitability ${p.habitability} out of bounds (10-150)`);
    sizes.push(p.sizeClass);
    habs.push(p.habitability);
  }

  // Check that sizeClass has decent coverage (not just concentrated in the middle)
  const avgSize = sizes.reduce((a, b) => a + b, 0) / sizes.length;
  // Uniform distribution average of 60-150 is 105.
  assert(Math.abs(avgSize - 105) < 5, `Expected average size around 105, got ${avgSize}`);

  // Check that habitability is weighted toward the bottom
  const avgHab = habs.reduce((a, b) => a + b, 0) / habs.length;
  // Weighted toward bottom average will be much lower than the midpoint (80)
  assert(avgHab < 70, `Expected average habitability to be weighted toward bottom (< 70), got ${avgHab}`);

  console.log(`-> Test 2 Passed: Randomizations correct. Avg Size: ${avgSize.toFixed(1)}, Avg Hab: ${avgHab.toFixed(1)}`);
}

// 3. Verify Gaia world production bonus and stacking
{
  const testProduction = (habitability, isHomeworld, homeworldOwnerId = 'p1') => {
    const p = new Planet(10, 100, 100, 25, owner, 10);
    p.habitability = habitability;
    if (isHomeworld) {
      p.homeworldOf = homeworldOwnerId;
    }
    
    // Call update with 1000ms
    p.update(1000, null, {});
    return p.productionProgress;
  };

  // Base rate (Non-Gaia, Non-Homeworld)
  const baseProd = testProduction(100, false);

  // Gaia rate (should be double base)
  const gaiaProd = testProduction(150, false);
  assert(Math.abs(gaiaProd - baseProd * 2) < 1e-5, `Gaia production ${gaiaProd} should be double base ${baseProd}`);

  // Homeworld rate (should be double base)
  const hwProd = testProduction(100, true);
  assert(Math.abs(hwProd - baseProd * 2) < 1e-5, `Homeworld production ${hwProd} should be double base ${baseProd}`);

  // Gaia + Homeworld rate (should be 4x base)
  const gaiaHwProd = testProduction(150, true);
  assert(Math.abs(gaiaHwProd - baseProd * 4) < 1e-5, `Gaia+Homeworld production ${gaiaHwProd} should be 4x base ${baseProd}`);

  console.log("-> Test 3 Passed: Gaia production bonus stacks with homeworld");
}

console.log("\nAll planet updates tests PASSED!");
