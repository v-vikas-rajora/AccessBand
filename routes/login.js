const { express, mysql, session, flash } = require('../MySQL/include');
const router = express.Router(); 
const hiveSigner = require('hivesigner');
const axios = require('axios');
router.use(express.json());
router.use(express.urlencoded({ extended: true }));
router.use(flash());

require('dotenv').config();

const hive = require("@hiveio/hive-js");



const dbHost = process.env.DB_HOST;
const dbUser = process.env.DB_USER;
const database = process.env.DB_DATABASE;
const dbPassword = process.env.DB_PASSWORD;
const HIVE_ACCOUNT = process.env.HIVE_ACCOUNT;
const HIVE_KEY = process.env.HIVE_KEY;


// const connection = mysql.createConnection({
//     host: dbHost,
//     user: dbUser,
//     database: database,
//     password: dbPassword,
//     port: 3306
// });

const connection = mysql.createConnection({
    host: dbHost,
    user: dbUser,
    database: database,
    password: dbPassword,
    port: 3306
});

router.use("/", (req, res, next) => {
    if (req.path === '/authenticate' || req.path === '/force-logout'|| req.path === '/hive-force-login'|| req.path === '/hive-callback') {
        return next();
    }

    if (!req.session.user) {
        res.redirect("/");
        return;
    }

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

router.post('/check-user', (req, res) => {
    const { username } = req.body;

    // Check if the user exists
    connection.query('SELECT * FROM users WHERE username = ?', [username], (err, results) => {
        if (err) {
            console.error('Error:', err);
            return res.status(500).json({ success: false, message: 'Database error occurred.' });
        }

        if (results.length === 0) {
            return res.status(400).json({ success: false, message: 'Invalid username.' });
        }

        const user = results[0];

        if (user.status === 'N') {
            return res.status(403).json({
                success: false,
                message: 'Account has been disabled, Kindly Contact to Administrator.'
            });
        }

        if (user.current_session_id && user.current_session_id !== req.sessionID) {
            return res.status(200).json({
                success: false,
                message: 'You are currently logged in on another device. Would you like to log out from the other session and log in here?',
                action_needed: true
            });
        }

        // ✅ Manually generate Hive Signer URL
        const client_id = 'accessband';
        const redirect_uri = 'http://localhost:3000/login/hive-callback';
        const response_type = 'token';
        const scope = 'login';

        const hiveLoginURL = `https://hivesigner.com/oauth2/authorize?client_id=${client_id}&redirect_uri=${redirect_uri}&response_type=${response_type}&scope=${scope}&username=${username}`;

        res.status(200).json({
            success: true,
            redirect_url: hiveLoginURL
        });
    });
});


router.get('/hive-callback', (req, res) => {
    const { access_token, username } = req.query;

    console.log('Hive Signer Username:', username);

    if (!access_token || !username) {
        return res.redirect('/');
    }

    // ✅ Step 1: Check if username exists in the database
    connection.query('SELECT * FROM users WHERE username = ?', [username], (err, results) => {
        if (err) {
            console.error('Database Error:', err);
            return res.redirect('/');
        }

        // ✅ Step 2: If User Not Found
        if (results.length === 0) {
            console.log('User Not Found');
            return res.send(`
                <script>
                    alert("User Not Found in AccessBand. Please contact administrator.");
                    window.location.href = "/";
                </script>
            `);
        }

        const user = results[0];

        // ✅ Step 3: If User is Disabled
        if (user.status === 'N') {
            console.log('Account Disabled');
            return res.send(`
                <script>
                    alert("Your Account has been Disabled. Kindly contact Administrator.");
                    window.location.href = "/";
                </script>
            `);
        }

        // ✅ Step 4: Check if User Already Logged In
        if (user.current_session_id && user.current_session_id !== req.sessionID) {
            console.log('User Already Logged In on Another Device');

            // ✅ Step 5: Ask User If They Want To Terminate Old Session
            return res.send(`
                <script>
                    if (confirm("You are already logged in on another device. Would you like to log out from the other session and log in here?")) {
                        window.location.href = "/login/hive-force-login?username=${username}&session=${req.sessionID}";
                    } else {
                        alert("Login Cancelled. You are still logged in on your previous device.");
                        window.location.href = "/";
                    }
                </script>
            `);
        }

        // ✅ Step 6: Update Current Session ID (Normal Login)
        req.session.user = user;
        req.session.user.current_session_id = req.sessionID;

        connection.query('UPDATE users SET current_session_id = ? WHERE username = ?', [req.sessionID, user.username], (err, result) => {
            if (err) {
                console.error('Error updating session:', err);
                return res.redirect('/');
            }

            // ✅ Step 7: Redirect to Panel Based on Role
            if (user.role === 'InUser' || user.role === 'OutUser') {
                return res.redirect('/login/gate/user');
            } else {
                return res.redirect('/login/manage/user');
            }
        });
    });
});


// ✅ API to Force Login (Terminate Old Session)
router.get('/hive-force-login', (req, res) => {
    const { username, session } = req.query;

    // ✅ Step 1: Update Current Session ID
    connection.query('UPDATE users SET current_session_id = ? WHERE username = ?', [session, username], (err, result) => {
        if (err) {
            console.error('Error updating session:', err);
            return res.redirect('/');
        }

        // ✅ Step 2: Set New Session
        connection.query('SELECT * FROM users WHERE username = ?', [username], (err, results) => {
            if (err || results.length === 0) {
                console.error('Error fetching user:', err);
                return res.redirect('/');
            }

            const user = results[0];
            req.session.user = user;
            req.session.user.current_session_id = session;

            console.log('Old session terminated, new session started.');

            // ✅ Step 3: Redirect to Dashboard
            if (user.role === 'InUser' || user.role === 'OutUser') {
                return res.redirect('/login/gate/user');
            } else {
                return res.redirect('/login/manage/user');
            }
        });
    });
});


router.post('/force-logout', (req, res) => {
    const { username } = req.body;

    // Clear the current session ID to force logout the other session
    connection.query('UPDATE users SET current_session_id = NULL WHERE username = ?', [username], (err, result) => {
        if (err) {
            console.error('Error:', err);
            return res.status(500).json({ success: false, message: 'Error logging out the other session.' });
        }
        return res.status(200).json({ success: true, message: 'Logged out other session successfully.' });
    });
});

router.post('/logout', (req, res) => {
    // Check if the user is logged in
    if (req.session && req.session.user) {
        const username = req.session.user.username;
        // Clear the session data
        req.session.destroy((err) => {
            if (err) {
                console.error('Error destroying session:', err);
                return res.status(500).send();  // No message, just a status
            }

            // Update the user's session ID in the database to null
            connection.query('UPDATE users SET current_session_id = NULL WHERE username = ?', [username], (err, result) => {
                if (err) {
                    console.error('Error updating session ID:', err);
                    return res.status(500).send();  // No message, just a status
                }
                // Redirect the user to the homepage or login page
                res.redirect('/');
            });
        });
    } else {
        // If no session exists (user is not logged in)
        res.status(400).send();  // No message, just a status
    }
});

router.get('/gate/user', (req, res) => {
    if (req.session && req.session.user) {
        res.render("f-entry", {role: req.session.user.role, name: req.session.user.name, post: req.session.user.post, f: 'first', barcode_type: ''});
    } else {
        res.redirect("/");
    }
});

router.get('/manage/user', (req, res) => {
    if (req.session && req.session.user) {

        res.locals.user_access_data = req.session.user;

        if (!['SuperAdmin'].includes(res.locals.user_access_data.role)) {
            res.redirect(`/band/issue/reg_no`);
            return;
        }

        connection.query("SELECT * FROM users WHERE role != 'SuperAdmin'", (err, results) => {
            if (err) {
                console.error('Error fetching users:', err);
                res.status(500).send('Error fetching users');
            } else {
                res.render('index.ejs', { users: results });
            }
        });

    } else {
        res.redirect("/");
    }


});


router.get("/student/bulk/exit", (req, res) => {
    if (req.session && req.session.user) {

        res.locals.user_access_data = req.session.user;

        if (!['SuperAdmin'].includes(res.locals.user_access_data.role)) {
            res.redirect(`/band/issue/reg_no`);
            return;
        }

        res.render('bulk');
    } else {
        res.redirect("/");
    }
});

router.post('/student/bulk/exit', async (req, res) => {
    if (req.session && req.session.user) {

        const { regNos } = req.body;
        const username = req.session.user.username;

        let now = new Date();
        let offset = now.getTimezoneOffset() * 60000;
        let localDateTime = new Date(now.getTime() - offset);
        let dateTimeOut = localDateTime.toISOString().replace('T', ' ').substring(0, 19).replace(/-/g, '-');

        if (!regNos || regNos.length === 0) {
            return res.status(400).json({ success: false, message: 'No reg_no provided.' });
        }

        // Blockchain pe bulk exit ka data ek saath store karna
        const bulkExitData = regNos.map(reg_no => ({
            type: 'exit_data',
            reg_no: reg_no,
            date_time_out: dateTimeOut,
            user_out: username
        }));

        async function storeBlockchainData(data) {
            try {
                const jsonData = JSON.stringify(data);

                const result = await new Promise((resolve, reject) => {
                    hive.broadcast.customJson(
                        HIVE_KEY,
                        [], // Required Auths
                        [HIVE_ACCOUNT], // Required Posting Auths
                        "hive_gate_event",
                        jsonData,
                        (err, result) => {
                            if (err) {
                                reject(err);
                            } else {
                                resolve(result);
                            }
                        }
                    );
                });

                return result;
            } catch (error) {
                console.error("Error storing data on Hive:", error);
                return null;
            }
        }

        // ✅ Transaction Start
        connection.beginTransaction(async (err) => {
            if (err) {
                console.error('Transaction error:', err);
                return res.status(500).json({ success: false, message: 'Failed to start transaction.' });
            }

            // ✅ Step 1: Blockchain pe data post karo
            const blockchainResult = await storeBlockchainData(bulkExitData);

            // ✅ Step 2: Agar blockchain fail ho gaya to rollback karo
            if (!blockchainResult) {
                return connection.rollback(() => {
                    console.error('Failed to store data on Blockchain');
                    return res.status(500).json({
                        success: false,
                        message: 'Failed to store bulk exit data on blockchain. No database changes were made.'
                    });
                });
            }

            // ✅ Step 3: Ab SQL query ko execute karo
            const updateStudentDataQuery = `
                UPDATE student_data 
                SET c_status = 'Out' 
                WHERE reg_no IN (?)`;

            connection.query(updateStudentDataQuery, [regNos], (err, result) => {
                if (err) {
                    return connection.rollback(() => {
                        console.error('Failed to update student_data:', err);
                        return res.status(500).json({ success: false, message: 'Failed to update student_data.' });
                    });
                }

                // ✅ Step 4: Sab kuch theek hai, commit karo
                connection.commit((err) => {
                    if (err) {
                        return connection.rollback(() => {
                            console.error('Failed to commit transaction:', err);
                            return res.status(500).json({ success: false, message: 'Failed to commit transaction.' });
                        });
                    }

                    // ✅ Step 5: Success response bhejo
                    res.json({
                        success: true,
                        message: 'Bulk exit data successfully stored on blockchain and c_status set to Out.'
                    });
                });
            });
        });

    } else {
        res.redirect("/");
    }
});



router.get('/password/change', (req, res) => {
    if (req.session && req.session.user) {
        res.locals.user_access_data = req.session.user;
        res.render('changePw');
    } else {
        res.redirect("/");
    }
});


router.post('/master/card/data/clear', (req, res) => {
    // Clear the session data
    if (req.session && req.session.tempMasterData) {
      delete req.session.tempMasterData;
    }
    
    // Send a response to the client
    res.json({ status: 'success' });
});


module.exports = router;