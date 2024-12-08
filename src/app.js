const express = require('express');

const app = express();
app.use(express.json());

app.use('/', require('./routes'));
app.use('/entity', require('./routes/workflow'));

module.exports = app;
