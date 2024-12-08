const crypto = require('crypto');
const stringify = require('json-stable-stringify');

exports.generateChecksum = (jsonStr)  => {
  const jsonObj = JSON.parse(jsonStr);
  const jsonString = stringify(jsonObj);
  const hash = crypto.createHash('sha256').update(jsonString).digest('hex');
  return hash;
}
