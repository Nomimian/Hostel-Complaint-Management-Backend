const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema({
  registrationNo: { type: String, required: true }, // Student's Registration No
  title: { type: String, required: true }, // Complaint Title
  complaintId: { type: mongoose.Schema.Types.ObjectId, ref: "Complaint" },
  sendTo: { type: String, required: false, default: null }, // Recipient (e.g., Warden, RT)
  message: { type: String, required: false }, // Notification Message
  hostel: { type: String, required: false }, // Hostel Name
  reason: { type: String, required: false },
  status: { type: String, enum: ["new", "seen"], default: "new" }, // Mark Read/Unread
  date: { type: Date, default: Date.now }, // Timestamp
});

const Notification = mongoose.model("Notification", notificationSchema);

module.exports = Notification;
