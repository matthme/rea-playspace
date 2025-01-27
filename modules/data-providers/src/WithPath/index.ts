import { Flavor, BuildFactory, getParentPath, GetPath, Constructor } from "typed-object-tweezers";
import { cloneDeep } from "lodash";

/**
 * Make a pathed version of the data, but allow structural type coercion to T.
 */
export interface WithPath {
  path?: string;
}
export type Pathed<T> = T & WithPath;

/**
 * Convert an object of T to a Pathed<T>.
 */
export function PathFunctor<T> (d: T, path: WithPath["path"]): Pathed<T> {
  const pathedT: T & WithPath = cloneDeep(d);
  pathedT.path = path;
  return pathedT;
}

/**
 * Definition of an object collection.
 * Uses Flavor to ensure structurally distinctiveness.
 */
export type TreeDefinition = Flavor<Record<string, TreeEntry>, "TreeDefinition">;

/**
 * TreeEntry describes the 'hierarchy' of objects and relationships.
 * Uses Flavor to ensure structurally distinctiveness.
 */
export type TreeEntry = Flavor<{
  singleton?: boolean;
  primaryKey?: string;
  parentKey?: string;
  substituteWith?: {};
  children?: TreeDefinition;
}, "TreeEntry">;

/**
 * Stores the object values needed to create the path from the current object.
 * Uses Flavor to ensure structurally distinctiveness.
 */
export type ObjectValues = Flavor<{
  singleton?: boolean;
  primaryKey?: string;
  keyValue?: string;
  parentKey?: string;
  parentKeyValue?: string;
}, "ObjectValues">;

/**
 * Intermediate tuple storing data about how to map between the given path and the TreeDefinition.
 * If element values is undefined, the corresponding TreeEntry is a singleton.
 */
export type PathData = Flavor<{ kind: string, values: ObjectValues }, "TreeData">;

export type PathWalkerCallback = (treeDefinition: TreeDefinition, currentTreeDatas: Array<PathData>) => void;

/**
 * Merge data from parameter B into A (merge arrays if present, but don't erase data).
 */
export function mergeObjectDefinitionTrees (A: TreeDefinition, B: TreeDefinition): TreeDefinition {
  const C: TreeDefinition = A ? cloneDeep(A) : {};
  for (let key in B) {
    if (key in C) {

      // These are just values that can be copied, but on a key by key basis to allow preserving type inference
      ('singleton' in B[key]) && (C[key].singleton = B[key].singleton);
      ('primaryKey' in B[key]) && (C[key].primaryKey = B[key].primaryKey);
      ('parentKey' in B[key]) && (C[key].parentKey = B[key].parentKey);
      ('substituteWith' in B[key]) && (C[key].substituteWith = B[key].substituteWith);

      // if children, merge recursively
      if ('children' in C[key]) {
        A[key].children = mergeObjectDefinitionTrees(C[key].children, B[key].children);
      } else {
        A[key].children = cloneDeep(B[key].children);
      }
    } else {
      C[key] = cloneDeep(B[key]);
    }
  }
  return A;
}

/**
 * Walk through the treeDefinition along the path specified calling the walker
 * function and return the treeDatas.
 */
export function walkTreeDefinition (treeDefinition: TreeDefinition, path: string, walker: PathWalkerCallback = undefined): Array<PathData>{
  const pathDatas = new Array<PathData>();
  const pathParts = path.split('.');
  const pathLength = pathParts.length;

  // set the initial value
  let currentTreeDef: TreeDefinition = treeDefinition;
  // currentObjectDef will always be an entry in the currentTreeDef
  let currentObjectDef: TreeEntry;
  // start from the beginning
  let offset = 0;

  do {
    // look at two path parts at a time
    const [kind, keyValue] = pathParts.slice(offset, offset + 2);

    if (kind in currentTreeDef) {
      currentObjectDef = currentTreeDef[kind];
      // push the tree data and increment by the number of parts looked at
      if ('singleton' in currentObjectDef && currentObjectDef.singleton) {
        pathDatas.push({ kind, values: { singleton: true } });
        offset++;
      } else {
        // the last element of the treeDatas has the parent data values
        const parentData = pathDatas[pathDatas.length - 1].values;
        const entryData = {
          singleton: false,
          parentKey: currentObjectDef.parentKey,
          // check for parent key value
          parentKeyValue: currentObjectDef.parentKey ? parentData.keyValue : undefined,
          // set primary key value
          primaryKey: currentObjectDef.primaryKey,
          keyValue
        };
        pathDatas.push({ kind, values: entryData });
        offset += 2;
      }

      // call the walker callback if we have it
      if (walker instanceof Function) {
        walker(treeDefinition, pathDatas);
      }

      // if we have children, go ahead and set that as the next object to traverse
      if ('children' in currentObjectDef) {
        currentTreeDef = currentObjectDef.children;
      }

    // otherwise, throw an error
    } else {
      throw new Error(`Path not valid for TreeDefinition: ${path}`);
    }
  } while (offset < pathLength);

  return pathDatas;
}

/**
 * Given a list of definitions, a path, and some data, create a Pathed<T> that's
 * compatible with T.
 */
export function buildModel<S, T> (treeDefinition: TreeDefinition, modelKinds: Record<string, Constructor>, path: string, data: S): Pathed<T> | Pathed<{}> {
  const pathDatas = walkTreeDefinition(treeDefinition, path);
  // fetch the last element of the tree datas and get the kind
  const modelData: PathData = pathDatas[pathDatas.length - 1];
  const modelKind = modelData.kind;
  if (modelData.values.singleton || modelData.values.keyValue) {
    const Factory = BuildFactory(modelKinds[modelKind]);
    return PathFunctor(Factory(data), path);
  } else {
    return {} as Pathed<{}>;
  }
}
/**
 * Constructs the current path of the tree.
 * @param tree 
 * @param data 
 * @param name 
 * @param path 
 * @param treeDefinition 
 * @param modelKinds 
 */
export function constructTreeAtPath(tree: {}, data: {}, name: string, path: string, treeDefinition: TreeDefinition, modelKinds: Record<string, Constructor>) {
  const parentPath = getParentPath(path);

  // Get the path datas for validation
  const pathDatas = walkTreeDefinition(treeDefinition, path);
  const currentData = pathDatas[pathDatas.length - 1];
  const parentData =  pathDatas[pathDatas.length - 2];

  /**
   * We can also decode the data payload and check to make sure the keys in the
   * data match up with the path itself. If it doesn't match, throw an error.
   */
  if (currentData && currentData.values) {
    const expectedKeyValue = data[currentData.values.primaryKey];
    const pathKeyValue = currentData.values.keyValue
    if ( pathKeyValue !== expectedKeyValue) {
      console.warn(`Primary key in data, ${expectedKeyValue}, does not match value from path, ${pathKeyValue}: ${path}.`);
      console.warn(tree);
    }
  }
  if (parentData && parentData.values && parentData.values.parentKeyValue) {
    const expectedParentKeyValue = data[currentData.values.parentKey];
    const pathParentKeyValue = parentData.values.keyValue;
    if ( pathParentKeyValue!== expectedParentKeyValue) {
      console.warn(`Parent key in data, ${expectedParentKeyValue}, does not match value from path, ${pathParentKeyValue}: ${path}.`);
    }
  }

  const instatiation = buildModel(treeDefinition, modelKinds, path, data);

  if (parentPath) {
    const parent = GetPath(tree, parentPath);
    parent[name] = instatiation;
  } else {
    tree[name] = instatiation;
  }
}
