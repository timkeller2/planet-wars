// Test script to verify the music track selection algorithm

let playedIntroTracks = [];

function getNextTrack() {
  const introTracks = [
    'A little loud, but pretty good.mp3',
    'Deep Space Ambience.wav',
    'Intense option.mp3',
    'Pretty and Steady.mp3',
    'Solid option.mp3'
  ];

  let availableTracks = introTracks.filter(track => !playedIntroTracks.includes(track));
  if (availableTracks.length === 0) {
    playedIntroTracks = [];
    availableTracks = [...introTracks];
  }

  const randomTrack = availableTracks[Math.floor(Math.random() * availableTracks.length)];
  playedIntroTracks.push(randomTrack);
  return randomTrack;
}

function assert(condition, message) {
  if (!condition) {
    throw new Error('ASSERTION FAILED: ' + message);
  }
}

console.log("Running music track selection tests...");

// Test 1: Verify first 5 plays are all unique
const firstFive = [];
for (let i = 0; i < 5; i++) {
  const track = getNextTrack();
  assert(!firstFive.includes(track), `Track ${track} should be unique in the first cycle`);
  firstFive.push(track);
}
console.log("Pass: First 5 tracks are all unique:", firstFive);

// Test 2: Verify the 6th play resets the cycle and plays one of the intro tracks
const sixth = getNextTrack();
console.log("Pass: 6th track is:", sixth);
assert(firstFive.includes(sixth), "6th track must be one of the original 5");

// Test 3: Verify subsequent 4 plays are unique and exclude the 6th track
const secondCycle = [sixth];
for (let i = 0; i < 4; i++) {
  const track = getNextTrack();
  assert(!secondCycle.includes(track), `Track ${track} should be unique in the second cycle`);
  secondCycle.push(track);
}
console.log("Pass: Second cycle of 5 tracks are all unique:", secondCycle);

console.log("All music track selection tests passed successfully!");
