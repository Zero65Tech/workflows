const Joi = require('joi');

const nextField = Joi.object({
  step: Joi.string().required(),
  scheduled: Joi.date().iso().required(),
});

const tasksField = Joi.array().items(Joi.object({
  step: Joi.string().required(),
  task: Joi.string().required(),
  scheduled: Joi.date().iso().required(),
  started: Joi.date().iso().required(),
  ended: Joi.date().iso().required(),
  response: Joi.string().required()
}));

exports.add = Joi.object({
  versionId: Joi.string().required(),
  params: Joi.object().required(),
  next: nextField.required(),
  count: Joi.number().integer().min(0).required(),
  tasks: tasksField.required(),
  state: Joi.string().valid('queued').required(),
  created: Joi.date().iso().required(),
  updated: Joi.date().iso().required()
}).required();

exports.update = Joi.object({
  next: nextField,
  count: Joi.number().integer().min(0).required(),
  tasks: tasksField,
  state: Joi.string().valid('running', 'waiting', 'completed', 'failed'),
  updated: Joi.date().iso().required()
}).or('next', 'tasks', 'state').required();
