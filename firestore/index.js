const workflowRepo = require("../src/repositories/workflow");
const versionRepo = require("../src/repositories/version");
const { generateChecksum } = require("../src/utils");

const owner = 'zero65';
const workflows = [
  'market-eq'
];

(async () => {

  for(const name of workflows) {

    const workflow = await workflowRepo.getByNameAndOwner(name, owner);
    const workflowId = workflow
        ? workflow.id
        : await workflowRepo.add({ name, owner, created: new Date(), updated: new Date() });

    const steps = JSON.stringify(require(`./${name}.json`));
    const checksum = generateChecksum(steps);

    const version = await versionRepo.getByChecksum(workflowId, checksum);
    if(version)
      continue;

    const versionId = await versionRepo.add(workflowId, { steps, checksum, created: new Date(), updated: new Date() });
    console.log(`Added version ${versionId} for workflow ${name}`);

  }

})();