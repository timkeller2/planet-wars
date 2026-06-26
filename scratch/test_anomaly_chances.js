import { Game } from '../src/game.js';
import assert from 'assert';

function testAnomalyDistribution() {
  console.log("Running Anomaly Reward Probability Distribution Test...");

  const iterations = 100000; // Increase count for higher precision
  const counts = {
    credits: 0,
    discount: 0,
    tech: 0,
    xp: 0,
    hab: 0,
    rare_resource_cache: 0,
    upgrade_token: 0
  };

  for (let i = 0; i < iterations; i++) {
    const rewardType = Game.getRandomAnomalyRewardType();
    if (counts[rewardType] !== undefined) {
      counts[rewardType]++;
    } else {
      console.error(`Unknown reward type generated: ${rewardType}`);
      process.exit(1);
    }
  }

  // Calculate percentages
  const pct = {};
  for (const key in counts) {
    pct[key] = (counts[key] / iterations) * 100;
  }

  console.log("Results (Percentages of 100,000 rolls):");
  for (const key in pct) {
    console.log(` - ${key}: ${pct[key].toFixed(2)}% (Count: ${counts[key]})`);
  }

  // Verify credits is around 64% (allow +/- 1.5% margin)
  assert.ok(Math.abs(pct.credits - 64) < 1.5, `Credits chance ${pct.credits.toFixed(2)}% is outside expected 64% range`);

  // Verify other options are around 6% (allow +/- 1.0% margin)
  const others = ['discount', 'tech', 'xp', 'hab', 'rare_resource_cache', 'upgrade_token'];
  for (const key of others) {
    assert.ok(Math.abs(pct[key] - 6) < 1.0, `${key} chance ${pct[key].toFixed(2)}% is outside expected 6% range`);
  }

  console.log("SUCCESS: All anomaly reward chances conform to the fallback weighted distribution!");
  process.exit(0);
}

testAnomalyDistribution();
