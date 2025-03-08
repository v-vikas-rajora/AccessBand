const hive = require("@hiveio/hive-js");

const HIVE_ACCOUNT = "vikasrajora";
const HIVE_KEY = "5Jh1ocbybk3nmNWhvy9YD3LHNeSeufgJu3PxkdGmPhW6LuUJ8vf";

async function getBlockchainBarcode(reg_no) {
    try {
        const result = await hive.api.callAsync('condenser_api.get_account_history', [
            HIVE_ACCOUNT,
            -1,
            1000 // 1000 transactions tak fetch karega
        ]);

        const customJsonOps = result
            .map(tx => tx[1].op)
            .filter(op => op[0] === 'custom_json');

        const parsedEntries = customJsonOps.map(op => {
            try {
                return JSON.parse(op[1].json);
            } catch (e) {
                console.error("❌ Error parsing JSON:", e);
                return null;
            }
        }).filter(entry => entry);

        // ✅ **Sirf barcode_data ko filter karega**
        const filteredData = parsedEntries.find(entry =>
            entry.type === 'barcode_data' && entry.barcode === reg_no
        );

        if (filteredData) {
            console.log("✅ Blockchain Barcode Found:", filteredData);
            return filteredData;
        } else {
            console.log("❌ No Barcode Found on Blockchain for:", reg_no);
            return null;
        }

    } catch (error) {
        console.error("❌ Error fetching Barcode from Blockchain:", error);
        return null;
    }
}

module.exports = getBlockchainBarcode;