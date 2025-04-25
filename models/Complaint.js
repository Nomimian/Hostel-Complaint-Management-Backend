const mongoose = require('mongoose');

const complaintSchema = new mongoose.Schema({
  title: String,
  registrationNo: String,
  roomNo: String,
  date: Date,
  description: String,
  hostel: String,
  submittedBy: String, 
  filePath: String,    
  assignedTo: { 
    type: String, 
    enum: ["Electrician", "Plumber", "Carpenter", "Other"],
    default: "Other",
  },
  status: { 
    type: String, 
    enum: ["Student", "RT", "Warden", "Munshi", "End User", "Done", "Rejected"],
    default: "Student" 
  }, 
  reason: {
    type: String,
    default: null
  },
  priority: {
    type: String,
    enum: ['Slow', 'Normal', 'Urgent'], // or any values you use
    default: 'Slow'
  }
});

const Complaint = mongoose.model("Complaint", complaintSchema);

module.exports = Complaint;
