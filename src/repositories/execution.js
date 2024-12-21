const { client, collectionName } = require('../config/firestore');
const model = require('../models/execution');

const collection = client.collection(collectionName);

function toData(doc) {
  const data = { id: doc.id, ...doc.data() };
  data.created = data.created.toDate();
  data.updated = data.updated.toDate();
  return data;
}

exports.get = async (workflowId, executionId) => {
  const doc = await collection.doc(workflowId).collection('EXECUTION').doc(executionId).get();
  return doc.exists ? toData(doc) : null;
}

exports.add = async (workflowId, data) => {
  await model.add.validateAsync(data);
  const ref = await collection.doc(workflowId).collection('EXECUTION').add(data);
  return ref.id;
}
