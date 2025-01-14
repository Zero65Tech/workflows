const { client, collectionName } = require('../config/firestore');
const model = require('../models/version');

const collection = client.collection(collectionName);

function toData(doc) {
  const data = { id: doc.id, ...doc.data() };
  data.created = data.created.toDate();
  data.updated = data.updated.toDate();
  return data;
}

exports.get = async (workflowId, versionId) => {
  const doc = await collection.doc(workflowId).collection('VERSION').doc(versionId).get();
  return doc.exists ? toData(doc) : null;
}

exports.getLatest = async (workflowId) => {

  const query = collection.doc(workflowId)
      .collection('VERSION')
      .orderBy("updated", "desc")
      .limit(1);

  const snap = await query.get();
  if(snap.empty)
    return null;

  return toData(snap.docs[0]);

}

exports.getLatestByChecksum = async (workflowId, checksum) => {

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

exports.create = async (workflowId, data) => {
  await model.add.validateAsync(data);
  const ref = await collection.doc(workflowId).collection('VERSION').add(data);
  return ref.id;
}

exports.update = async (workflowId, versionId, updates) => {
  await model.update.validateAsync(updates);
  await collection.doc(workflowId).collection('VERSION').doc(versionId).update(updates);
}
