const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, required: true },
    type: { type: String, required: false },
    regno: { type: String, required: true, unique: true }, // Ensure regno is unique
    hostel: { type: String, required: true },
    campus: { type: String, required: true }, // Added campus field
}, { timestamps: true });

const User = mongoose.model('User', userSchema);

module.exports = User;
