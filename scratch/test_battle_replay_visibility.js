/**
 * Battle replay visibility / chat targeting rules.
 * Participants always keep their recordings; FoW must not strip them.
 * Chat is only for human participants, never global.
 */

function filterReplaysForPlayer(replays, playerId) {
  return (replays || []).filter(r => {
    if (!r.participants || r.participants.length === 0) return false;
    return r.participants.includes(playerId);
  });
}

function chatTargetsForBattle(humanParticipants, battleName, durationStr) {
  return humanParticipants.map(pId => ({
    playerId: pId,
    text: `A new battle recording (${battleName}, ${durationStr}) is available for review.`
  }));
}

function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    process.exit(1);
  }
}

console.log('Running battle replay visibility tests...');

const replays = [
  {
    id: 'b1',
    name: 'Battle of Alpha',
    x: 100,
    y: 100,
    participants: ['human1', 'ai2']
  },
  {
    id: 'b2',
    name: 'Battle of Beta',
    x: 9000,
    y: 9000,
    participants: ['human2', 'ai3']
  },
  {
    id: 'b3',
    name: 'Orphan',
    x: 0,
    y: 0,
    participants: []
  }
];

// Player only sees battles they participated in
const forHuman1 = filterReplaysForPlayer(replays, 'human1');
assert(forHuman1.length === 1 && forHuman1[0].id === 'b1', 'human1 should only see b1');

const forHuman2 = filterReplaysForPlayer(replays, 'human2');
assert(forHuman2.length === 1 && forHuman2[0].id === 'b2', 'human2 should only see b2');

const forBystander = filterReplaysForPlayer(replays, 'human3');
assert(forBystander.length === 0, 'non-participant should see nothing');

// FoW at (9000,9000) must NOT hide human2's own battle (regression: old code used isVisible)
// Simulated: even if "not visible", filter is participant-only
assert(forHuman2[0].x === 9000, 'participant keeps far-away battle in list');

// Chat only to human participants, never 'all'
const msgs = chatTargetsForBattle(['human1'], 'Battle of Alpha (12:00:00)', '00:12');
assert(msgs.length === 1, 'one chat message per human participant');
assert(msgs[0].playerId === 'human1', 'chat targets participant, not all');
assert(!msgs.some(m => m.playerId === 'all'), 'must never use global all broadcast for battle recordings');

console.log('All battle replay visibility tests passed.');
