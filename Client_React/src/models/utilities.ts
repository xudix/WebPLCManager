import { act, createContext, useContext, useReducer } from "react";
import { IControllerSymbol } from "./controller-data-types";
import { ILoggingConfig, ILoggingServerConfig, ILoggingTagConfig, LoggingServerConfig } from "./logging-config-type";

export const treeLevelContext = createContext<number>(0);


/**
*  A tree to represent the structure of the symbol tree
*  it includes information about filtering result
*/
export interface IModelTreeNode {
  name: string,  // full path of this symbol
  symbol: IControllerSymbol,
  baseType: string,  // baseType is used to determine whether it should be subscribed
  enumInfo?: Record<string, any>, // if this is a enum type, this object records the name-value pair for the enum
  subNodes: IModelTreeNode[],
  filterPassed: boolean, // flags if this node or its decendent passed the filter test
  isArrayRoot: boolean,  // if it's an array root, need to pass displayValue to subnodes
  requestExpand?: boolean  // expand nodes that passed filter test
}

export const ModelTreeContext = createContext<IModelTreeNode | IModelTreeNode[]>([]);
export function useModelTree() {
  return useContext(ModelTreeContext);
}



