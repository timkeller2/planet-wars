import fs from 'fs';
import path from 'path';

const mainJsPath = path.resolve('src/main.js');
const mainJsContent = fs.readFileSync(mainJsPath, 'utf8');

let errors = [];

// Check 1: hoveredWreckage variable declaration
if (!mainJsContent.includes('let hoveredWreckage = null;')) {
  errors.push('hoveredWreckage is not declared.');
}

// Check 2: hoveredWreckage assignment in handlePointerMove
if (!mainJsContent.includes('hoveredWreckage = null;') || !mainJsContent.includes('wdx * wdx + wdy * wdy < 50 * 50')) {
  errors.push('Wreckage hover detection logic not found in handlePointerMove.');
}

// Check 3: hoveredWreckage checking in tooltip hover check
if (!mainJsContent.includes("newType = 'wreckage';")) {
  errors.push("Wreckage type setting not found in tooltip hover check.");
}

// Check 4: updateInfoPanelContent includes wreckage type rendering
if (!mainJsContent.includes("type === 'wreckage'") || !mainJsContent.includes('WRECKAGE SALVAGE SITE')) {
  errors.push('Wreckage info panel rendering logic not found.');
}

// Check 5: Space debris image path set
if (!mainJsContent.includes("url('/Art/spacedebris.png')")) {
  errors.push('Space debris image is not set in updateInfoPanelContent.');
}

// Check 6: Check isMouseOverActiveEntity contains wreckage check
if (!mainJsContent.includes("activeInfoPanel.type === 'wreckage'")) {
  errors.push('isMouseOverActiveEntity does not check wreckage type.');
}

if (errors.length > 0) {
  console.error('Validation FAILED:');
  errors.forEach(e => console.error(`- ${e}`));
  process.exit(1);
} else {
  console.log('Validation PASSED: All required wreckage tooltip logic exists in main.js.');
}
