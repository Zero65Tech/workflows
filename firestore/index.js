const workflowService = require("../src/services/workflow");
const versionService = require("../src/services/version");
const { generateChecksum } = require("../src/utils");

const owner = 'zero65';
const workflows = [
  'market-mf',
  'market-eq',
  'market-fo',
];

(async () => {

  for(const name of workflows) {

    const workflow = await workflowService.getByNameAndOwner(name, owner);
    const workflowId = workflow
      ? workflow.id
      : await workflowService.add({ name, owner });

    const { params, steps } = require(`./${name}.json`);
    const checksum = generateChecksum({ params, steps });

    const version = await versionService.getByChecksum(workflowId, checksum);
    if(version)
      continue;

    const versionId = await versionService.add(workflowId, {
      params: JSON.stringify(params),
      steps: JSON.stringify(steps),
      checksum
    });
    
    console.log(`Added version ${versionId} for workflow ${name}`);

  }

})();