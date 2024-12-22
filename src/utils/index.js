const crypto = require('crypto');
const stringify = require('json-stable-stringify');
const { GoogleAuth } = require('google-auth-library');

exports.generateChecksum = (jsonObj)  => {
  const jsonString = stringify(jsonObj);
  const hash = crypto.createHash('sha256').update(jsonString).digest('hex');
  return hash;
}

exports.doHttpGet = async (url, params) => {

  const auth = new GoogleAuth({
    scopes: 'https://www.googleapis.com/auth/cloud-platform',
  });

  const client = await auth.getIdTokenClient(url);

  return await client.request({ method: 'GET', url, params, validateStatus: () => true });

}
