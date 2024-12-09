const firestore = require('@google-cloud/firestore');

const Config = require('../config/firestore');
const Firestore = new firestore.Firestore({ projectId: Config.projectId });
const Collection = Firestore.collection(Config.collection);

const workflowModel = require('../models/workflow');

function toData(doc) {
  const data = { id: doc.id, ...doc.data() };
  data.created = data.created.toDate();
  return data;
}

exports.findOneByNameAndOwner = async (name, owner) => { // Needed for back-filling data from GitHub repository

  const query = Collection
      .where('name', '==', name)
      .where('owner', '==', owner);
  
  const snap = await query.get();
  if(snap.empty)
    return null;
  
  const docs = snap.docs.map(toData);
  docs.sort((a, b) => b.created - a.created);

  return docs[0];

}

exports.add = async (data) => {
  await workflowModel.add.validateAsync(data);
  const ref = await Collection.add(data);
  return ref.id;
}
