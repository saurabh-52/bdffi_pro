# 🩸 Fast Forward India - Blood Donation Automation System

## 📖 Overview
This project is an automated blood donation requisition and matching system built for **Fast Forward India (NGO)**. It streamlines the process of finding blood donors by extracting patient details from medical forms using AI, matching them with eligible student donors from a database, and automating outreach via WhatsApp.

## 🛠 Tech Stack
* **Frontend:** React.js
* **Backend:** Node.js, Express.js
* **Database:** MySQL
* **AI Integration:** OpenAI GPT-4o Vision API (or Google Cloud Vision) for OCR
* **Messaging:** Meta WhatsApp Cloud API (or Twilio)


## ⚙️ Installation & Setup

Follow these steps to set up both the backend and frontend services locally.

### 1. Clone the repository
```bash
git clone https://github.com/yourusername/ffi-blood-donation.git
cd ffi-blood-donation
```

### 2. Set Up the Backend
1. Navigate to the backend directory and install dependencies:
   ```bash
   cd backend
   npm install
   ```
2. Create and configure your environment file:
   Copy `.env.example` to `.env` inside the `backend` folder and populate it with your local credentials.
   ```ini
   DB_HOST=127.0.0.1
   DB_USER=root
   DB_PASSWORD=your_database_password
   DB_NAME=bdffi

   # Super-manager credentials used to seed the manager account
   SUPER_MANAGER_NAME=Fast Forward India Super Manager
   SUPER_MANAGER_EMAIL=manager@fastforwardindia.org
   SUPER_MANAGER_PASSWORD=your_super_manager_password

   # Meta WhatsApp Cloud API configuration
   META_WHATSAPP_ACCESS_TOKEN=your_meta_whatsapp_access_token
   META_WHATSAPP_PHONE_NUMBER_ID=your_meta_whatsapp_phone_number_id
   META_WHATSAPP_API_VERSION=v25.0
   META_WHATSAPP_VERIFY_TOKEN=bdffi_meta_webhook_verify_token
   META_WHATSAPP_TEMPLATE_NAME=blood_donation_request_
   META_WHATSAPP_TEMPLATE_LANGUAGE=en  # Use 'en' or 'en_US' depending on template locale in Meta Manager
   ```

### 3. Initialize the Database
Run migrations and seed the database using Knex:
```bash
# Create database (if not exists)
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS bdffi;"

# Run schema migrations
npx knex --knexfile knexfile.js migrate:latest

# Populate database with seeds
npx knex --knexfile knexfile.js seed:run
```
> [!NOTE]
> The database migration seeds a default manager account:
> - **Email:** `manager@fastforwardindia.org`
> - **Password:** (Set in `SUPER_MANAGER_PASSWORD` or defaults to `FFI-Manager-1234`)

### 4. Start the Services
* **Backend Dev Server** (Runs on port `3001`):
  ```bash
  cd backend
  npm run dev
  ```
* **Frontend Dev Server** (Runs on port `5173` via Vite):
  ```bash
  cd ../frontend
  npm install
  npm run dev
  ```

---

## 📲 Meta WhatsApp Business API Integration

### 1. Template Creation in Meta WhatsApp Manager
Create a template matching the following details in your WhatsApp Business account:
- **Template Name:** `blood_donation_request_`
- **Category:** Utility or Marketing (depending on your setup)
- **Language:** English (`en`) or English (US) (`en_US`)
- **Body Content:**
  ```text
  Hello {{1}}, 

  There is an urgent request for *{{2}}* blood group for patient *{{3}}* at *{{4}}*. 

  As an eligible donor in our system, your support is highly valued. Please select *YES* below if you are available to donate.

  *All of your expenses during this process will be completely covered by us, and it will take no more than an hour of your time.*

  _Regards_,
  Fast Forward India
  Official student NGO, IIT Dhanbad
  ```
- **Variables Mapping:**
  - `{{1}}`: Donor's name
  - `{{2}}`: Required blood group
  - `{{3}}`: Patient's name
  - `{{4}}`: Hospital name / Location
- **Interactive Buttons:** Add a quick reply button labeled `YES` (and optionally `NO`).

> [!WARNING]
> Meta is strict on translation locales. If your template is created with language "English" (code `en`) but you request `en_US` in the API, it will fail with `(#132001) Template name does not exist in the translation`. Make sure `META_WHATSAPP_TEMPLATE_LANGUAGE` in your `.env` matches the code configured in the Meta Manager exactly.

### 2. Local Webhook Testing (ngrok Setup)
Meta requires a secure public URL to deliver incoming message events. You can use `ngrok` to expose your local port `3001`:

1. Expose backend port `3001`:
   ```bash
   .\ngrok config add-authtoken AUTH_TOKEN
   .\ngrok http 3001
   ```
2. Copy the generated HTTPS forwarding URL (e.g. `https://xxxx.ngrok-free.app`).
3. In the Meta Developer Console, go to **WhatsApp > Configuration**:
   - **Callback URL:** `https://xxxx.ngrok-free.app/api/meta/whatsapp/webhook`
   - **Verify Token:** Use the string set in `META_WHATSAPP_VERIFY_TOKEN` (e.g. `bdffi_meta_webhook_verify_token`).
   - Click **Verify and Save**.
4. **Subscribe to Webhook Fields:** Under the Webhooks section, click **Manage** next to webhook fields and **Subscribe** to **`messages`** (this is crucial for receiving yes/no replies from donors).

---

## 🤝 Contributing
Contributions are welcome! Please open an issue or submit a pull request if you have suggestions to improve the system.
