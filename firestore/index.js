const { generateChecksum } = require("../src/utils");

const workflows = [
    'market-eq'
];

(() => {

    for(const name of workflows) {
        const steps = require(`./${name}.json`);
        const checksum = generateChecksum(steps);
        console.log(`Checksum for ${name} is ${checksum}`);
    }

})()