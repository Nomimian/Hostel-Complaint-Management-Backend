const mongoose = require('mongoose');

const HostelSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  rooms: {
    type: Number,
    required: true, // make it optional if you're not adding room count for every hostel
    default: 0      // optional: default value
  }
});

const Hostel = mongoose.model("Hostel", HostelSchema);

module.exports = Hostel;
