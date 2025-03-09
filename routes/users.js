const { express, mysql, session, flash } = require('../MySQL/include');
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

router.post("/add", async (req, res) => {
    console.log(req.body); 
    const {name, post, username, role} = req.body;

    try {
        const query = `
            INSERT INTO users (name, post, username, role) 
            VALUES (?, ?, ?, ?, ?)
        `;
        const values = [name, post, username, role];

        // Execute the query
        connection.query(query, values, (err, results) => {
            if (err) {
                console.log(err);
                return res.status(500).json({ success: false, message: "Error inserting user" });
            }

            // Respond with success and new user details (optional)
            console.log(results);
            return res.status(200).json({
                success: true,
                message: "User created successfully",
                user: {
                    name: name,
                    post: post,
                    username: username,
                    role: role
                }
            });
        });
    } catch (error) {
        console.error("Error processing the request", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
});


router.post('/master/card/update', (req, res) => {
    const { master_id, username } = req.body;

    // Validate input
    if (!master_id || !username) {
        return res.status(400).json({ success: false, message: 'Master ID and Username are required' });
    }

    // SQL query to update the master_id (example using a simple query)
    const query = 'UPDATE users SET master_id = ? WHERE username = ?';
    connection.query(query, [master_id, username], (err, result) => {
        if (err) {
            console.error('Error updating master_id:', err);
            return res.status(500).json({ success: false, message: 'Internal server error' });
        }

        if (result.affectedRows > 0) {
            return res.status(200).json({ success: true, message: 'Master Card Id updated successfully!' });
        } else {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
    });
});

router.put('/update/:userId', async (req, res) => {
    const userId = req.params.userId; // Extract userId from the URL
    const { name, post, username, role } = req.body; // Extract updated details from the request body

    if (!name || !post || !username || !role) {
        return res.status(400).json({ success: false, message: 'All fields are required' });
    }

    let query;

 
        query = `
        UPDATE users
        SET name = ?, post = ?, username = ?, role = ?
        WHERE username = ?`;

        values = [name, post, username, role, userId];


    // Execute the query
    connection.query(query, values, (error, results) => {
        if (error) {
            console.error('Error updating user:', error);
            return res.status(500).json({ success: false, message: 'Error updating user' });
        }

        if (results.affectedRows > 0) {
            // If update is successful
            res.json({ success: true, message: 'User updated successfully' });
        } else {
            // If no user is found with the given username
            res.status(404).json({ success: false, message: 'User not found' });
        }
    });
});

router.put('/action/update/role', (req, res) => {
    const { userId, newRole } = req.body;
    console.log(userId, newRole);
    if (!userId || !newRole) {
        return res.status(400).json({ success: false, message: 'User ID and new role are required' });
    }

    // Update the role in the database
    const query = 'UPDATE users SET role = ? WHERE username = ?';

    connection.query(query, [newRole, userId], (err, result) => {
        if (err) {
            console.error('Error updating role:', err);
            return res.status(500).json({ success: false, message: 'Error updating user role' });
        }

        if (result.affectedRows > 0) {
            return res.json({ success: true, message: 'Role updated successfully' });
        } else {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
    });
});

router.put('/action/:status', (req, res) => {
    const { userId } = req.body;
    const { status } = req.params; // 'Y' or 'N'

    // Update the user's status in the database
    const query = `UPDATE users SET status = ? WHERE username = ?`;
    connection.query(query, [status, userId], (err, result) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ success: false, message: 'Database error' });
        }

        if (result.affectedRows > 0) {
            res.json({ success: true });
        } else {
            res.status(404).json({ success: false, message: 'User not found' });
        }
    });
});

router.delete('/action/delete', (req, res) => {
    const { userId } = req.body;  // `userId` is expected to be the username

    // Database query to delete the user by username
    const query = 'DELETE FROM users WHERE username = ?';
    
    connection.query(query, [userId], (err, result) => {
        if (err) {
            console.error('Error deleting user:', err);
            return res.status(500).json({ success: false, message: 'Failed to delete user' });
        }

        if (result.affectedRows > 0) {
            return res.json({ success: true });
        } else {
            return res.json({ success: false, message: 'User not found' });
        }
    });
});


module.exports = router;