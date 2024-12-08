
const config = {
  development: {
    projectId: 'zero65-test',
    collection: 'WORKFLOW'
  },
  production: {
    projectId: 'zero65-workflows',
    collection: 'WORKFLOW'
  }
}

module.exports = process.env.STAGE === 'prod' || process.env.STAGE === 'gamma'
  ? config.production
  : config.development; // beta & alpha
