const express = require('express');
const mysql = require('mysql2');
const session = require('express-session');
const flash = require('connect-flash');

// Create MySQL connection (example)


module.exports = {
    express,
    mysql,
    session,
    flash // Export the MySQL connection here
};

