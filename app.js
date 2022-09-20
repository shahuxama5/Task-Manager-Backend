const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const { mongoose } = require('./database/mongoose');
const { List, Task } = require('./models/index');

app.use(bodyParser.json());

app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "Get, POST, HEAD, OPTIONS, PUT, PATCH, DELETE");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});

app.get('/lists', (req, res) => {
    List.find({}).then((list) => {
        res.send(list);
    });
});

app.post('/lists', (req, res) => {
    let title = req.body.title;
    let newList = new List({
        title
    });
    newList.save().then((listDoc) => {
        res.send(listDoc);
    });
});

app.patch('/lists/:id', (req, res) => {
    List.findOneAndUpdate({ _id: req.params.id }, { $set: req.body}).then(() => {
        res.sendStatus(200);
    });
});

app.delete('/lists/:id', (req, res) => {
    List.findOneAndRemove({ _id: req.params.id }).then((removedListDoc) => {
        res.send(removedListDoc);
    });
});

app.get('/lists/:listId/tasks', (req, res) => {
    Task.find({ _listId: req.params.listId }).then((tasks) => {
        res.send(tasks);
    });
});

app.post('/lists/:listId/tasks', (req, res) => {
    let title = req.body.title;
    let _listId = req.params.listId;
    let newTask = new Task({
        title,
        _listId
    });
    newTask.save().then((newTaskDoc) => {
        res.send(newTaskDoc);
    });
});

app.patch('/lists/:listId/tasks/:taskId', (req, res) => {
    Task.findOneAndUpdate({ _id: req.params.taskId, _listId: req.params.listId }, { $set: req.body}).then(() => {
        res.send({message: 'Updated Successfully.'});
    });
});

app.delete('/lists/:listId/tasks/:taskId', (req, res) => {
    Task.findOneAndRemove({ _id: req.params.taskId, _listId: req.params.listId }).then((removedTaskDoc) => {
        res.send(removedTaskDoc);
    });
});

app.listen(3000, () => {
    console.log('server is running on port 3000')
})