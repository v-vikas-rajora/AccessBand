const { express, mysql, session, bcrypt, flash } = require('../MySQL/include');
const router = express.Router(); 

const hive = require("@hiveio/hive-js");
const getBlockchainBarcode = require("../blockChain/barcodeFuntion");
const HIVE_ACCOUNT = "vikasrajora"; // Your Hive account name
const HIVE_KEY = "5Jh1ocbybk3nmNWhvy9YD3LHNeSeufgJu3PxkdGmPhW6LuUJ8vf"; // Your private posting key (keep it secure)


router.use(express.json());
router.use(express.urlencoded({ extended: true }));
router.use(flash());

const dbPassword = require('../MySQL/config');
const connection = mysql.createConnection({
    host: "localhost",
    user: "root",
    database: "event_0225",
    password: dbPassword,
});

router.use("/", (req, res, next) => {
    connection.query('SELECT current_session_id FROM users WHERE username = ?', [req.session.user.username], (err, result) => {
        if (err) {
            console.error(err);
        } else {
            req.session.user.current_session_id = result[0].current_session_id;
            if (req.sessionID !== req.session.user.current_session_id) {
                res.redirect("/");
                return
            } else {
                next();
            }
        }
    });
});

router.get("/action/reg_no", (req, res) => {
    res.render('master.ejs', {form_type: 'action', errorMessage: ''});
});

router.get("/issue/reg_no", (req, res) => {
    res.render('master.ejs', {form_type: 'issue', errorMessage: ''});
});

router.get("/action", async (req, res) => {
    const reg_no = req.query.reg_no;
    let barcode_type;

    if (reg_no.startsWith('PU') || reg_no.startsWith('PGC')) {
        let barcodeData = await getBlockchainBarcode(reg_no);

        if (barcodeData) {
            barcode_type = barcodeData.barcode_type;
            console.log("✅ Barcode Type from Blockchain:", barcode_type);

            let q = `SELECT * FROM ${barcode_type} WHERE barcode = '${reg_no}'`;
            aa(q);
        } else {
            return res.render('master.ejs', { form_type: 'action', barcode_type: '', errorMessage: 'Invalid barcode' });
        }

    }

    else if (reg_no.includes("/") && reg_no.length > 5) {
        let q = `SELECT * FROM student_data WHERE reg_no = '${reg_no}'`;
        barcode_type = 'student_data';
        aa(q);
    }

    else if (!reg_no.includes("/") && reg_no.length === 4) {
        let q = `SELECT * FROM faculty_data WHERE reg_no = '${reg_no}'`;
        barcode_type = 'faculty_data';
        aa(q);
    }

    else if (!reg_no.includes("/") && reg_no.length > 10) {
        function isValidDate(dateStr) {
            const day = parseInt(dateStr.slice(0, 2), 10);
            const month = parseInt(dateStr.slice(2, 4), 10);
            const year = parseInt(dateStr.slice(4, 8), 10);

            const date = new Date(year, month - 1, day);
            return date.getDate() === day && date.getMonth() === month - 1 && date.getFullYear() === year;
        }

        function checkId(id) {
            const first8 = id.slice(0, 8);
            const last8 = id.slice(-8);

            if (isValidDate(first8)) {
                return id.slice(-4);
            } else if (isValidDate(last8)) {
                return id.slice(0, 4);
            }
        }

        let newReg = checkId(reg_no);

        let q = `SELECT * FROM faculty_data WHERE reg_no = '${newReg}'`;
        barcode_type = 'faculty_data';
        aa(q);
    }
    else if (reg_no.includes('-') && !reg_no.includes("/") && reg_no.length < 8) {
        let q = `SELECT g.*, f.name AS eName, f.email AS eEmail
            FROM guest_data g JOIN faculty_data f 
            ON g.emp_id = f.reg_no WHERE g.reg_no = '${reg_no}';`;

        barcode_type = 'guest_data';
        aa(q);
    }
    else {
        return res.render('master.ejs', { form_type: 'action', barcode_type: '', errorMessage: 'Invalid barcode' });
    }

    function aa(q) {
        connection.query(q, (err, results) => {
            if (err) {
                console.error('Error fetching data from DB:', err);
                return res.send('Error retrieving data');
            } else {
                if (!results[0]) {
                    return res.render('master.ejs', { form_type: 'action', barcode_type, errorMessage: 'Invalid barcode' });
                }

                res.render('bandAction', { bandData: results[0], barcode_type });
            }
        });
    }
});

