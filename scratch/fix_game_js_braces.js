import fs from 'fs';

let content = fs.readFileSync('src/game.js', 'utf8');

// Target pattern to fix closing braces
const targetPattern = /                  if \(ship\.count <= 0\) \{\r?\n\s*ship\.count = 0;\r?\n\s*ship\.active = false;\r?\n\s*\}\r?\n\s*\}\r?\n\s*\}\r?\n\s*\}\r?\n\s*\}\r?\n\s*\}\r?\n\s*\/\/ Minefield damage/;

const replacement = `                  if (ship.count <= 0) {
                  ship.count = 0;
                  ship.active = false;
                }
              }
            }
          }
        }
      }
    }

    // Minefield damage`;

// Let's use a simpler string replace if possible.
// We can locate:
const findStr = `                if (ship.count <= 0) {
                  ship.count = 0;
                  ship.active = false;
                }
              }
            }
          }
        }
    }`;

// Let's check if findStr is in the file (normalized newlines)
const normalizedContent = content.replace(/\r\n/g, '\n');
const normalizedFind = findStr.replace(/\r\n/g, '\n');

if (normalizedContent.includes(normalizedFind)) {
  const fixedNormalized = normalizedContent.replace(normalizedFind, `                if (ship.count <= 0) {
                  ship.count = 0;
                  ship.active = false;
                }
              }
            }
          }
        }
      }
    }`);
  fs.writeFileSync('src/game.js', fixedNormalized, 'utf8');
  console.log("Successfully fixed the braces in game.js!");
} else {
  console.error("Target string not found in game.js!");
}
