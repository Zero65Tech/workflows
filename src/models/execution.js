const Joi = require('joi');

const taskRun = Joi.object({
  name: Joi.string().required(),
  scheduled: Joi.date().iso().required(),
  started: Joi.date().iso().required(),
  ended: Joi.date().iso().required(),
  response: Joi.string().required()
});

exports.add = Joi.object({
  versionId: Joi.string().required(),
  params: Joi.object().required(),
  scheduled: Joi.date().iso().allow(null).required(),
  count: Joi.number().integer().min(0).required(),
  tasks: Joi.array().items(taskRun).required(),
  state: Joi.string().valid('queued').required(),
  created: Joi.date().iso().required(),
  updated: Joi.date().iso().required()
});

exports.update = Joi.object({
  scheduled: Joi.date().iso(),
  count: Joi.number().integer().min(0),
  tasks: Joi.array().items(taskRun),
  state: Joi.string().valid('running', 'waiting', 'completed', 'failed', 'error'),
  updated: Joi.date().iso().required()
}).or('scheduled', 'tasks', 'state').required();
