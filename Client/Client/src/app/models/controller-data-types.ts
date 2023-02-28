export interface ControllerSymbol{
    name: string;
    type: string;
    comment: string;
    value?: any;
    newValue?: any;   // new value to be written to Controller
    isPersisted?: boolean;
}

export interface ControllerType{
    name: string;
    comment: string;
    size?: number; // size in bytes
    subItemCount: number;
    subItems: ControllerSymbol[];
    arrayDimension: number;
    arrayInfo: {length: number, startIndex: number}[];
    isPersisted?: boolean;   // This is only meaningful for subItems. 
}