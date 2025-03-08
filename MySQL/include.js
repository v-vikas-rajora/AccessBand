const express = require('express');
const mysql = require('mysql2');
const session = require('express-session');
const bcrypt = require('bcrypt');
const flash = require('connect-flash');

// Create MySQL connection (example)


module.exports = {
    express,
    mysql,
    session,
    bcrypt,
    flash // Export the MySQL connection here
};

