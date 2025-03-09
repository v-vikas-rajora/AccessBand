const { express, mysql, session, bcrypt, flash } = require('../MySQL/include');
const router = express.Router(); 

const hive = require("@hiveio/hive-js");
const { getBlockchainData, storeBlockchainData } = require("../blockChain/entryFuntion");
const getBlockchainBarcode = require("../blockChain/barcodeFuntion");
require('dotenv').config();

router.use(express.json());
router.use(express.urlencoded({ extended: true }));
router.use(flash());

const dbHost = process.env.DB_HOST;
const dbUser = process.env.DB_USER;
const database = process.env.DB_DATABASE;
const dbPassword = process.env.DB_PASSWORD;
const HIVE_ACCOUNT = process.env.HIVE_ACCOUNT;
const HIVE_KEY = process.env.HIVE_KEY;

const connection = mysql.createConnection({
    host: dbHost,
    user: dbUser,
    database: database,
    password: dbPassword,
    port: 3306
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

router.get("/details/reg_no", (req, res) => {
    if (!['Admin', 'SuperAdmin', 'User'].includes(req.session.user.role)) {
        res.redirect("/login/manage/user");
        return;
    }

    res.render('master.ejs', {form_type: 'entry_reg', errorMessage: ''});
});

router.get("/details", async (req, res) => {
    if (!['Admin', 'SuperAdmin', 'User'].includes(req.session.user.role)) {
        res.redirect("/login/manage/user");
        return;
    }

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
     else if (reg_no.includes("/") && reg_no.length > 5 && reg_no.length < 11) {
        let q = `SELECT * FROM student_data WHERE reg_no = '${reg_no}'`;
        barcode_type = 'student_data';
        aa(q);
    } else if (!reg_no.includes("/") && reg_no.length === 4) {
        let q = `SELECT * FROM faculty_data WHERE reg_no = '${reg_no}'`;
        barcode_type = 'faculty_data';
        aa(q);
    } else if (!reg_no.includes("/") && reg_no.length > 10) {
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
    } else if (reg_no.startsWith('M')) {
        let q = `SELECT * FROM master_entry_data WHERE id = '${reg_no}'`;
        barcode_type = 'master_entry';
        aa(q);
    } else {
        return res.render('master.ejs', { form_type: 'action', barcode_type: '', errorMessage: 'Invalid barcode' });
    }

    function aa(q) {
        connection.query(q, async (err, results) => {
            if (err) {
                console.error('Error fetching data from DB:', err);
                return res.send('Error retrieving data');
            } else {
                const dataaa = results[0];

                if (!dataaa) {
                    return res.render('master.ejs', { form_type: 'entry_reg', errorMessage: 'Invalid barcode' });
                }

                try {
                    const blockchainData = await getBlockchainData(dataaa.reg_no || dataaa.id);

                    if (blockchainData) {
                        res.render('entry', {
                            bandData: dataaa,
                            barcode_type,
                            entry_data: blockchainData,
                            errorType: '',
                            action: ''
                        });
                    } else {
                        console.log('No entry data found on blockchain.');
                        res.render('entry', {
                            bandData: dataaa,
                            barcode_type,
                            entry_data: [],
                            errorType: '',
                            action: ''
                        });
                    }
                } catch (err) {
                    console.error('Error fetching data from Blockchain:', err);
                    res.render('error', { message: 'Failed to fetch data from Blockchain.' });
                }
            }
        });
    }
});


router.get('/gate/check/:action', (req, res) => {   
    if (!['Admin', 'SuperAdmin', 'User'].includes(req.session.user.role)) {
        res.redirect("/login/manage/user");
        return;
    }

    const {action} = req.params;
    res.render('master.ejs', {form_type: action, errorMessage: ''});
});



router.post("/gate/:role/:action", (req, res) => {
    const role = req.params.role;
    const action = req.params.action;
    const reg_no = req.body.reg_no;
    const force_exit = req.body.force_exit_value;
    const username = req.session.user.username;
    const name = req.session.user.name;
    const post = req.session.user.post;

    let barcode_type;

    if (reg_no.startsWith('PU') || reg_no.startsWith('PGC')) {
        let checkQ = `SELECT barcode_type FROM barcode_data WHERE barcode = '${reg_no}'`;

        getBlockchainBarcode(reg_no)
            .then(blockchainResult => {
                if (blockchainResult) {
                    barcode_type = blockchainResult.barcode_type;
                    console.log("✅ Blockchain Barcode Type:", barcode_type);
                    let q = `SELECT * FROM ${barcode_type} WHERE barcode = '${reg_no}'`;
                    fetchUserData(q);
                } else {
                    connection.query(checkQ, (err, results) => {
                        if (err) {
                            console.error("SQL Query Error:", err);
                        } else if (results.length > 0) {
                            barcode_type = results[0].barcode_type;
                            console.log("SQL Barcode Type:", barcode_type);
                            let q = `SELECT * FROM ${barcode_type} WHERE barcode = '${reg_no}'`;
                            fetchUserData(q);
                        } else {
                            console.log("Barcode not found in both Blockchain and SQL.");
                            res.render('error', { message: "Barcode not found." });
                        }
                    });
                }
            })
            .catch(err => {
                console.error("Error fetching barcode data from Blockchain:", err);
                res.render('error', { message: "Failed to fetch barcode data." });
            });

    } else if (reg_no.includes("/") && reg_no.length > 5) {
        let q = `SELECT * FROM student_data WHERE reg_no = '${reg_no}'`;
        barcode_type = 'student_data';
        fetchUserData(q);
    } else if (!reg_no.includes("/") && reg_no.length === 4) {
        let q = `SELECT * FROM faculty_data WHERE reg_no = '${reg_no}'`;
        barcode_type = 'faculty_data';
        fetchUserData(q);
    } else {
        let q = `SELECT barcode_type FROM barcode_data WHERE barcode = '${reg_no}'`;
        fetchUserData(q);
    }

    let q2;
    
    function fetchUserData(q) {
        connection.query(q, (err, results) => {
            if (err) {
                console.error('Error fetching data from DB:', err);
                return res.send('Error retrieving data');
            } else if (results[0]) {
                q2 = null;

                let now = new Date();
                let offset = now.getTimezoneOffset() * 60000; 
                let localDateTime = new Date(now.getTime() - offset);
                let date_time = localDateTime.toISOString().replace('T', ' ').substring(0, 19).replace(/-/g, '-');

                const st_data = results[0];

                let errorTypeData;

                getBlockchainData(st_data.reg_no)
                    .then(entry_data => {
                        console.log('Data fetched:', entry_data);

                        if (action === "In") {
                            if (st_data.c_status === "In") {
                                if (['Admin', 'SuperAdmin', 'User'].includes(role)) {
                                    console.log(entry_data);
                                    res.render('entry', { bandData: st_data, entryD: 'yes', barcode_type, entry_data, errorType:"AlreadyIn", action: action});
                                    return;
                                } else {
    
                                    res.render('f-entry', { bandData: st_data, entryD: 'yes', name, post, barcode_type, entry_data, errorType:"AlreadyIn", role: role, f: ''});
                                    return;
                                }
                            } else if (st_data.status === "N") {
                                if (['Admin', 'SuperAdmin', 'User'].includes(role)) {
                                    res.render('entry', { bandData: st_data, entryD: 'none', barcode_type, entry_data, errorType:"Disable",  action: action });
                                    return;
                                } else {
                                    res.render('f-entry', { bandData: st_data, entryD: 'none', barcode_type, name, post, entry_data, errorType:"Disable",  role: role, f: ''});
                                    return;
                                }
                            } else {
                                q2 = `UPDATE ${barcode_type} SET c_status='In', c_id = '${date_time}' WHERE reg_no = '${st_data.reg_no}'`;
                                errorTypeData = "success_in";

                                storeBlockchainData('entry_data', st_data.reg_no, {
                                    reg_no: st_data.reg_no, 
                                    date_time_in: date_time, 
                                    user_in: HIVE_ACCOUNT 
                                }).then(() => updateStatus());
                            }
                        } else if (action === "Out") {
                            if (st_data.c_status === "Out") {
                                if (['Admin', 'SuperAdmin', 'User'].includes(role)) {
                                    res.render('entry', { bandData: st_data, entryD: 'yes', barcode_type, entry_data, errorType:"AlreadyOut", action: action, f_exit: ''});
                                    return;
                                } else {
                                    res.render('f-entry', { bandData: st_data, entryD: 'yes', barcode_type, name, post, entry_data, errorType:"AlreadyOut", role: role, f: '', f_exit: ''});
                                    return;
                                }
                            } else if (st_data.status === "N" && !force_exit) {
                                if (['Admin', 'SuperAdmin', 'User'].includes(role)) {
                                    res.render('entry', { bandData: st_data, entryD: 'none', barcode_type, entry_data, errorType:"Disable",  action: action, f_exit: 'show' });
                                    return;
                                } else {
                                    res.render('f-entry', { bandData: st_data, entryD: 'none', barcode_type, name, post, entry_data, errorType:"Disable",  role: role, f: '', f_exit: 'show'});
                                    return;
                                }
                            } else {
                                q2 = `UPDATE ${barcode_type} SET c_status='Out' WHERE reg_no = '${st_data.reg_no}'`;
                                errorTypeData = "success_out";

                                storeBlockchainData('exit_data', st_data.reg_no, { 
                                    reg_no: st_data.reg_no, 
                                    date_time_out: date_time, 
                                    user_out: HIVE_ACCOUNT 
                                }).then(() => updateStatus());
                            }
                        }
                    })
                    .catch(err => console.error("Error fetching entry data from blockchain:", err));

                    function updateStatus() {
                        console.log('yessss');
                        if (q2) {
                            connection.query(q2, (err, results) => {
                                if (err) {
                                    console.log("Error updating barcode status in SQL:", err);
                                } else {
                                    console.log("Barcode status updated successfully:", q2);
                                }
                    
                                getBlockchainData(st_data.reg_no)
                                    .then(entry_data1 => {    
                                        console.log(entry_data1);
                                        console.log('okk', entry_data1);
                                        if (['Admin', 'SuperAdmin', 'User'].includes(role)) {
                                            res.render('entry', { 
                                                bandData: st_data, 
                                                entryD: 'yes', 
                                                barcode_type, 
                                                errorType: errorTypeData, 
                                                entry_data: entry_data1, 
                                                action: action 
                                            });
                                        } else {
                                            res.render('f-entry', { 
                                                bandData: st_data, 
                                                entryD: 'yes', 
                                                barcode_type, 
                                                name, 
                                                post, 
                                                errorType: errorTypeData, 
                                                entry_data: entry_data1, 
                                                role: role, 
                                                f: '' 
                                            });
                                        }
                                    })
                                    .catch(err => {
                                        console.error("Error fetching entry_data from Blockchain:", err);
                                        res.send("Error retrieving data from Blockchain");
                                    });
                            });
                        }
                    }
            } else {
                res.render('master.ejs', { form_type: action, errorMessage: '' });
            }
        });
    }

});

router.get("/misc/activity/view", (req, res) => {
    const { reg_no } = req.query;

    hive.api.getAccountHistory(HIVE_ACCOUNT, -1, 1000, (err, result) => {
        if (err) {
            console.error('Error fetching data from blockchain:', err);
            return res.status(500).json({ success: false, message: 'Error fetching data from blockchain' });
        }

        // Filter the custom_json operation related to 'm_activity_data'
        const activityData = result
            .filter(tx => 
                tx[1].op[0] === 'custom_json' &&
                tx[1].op[1].id === 'm_activity_data'
            )
            .map(tx => {
                const data = JSON.parse(tx[1].op[1].json);
                if (data.reg_no === reg_no) {
                    return {
                        date_time: data.date_time,
                        user: data.user,
                        post: data.post,
                        remark: data.remark
                    };
                }
            })
            .filter(Boolean) // Remove undefined entries
            .sort((a, b) => new Date(b.date_time) - new Date(a.date_time)); // Sort by date_time DESC

        res.json({ success: true, data: activityData });
    });
});

router.post("/mics/activity", async (req, res) => {
    const { reg_no, remark, user, post } = req.body;

    // Validate the input
    if (!reg_no || !remark) {
        return res.status(400).json({ success: false, message: "Reg No and Remark are required" });
    }

    // Get current date-time in local timezone
    let now = new Date();
    let offset = now.getTimezoneOffset() * 60000; // Offset in milliseconds
    let localDateTime = new Date(now.getTime() - offset);
    let date_time = localDateTime.toISOString().replace('T', ' ').substring(0, 19);


    

    const jsonData = {
        reg_no: reg_no,
        date_time: date_time,
        user: user,
        post: post,
        remark: remark
    };

    const customJsonData = {
        required_auths: [],
        required_posting_auths: [HIVE_ACCOUNT],
        id: "m_activity_data",
        json: JSON.stringify(jsonData)
    };

    // Broadcast the data to Hive Blockchain
    hive.broadcast.customJson(HIVE_KEY, customJsonData.required_auths, customJsonData.required_posting_auths, customJsonData.id, customJsonData.json, async (err, result) => {
        if (err) {
            console.error("Error inserting remark to Hive Blockchain:", err.stack);
            return res.status(500).json({ success: false, message: "Failed to store data on Blockchain" });
        } else {
            console.log("Data successfully stored on Blockchain!");

            // ✅ Update the activity count in MySQL
            const q = `UPDATE student_data SET m_activity = m_activity + 1 WHERE reg_no = '${reg_no}'`;
            connection.query(q, (err, results) => {
                if (err) {
                    console.error("Error updating activity count:", err.stack);
                    return res.status(500).json({ success: false, message: "Failed to update activity count in MySQL" });
                } else {
                    res.status(200).json({ success: true, message: "Activity successfully added to Blockchain and MySQL" });
                }
            });
        }
    });
});

router.post("/scan/master/card", (req, res) => {
    const { master_id } = req.body;
    const query = 'SELECT name, post FROM users WHERE master_id = ?';

    connection.execute(query, [master_id], (err, results) => {
        if (err) {
            console.error('Error executing query:', err);
            return res.status(500).json({ success: false, message: 'Internal server error' });
        }

        if (results.length > 0) {
            req.session.tempMasterData = {
                name: results[0].name,
                post: results[0].post
            };
            return res.status(200).json({ success: true, userExists: true });
        } else {
            return res.status(404).json({ success: true, userExists: false });
        }
    });
});


router.get("/add/guest", (req, res) => {
    if (!['Admin', 'SuperAdmin'].includes(req.session.user.role)) {
        res.redirect("/login/manage/user");
        return;
    }

    res.render('addGuest');

});

router.get('/add/guest/:emp_id', (req, res) => {
    const empId = req.params.emp_id;

    const query = `SELECT name, email FROM faculty_data WHERE reg_no = '${empId}'`;
    console.log(query);
    // Execute the query
    connection.execute(query, [empId], (err, results) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }

        if (results.length === 0) {
            return res.status(404).json({ error: 'Employee not found' });
        }
        const employee = results[0];
        console.log(results);

        // Send the data back as JSON
        res.json({
            name: employee.name,
            email: employee.email
        });
    });
});

