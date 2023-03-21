/* gets config json file contents in a standardized way from a conf sub-folder
 * appends .json to the "name" to get that configuration
 */
'use strict';
const fs = require('fs');
const path = require('path');

//might not work in a library... ;D
let confDir = path.dirname(process.argv[1]) + "/config/";
let debug = false;
//console.debug("directory: " + confDir );

var config = {
    get: function (name) {
        try {
            let confData = fs.readFileSync(confDir + name + ".json");
            return JSON.parse(confData);
        } catch (err) {
            console.log(confDir + name + ".json is not a valid config JSON file");
            if (debug) console.log(err);
            throw (err);
        }
    }
}

module.exports = config;
