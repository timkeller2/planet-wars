// Test script to verify configuration cost calculation
const SHIP_CLASSES = {
  corvette: { name: 'Corvette', hp: 15, costShips: 50, costCap: 2 },
  destroyer: { name: 'Destroyer', hp: 25, costShips: 100, costCap: 4 },
  battlecruiser: { name: 'Battlecruiser', hp: 35, costShips: 175, costCap: 7 },
  titan: { name: 'Titan', hp: 45, costShips: 300, costCap: 12 },
  mammoth: { name: 'Mammoth', hp: 55, costShips: 500, costCap: 20 }
};

const serverState = {
  globalUpgradeModifiers: {
    armor: 0, // 0 means no global discount
    shield: 0
  }
};

const myPlayer = {
  upgradeModifiers: {
    armor: -0.15,
    shield: -0.15
  }
};

function getConfigurationUpgradeCost(classType, upgrades, myPlayer) {
  const baseCfg = SHIP_CLASSES[classType];
  if (!baseCfg) return 0;
  const hp = baseCfg.hp;

  const upgradeProps = [
    'sensorarrays', 'labs', 'armor', 'shields', 'engine', 
    'munitions', 'targeting', 'damagecontrol', 'fuel_tanker', 
    'diplomat', 'marines', 'command'
  ];
  let totalUpgradeCost = 0;
  const levels = {};
  let totalUpgradesCount = 0;
  for (const prop of upgradeProps) {
    levels[prop] = upgrades ? (upgrades[prop] || 0) : 0;
    totalUpgradesCount += levels[prop];
  }

  console.log('totalUpgradesCount calculated:', totalUpgradesCount);

  let simulatedTotalUpgrades = 0;
  const simulatedLevels = { ...levels };
  while (totalUpgradesCount > 0) {
    let foundProp = null;
    for (const prop of upgradeProps) {
      if (simulatedLevels[prop] > 0) {
        foundProp = prop;
        break;
      }
    }
    if (!foundProp) break;

    const prevSum = simulatedTotalUpgrades;
    const baseCost = Math.min(150, Math.round(25 + hp * (3 + prevSum / 3)));

    const typeKeyMap = {
      sensorarrays: 'sensorarray',
      labs: 'lab',
      armor: 'armor',
      shields: 'shield',
      engine: 'engine',
      munitions: 'munitions',
      targeting: 'targeting',
      damagecontrol: 'damagecontrol',
      fuel_tanker: 'fueltanker',
      diplomat: 'diplomat',
      marines: 'marines',
      command: 'command'
    };
    const normType = typeKeyMap[foundProp] || foundProp;
    const globalMod = (serverState.globalUpgradeModifiers && serverState.globalUpgradeModifiers[normType] !== undefined)
      ? Math.max(-0.35, serverState.globalUpgradeModifiers[normType])
      : -0.25;
    let playerMod = 0;
    if (myPlayer && myPlayer.upgradeModifiers && myPlayer.upgradeModifiers[normType] !== undefined) {
      playerMod = myPlayer.upgradeModifiers[normType];
    }
    const modifier = Math.max(-0.50, globalMod + playerMod);
    const finalCostVal = Math.max(1, Math.round(baseCost * (1 + modifier)));
    totalUpgradeCost += finalCostVal;

    simulatedLevels[foundProp]--;
    simulatedTotalUpgrades++;
    totalUpgradesCount--;
  }

  return totalUpgradeCost;
}

const upgrades1 = {
  armor: 2,
  shields: 1
};

console.log('Result for upgrades:', getConfigurationUpgradeCost('corvette', upgrades1, myPlayer));

const upgradesWithStrings = {
  armor: '2',
  shields: '1'
};

console.log('Result for string upgrades:', getConfigurationUpgradeCost('corvette', upgradesWithStrings, myPlayer));
