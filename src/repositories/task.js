const firestore = require('@google-cloud/firestore');

const Config = require('../config/firestore');
const Firestore = new firestore.Firestore({ projectId: Config.projectId });
const Collection = Firestore.collection(Config.collection);

const taskModel = require('../models/task');

function toData(doc) {
  const data = { id: doc.id, ...doc.data() };
  data.created = data.created.toDate();
  return data;
}

exports.get = async (workflowId, taskId) => {
  const doc = await Collection.doc(workflowId).collection('TASK').doc(taskId).get();
  return doc.exists ? toData(doc) : null;
}

exports.findOneByExecutionStepAndTask = async (workflowId, executionId, step, task) => {

  const query = Collection.doc(workflowId)
      .collection('TASK')
      .where('executionId', '==', executionId)
      .where('step', '==', step)
      .where('task', '==', task);
  
  const snap = await query.get();
  if(snap.empty)
    return null;
  
  const docs = snap.docs.map(toData);
  docs.sort((a, b) => b.created - a.created);

  return docs[0];

}

exports.add = async (workflowId, data) => {
  await taskModel.add.validateAsync(data);
  const ref = await Collection.doc(workflowId).collection('TASK').add(data);
  return ref.id;
}
