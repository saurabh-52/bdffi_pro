# 🩸 Fast Forward India - Blood Donation Automation System

## 📖 Overview
This project is an automated blood donation requisition and matching system built for **Fast Forward India (NGO)**. It streamlines the process of finding blood donors by extracting patient details from medical forms using AI, matching them with eligible student donors from a database, and automating outreach via WhatsApp.

## 🛠 Tech Stack
* **Frontend:** React.js
* **Backend:** Node.js, Express.js
* **Database:** MySQL
* **AI Integration:** OpenAI GPT-4o Vision API (or Google Cloud Vision) for OCR
* **Messaging:** Meta WhatsApp Cloud API (or Twilio)


### Installation

1. **Clone the repository**
   ```bash
   git clone [https://github.com/yourusername/ffi-blood-donation.git](https://github.com/yourusername/ffi-blood-donation.git)
   cd ffi-blood-donation
    ```

2. **Set up the backend**
    ```bash
    cd backend
    npm install
    ```

3. **Configure MySQL credentials**
    Create `backend/.env` with your local database details.

4. **Create the database and run Phase 1 schema**
    ```bash
    mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS bdffi;"
    npx knex --knexfile knexfile.js migrate:latest
    npx knex --knexfile knexfile.js seed:run
    ```

    The manager login is seeded too. Use `manager@fastforwardindia.org` for the single manager account.

5. **Start the backend**
    ```bash
    npm run dev
    ```

6. **Set up the frontend**
    ```bash
    cd ../frontend
    npm install
    npm start
    ```

### Phase 1 Quickstart

The initial database layer is already scaffolded with Knex:

* [backend/knexfile.js](backend/knexfile.js) configures the MySQL connection.
* [backend/migrations/20260521_create_tables.js](backend/migrations/20260521_create_tables.js) creates `students`, `donation_requests`, and `notification_logs`.
* [backend/seeds/01_students.js](backend/seeds/01_students.js) loads sample students.
* [schema.sql](schema.sql) contains the same Phase 1 schema in plain SQL if you prefer manual setup.

### Useful Commands

```bash
cd backend
npx knex --knexfile knexfile.js migrate:latest
npx knex --knexfile knexfile.js seed:run
```

## 🤝 Contributing
Contributions are welcome! Please open an issue or submit a pull request if you have suggestions to improve the system.
