const firestore = require('@google-cloud/firestore');

const Config = require('../config/firestore');
const Firestore = new firestore.Firestore({ projectId: Config.projectId });
const Collection = Firestore.collection(Config.collection);

const versionModel = require('../models/version');

function toData(doc) {
  const data = { id: doc.id, ...doc.data() };
  data.created = data.created.toDate();
  return data;
}

exports.getByChecksum = async (workflowId, checksum) => {

  const query = Collection.doc(workflowId)
      .collection('versions')
      .where('checksum', '==', checksum);
  
  const snap = await query.get();
  if(snap.empty)
    return null;
  
  const docs = snap.docs.map(toData);
  docs.sort((a, b) => b.created - a.created);

  return docs[0];

}

exports.add = async (workflowId, data) => {
  await versionModel.add.validateAsync(data);
  const ref = await Collection.doc(workflowId).collection('versions').add(data);
  return ref.id;
}
