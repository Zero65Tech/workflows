const crypto = require('crypto');
const stringify = require('json-stable-stringify');

exports.generateChecksum = (jsonObj)  => {
  const jsonString = stringify(jsonObj);
  const hash = crypto.createHash('sha256').update(jsonString).digest('hex');
  return hash;
}
