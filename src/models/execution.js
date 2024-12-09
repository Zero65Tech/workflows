const Joi = require('joi');

exports.add = Joi.object({
  versionId: Joi.string().required(),
  nextRun: Joi.date().iso().required(),
  created: Joi.date().iso().required(),
  updated: Joi.date().iso().required()
}).required();

exports.update = Joi.object({
  nextRun: Joi.date().iso().required(),
  updated: Joi.date().iso().required()
}).required();
