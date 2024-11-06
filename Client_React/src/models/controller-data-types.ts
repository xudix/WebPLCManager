export interface IControllerSymbol {
  name: string;
  type: string;
  comment: string;
  value?: any;
  newValueStr?: string; // new value to be written to Controller. Tied to input box of UI
  isPersistent?: boolean;
}

export interface IControllerType {
  name: string;
  baseType: string; // for array, enum, and alis, this gives the underlying data type. For other types, this is the the same as name.
  comment: string;
  size?: number; // size in bytes
  subItemCount: number;
  subItems: IControllerSymbol[];
  arrayDimension: number;
  arrayInfo: { length: number; startIndex: number }[];
  enumInfo: Record<string, any>; // For enumeration type, this object of name-value pair gives the possible values of the enum.

  isPersistent?: boolean; // This is only meaningful for subItems.
}

/**
 * data type info received from controller. {controllerName: {typename: typeObj}}. typename is lower case
 */
export type DataTypesInfo = Record<string, Record<string, IControllerType>>;

/**
 * symbol info received from controller. {controllerName: {symbolname: symbolObj}}. symbolname is lower case.
 */
export type SymbolsInfo = Record<string, Record<string, IControllerSymbol>>;
