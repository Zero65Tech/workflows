const Joi = require('joi');

exports.add = Joi.object({
  name: Joi.string(),
  steps: Joi.string().required(),
  checksum: Joi.string().required(),
  created: Joi.date().iso().required(),
  updated: Joi.date().iso().required()
});