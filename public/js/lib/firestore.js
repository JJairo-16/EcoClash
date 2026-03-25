import { db } from "../config.js";
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  updateDoc,
  setDoc,
  startAt,
  endAt
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

function getCollection(collectionName) {
  return collection(db, collectionName);
}

async function add(collectionRef, data) {
  try {
    return await addDoc(collectionRef, data);
  } catch (error) {
    throw new Error(`Error al añadir el elemento: ${error.message}`);
  }
}

async function deleteById(collectionName, id) {
  try {
    await deleteDoc(doc(db, collectionName, id));
  } catch (error) {
    throw new Error(`Error al eliminar el elemento con ID ${id}: ${error.message}`);
  }
}

async function selectAll(collectionName, orderByField = null) {
  try {
    const colRef = collection(db, collectionName);
    const q = orderByField ? query(colRef, orderBy(orderByField)) : colRef;
    const querySnapshot = await getDocs(q);

    const docs = [];
    querySnapshot.forEach((item) => {
      docs.push({
        id: item.id,
        ...item.data()
      });
    });

    return docs;
  } catch (error) {
    throw new Error(`Error recuperando todos los elementos: ${error.message}`);
  }
}

async function selectById(collectionName, id) {
  try {
    const snap = await getDoc(doc(db, collectionName, id));
    if (!snap.exists()) return null;

    return {
      id: snap.id,
      ...snap.data()
    };
  } catch (error) {
    throw new Error(`Error al recuperar el elemento con ID ${id}: ${error.message}`);
  }
}

async function selectWhere(collectionName, field, operator, value) {
  try {
    const colRef = collection(db, collectionName);
    const q = query(colRef, where(field, operator, value));
    const querySnapshot = await getDocs(q);

    const docs = [];
    querySnapshot.forEach((item) => {
      docs.push({
        id: item.id,
        ...item.data()
      });
    });

    return docs;
  } catch (error) {
    throw new Error(`Error recuperando elementos donde ${field} ${operator} ${value}: ${error.message}`);
  }
}

async function selectLike(collectionName, field, value) {
  try {
    const colRef = collection(db, collectionName);
    const q = query(
      colRef,
      orderBy(field),
      startAt(value),
      endAt(value + "\uf8ff")
    );

    const querySnapshot = await getDocs(q);

    const docs = [];
    querySnapshot.forEach((item) => {
      docs.push({
        id: item.id,
        ...item.data()
      });
    });

    return docs;
  } catch (error) {
    throw new Error(`Error recuperando elementos similares a ${value}: ${error.message}`);
  }
}

async function updateById(collectionName, id, data) {
  try {
    await updateDoc(doc(db, collectionName, id), data);
  } catch (error) {
    throw new Error(`Error al actualizar el elemento con ID ${id}: ${error.message}`);
  }
}

async function setById(collectionName, id, data, merge = false) {
  try {
    await setDoc(doc(db, collectionName, id), data, { merge });
  } catch (error) {
    throw new Error(`Error al guardar el elemento con ID ${id}: ${error.message}`);
  }
}

export {
  getCollection,
  add,
  deleteById,
  selectAll,
  selectById,
  selectLike,
  selectWhere,
  updateById,
  setById
};

export { db } from "../config.js";