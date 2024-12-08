const workflowService = require("../src/services/workflow");
const versionService = require("../src/services/version");
const { generateChecksum } = require("../src/utils");

const owner = 'zero65';
const workflows = [
  'market-eq'
];

(async () => {

  for(const name of workflows) {

    const workflow = await workflowService.getByNameAndOwner(name, owner);
    const workflowId = workflow
        ? workflow.id
        : await workflowService.add({ name, owner });

    const steps = JSON.stringify(require(`./${name}.json`));
    const checksum = generateChecksum(steps);

    const version = await versionService.getByChecksum(workflowId, checksum);
    if(version)
      continue;

    const versionId = await versionService.add(workflowId, { steps, checksum });
    console.log(`Added version ${versionId} for workflow ${name}`);

  }

})();