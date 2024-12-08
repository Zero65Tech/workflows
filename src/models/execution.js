const Joi = require('joi');

exports.add = Joi.object({
  workflowId: Joi.string().required(),
  step: Joi.string().required(),
  task: Joi.string().required(),
  state: Joi.string().valid('queued', 'in_progress', 'error').required(),
  created: Joi.date().iso().required(),
  updated: Joi.date().iso().required()
}).required();

exports.update = Joi.object({
  state: Joi.string(),
  updated: Joi.date().iso().required()
}).required();