router.get("/issue", (req, res) => {
    let reg_no = req.query.reg_no;
    let barcode_type;
    let errorMessage;

    if (reg_no.startsWith('FAC')) {
        reg_no = reg_no.slice(4)

        function isValidDate(dateStr) {
            const day = parseInt(dateStr.slice(0, 2), 10);
            const month = parseInt(dateStr.slice(2, 4), 10);
            const year = parseInt(dateStr.slice(4, 8), 10);
        
            const date = new Date(year, month - 1, day);         
            return date.getDate() === day && date.getMonth() === month - 1 && date.getFullYear() === year;
        }
        
        function checkId(id) {
            const first8 = id.slice(0, 8);
            const last8 = id.slice(-8);
        
            if (isValidDate(first8)) {
                return id.slice(-4);
            } else if (isValidDate(last8)) {
                return id.slice(0, 4);
            }
        }

        if (reg_no.length > 10) {
            reg_no = checkId(reg_no);
        }

        barcode_type = 'faculty_data';
        errorMessage = "Invalid employee I'd"
    
    } else if (reg_no.startsWith('GUEST')) {
        reg_no = reg_no.split('/')[1];
        barcode_type = 'guest_data';
        errorMessage = "Invalid guest I'd"

    } else {
        barcode_type = 'student_data';
        errorMessage = "Invalid registration number."
    }

    if (barcode_type === 'guest_data') {
        q = `SELECT g.*, f.name AS eName, f.email AS eEmail
            FROM guest_data g JOIN faculty_data f 
            ON g.emp_id = f.reg_no WHERE g.reg_no = ?;`;
            
    } else {
        q = `SELECT * FROM ${barcode_type} WHERE reg_no = ?`;
    }

    connection.query(q, [reg_no], (err, results) => {
        if (err) {
            console.error('Error fetching data from DB:', err);
            return res.send('Error retrieving data');
        } else {

            if (!results[0]) {
                // Send an error message to the frontend if no data is found
                return res.render('master.ejs', {form_type: 'issue', errorMessage: errorMessage});
            }

            q = `SELECT * FROM m_activity_data WHERE `
            res.render('bandIssue', { bandData: results[0], barcode_type });
        }
    });
});

router.post('/issue', async (req, res) => {
    let { regNo, barcodeNo } = req.body;
    let barcode_type;
    let username = req.session.user.username;

    if (regNo.startsWith('FAC')) {
        regNo = regNo.slice(4);
        barcode_type = 'faculty_data';
    } else if (regNo.startsWith('GUEST')) {
        regNo = regNo.split('/')[1];
        barcode_type = 'guest_data';
    } else {
        barcode_type = 'student_data';
    }

    if (barcodeNo.length !== 7) {
        return res.status(400).json({
            success: false,
            message: 'Invalid Barcode.'
        });
    }

    // ✅ **Step 1: Check if Barcode Already Exists on Blockchain**
    try {
        const existingBarcode = await getBlockchainBarcodeIssue(barcodeNo);

        if (existingBarcode) {
            return res.status(400).json({
                success: false,
                message: 'This barcode is already assigned.'
            });
        }

        // ✅ **Step 2: Store Barcode Data on Blockchain**
        const json_data = {
            type: 'barcode_data',
            barcode: barcodeNo,
            barcode_type: barcode_type,
            user: username
        };

        hive.broadcast.customJson(
            HIVE_KEY,
            [],
            [HIVE_ACCOUNT],
            'barcode_data',
            JSON.stringify(json_data),
            async (err, result) => {
                if (err) {
                    console.error('Blockchain Error:', err);
                    return res.status(500).json({
                        success: false,
                        message: 'Failed to store barcode on blockchain.'
                    });
                }

                console.log(`✅ Barcode ${barcodeNo} registered successfully on Blockchain`);

                // ✅ **MySQL pe band issue ka record insert karo**
                const query = `UPDATE ${barcode_type} SET barcode = ? WHERE reg_no = ?`;
                connection.query(query, [barcodeNo, regNo], (err, result) => {
                    if (err) {
                        console.error('Database Error:', err);
                        return res.status(500).json({
                            success: false,
                            message: 'Failed to update barcode in database.'
                        });
                    }

                    res.json({
                        success: true,
                        message: 'Barcode updated and stored on blockchain successfully!'
                    });
                });
            }
        );
    } catch (error) {
        console.error("Error:", error);
        res.status(500).json({
            success: false,
            message: 'Something went wrong. Try again later.'
        });
    }
});


