const express = require("express");
const session = require('express-session');
const path = require("path");
const methodOverride = require('method-override');
const flash = require('connect-flash');
const dns = require('dns');

const port = 3000;
const app = express();
const fs = require('fs');  // fs module ko import karna

const https = require('https');

app.use(session({
    secret: 'secret',
    resave: false,
    saveUninitialized: true
}));


// const checkInternetConnection = (req, res, next) => {
//     dns.lookup('www.google.com', (err, address, family) => {
//         if (err) {
//             next()
//         } else {
//             res.status(500).send('Internet is ON. Kindly turn off your internet.');
//             return;
//         }
//     });
// };

// app.use(checkInternetConnection);


const options = {
    cert: fs.readFileSync('./MySQL/certificate.crt'),
    key: fs.readFileSync('./MySQL/private.key')
};

const privateKey = fs.readFileSync('./MySQL/certificate.crt', 'utf8');
const certificate = fs.readFileSync('./MySQL/private.key', 'utf8');
const credentials = { key: privateKey, cert: certificate };


app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "/views"));

app.use(express.static(path.join(__dirname, "/public")));

app.use(express.urlencoded({ extended: true }));
app.use(methodOverride('_method'));
app.use(flash());


app.get("/", (req, res) => {
    const alert_msg = req.flash('alert_msg');
    res.render("login.ejs", {alert_msg});
});


const loginRoute = require("./routes/login");
app.use('/login', loginRoute);


const userRoute = require("./routes/users");
app.use("/users", (req, res, next) => {
    res.locals.user_access_data = req.session.user;
    if (req.session && req.session.user) {
        if (res.locals.user_access_data.role === "SuperAdmin") {
            next();
        } else {
            res.redirect("/login/manage/user");
        }
    } else {
        res.redirect("/");
    }
});
app.use('/users', userRoute);


const bandRoute = require("./routes/band");
app.use("/band", (req, res, next) => {
    res.locals.user_access_data = req.session.user;
    if (req.session && req.session.user) {
        if (['Admin', 'SuperAdmin', 'User'].includes(res.locals.user_access_data.role)) {
            if (req.url === "/action/reg_no" && !['Admin', 'SuperAdmin'].includes(res.locals.user_access_data.role)) {
                res.redirect("/login/manage/user");
                return;
            }
            next();
        } else {
            res.redirect("/login/manage/user");
            return;
        }
    } else {
        res.redirect("/");
    }
});
app.use('/band', bandRoute);


const entryRoute = require("./routes/entry")
app.use("/entry", (req, res, next) => {
    res.locals.user_access_data = req.session.user;
    if (req.session && req.session.user) {
        next();
    } else {
        res.redirect("/");
    }
});
app.use('/entry', entryRoute);


const miscRoute = require("./routes/misc")
app.use("/misc", (req, res, next) => {
    res.locals.user_access_data = req.session.user;
    if (req.session && req.session.user) {
        if (['Admin', 'SuperAdmin'].includes(res.locals.user_access_data.role)) {
            next();
        } else {
            res.redirect("/login/manage/user");
        }
    } else {
        res.redirect("/");
    }
});
app.use('/misc', miscRoute);


const reportsRoute = require("./routes/reports")
app.use("/reports", (req, res, next) => {
    res.locals.user_access_data = req.session.user;
    if (req.session && req.session.user) {
        if (['Admin', 'SuperAdmin', 'User'].includes(res.locals.user_access_data.role)) {
            next();
        } else {
            res.redirect("/login/manage/user");
        }
    } else {
        res.redirect("/");
    }
});
app.use('/reports', reportsRoute);


const uploadRoute = require("./routes/upload")
app.use("/student/photo", (req, res, next) => {
    res.locals.user_access_data = req.session.user;
    if (req.session && req.session.user) {
        if (['Admin', 'SuperAdmin', 'User', 'InUser'].includes(res.locals.user_access_data.role)) {
            next();
        } else {
            res.redirect("/login/manage/user");
        }
    } else {
        res.redirect("/");
    }
});
app.use('/student/photo', uploadRoute);


// const IP = '10.11.21.40'

// https.createServer(options, app).listen(port, IP, () => {
//     console.log(`Secure app is listening on https://${IP}:${port}`);
// });

app.listen(port, () => {
    console.log('app is listen on port 3000');
});


