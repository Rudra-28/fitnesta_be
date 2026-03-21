const Joi = require('joi');

const personalTutorSchema = Joi.object({
    tutor_details: Joi.object({
        participant_name: Joi.string().min(3).max(100).required(),
        address: Joi.string().required(),
        dob: Joi.date().iso().required(),
        standard: Joi.string().required(),
        batch: Joi.string().required(),
        contact_number: Joi.string().pattern(/^[0-9]{10}$/).required()
            .messages({ 'string.pattern.base': 'Mobile number must be 10 digits.' }),
        teacher_for: Joi.string().required()
    }).required(),

    // These act as the "Gatekeepers" you mentioned
    consent_given: Joi.boolean().valid(true).required()
        .messages({ 'any.only': 'You must provide parent consent.' }),
    payment_confirmed: Joi.boolean().valid(true).required()
        .messages({ 'any.only': 'Payment must be confirmed before registration.' }),
    
    transaction_id: Joi.string().required(),
    society_name: Joi.string().allow(null, '') // Optional for personal tutor
});

const validatePersonalTutor = (req, res, next) => {
    const { error } = personalTutorSchema.validate(req.body, { abortEarly: false });
    
    if (error) {
        return res.status(400).json({
            success: false,
            errors: error.details.map(err => err.message)
        });
    }
    next();
};

module.exports = { validatePersonalTutor };