async function getBlockchainBarcodeIssue(barcodeNo) {
    try {
        const result = await hive.api.callAsync('condenser_api.get_account_history', [
            HIVE_ACCOUNT,
            -1,
            1000
        ]);

        const barcodeRecords = result
            .map(tx => tx[1].op)
            .filter(op => op[0] === 'custom_json')
            .map(op => {
                try {
                    return JSON.parse(op[1].json);
                } catch (e) {
                    return null;
                }
            })
            .filter(data => data !== null && data.type === 'barcode_data');

        // ✅ Check if Barcode Already Exists
        const existing = barcodeRecords.find(item => item.barcode === barcodeNo);

        if (existing) {
            console.log(`⚠️ Barcode ${barcodeNo} already exists on Blockchain`);
            return true;
        }

        return false;
    } catch (error) {
        console.error("Error fetching Blockchain data:", error);
        return false;
    }
}


router.put('/action/disable/:reg_no', (req, res) => {
    const { reg_no } = req.params;
    let { remark } = req.body;
    remark = 'Disable: ' + remark;

    let barcode_type = 'student_data';

    if (reg_no.length === 4) {
        barcode_type = 'faculty_data';
    }

    if (reg_no.includes('-')) {
        barcode_type = 'guest_data';
    }

    const user = req.session.user.username;
    const post = req.session.user.post;
    
    let now = new Date();
    let offset = now.getTimezoneOffset() * 60000; // Offset in milliseconds
    let localDateTime = new Date(now.getTime() - offset);
    let currentDateTime = localDateTime.toISOString().replace('T', ' ').substring(0, 19).replace(/-/g, '-');

    let q = `UPDATE ${barcode_type} SET status = ? WHERE reg_no = ?`;

    connection.execute(q, ['N', reg_no], (error, results) => {
        if (error) {
            console.error('Error disabling student:', error);
            return res.status(500).json({ success: false, message: 'Internal Server Error' });
        }

        if (results.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Student not found' });
        }

        // Update m_activity field in student_data table
        let updateActivityQuery = `UPDATE ${barcode_type} SET m_activity = m_activity + 1 WHERE reg_no = ?`;

        connection.execute(updateActivityQuery, [reg_no], (updateActivityError, updateActivityResults) => {
            if (updateActivityError) {
                console.error('Error updating activity count:', updateActivityError);
                return res.status(500).json({ success: false, message: 'Error updating activity count' });
            }

            // Push data to Hive Blockchain instead of MySQL
            const data = {
                reg_no: reg_no,
                date_time: currentDateTime,
                user: user,
                post: post,
                remark: remark
            };

            hive.broadcast.customJson(
                HIVE_KEY, // Your private posting key
                [], // Required Posting Auth (Empty if posting on your behalf)
                [HIVE_ACCOUNT], // Your Hive username
                'm_activity_data', // Custom JSON ID
                JSON.stringify(data),
                (err, result) => {
                    if (err) {
                        console.error('Error pushing to blockchain:', err);
                        return res.status(500).json({ success: false, message: 'Error pushing to blockchain' });
                    }

                    res.json({ success: true, message: 'Band disabled successfully and activity recorded on blockchain' });
                }
            );
        });
    });
});


