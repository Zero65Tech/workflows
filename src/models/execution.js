const Joi = require('joi');

exports.add = Joi.object({
  refId: Joi.string().required(),
  params: Joi.object().required(),
  versionId: Joi.string().required(),
  next: Joi.object({
    step: Joi.string().required(),
    retry: Joi.integer().required(),
    scheduled: Joi.date().iso().required(),
  }).required(),
  runs: Joi.array().items(Joi.object({
    step: Joi.string().required(),
    retry: Joi.integer().required(),
    scheduled: Joi.date().iso().required(),
    task: Joi.string().required(),
    started: Joi.date().iso().required(),
    ended: Joi.date().iso().required(),
    response: Joi.string().required()
  }).required()).required(),
  state: Joi.string().valid('queued').required(),
  created: Joi.date().iso().required(),
  updated: Joi.date().iso().required()
}).required();

exports.update = Joi.object({
  next: Joi.object({
    step: Joi.string().required(),
    retry: Joi.integer().required(),
    scheduled: Joi.date().iso().required(),
  }),
  runs: Joi.array().items(Joi.object({
    step: Joi.string().required(),
    retry: Joi.integer().required(),
    scheduled: Joi.date().iso().required(),
    task: Joi.string().required(),
    started: Joi.date().iso().required(),
    ended: Joi.date().iso().required(),
    response: Joi.string().required()
  }).required()),
  state: Joi.string().valid('running', 'waiting', 'success', 'error'),
  updated: Joi.date().iso().required()
}).or('next', 'runs', 'state').required();
