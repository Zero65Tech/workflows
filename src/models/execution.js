const Joi = require('joi');

const nextField = Joi.object({
  step: Joi.string().required(),
  retry: Joi.integer().required(),
  scheduled: Joi.date().iso().required(),
});

const runsFiled = Joi.array().items(Joi.object({
  step: Joi.string().required(),
  retry: Joi.integer().required(),
  scheduled: Joi.date().iso().required(),
  task: Joi.string().required(),
  started: Joi.date().iso().required(),
  ended: Joi.date().iso().required(),
  response: Joi.string().required()
}));

exports.add = Joi.object({
  versionId: Joi.string().required(),
  params: Joi.object().required(),
  next: nextField.required(),
  runs: runsFiled.required(),
  state: Joi.string().valid('waiting').required(),
  created: Joi.date().iso().required(),
  updated: Joi.date().iso().required()
}).required();

exports.update = Joi.object({
  next: nextField,
  runs: runsFiled,
  state: Joi.string().valid('running', 'waiting', 'completed', 'failed'),
  updated: Joi.date().iso().required()
}).or('next', 'runs', 'state').required();
