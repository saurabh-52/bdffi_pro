## 🛠 Tech Stack
* **Frontend:** React.js
* **Backend:** Node.js, Express.js
* **Database:** MySQL
* **AI Integration:** OpenAI GPT-4o Vision API (or Google Cloud Vision) for OCR
* **Messaging:** Meta WhatsApp Cloud API (or Twilio)

---

## 🏗 System Workflow & Architecture

### Phase 1: Database Design (MySQL)
The system uses a relational database to track students, requests, and communication logs.

* **`students`**: `id`, `name`, `admission_no`, `phone_no`, `blood_group`, `last_donation_date`, `status`
* **`donation_requests`**: `id`, `patient_name`, `hospital_name`, `required_blood_group`, `contact_no`, `status` (Pending/Fulfilled)
* **`notification_logs`**: `id`, `request_id`, `student_id`, `status` (Sent/Accepted/Declined)

### Phase 2: Backend Core & Text Extraction (Node.js)
Handles incoming requests and processes medical forms.
1. Receives requisition form images via `multer`.
2. Sends the image to the Vision API to extract structured JSON data (Patient Name, Blood Group, Hospital, Mobile).
3. Saves the parsed requisition data into the `donation_requests` table.

### Phase 3: Filtering & WhatsApp Automation
Automates the matching and notification process.
1. **Filtering:** Queries the database for students matching the required blood group who haven't donated in the last 90 days.
   ```sql
   SELECT * FROM students 
   WHERE blood_group = ? 
   AND (last_donation_date IS NULL OR last_donation_date < DATE_SUB(NOW(), INTERVAL 90 DAY))
   LIMIT 10;
   2. **Outreach:** Sends an automated WhatsApp template message with the case details to the matched students using the WhatsApp Cloud API.
3. **Webhooks:** Listens for interactive button replies ("Yes, I can donate" / "No"). If a student clicks "Yes", the database updates and the NGO/patient is notified.

### Phase 4: Frontend Interface (React)
Provides a clean UI for NGO operators and patients.
* **Request Form:** A public-facing page where patients or NGO members can upload the medical requisition form.
* **Verification Screen:** Displays the auto-extracted data for human verification before triggering the WhatsApp messages.
* **Operator Dashboard:** A real-time view of incoming requests, matched students, and live notification statuses.

### Phase 5: Security & Deployment
* **Security:** JWT-based authentication for the NGO admin dashboard.
* **Deployment:** 
  * Backend deployed via PM2/Nginx.
  * Frontend hosted on Vercel/Netlify or served statically.
  * Webhooks securely exposed over HTTPS.

---

## 🚀 Getting Started (Development)

### Prerequisites
* Node.js (v16+)
* MySQL Server
* WhatsApp Cloud API Developer Account
* OpenAI / Google Cloud Vision API Key