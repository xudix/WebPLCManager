#!/usr/bin/env node --openssl-legacy-provider
//might need NODE_OPTIONS=--openssl-legacy-provider
//compatibilty with the samba versions on the PLC.  Not required for node < 18

const smb2 = require('@marsaud/smb2');
const fs = require('fs').promises;
const fsync = require('fs');
const EventLogger = require('node-windows').EventLogger;


const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const path = require('path');

const conf = require('./config').get("pusher_BenchScale");

const fileCount = 5;
const dataDir = path.dirname(process.argv[1]) + "/data/";
const tempFile = dataDir + ".temp_";
const api = '/api/v2/write?precision=ms&bucket=';
const loggerURL = 'http://172.16.20.100:2333';

//TODO:  use an escapify call to make the share look 'normal'
conf.source = {
    share: '\\\\172.16.20.100\\data',
    domain: 'WORKGROUP',
    path: '',
    autoCloseTimeout: 0,    //make this zero?!
    ...conf.source
}

var allInfluxKeys = "";

const smbClient = new smb2(conf.source);
const log = new EventLogger("Data Pusher")


let keepRunning = true;

//FIXME:  Make sure the data directory exists...
async function run(){
    var influxKeys = [];
    for (let key in conf.influx) {
        influxKeys.push(key);
        allInfluxKeys = allInfluxKeys + "." + key;
    }
    log.info("Pusher started.")
    setInterval(() => {
        fetch(loggerURL+"/api/log-status").then(res => {
            res.json().then((result) => {
                //console.log(result);
                fetch(loggerURL+"/api/log-file").then( res => {
                    if(res.status == 200){
                        
                    }
                    
                });
            });
        }).catch(err => {
            //console.error(`Failed to connect to logger ${loggerURL}. `, err);
            log.error(`Failed to connect to logger ${loggerURL}. `)
        });
        listRemoteFiles(fileCount)
            .then(async (files) => {
                //console.log(`got files: ${JSON.stringify(files)}`);
            //     let fileProms = [];
            //     if (files.length > 0) {
            //         files.forEach((filename) => {
            //             fileProms.push(copyFileFromRemote(filename));
            //         });
            //         console.log(`Promised to copy ${files.length} files`)
            //         return Promise.all(fileProms);
            //     }
            //     return fileProms;
            // })
            // .then((filenames) => {
                if (files.length > 0){
                    for(let fileName of files){
                        await copyFileFromRemote(fileName);
                    }
                    smbClient.disconnect();
                }
                //console.log(`got ${JSON.stringify(localFileNames)}`);
                fs.readdir(dataDir).then( async (localFileNames) => {
                    if (localFileNames.length > 0) {
                        for(let filename of localFileNames){
                            if(filename.endsWith(".lp")){
                                let currentFile = dataDir + filename;
                                for (let key in conf.influx) {
                                    //console.log(conf.influx[key]);
                                    currentFile = await writeFileToInflux(currentFile, key);
                                }
                            }
                        }
                    }
                });
            })
            .catch(err => {
                log.error(err.toString());
                console.error("outside catch\n" + err);
                return smbClient.disconnect();
            });
    }, 10*1000); // scan every 10s


    
}

//gets the file ID for (at most) count lp files on the remote system, returns an array of file names
async function listRemoteFiles(count){
    return smbReaddirAsync(conf.source.path)
    .then(files => {
        let found = [];
        //TODO: this iterator could be improved to stop looking when reached count
        files.forEach(async (fileName, index) => {
            if (fileName.endsWith('.lp') && (found.length < count)){
                //console.log(fileName);
                found.push(fileName);
            }
        });
        return found;
    })
}

