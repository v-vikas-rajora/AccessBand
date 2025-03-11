const { express, mysql, session, bcrypt, flash } = require('../MySQL/include');
const router = express.Router(); 

const hive = require("@hiveio/hive-js");
const getAllBlockchainEntryData = require("../blockChain/reportsFunction");

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

router.get("/", (req, res) => {
    res.render("reports");
});

router.get('/fetch/filterArea2', (req, res) => {
  const query = 'SELECT DISTINCT school, program, sem, section FROM student_data';
  
  connection.query(query, (err, results) => {
      if (err) {
          console.error('Database query failed:', err);
          return res.status(500).json({ error: 'Database query failed' });
      }

      res.json(results);  // Send the results as JSON response
  });
});


router.get('/fetch/bulkExit', async (req, res) => {
    let { startDate, endDate, regNo, barcodeNo, studentName, school, program, semester, section } = req.query;

    // ✅ Blockchain se saara entry data le lo
    let blockchainData;
    try {
        blockchainData = await getAllBlockchainEntryData();
    } catch (error) {
        console.error('Error fetching blockchain data:', error);
        return res.status(500).json({ message: 'Error fetching data from blockchain' });
    }

    // ✅ Sirf wo data filter karo jinke exit time null hai
    let filteredData = blockchainData.filter(entry => entry.date_time_out === null);

    // ✅ Filters ko apply karo
    if (startDate && endDate) {
        filteredData = filteredData.filter(entry =>
            new Date(entry.date_time_in) >= new Date(startDate) &&
            new Date(entry.date_time_in) <= new Date(endDate)
        );
    }

    if (regNo) {
        filteredData = filteredData.filter(entry =>
            entry.reg_no.toLowerCase().includes(regNo.toLowerCase())
        );
    }

    if (barcodeNo) {
        filteredData = filteredData.filter(entry =>
            entry.barcode.toLowerCase().includes(barcodeNo.toLowerCase())
        );
    }

    if (studentName) {
        filteredData = filteredData.filter(entry =>
            entry.name.toLowerCase().includes(studentName.toLowerCase())
        );
    }

    // ✅ Database se student_data ko fetch karo jisse school, program, sem, section ka filter kaam kare
    let studentQuery = `SELECT * FROM student_data`;
    connection.query(studentQuery, (err, students) => {
        if (err) {
            console.error('Error fetching student data:', err);
            return res.status(500).json({ message: 'Error fetching student data' });
        }

        // ✅ Blockchain ke entry_data aur student_data ko merge karo
        let mergedData = filteredData.map(entry => {
            let student = students.find(s => s.reg_no === entry.reg_no);
            if (student) {
                return {
                    reg_no: entry.reg_no,
                    barcode: student.barcode,
                    name: student.name,
                    school: student.school,
                    program: student.program,
                    semester: student.sem,
                    section: student.section,
                    date_time_in: entry.date_time_in
                };
            }
            return null;
        }).filter(data => data !== null);

        // ✅ Filter by School
        if (school) {
            if (!Array.isArray(school)) {
                school = school.split(',').map(s => s.trim());
            }
            mergedData = mergedData.filter(data => school.includes(data.school));
        }

        // ✅ Filter by Program
        if (program) {
            if (!Array.isArray(program)) {
                program = program.split(',').map(p => p.trim());
            }
            mergedData = mergedData.filter(data => program.includes(data.program));
        }

        // ✅ Filter by Semester
        if (semester) {
            if (!Array.isArray(semester)) {
                semester = semester.split(',').map(s => s.trim());
            }
            mergedData = mergedData.filter(data => semester.includes(data.semester));
        }

        // ✅ Filter by Section
        if (section) {
            if (!Array.isArray(section)) {
                section = section.split(',').map(s => s.trim());
            }
            mergedData = mergedData.filter(data => section.includes(data.section));
        }

        res.json(mergedData);
    });
});



