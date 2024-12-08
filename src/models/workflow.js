const Joi = require('joi');

exports.add = Joi.object({
  name: Joi.string().required(),
  owner: Joi.string().required(),
  created: Joi.date().iso().required(),
  updated: Joi.date().iso().required()
}).required();
