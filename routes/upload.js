const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { express, mysql, session, bcrypt, flash } = require('../MySQL/include');
const router = express.Router(); 

// Set up the request size limit (for base64 data)
router.use(express.json({ limit: '10mb' }));  // Increase the size limit for JSON requests
router.use(express.urlencoded({ extended: true, limit: '10mb' })); // Increase the size limit for form-data requests
// Allow larger form data requests

router.use(flash());


router.post('/upload/:id/:type', (req, res) => {
    let reg_no = req.params.id;
    if (reg_no === 'master') {
      let currentDate = new Date();
      let uniquePath = currentDate.getTime();
      reg_no = uniquePath.toString();
    } 
    
    let barcode_type = req.params.type;

    const storage = multer.diskStorage({
    destination: (req, file, cb) => {

    let destinationPath;
    if (barcode_type === 'faculty_data') {
      destinationPath = './public/staff-Images';
    } else if (barcode_type === 'student_data') {
      destinationPath = './public/Images';
    } else {
      destinationPath = './public/master-entry-Images';
    }

    fs.mkdir(destinationPath, { recursive: true }, (err) => {
        if (err) {
          console.error("Error creating directory:", err);
          return cb(err);
        }
        cb(null, destinationPath);
    });
      },
        filename: (req, file, cb) => {
          let reg_no_value = reg_no;
          console.log(reg_no);
          if (reg_no.includes('/') && reg_no.length > 8 && reg_no.length < 11) {
            reg_no_value = reg_no.split('/')[1];
          }

          const filename = `${reg_no_value}.jpg`;
          cb(null, filename);
      }
    });

    const upload = multer({ storage: storage }).single('image');

    upload(req, res, (err) => {
        if (err) {
          console.error("Error during file upload:", err);
          return res.status(500).json({ success: false, message: 'File upload failed', error: err });
        }

      console.log('Multer file upload completed');


      if (req.file) {
          const filepath = path.join(__dirname, 'uploads', req.file.filename);
          return res.json({ success: true, message: 'Image uploaded successfully!', path: reg_no});
      } else {
          return res.status(400).json({ success: false, message: 'No file uploaded' });
      }
    });
});




module.exports = router;

