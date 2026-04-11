import 'dotenv/config';
import { createQuestProposal, getDb } from './server/db';

async function run() {
  const userId = 1; // use an existing user ID from the DB
  const proposalId = await createQuestProposal({
    title: 'Debug Test Quest',
    description: 'This is a debug test proposal for reproduction.',
    xpReward: 100,
    difficulty: 'easy',
    proposedBy: userId,
    status: 'pending',
    duration: '1h',
    requirementType: 'individual',
    requiredMediaCount: 1,
  });
  console.log('Inserted proposalId', proposalId);
}

run().catch((err) => {
  console.error('ERROR', err);
  process.exit(1);
});
