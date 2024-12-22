const Joi = require('joi');

exports.add = Joi.object({
  name: Joi.string().allow(null).required(),
  params: Joi.string().required(),
  steps: Joi.string().required(),
  checksum: Joi.string().required(),
  created: Joi.date().iso().required(),
  updated: Joi.date().iso().required()
}).required();

exports.update = Joi.object({
  name: Joi.string().allow(null).required(),
  params: Joi.string().required(),
  steps: Joi.string().required(),
  updated: Joi.date().iso().required()
}).required();
