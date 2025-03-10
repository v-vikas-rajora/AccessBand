const { express, mysql, session, bcrypt, flash } = require('../MySQL/include');
const router = express.Router(); 

const hive = require("@hiveio/hive-js");
router.use(express.json());
router.use(express.urlencoded({ extended: true }));
router.use(flash());

require('dotenv').config();


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

router.get("/activity/details", async (req, res) => {
    try {

        hive.api.getAccountHistory(HIVE_ACCOUNT, -1, 1000, (err, result) => {
            if (err) {
                console.error('Error fetching from blockchain:', err);
                return res.status(500).send('Error fetching from blockchain');
            }

            // Step 2: Filter only 'custom_json' of type 'm_activity_data'
            const activityData = result
                .map(tx => tx[1].op)
                .filter(op => op[0] === 'custom_json' && op[1].id === 'm_activity_data')
                .map(op => JSON.parse(op[1].json));

            // ✅ Step 3: Extract DISTINCT reg_no from blockchain
            const regNos = [...new Set(activityData.map(item => item.reg_no))]; // Distinct reg_no

            if (regNos.length === 0) {
                return res.render('m_activity.ejs', { users: [] });
            }

            // Step 4: SQL Query to fetch student data for those DISTINCT reg_no
            const q = `
                SELECT DISTINCT sd.reg_no, sd.name, sd.f_name, sd.school, sd.program, 
                sd.sem, sd.section, sd.mobile, sd.status, sd.m_activity
                FROM student_data sd
                WHERE sd.reg_no IN (${regNos.map(() => '?').join(',')})`;

            connection.query(q, regNos, (err, results) => {
                if (err) {
                    console.error('Error fetching users:', err);
                    return res.status(500).send('Error fetching users');
                }

                // Step 5: Combine Blockchain data with MySQL data
                const combinedData = regNos.map(regNo => {
                    const student = results.find(s => s.reg_no === regNo);
                    const activity = activityData.find(a => a.reg_no === regNo);
                    return {
                        ...activity,
                        ...student
                    };
                });

                // Step 6: Render EJS template with Combined Data
                res.render('m_activity.ejs', { users: combinedData });
            });
        });

    } catch (error) {
        console.error('Unexpected Error:', error);
        res.status(500).send('Unexpected Error');
    }
});

router.put('/student/account/:action', (req, res) => {
    const action = req.params.action;
    let { reg_no, remark } = req.body;
    
    if (!reg_no) {  
        return res.status(400).json({ success: false, message: 'Missing reg_no' });
    }

    // Determine the new status based on the action
    const newStatus = action === 'enable' ? 'Y' : 'N';
    const updateStudentQuery = "UPDATE student_data SET status = ? WHERE reg_no = ?";

    const user = req.session.user.username;
    const post = req.session.user.post;
    
    let now = new Date();
    let offset = now.getTimezoneOffset() * 60000; // Offset in milliseconds
    let localDateTime = new Date(now.getTime() - offset);
    let currentDateTime = localDateTime.toISOString().replace('T', ' ').substring(0, 19).replace(/-/g, '-');

    const actionA = newStatus === 'Y' ? 'Enable: ' : 'Disable: ';
    remark = actionA + remark;

    // Increment m_activity value
    const incrementActivityQuery = "UPDATE student_data SET m_activity = m_activity + 1 WHERE reg_no = ?";

    // Update student data status
    connection.query(updateStudentQuery, [newStatus, reg_no], (err, result) => {
        if (err) {
            console.error('Error updating status:', err);
            return res.status(500).json({ success: false, message: 'Failed to update status.' });
        }

        // Check if any row was affected (if no rows were updated, reg_no may be invalid)
        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Student not found.' });
        }

        // Increment m_activity count
        connection.query(incrementActivityQuery, [reg_no], (err, result) => {
            if (err) {
                console.error('Error updating m_activity:', err);
                return res.status(500).json({ success: false, message: 'Failed to update m_activity.' });
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
                HIVE_KEY,
                [], 
                [HIVE_ACCOUNT],
                'm_activity_data',
                JSON.stringify(data),
                (err, result) => {
                    if (err) {
                        console.error('Error pushing to blockchain:', err);
                        return res.status(500).json({ success: false, message: 'Error pushing to blockchain' });
                    }

                    // Respond with success if both updates are successful
                    res.json({ success: true, message: 'Status updated, m_activity incremented, and activity logged on blockchain.' });
                }
            );
        });
    });
});







module.exports = router;