async function getBlockchainData() {
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

        const entryList = parsedEntries.filter(entry => entry.type === 'entry_data');
        const exitList = parsedEntries.filter(entry => entry.type === 'exit_data');

        let finalData = [];
        let usedExits = new Set();

        entryList.forEach(entry => {
            let matchingExit = exitList.find(exit =>
                new Date(exit.date_time_out) > new Date(entry.date_time_in) &&
                !usedExits.has(exit.date_time_out)
            );

            if (matchingExit) {
                usedExits.add(matchingExit.date_time_out);
            }

            finalData.push({
                reg_no: entry.reg_no,
                date_time_in: entry.date_time_in,
                user_in: entry.user_in,
                date_time_out: matchingExit ? matchingExit.date_time_out : null,
                user_out: matchingExit ? matchingExit.user_out : null
            });
        });

        return finalData.length > 0 ? finalData : [];
    } catch (error) {
        console.error("Error fetching blockchain data:", error);
        return [];
    }
}

router.get('/fetch/data', async (req, res) => {
    let { regNo, barcodeNo, studentName, school, program, semester, section, first, second, third, forth, startDate, endDate, site, type, userCount } = req.query;
    let query;
    let hiveBarcodes = [];

    if (second === 'band' && (third !== 'revoked' || third !== 'disabled')) {
        if (third === 'pending') {
            query = `
                SELECT s.reg_no, s.name, s.mobile, s.school, s.program, s.sem, s.section, s.site, s.type, s.hostel
                FROM student_data s
                WHERE 1=1
            `;

            if (first === 'FAC') {
                query = `
                SELECT s.reg_no, s.name, s.site, s.email, s.mobile
                FROM faculty_data s
                WHERE 1=1`;
            }
        } else {
            query = `
                SELECT s.reg_no, s.name, s.barcode, s.mobile, s.school, s.program, s.sem, s.section, s.site, s.hostel, s.type
                FROM student_data s
                WHERE 1=1
            `;

            if (first === 'FAC') {
                query = `
                SELECT s.reg_no, s.barcode, s.name, s.site, s.email, s.mobile
                FROM faculty_data s
                WHERE 1=1`;
            }

            // Fetch barcode data from Hive Blockchain
            try {
                const accountHistory = await hive.api.getAccountHistoryAsync(HIVE_ACCOUNT, -1, 1000);
                hiveBarcodes = accountHistory
                    .filter(tx => tx[1].op[0] === 'custom_json')
                    .map(tx => {
                        try {
                            const json = JSON.parse(tx[1].op[1].json);
                            if (json.type === 'barcode_data') {
                                return json;
                            }
                        } catch (err) {
                            return null;
                        }
                    })
                    .filter(Boolean);

                const barcodeNumbers = hiveBarcodes.map(b => b.barcode);

                if (barcodeNumbers.length > 0) {
                    query += ` AND s.barcode IN ('${barcodeNumbers.join("', '")}')`;
                }
            } catch (error) {
                console.error('Hive Blockchain Error:', error);
                return res.status(500).json({ message: 'Failed to fetch data from blockchain' });
            }
        }

        if (third === 'issued') {
            query += ` AND s.barcode IS NOT NULL`;
        } else if (third === 'pending') {
            query += ` AND s.barcode IS NULL`;
        } else if (third === 'disabled') {
            query += ` AND s.status = 'N'`;
        }
    }


    if (second === 'entry') {
        if (third === 'in' || third === 'out') {
            query = `
                SELECT ${userCount === "Yes" ? 'DISTINCT' : ''} s.reg_no, s.name, s.mobile, s.school, s.program, s.sem, s.section, s.site, s.type, s.hostel, e.user_${third} AS user, e.date_time_${third} AS date_time
                FROM student_data s
                JOIN entry_data e ON s.reg_no = e.reg_no
                WHERE e.date_time_${third} BETWEEN '${startDate}' AND '${endDate}'
            `;

            if (first === 'FAC') {
                query = `
                    SELECT ${userCount === "Yes" ? 'DISTINCT' : ''} s.reg_no, s.name, s.site, s.email, s.mobile, e.user_${third} AS user, e.date_time_${third} AS date_time
                    FROM faculty_data s
                    JOIN entry_data e ON s.reg_no = e.reg_no
                    WHERE e.date_time_${third} BETWEEN '${startDate}' AND '${endDate}'
                `;
            }
        }

        if (third === 'both') {
            query = `
                SELECT ${userCount === "Yes" ? 'DISTINCT' : ''} s.reg_no, s.name, s.mobile, s.school, s.program, s.sem, s.section, s.site, s.type, s.hostel, e.user_in, e.date_time_in, e.user_out, e.date_time_out 
                FROM student_data s
                JOIN entry_data e ON s.reg_no = e.reg_no
                WHERE e.date_time_in BETWEEN '${startDate}' AND '${endDate}'
                OR e.date_time_out BETWEEN '${startDate}' AND '${endDate}'

            `;

            if (first === 'FAC') {
                query = `
                    SELECT ${userCount === "Yes" ? 'DISTINCT' : ''}  s.reg_no, s.name, s.site, s.email, s.mobile, e.user_in, e.date_time_in, e.user_out, e.date_time_out
                    FROM faculty_data s
                    JOIN entry_data e ON s.reg_no = e.reg_no
                    WHERE e.date_time_in BETWEEN '${startDate}' AND '${endDate}'
                    OR e.date_time_out BETWEEN '${startDate}' AND '${endDate}'
                `;
            }
        }

        if (third === 'outPending') {
                query = `
                    SELECT s.reg_no, s.name, s.mobile, s.school, s.program, s.sem, s.section, s.site, s.type, s.hostel, e.user_in AS user, e.date_time_in AS date_time
                    FROM student_data s
                    JOIN entry_data e ON s.reg_no = e.reg_no
                    WHERE e.date_time_in BETWEEN '${startDate}' AND '${endDate}' AND date_time_out IS NULL
                `;

            if (first === 'FAC') {
                query = `
                    SELECT s.reg_no, s.name, s.mobile, s.site, s.email, s.mobile, e.user_in AS user, e.date_time_in AS date_time
                    FROM faculty_data s
                    JOIN entry_data e ON s.reg_no = e.reg_no
                    WHERE e.date_time_in BETWEEN '${startDate}' AND '${endDate}' AND date_time_out IS NULL
                `;
            }
        }
    }


    if (site) {
        query += ` AND s.site = '${site}'`;
    }

    if (first === 'student' && type) {
        if (type === 'day') {
            query += ` AND s.type = 'Day Schollar'`;
        }
        if (type === 'cam_host') {
            query += ` AND s.hostel = 'PU'`;
        }
        if (type === 'oth_host') {
            query += ` AND s.hostel != 'PU' AND s.type = 'Hosteller'`;
        }
        if (type === 'lakshya') {
            query += ` AND s.type = 'Lakshya Hosteller'`;
        }
        if (type === 'transport') {
            query += ` AND s.type = 'Transport'`;
        }
    }

    if (regNo) {
        query += ` AND s.reg_no LIKE '%${regNo}%'`;
    }

    if (barcodeNo) {
        query += ` AND s.barcode LIKE '%${barcodeNo}%'`;
    }

    if (studentName) {
        query += ` AND s.name LIKE '%${studentName}%'`;
    }

    if (school && !Array.isArray(school)) {
        school = school.split(',').map(s => s.trim());
    }

    if (program && !Array.isArray(program)) {
        program = program.split(',').map(p => p.trim());
    }

    if (semester && !Array.isArray(semester)) {
        semester = semester.split(',').map(s => s.trim());
    }

    if (section && !Array.isArray(section)) {
        section = section.split(',').map(s => s.trim());
    }

    if (school && school.length > 0) {
        query += ` AND s.school IN ('${school.join("', '")}')`;
    }

    if (program && program.length > 0) {
        query += ` AND s.program IN ('${program.join("', '")}')`;
    }

    if (semester && semester.length > 0) {
        query += ` AND s.sem IN ('${semester.join("', '")}')`;
    }

    if (section && section.length > 0) {
        query += ` AND s.section IN ('${section.join("', '")}')`;
    }

    if (userCount === 'Yes') {
        query += ` ORDER BY s.reg_no`;
    }

    connection.query(query, (err, result) => {
        if (err) {
            console.error('Error executing query:', err);
            return res.status(500).json({ message: 'Error fetching data' });
        }

        const finalData = result.map(row => {
            const barcodeDetails = hiveBarcodes.find(b => b.barcode === row.barcode);
            if (barcodeDetails) {
                row.user = barcodeDetails.user;
                row.barcode_type = barcodeDetails.barcode_type;
            }
            return row;
        });

        res.json(finalData);
    });
});



module.exports = router;