require('dotenv').config();
const mongoose = require('mongoose');
const Campaign = require('../models/campaign.model');
const User = require('../models/user.model');
const passport = require('passport');
const ApiError = require('../models/api-error.model');
const latch = require('latch-sdk');


module.exports.create = (req, res, next) => {
  console.log(`body: ${JSON.stringify(req.body)}`);
  User.findOne({
      email: req.body.email
    })
    .then(user => {
      if (user != null) {
        res.json({
          message: 'User already exists'
        });
      } else {
        const newUser = new User(req.body);

        if (req.file) {
          newUser.image = req.file.secure_url;
        }

        newUser.save()
          .then((userCreated) => {
            res.status(201).json(userCreated);
          }).catch(error => {
            if (error instanceof mongoose.Error.ValidationError) {
              console.log(error);
              next(new ApiError(error.errors));
            } else {
              next(new ApiError(error.message, 500));
            }
          });
      }
    }).catch(error => next(new ApiError(error.message, 500)));
}


module.exports.list = (req, res, next) => {
  User.find()
    .then((users) => res.status(201).json(users))
    .catch(error => next(new ApiError(error.message)))
}

module.exports.get = (req, res, next) => {
  const id = req.params.id;
  User.findById(id)
    .populate('campaignsBacked').populate('campaignsCreated').populate('campaignsFollowed')
    .then(user => {
      if (user) {
        res.status(201).json(user)
    
      } else {
        next(new ApiError("User not found", 404));
      }
    }).catch(error => next(error));
}

module.exports.edit = (req, res, next) => {
  const id = req.params.id;
  User.findByIdAndUpdate(id, {
      $set: req.body
    }, {
      new: true
    })
    .then(user => {
      if (user) {
        res.status(201).json(user)
      } else {
        next(new ApiError("User not found", 404));
      }
    }).catch(error => {
      if (error instanceof mongoose.Error.ValidationError) {
        next(new ApiError(error.message));
      } else {
        (new ApiError(error.message, 500));
      }
    })
}

module.exports.changePassword = (req, res, next) => {
  const id = req.params.id;
  User.findById(id, function (err, user) {
    if (user) {
      user.save({
          id,
          password: req.body.password
        })
        .then((userPasswordUpdated) => {
          res.status(201).json(userPasswordUpdated);
        }).catch(error => {
          if (error instanceof mongoose.Error.ValidationError) {
            console.log(error);
            next(new ApiError(error.errors));
          } else {
            next(new ApiError(error.message, 500));
          }
        });
    }
  }).catch(error => next(error));
}


module.exports.delete = (req, res, next) => {
  const id = req.params.id;
  User.findByIdAndRemove(id)
    .then(user => {
      if (user) {
        res.status(204).json()
      } else {
        next(new ApiError("User not found", 404));
      }
    }).catch(error => new ApiError(error.message, 500));
}

module.exports.pairLatch = (req, res, next) => {
  var pairResponse = latch.pair(req.body.code, function (err, data) {
    console.log(data)
    if (data["data"]["accountId"]) {
      User.findByIdAndUpdate(req.user.id, {
          $set: {
            latchId: data['data']['accountId'],
            paired: true
          }
        })
        .then((usersaved) => {
          res.status(204).json()
        }).catch(error => {
          next(new ApiError("User not found", 404))
        })
    } else if (data["error"]) {
      var message = "There has been an error with Latch, try again";
      res.render("setup", {
        user: req.user,
        message: message,
        accountId: ""
      });
    }
  });
}

module.exports.unpairLatch = (req, res, next) => {
  const id = req.params.id;

  User.findById(id)
    .then(user => {
      if (user) {
        const unpair = latch.unpair(user.latchId, () => {
          console.log('account unpaired');
          User.findByIdAndUpdate(id, {
              $set: {
                latchId: '',
                paired: false
              }
            })
            .then((user) => {
              if (user) {
                res.status(204).json(user);
              } else {
                next(new ApiError('User not found', 404));
              }
            })
            .catch(error => {
              if (error instanceof mongoose.Error.ValidationError) {
                next(new ApiError(error.message, 400, error.errors));
              } else {
                next(new ApiError(error.message, 500));
              }
            });
        });
      } else {
        next(new ApiError('User not found', 404));
      }
    })
    .catch(error => next(error));
}
