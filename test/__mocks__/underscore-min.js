// Mock underscore for tests
export default {
  each: (collection, iteratee) => {
    if (Array.isArray(collection)) {
      collection.forEach(iteratee);
    } else {
      Object.keys(collection).forEach((key) => iteratee(collection[key], key));
    }
  },
  map: (collection, iteratee) => {
    return Array.isArray(collection)
      ? collection.map(iteratee)
      : Object.keys(collection).map((key) => iteratee(collection[key], key));
  },
  min: (collection, iteratee) => {
    if (!collection || collection.length === 0) return undefined;

    if (typeof iteratee === "function") {
      return collection.reduce((min, item) => {
        const minVal = iteratee(min);
        const itemVal = iteratee(item);
        return itemVal < minVal ? item : min;
      });
    }

    return collection.reduce((min, item) => (item < min ? item : min));
  },
  iteratee: (key) => {
    if (typeof key === "string") {
      return (obj) => obj[key];
    }
    return key;
  },
};