router.post('/add/guest', (req, res) => {
    const { emp_id, name, mobile, email, remark, type, relation, photoPath } = req.body;

    // Check if the same name and emp_id already exist in the database
    const checkQuery = 'SELECT * FROM guest_data WHERE name = ? AND emp_id = ?';
    connection.query(checkQuery, [name, emp_id], (err, result) => {
        if (err) {
            console.error('Error checking for existing record:', err);
            return res.status(500).json({ success: false, message: 'Database error' });
        }

        // If a matching record exists, return an error message
        if (result.length > 0) {
            return res.status(400).json({ success: false, message: 'Person already exists in database' });
        }

        // Query to count records starting with the emp_id to generate the guest_id
        const countQuery = 'SELECT COUNT(*) AS count FROM guest_data WHERE emp_id LIKE ?';
        connection.query(countQuery, [emp_id + '%'], (err, countResult) => {
            if (err) {
                console.error('Error counting records:', err);
                return res.status(500).json({ success: false, message: 'Database error' });
            }

            // Generate guest_id by concatenating emp_id with the count + 1
            const guestCount = countResult[0].count + 1;
            const guestId = `${emp_id}-${guestCount}`;

            console.log(guestId);
            // SQL query to insert data into guest_data table
            const query = `INSERT INTO guest_data (reg_no, name, mobile, email, remark, emp_id, type, relation, photo_path) 
                           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;

            connection.query(query, [guestId, name, mobile, email, remark, emp_id, type, relation, photoPath], (err, result) => {
                if (err) {
                    console.error('Error inserting data:', err);
                    return res.status(500).json({ success: false, message: 'Database error' });
                }
                res.status(200).json({ success: true, message: 'Guest data added successfully' });
            });
        });
    });
});

router.post('/master/card/', async (req, res) => {
    try {
        delete req.session.tempMasterData;

        const { name, mobile, email, remark, m_card_holder, post, photo_path } = req.body;

        let now = new Date();
        let offset = now.getTimezoneOffset() * 60000; // Offset in milliseconds
        let localDateTime = new Date(now.getTime() - offset);
        let date_time = localDateTime.toISOString().replace('T', ' ').substring(0, 19).replace(/-/g, '-');

        // Generate ID Format "PU-M11001"
        connection.query('SELECT COUNT(*) AS count FROM master_entry_data', (err, results) => {
            if (err) {
                console.error(err);
                return res.status(500).send('Error counting records');
            }

            const count = results[0].count + 1;
            const id = `M11${String(count).padStart(4, '0')}`;

            // SQL Query to insert data into the master_entry_data table
            const query = 'INSERT INTO master_entry_data (id, name, mobile, email, remark, m_card_holder, post, c_status, c_id, photo_path) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
            const values = [id, name, mobile, email, remark, m_card_holder, post, "In", date_time, photo_path];

            connection.query(query, values, (err, results) => {
                if (err) {
                    console.error(err);
                    return res.status(500).send('Error inserting data into the master_entry_data table');
                }

                // Now insert into the entry_data table
                const entryDataQuery = 'INSERT INTO entry_data (reg_no, date_time_in, user_in) VALUES (?, ?, ?)';
                const entryDataValues = [id, date_time, req.session.user.HIVE_ACCOUNT];

                connection.query(entryDataQuery, entryDataValues, (err, results) => {
                    if (err) {
                        console.error(err);
                        return res.status(500).send('Error inserting data into the entry_data table');
                    }
                    res.status(200).send('Data inserted successfully');
                });
            });
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Error processing request');
    }
});



router.get('/master/card/out', (req, res) => {
    const query = "SELECT id, name, mobile, email, m_card_holder, post, c_id FROM master_entry_data WHERE c_status = 'In'";

    connection.query(query, (err, results) => {
        if (err) {
            res.status(500).send({ error: 'Error fetching data' });
        } else {
            res.json(results);
        }
    });
});

router.post('/master/card/markExit/:id', (req, res) => {
    const { id } = req.params;
    const query = "UPDATE master_entry_data SET c_status = 'Out' WHERE id = ?";

    let now = new Date();
    let offset = now.getTimezoneOffset() * 60000; // Offset in milliseconds
    let localDateTime = new Date(now.getTime() - offset);
    let date_time = localDateTime.toISOString().replace('T', ' ').substring(0, 19).replace(/-/g, '-');

    // Update master_entry_data to mark as 'Out'
    connection.query(query, [id], (err, results) => {
        if (err) {
            return res.status(500).send({ error: 'Error marking exit' });
        }

        // Once the status is updated, also update the entry_data table
        const updateEntryDataQuery = `
            UPDATE entry_data
            SET date_time_out = ?, user_out = ?
            WHERE reg_no = ?
        `;
        
        // Ensure session and username exist
        const username = req.session.user.username;  // Handle case if no user logged in
        
        connection.query(updateEntryDataQuery, [date_time, username, id], (updateErr) => {
            if (updateErr) {
                return res.status(500).send({ error: `Error updating entry_data for reg_no ${id}` });
            } else {
                return res.json({ success: true });
            }
        });
    });
});


module.exports = router;