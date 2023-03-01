export interface ControllerSymbol{
    name: string;
    type: string;
    comment: string;
    value?: any;
    newValueStr?: string;   // new value to be written to Controller. Tied to input box of UI
    isPersisted?: boolean;
}

export interface ControllerType{
    name: string;
    baseType: string; // for array, enum, and alis, this gives the underlying data type. For other types, this is the the same as name.
    comment: string;
    size?: number; // size in bytes
    subItemCount: number;
    subItems: ControllerSymbol[];
    arrayDimension: number;
    arrayInfo: {length: number, startIndex: number}[];
    enumInfo: Record<string, any>; // For enumeration type, this object of name-value pair gives the possible values of the enum.
    
    isPersisted?: boolean;   // This is only meaningful for subItems. 
}