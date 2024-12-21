const firestore = require('@google-cloud/firestore');

const projectId = process.env.STAGE === 'prod' || process.env.STAGE === 'gamma'
    ? 'zero65-workflows'
    : 'zero65-test'; // beta & alpha

const client = new firestore.Firestore({ projectId: Config.projectId });
const collectionName = 'WORKFLOW';
    
module.exports = { client, collectionName };
