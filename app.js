const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const { mongoose } = require('./database/mongoose');
const { List, Task, User } = require('./models/index');
const jwt = require('jsonwebtoken');

app.use(bodyParser.json());

app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "Get, POST, HEAD, OPTIONS, PUT, PATCH, DELETE");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");

    res.header('Access-Control-Expose-Headers', 'x-access-token, x-refresh-token')

    next();
});

let authenticated = (req, res, next) => {
    let token = req.header('x-access-token');
    jwt.verify(token, User.getJWTSecret(), (err, decoded) => {
        if (err) {
            res.status(401).send(err);
        }
        else {
            req.user_id = decoded._id;
            next();
        }
    })
}

let verifySession = (req, res, next) => {
    let refreshToken = req.header('x-refresh-token');
    let _id = req.header('_id');

    User.findByIdAndToken(_id, refreshToken).then((user) => {
        if (!user) {
            return Promise.reject({
                'error': 'User not found. Make sure that the refresh token and user id are correct.'
            })
        }

        req.user_id = user._id;
        req.refreshToken = refreshToken;
        req.userObject = user;

        let isSessionValid = false;

        user.sessions.forEach((session) => {
            if (session.token === refreshToken) {
                if (User.hasRefreshTokenExpired(session.expiresAt) === false) {
                    isSessionValid = true;
                }
            }
        })
        if (isSessionValid) {
            next();
        }
        else {
            return Promise.reject({
                'error': 'Refresh token has expired or the session is invalid.'
            })
        }
    }).catch((err) => {
        res.status(401).send(err);
    })
}

app.get('/lists', authenticated, (req, res) => {
    List.find({
        // _userId: req.user_id
    }).then((lists) => {
        res.send(lists);
    }).catch((e) => {
        res.send(e);
    })
});

app.post('/lists', authenticated,  (req, res) => {
    let title = req.body.title;
    let _userId = req.user_id;

    let newList = new List({ title, _userId });
    newList.save().then((listDoc) => {
        res.send(listDoc);
    });
});

app.patch('/lists/:id', authenticated, (req, res) => {
    List.findOneAndUpdate({ _id: req.params.id, _userId: req.user_id },
        { $set: req.body}).then(() => {
        res.sendStatus(200);
    });
});

app.delete('/lists/:id', authenticated, (req, res) => {
    List.findOneAndRemove({ _id: req.params.id, _userId: req.user_id })
    .then((removedListDoc) => {
        res.send(removedListDoc);
        deleteTasksFromList(removedListDoc._id);
    });
});

app.get('/lists/:listId/tasks', authenticated, (req, res) => {
    Task.find({ _listId: req.params.listId }).then((tasks) => {
        res.send(tasks);
    });
});

app.post('/lists/:listId/tasks', authenticated, (req, res) => {

    List.findOne({
        _id: req.params.listId,
        _userId: req.user_id
    }).then((user) => {
        if (user) {
            return true;
        }
        else {
            return false;
        }
    }).then((canCreateTasks) => {
        if (canCreateTasks) {
            let title = req.body.title;
            let _listId = req.params.listId;
            let newTask = new Task({
                title,
                _listId
            });
            newTask.save().then((newTaskDoc) => {
            res.send(newTaskDoc);
        });
        }
        else {
            res.sendStatus(404);
        }
    })  
});

app.patch('/lists/:listId/tasks/:taskId', authenticated, (req, res) => {

    List.findOne({
        _id: req.params.listId,
        _userId: req.user_id
    }).then((list) => {
        if (list) {
            return true;
        }
        else {
            return false;
        }
    }).then((canUpdateTasks) => {
        if (canUpdateTasks) {
            Task.findOneAndUpdate({ _id: req.params.taskId, _listId: req.params.listId },
                { $set: req.body}).then(() => {
                res.send({message: 'Updated Successfully.'});
            });
        }
        else {
            res.sendStatus(404);
        }
    })  
});

app.delete('/lists/:listId/tasks/:taskId', authenticated, (req, res) => {

    List.findOne({
        _id: req.params.listId,
        _userId: req.user_id
    }).then((list) => {
        if (list) {
            return true;
        }
        else {
            return false;
        }
    }).then((canDeleteTasks) => {
        if (canDeleteTasks) {
            Task.findOneAndRemove({ _id: req.params.taskId, _listId: req.params.listId })
            .then((removedTaskDoc) => {
                res.send(removedTaskDoc);
            });
        }
        else {
            res.sendStatus(404);
        }
    }) 
});

app.post('/users', (req, res) => {
    let body = req.body;
    let newUser = new User(body);
    newUser.save().then(() => {
        return newUser.createSession();
    }).then((refreshToken) => {
        return newUser.generateAccessAuthToken().then((accessToken) => {
            return {accessToken, refreshToken}
        });
    }).then((authToken) => {
        res
            .header('x-refresh-token', authToken.refreshToken)
            .header('x-access-token', authToken.accessToken)
            .send(newUser);
    }).catch((err) => {
        res.status(400).send(err);
    })
})

app.post('/users/login', (req, res) => {
    let email = req.body.email;
    let password = req.body.password;

    User.findByCredentials(email, password).then((user) => {
        return user.createSession().then((refreshToken) => {
            return user.generateAccessAuthToken().then((accessToken) => {
                return {accessToken, refreshToken}
            });
        }).then((authToken) => {
            res
                .header('x-refresh-token', authToken.refreshToken)
                .header('x-access-token', authToken.accessToken)
                .send(user);
        })
    }).catch((err) => {
        res.status(400).send(err);
    })
})

app.get('/users/me/access-token', verifySession, (req, res) => {
    req.userObject.generateAccessAuthToken().then((accessToken) => {
        res.header('x-access-token', accessToken).send({ accessToken });
    }).catch((err) => {
        res.status(400).send(err);
    })
})

let deleteTasksFromList = (_listId) => {
    Task.deleteMany({
        _listId
    }).then(() => {
        console.log("Tasks from list : " + _listId + " are deleted.");
    })

}

app.listen(3000, () => {
    console.log('server is running on port 3000')
})