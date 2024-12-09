const firestore = require('@google-cloud/firestore');

const Config = require('../config/firestore');
const Firestore = new firestore.Firestore({ projectId: Config.projectId });
const Collection = Firestore.collection(Config.collection);

const executionModel = require('../models/execution');

function toData(doc) {
  const data = { id: doc.id, ...doc.data() };
  data.created = data.created.toDate();
  return data;
}

exports.get = async (workflowId, executionId) => {
  const doc = await Collection.doc(workflowId).collection('EXECUTION').doc(executionId).get();
  return doc.exists ? toData(doc) : null;
}

exports.add = async (workflowId, data) => {
  await executionModel.add.validateAsync(data);
  const ref = await Collection.doc(workflowId).collection('EXECUTION').add(data);
  return ref.id;
}
