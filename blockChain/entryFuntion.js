const hive = require("@hiveio/hive-js");
require('dotenv').config();


const HIVE_ACCOUNT = process.env.HIVE_ACCOUNT;
const HIVE_KEY = process.env.HIVE_KEY;

async function getBlockchainData(reg_no) {
    console.log(reg_no);
    try {
        const result = await hive.api.callAsync('condenser_api.get_account_history', [
            HIVE_ACCOUNT,
            -1,
            1000
        ]);

        const customJsonOps = result
            .map(tx => tx[1].op)
            .filter(op => op[0] === 'custom_json');


        const parsedEntries = customJsonOps.map(op => {
            try {
                return JSON.parse(op[1].json);
            } catch (e) {
                console.error("Error parsing JSON:", e, op[1].json);
                return null;
            }
        }).filter(entry => entry);

        const entryList = parsedEntries.filter(entry => entry.type === 'entry_data' && entry.reg_no === reg_no);
        const exitList = parsedEntries.filter(entry => entry.type === 'exit_data' && entry.reg_no === reg_no);

        let finalData = [];
        let usedExits = new Set();  // Already used exits ko track karne ke liye

        entryList.forEach(entry => {
            let matchingExit = exitList.find(exit => 
                new Date(exit.date_time_out) > new Date(entry.date_time_in) && 
                !usedExits.has(exit.date_time_out) // Jo exit already use ho chuka hai, usko dobara na lo
            );

            if (matchingExit) {
                usedExits.add(matchingExit.date_time_out); // Exit use ho gaya, track kar lo
            }

            finalData.push({
                reg_no: entry.reg_no,
                date_time_in: entry.date_time_in,
                user_in: entry.user_in,
                date_time_out: matchingExit ? matchingExit.date_time_out : null,
                user_out: matchingExit ? matchingExit.user_out : null
            });
        });

        console.log("Final Matched Data:", finalData);

        return finalData.length > 0 ? finalData : null;
    } catch (error) {
        console.error("Error fetching blockchain data:", error);
        return null;
    }
}

async function storeBlockchainData(type, reg_no, data) {
    try {
        const jsonData = {
            type,
            reg_no,
            ...data,
        };

        const result = await new Promise((resolve, reject) => {
            hive.broadcast.customJson(
                HIVE_KEY,
                [], // Required Auths
                [HIVE_ACCOUNT], // Required Posting Auths
                "hive_gate_event",
                JSON.stringify(jsonData),
                (err, result) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(result);
                    }
                }
            );
        });

        //console.log("Stored on Hive:", result);
        return result;
    } catch (error) {
        console.error("Error storing data on Hive:", error);
        return null;
    }
}

module.exports = { getBlockchainData, storeBlockchainData };
