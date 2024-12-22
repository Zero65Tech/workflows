const { client, collectionName } = require('../config/firestore');
const model = require('../models/version');

const collection = client.collection(collectionName);

function toData(doc) {
  const data = { id: doc.id, ...doc.data() };
  data.created = data.created.toDate();
  data.updated = data.updated.toDate();
  return data;
}

exports.findLatestByChecksum = async (workflowId, checksum) => {

  const query = collection.doc(workflowId)
      .collection('VERSION')
      .where('checksum', '==', checksum);

  const snap = await query.get();
  if(snap.empty)
    return null;

  const docs = snap.docs.map(toData);
  docs.sort((a, b) => b.created - a.created);

  return docs[0];

}

exports.add = async (workflowId, data) => {
  await model.add.validateAsync(data);
  const ref = await collection.doc(workflowId).collection('VERSION').add(data);
  return ref.id;
}
