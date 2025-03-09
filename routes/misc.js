const { express, mysql, session, bcrypt, flash } = require('../MySQL/include');
const router = express.Router(); 

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

router.get("/activity/details", (req, res) => {
    q = `SELECT DISTINCT mad.reg_no, sd.name, sd.f_name, sd.school, sd.program, sd.sem, sd.section, sd.mobile, sd.m_activity, sd.status FROM m_activity_data mad JOIN student_data sd ON mad.reg_no = sd.reg_no`;
    
    connection.query(q, (err, results) => {
        if (err) {
            console.error('Error fetching users:', err);
            res.status(500).send('Error fetching users');
        } else {
            // Render the page and pass the users data
            res.render('m_activity.ejs', { users: results });
        }
    });
});
router.put('/student/account/:action', (req, res) => {
    const action = req.params.action;  // Either 'enable' or 'disable'
    let { reg_no, remark } = req.body;  // The student’s registration number and remark
    
    // Check that reg_no is provided
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