//copies the file with dirPath from the remote to the local file system and inserts all the influx targets into the name
async function copyFileFromRemote(dirPath){
    return new Promise(async (resolve, reject) => {
        let readStream = await smbClient.createReadStream(dirPath);
        let writeStream = fsync.createWriteStream(tempFile + dirPath);
        let done = false;
        // Listen for the 'end' event on the read stream to know when there is no more data to read
        readStream.on('end', () => {
            
        // Listen for the 'finish' event on the write stream to know when all data has been written
            writeStream.on('finish', () => {
                done = true;
                resolve(true);
            });
        });
        
        readStream.pipe(writeStream);

        // Handle errors
        readStream.on('error', (err) => {
            if (!done){
                log.error(`readStream error ${dirPath}`);
                // console.log(`readStream error ${dirPath}`);
                reject(err);
            }
        });
        writeStream.on('error', (err) => {
            if (!done){
                log.error(`writeSteam error ${dirPath}`);
                // console.log(`writeSteam error ${dirPath}`);
                reject(err);
            }
        });
    })
    .then((success) => {
        if (success) {
            let proms = [];
            fetch(loggerURL+"/api/log-file/"+dirPath, {
                method: "DELETE"
            }).catch((err) => log.error(`Failed to delete ${dirPath} from server.`, err));
            const newName = dataDir + dirPath.replace(/.lp$/, allInfluxKeys + ".lp");
            proms.push(fs.rename(tempFile + dirPath, newName));
            proms.push(new Promise(resolve => setTimeout(resolve, 1000)));
            return Promise.all(proms).then(() => {
                return newName;
            });
        }
        else {
            log.error("smb transfer failed or incomplete")
            //console.log("smb transfer failed or incomplete");
            smbClient.disconnect();
            return null;
        }
    })
    .catch((err) => {
        log.error(`error in smb2 ${dirPath}\n${err}`);
        // console.log(`error in smb2 ${dirPath}\n${err}`);
    });
}


//cound just be done with promisify?
function smbReaddirAsync(dirPath){
  //return new Promise(async (resolve, reject) => {   //why async?
  return new Promise((resolve, reject) => {
    try {
      //await fs.access(dirPath);
      smbClient.readdir(dirPath, (err, files) => {
        if (err) {
          reject(err);
        } else {
          resolve(files);
        }
      });
    } catch (err) {
      reject(err);
      smbClient.close();
    }
  });
};

//pushes a file to the specified influx
//upon success it removes the influx id from the filename, and if there are no more 
//influx tasks left the file is deleted
async function writeFileToInflux(fileName, influxID){
    // console.log(`writing ${path.basename(fileName)} to ${influxID}`);
    const readable = fsync.createReadStream(fileName);
    const options = {
        method: 'POST',
        body: readable,
        headers : {
            //'Content-Type': 'text/plain; charset=utf-8',
            'Content-Type': 'application/octet-stream',
            'Accept': 'application/json',
            'Authorization': 'Token ' + conf.influx[influxID].token
        }
    }

    //console.log(`writing to ${conf.influx[influxID].URL}${api}${conf.influx[influxID].bucket}&org=${conf.influx[influxID].org}`);
    return fetch(`${conf.influx[influxID].URL}${api}${conf.influx[influxID].bucket}&org=${conf.influx[influxID].org}`, options)
    .then(async response => {
        //FIXME:  really the only reason not to remove my task is if the server didn't respond or got interrupted?
        let delFile = false;
        if (response.ok) {
            // console.log('uploaded successfully!');
            delFile = true;
        }
        else {
            text = await response.text();
            //console.log(text);
            if (text.code === "invalid"){
                log.warn("bad data in the file, marking it as complete anyway");
                log.warn(text.message);
                delFile = true;
            }
            else {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
        }
        if (delFile){
            return stripFromFileName(fileName, influxID);
        }
        else {
            return Promise.resolve(fileName);
        }
    })
    .catch((error) => {
        log.error(`Error uploading file: ${error}`);
        return fileName;
    });

}

//renames a file with a task removed from name
function stripFromFileName(filename, toStrip){
    const newName = filename.replace(`.${toStrip}.`, '.');
    //console.log(`${path.basename(filename)} --> ${path.basename(newName)}`);
    let test = newName.split('.');
    if (test.length == 2){
        return fs.unlink(filename)
        .then((result) => {
            return "";
        });
    }
    else {
        return fs.rename(filename, newName)
        .then((result) => {
            // console.log(`done!  deleting ${path.basename(filename)}`);
            return newName;
        });
    }
}

function getBucketFromFilename(filename){
//FIXME:  for testing use the test bucket
//    return "test";
    return filename.split('_')[1].split('.')[0];
}

//ultimately this should loop forever, or until some file appears to tell it to stop?
run();

