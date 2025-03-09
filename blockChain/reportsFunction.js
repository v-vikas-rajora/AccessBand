const hive = require("@hiveio/hive-js");
require('dotenv').config();

const HIVE_ACCOUNT = process.env.HIVE_ACCOUNT;
const HIVE_KEY = process.env.HIVE_KEY;

async function getAllBlockchainEntryData() {
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
                return null;
            }
        }).filter(entry => entry);

        const entryList = parsedEntries.filter(entry => entry.type === 'entry_data');
        const exitList = parsedEntries.filter(entry => entry.type === 'exit_data');

        let finalData = [];
        let usedExits = new Set();

        entryList.forEach(entry => {
            let matchingExit = exitList.find(exit =>
                exit.reg_no === entry.reg_no &&    // ✅ REG_NO MUST MATCH
                new Date(exit.date_time_out) > new Date(entry.date_time_in) &&
                !usedExits.has(exit.date_time_out) // ✅ EXIT MUST NOT BE USED AGAIN
            );

            if (matchingExit) {
                usedExits.add(matchingExit.date_time_out);
            }

            finalData.push({
                reg_no: entry.reg_no,
                barcode: entry.barcode,
                date_time_in: entry.date_time_in,
                user_in: entry.user_in,
                date_time_out: matchingExit ? matchingExit.date_time_out : null,
                user_out: matchingExit ? matchingExit.user_out : null
            });
        });

        return finalData;
    } catch (error) {
        console.error('Error fetching blockchain data:', error);
        throw error;
    }
}


module.exports = getAllBlockchainEntryData;