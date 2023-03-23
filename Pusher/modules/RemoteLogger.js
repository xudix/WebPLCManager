
import { Socket } from "socket.io-client";
import * as FileSystem from "node:fs/promises";
import * as Path from "node:path";
import EventEmitter from "node:events";


export class RemoteLogger extends EventEmitter{


    /**
     * 
     * @param {Socket} socket 
     */
    constructor(socket, config){
        super();
        this.config = config;
        this._socket = socket;

        this.log = {
            info : (...args) => {
                let msg = "";
                args.forEach(arg => msg += arg.toString() + "\n");
                this.emit("log", "info", msg);
            },
            warn : (...args) => {
                let msg = "";
                args.forEach(arg => msg += arg.toString() + "\n");
                this.emit("log", "warn", msg);
            },
            error : (...args) => {
                let msg = "";
                args.forEach(arg => msg += arg.toString() + "\n");
                this.emit("log", "error", msg);
            }
        }

        // event handlers from socket
        this._socket.on("lpData", (lpStr) => {
            this.lastDataTime = new Date();
            this._writeToFile(lpStr);
        });
        
        this._clearOldTempFiles();
    }

    /**
     * Close the current logging file and rename it. The next write operation will be on a new file.
     * @returns {Promise<string>} New file name is returned if resolved.
     */
    switchFile(){
        clearTimeout(this._fileTimer);
        return new Promise((resolve, reject) => {
            if(this._fileHandle == null){
                resolve("");
                return;
            }
            if(this._fileAvailable){
                this._fileAvailable = false;
                this._fileHandle.close()
                    .then(() => {
                        let newFileName = this.tempFilePath.replace(".temp", `_${this.config.bucket}.new.lp`);
                        FileSystem.rename(this.tempFilePath, newFileName)
                            .then(() => {
                                resolve(newFileName);
                            })
                            .catch(err => {
                                this.log.error(`Failed to rename temp file ${this.tempFilePath}.`, err);
                                reject(err);
                            })
                            .finally(() => {
                                this._fileHandle = null;
                            })
                    })
                    .catch(err => {
                        this.log.error(`Failed to close temp file ${this.tempFilePath}.`, err);
                        reject(err);
                    });
            }
            else{   // if file is not available, try again in 5 seconds
                setTimeout(() => {
                    this.switchFile()
                        .then((newFileName) => resolve(newFileName))
                        .catch(err => reject(err));
                }, 5000);
            }
        });
    }

    deleteDataFile(fileName){
        return FileSystem.unlink(Path.join(this.config.logPath, fileName));
    }

    /**
     * Write data to a temp file. If the temp file doesn't exist, create it.
     * @param {string} lpStr String to be written to the file.
     */
    async _writeToFile(lpStr){
        if (this._buffer === undefined){this._buffer = Buffer.alloc(lpStr.length*10);}
        this._bufferLength += this._buffer.write(lpStr, this._bufferLength, "binary");
        if(this._fileHandle === null){
            this._fileAvailable = false;
            this._fileHandle = {};  // to prevent another file creation operation before this one is done.
            this.tempFilePath = Path.join(this.config.logPath, "r" + Date.now() + ".temp") // name this slightly different from the PLC, so that if copying from PLC, won't cause name conflict.
            await FileSystem.open(this.tempFilePath, "a+")
            .then(async fileHandle => {
                this._fileHandle = fileHandle;
                this._fileLength = 0;
                await this._writeData()
                this._fileTimer = setTimeout(() => {
                    this.switchFile();
                }, this.config.logFileTime);
            })
            .catch(err => {
                this._fileHandle = null;
                this.log.error("Failed to create temp file", err);
            })
        }
        else if (this._fileAvailable){
            this._writeData();
        }
    }

    /**
     * 
     * @param {string} lpStr String to be written to the file
     */
    async _writeData(){
        this._fileAvailable = false;
        await this._fileHandle.write(this._buffer,0, this._bufferLength)
            .then((res) => {
                this._bufferLength = 0;
                //console.log(`${res.bytesWritten} written`);
            })
            .catch((err) => {
                this.log.error("Failed to write to file.", err);
            })
            .finally(() => {
                this._fileAvailable = true;
            });
    }

    /**
    * Look in the data folder, and convert all existing .temp files to .lp file.
    */
    async _clearOldTempFiles() {
        await FileSystem.readdir(this.config.logPath)
            .then(async (files) => {
                for (let fileName of files) {
                    if (fileName.endsWith(".temp")) {
                        let oldName = Path.join(this.config.logPath, fileName);
                        await FileSystem.rename(oldName, oldName.replace(".temp", ".new.lp"));
                    }
                }
            })
    }


    // private variables
    
    /**
     * @type {FileSystem.FileHandle}
     */
    _fileHandle = null;

    _fileAvailable = false;

    _fileTimer;

    /**
     * @type {Buffer}
     */
    _buffer;

    _bufferLength = 0;
}