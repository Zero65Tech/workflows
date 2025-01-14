const Joi = require('joi');

const taskRun = Joi.object({
  name: Joi.string().required(),
  scheduled: Joi.date().iso().required(),
  started: Joi.date().iso().required(),
  ended: Joi.date().iso().allow(null).required(),
  response: Joi.object({
    status: Joi.number().integer().required(),
    data: Joi.string().required()
  }).allow(null).required()
}).required();

exports.add = Joi.object({
  versionId: Joi.string().required(),
  params: Joi.object().required(),
  scheduled: Joi.date().iso().required(),
  count: Joi.number().valid(0).required(),
  tasks: Joi.array().length(0).required(),
  state: Joi.string().valid('queued').required(),
  created: Joi.date().iso().required(),
  updated: Joi.date().iso().required()
}).required();

exports.update = Joi.object({
  scheduled: Joi.date().iso().allow(null),
  count: Joi.number().integer().min(1),
  tasks: Joi.array().items(taskRun),
  state: Joi.string().valid('running', 'waiting', 'completed', 'failed', 'error'),
  updated: Joi.date().iso().required()
}).or('scheduled', 'count', 'tasks', 'state').required();