router.put('/action/enable/:reg_no', (req, res) => {
    const { reg_no } = req.params;
    let { remark } = req.body;
    remark = 'Enable: ' + remark;
    
    let barcode_type = 'student_data';

    if (reg_no.length === 4) {
        barcode_type = 'faculty_data';
    }

    if (reg_no.includes('-')) {
        barcode_type = 'guest_data';
    }

    const user = req.session.user.username;
    const post = req.session.user.post;
    
    let now = new Date();
    let offset = now.getTimezoneOffset() * 60000; // Offset in milliseconds
    let localDateTime = new Date(now.getTime() - offset);
    let currentDateTime = localDateTime.toISOString().replace('T', ' ').substring(0, 19).replace(/-/g, '-');

    let q = `UPDATE ${barcode_type} SET status = ? WHERE reg_no = ?`;

    connection.execute(q, ['Y', reg_no], (error, results) => {
        if (error) {
            console.error('Error enabling student:', error);
            return res.status(500).json({ success: false, message: 'Internal Server Error' });
        }

        if (results.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Student not found' });
        }

        // Update m_activity field in student_data table
        let updateActivityQuery = `UPDATE ${barcode_type} SET m_activity = m_activity + 1 WHERE reg_no = ?`;

        connection.execute(updateActivityQuery, [reg_no], (updateActivityError, updateActivityResults) => {
            if (updateActivityError) {
                console.error('Error updating activity count:', updateActivityError);
                return res.status(500).json({ success: false, message: 'Error updating activity count' });
            }

            // Push data to Hive Blockchain instead of MySQL
            const data = {
                reg_no: reg_no,
                date_time: currentDateTime,
                user: user,
                post: post,
                remark: remark
            };

            hive.broadcast.customJson(
                HIVE_KEY, // Your private posting key
                [], // Required Posting Auth (Empty if posting on your behalf)
                [HIVE_ACCOUNT], // Your Hive username
                'm_activity_data', // Custom JSON ID
                JSON.stringify(data),
                (err, result) => {
                    if (err) {
                        console.error('Error pushing to blockchain:', err);
                        return res.status(500).json({ success: false, message: 'Error pushing to blockchain' });
                    }

                    res.json({ success: true, message: 'Band enabled successfully and activity recorded on blockchain' });
                }
            );
        });
    });
});


router.put('/action/revoke/:reg_no', (req, res) => {
    let { reg_no } = req.params;
    let { remark } = req.body;

    let barcode_type = 'student_data';

    if (reg_no.length === 4) {
        barcode_type = 'faculty_data';
    }

    if (reg_no.includes('-')) {
        barcode_type = 'guest_data';
    }

    let barcodeNo;
    const user = req.session.user.username;
    const post = req.session.user.post;
    
    let now = new Date();
    let offset = now.getTimezoneOffset() * 60000; // Offset in milliseconds
    let localDateTime = new Date(now.getTime() - offset);
    let currentDateTime = localDateTime.toISOString().replace('T', ' ').substring(0, 19).replace(/-/g, '-');

    let q = `UPDATE ${barcode_type} SET barcode = ? WHERE barcode = ?`;
    let updateActivityCountQuery = `UPDATE ${barcode_type} SET m_activity = m_activity + 1 WHERE reg_no = ?`;
    let query = `SELECT barcode FROM ${barcode_type} WHERE reg_no=?`;

    connection.query(query, [reg_no], (err, result) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ success: false, message: 'Failed to fetch barcode number.' });
        }

        if (result.length === 0) {
            return res.status(404).json({ success: false, message: 'Band not found.' });
        }

        barcodeNo = result[0].barcode;
        processRevocation();
    });

    function processRevocation() {
        remark = 'Revoke: ' + barcodeNo + ' ' + remark;

        connection.query(q, [null, barcodeNo], (err, result) => {
            if (err) {
                console.error('Error revoking band:', err);
                return res.status(500).json({ success: false, message: 'Failed to revoke the band.' });
            }

            if (result.affectedRows === 0) {
                return res.status(404).json({ success: false, message: 'Band not found.' });
            }

            // Update m_activity column to increment by 1
            connection.query(updateActivityCountQuery, [reg_no], (err, result) => {
                if (err) {
                    console.error('Error updating m_activity count:', err);
                    return res.status(500).json({ success: false, message: 'Failed to update activity count.' });
                }

                // Push activity data to Hive Blockchain instead of MySQL
                const data = {
                    reg_no: reg_no,
                    date_time: currentDateTime,
                    user: user,
                    post: post,
                    remark: remark
                };

                hive.broadcast.customJson(
                    HIVE_KEY, // Your private posting key
                    [], // Required Posting Auth (Empty if posting on your behalf)
                    [HIVE_ACCOUNT], // Your Hive username
                    'm_activity_data', // Custom JSON ID
                    JSON.stringify(data),
                    (err, result) => {
                        if (err) {
                            console.error('Error pushing to blockchain:', err);
                            return res.status(500).json({ success: false, message: 'Error pushing to blockchain' });
                        }

                        return res.json({ success: true, message: 'Band revoked successfully and activity recorded on blockchain.' });
                    }
                );
            });
        });
    }
});




module.exports = router;