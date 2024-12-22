const { client, collectionName } = require('../config/firestore');
const model = require('../models/execution');

const collection = client.collection(collectionName);

function toData(doc) {
  const data = { id: doc.id, ...doc.data() };
  data.created = data.created.toDate();
  data.updated = data.updated.toDate();
  return data;
}

exports.findLatestByNameAndOwner = async (name, owner) => {

  const query = collection
      .where('name', '==', name)
      .where('owner', '==', owner);
  
  const snap = await query.get();
  if(snap.empty)
    return null;
  
  const docs = snap.docs.map(toData);
  docs.sort((a, b) => b.updated - a.updated);

  return docs[0];

}

exports.add = async (data) => {
  await model.add.validateAsync(data);
  const ref = await collection.add(data);
  return ref.id;
}
