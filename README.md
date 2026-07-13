# 🩸 Fast Forward India - Blood Donation Automation System

An automated, real-time blood donation matching and outreach portal built for **Fast Forward India (NGO), IIT (ISM) Dhanbad**. This platform streamlines blood drive coordination by matching patient requirements with eligible student donors from local databases, sending templates via WhatsApp, tracking responses, and providing comprehensive auditing for managers.

---

## ✨ Features

### 📋 Volunteer & Operator Dashboard
- **Operator Dashboard**: View live outreach activity feed and blood pool stats.
- **Intake Form**: Form to input case details manually or upload medical requisitions.
- **Recent Requests**: Historical and live listings of blood cases matched with status pills (Pending, Active, Fulfilled).

### 👥 Donor & Roster Management
- **Roster Controls**: Search student donors by name or roll number, and filter by blood group.
- **Excel Sync**: Seamlessly import new excel roster sheets or export the current filtered database back to XLSX.
- **Outreach Cooldowns**: Enforces a strict 3-month eligibility cooldown to prevent donor fatigue.
- **Block Filters**: Exclude entire cohorts dynamically from outreach campaigns using admission roll prefixes (e.g., `24je`) or academic programmes (e.g., `B.Tech`).

### 📲 WhatsApp Outreach & Admin Console
- **Direct Outreach**: Send template outreach messages to eligible matching donors.
- **Admin Console**: Real-time webhook monitor showing sent messages, deliveries, replies, and error logs.
- **Error Recovery**: Manual button trigger to retry failed alerts or resend updates.

### 🔒 Access Control & Auditing
- **Multi-Tier Portals**: Separate dashboards for general Volunteers and primary Managers.
- **Manager Tools**: Super-admins can promote volunteers, deactivate accounts, and demote managers.
- **Manager Audit Log**: Independent tracking of administrative operations (roster imports/deletions, setting updates) for auditing.

---

## 🛠 Tech Stack

- **Frontend**: React 18, Vite, Vanilla CSS
- **Backend**: Node.js, Express.js
- **Database**: MySQL, Knex.js
- **Integrations**: Meta WhatsApp Cloud API, xlsx (SheetJS)

---

## 📂 Project Structure

```text
bdffi/
├── backend/                  # Node.js + Express backend service
│   ├── config/               # System configurations (WhatsApp credentials loader)
│   ├── controllers/          # Business logic endpoint handlers (Donors, Webhooks, Users)
│   ├── db/                   # Knex SQL initialization and automatic schema check hooks
│   ├── models/               # File store backups and cohort filtering algorithms
│   ├── routes/               # Express routing branch maps
│   ├── utils/                # Messaging wrappers (WhatsApp API, Nodemailer mail client)
│   ├── index.js              # Main Express startup entry point
│   └── knexfile.js           # SQL connectivity settings
├── frontend/                 # React + Vite frontend application
│   ├── src/
│   │   ├── components/       # Component-based UI layout
│   │   │   ├── modals/       # Popups (WhatsAppAdmin, BlockFilters, AlertModal, etc.)
│   │   │   ├── views/        # Tab pages (Dashboard, Donors, Logs, Login portals)
│   │   │   ├── BloodBadge.jsx
│   │   │   ├── RequestItem.jsx
│   │   │   └── ...
│   │   ├── utils/            # Helper files
│   │   │   ├── api.js        # Backend API wrappers
│   │   │   ├── constants.js  # Global lists and mock databases
│   │   │   └── helpers.js    # Data normalizers and dates formats
│   │   ├── App.jsx           # App state container and shell
│   │   ├── main.jsx
│   │   └── styles.css        # Vanilla CSS styling rules
│   └── package.json
└── README.md
```

---

## ⚙️ Installation & Setup

### 1. Set Up the Backend
1. Install backend dependencies:
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
   META_WHATSAPP_TEMPLATE_LANGUAGE=en
   ```

### 2. Initialize the Database
Run migrations and seed the database using Knex:
```bash
# Create database
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS bdffi;"

# Run schema migrations and seeds
npx knex --knexfile knexfile.js migrate:latest
npx knex --knexfile knexfile.js seed:run
```
> [!NOTE]
> The database migration seeds a default manager account:
> - **Email**: `manager@fastforwardindia.org`
> - **Password**: Set in `SUPER_MANAGER_PASSWORD` or defaults to `FFI-Manager-1234`.

### 3. Run Locally
- **Backend Service** (Runs on port `3001`):
  ```bash
  cd backend
  npm run dev
  ```
- **Frontend Service** (Runs on port `5173` via Vite):
  ```bash
  cd frontend
  npm run dev
  ```

---

## 📲 Meta WhatsApp Business API Integration

### 1. Template Setup
Create a template matching the following details in your WhatsApp Business account:
- **Template Name**: `blood_donation_request_`
- **Body Content**:
  ```text
  Hello {{1}}, 

  There is an urgent request for *{{2}}* blood group for patient *{{3}}* at *{{4}}*. 

  As an eligible donor in our system, your support is highly valued. Please select *YES* below if you are available to donate.

  *All of your expenses during this process will be completely covered by us, and it will take no more than an hour of your time.*

  _Regards_,
  Fast Forward India
  Official student NGO, IIT Dhanbad
  ```
- **Variables Mapping**:
  - `{{1}}`: Donor's name
  - `{{2}}`: Required blood group
  - `{{3}}`: Patient's name
  - `{{4}}`: Hospital name / Location
- **Interactive Buttons**: Add a quick reply button labeled `YES` (and optionally `NO`).

### 2. Callback URL Integration
WhatsApp incoming events (like yes/no responses) require a public webhook endpoint:
1. Expose backend port `3001` using ngrok:
   ```bash
   ngrok http 3001
   ```
2. Copy the secure public HTTPS forwarding URL and verify it in the Meta Developer Console under **WhatsApp > Configuration**:
   - **Callback URL**: `https://<forwarding-subdomain>.ngrok-free.app/api/meta/whatsapp/webhook`
   - **Verify Token**: Match the token in your `.env` (e.g. `bdffi_meta_webhook_verify_token`).
3. Subscribe to the `messages` fields under **Webhooks**.
