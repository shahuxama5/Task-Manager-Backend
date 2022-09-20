const mongoose = require('mongoose');

mongoose.Promise = global.Promise;

mongoose.connect('mongodb://localhost:27017/TaskManager', {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
    console.log("Connected to MongoDB successfully :) ");
}).catch((err) => {
    console.log("Error while attempting to connect to MongoDB :( " + err);
});


module.exports = { mongoose }