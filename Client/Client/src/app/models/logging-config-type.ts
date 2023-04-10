export interface ILoggingConfig{
    /**
     * measurement name used in the database
     */
    measurement: string;
    /**
     * Controller name. This should correspond to the id of one of the Controller object in the server.
     */
    name: string;
    /**
     * Symbols to subscribe to
     */
    tags: {
        /**
         * field name used in the data base
         */
        field: string;
        /**
         * Full path and name of the symbol in the controller
         */
        tag: string;
        /**
         * Indicate the status of the symbol.
         * "success": this symbol is sucessfully subscribed to from the controller
         * "fail"   : subscription to this symbol from the controller failed
         * "new"    : this symbol is just added to the configuration by web application
         * "modified": this symbol is modified.
         * "remove" : this symbol is just removed by web application
         * whether this symbol is sucessfully subscribed to from the controller
         */
        status?:string;
        /**
         * Indicate whether this symbol should be logged in "On Change" mode, i.e. only log when value changes. If undefinded or false, it will be cyclic mode.
         */
        onChange?: boolean;
        /**
         * If disabled is true, the symbol will not be logged.
         */
        disabled?: boolean;
    }[]

}

export interface ILoggingServerConfig{
    logFileTime: number;
    logPath: string;
    logConfigs: ILoggingConfig[];
}

export class LoggingServerConfig implements ILoggingServerConfig{
    logFileTime: number;
    logPath: string;
    logConfigs: ILoggingConfig[];

    constructor(logFileTime: number, logPath: string){
        this.logFileTime = logFileTime;
        this.logPath = logPath;
        this.logConfigs = [];
    }

}

export class LoggingConfig implements ILoggingConfig{
    measurement: string;
    name: string;
    tags: {
        /**
         * field name used in the data base
         */
        field: string;
        /**
         * Full path and name of the symbol in the controller
         */
        tag: string;
        /**
         * Indicate whether this symbol is sucessfully subscribed to from the controller
         */
        status?: string;
        /**
         * Indicate whether this symbol should be logged in "On Change" mode, i.e. only log when value changes. If undefinded or false, it will be cyclic mode.
         */
        onChange?: boolean;
        /**
        * If disabled is true, the symbol will not be logged.
        */
        disabled?: boolean;
    }[];

    constructor(controllerName: string, measurement: string){
        this.measurement = measurement;
        this.name = controllerName;
        this.tags = [];
    }

}