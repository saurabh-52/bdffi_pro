# 💻 Fast Forward India - Blood Donation Automation Dashboard UI

A component-based React single-page application (SPA) acting as the frontend console for volunteers and managers of the FFI Blood Donation Automation System. Built using React 18, Vite, and Vanilla CSS.

---

## 📂 Project Directory Structure

```text
frontend/
├── src/
│   ├── assets/               # Static icons and image files
│   │
│   ├── components/           # Reusable widgets and modular views
│   │   ├── modals/           # Popups and overlay controllers
│   │   │   ├── BlockFiltersModal.jsx   # Cohort exclusion prefix controls
│   │   │   ├── RequestDetailsModal.jsx # Compatible donor list & alert trigger panel
│   │   │   ├── VolunteersModal.jsx     # Volunteer accounts viewer
│   │   │   ├── WhatsAppAdminPanel.jsx  # Live webhook log and retry console
│   │   │   └── WhatsAppAlertModal.jsx  # Outreach message confirmation overlay
│   │   │
│   │   ├── views/            # Full-page tab views
│   │   │   ├── DashboardView.jsx       # Main volunteer console feed
│   │   │   ├── DonorsView.jsx          # Donor table search & Excel imports
│   │   │   ├── RecentRequestsView.jsx  # Filed blood cases chronological list
│   │   │   ├── RequestView.jsx         # Case intake form
│   │   │   ├── LogsView.jsx            # Audit trails stream viewer
│   │   │   ├── ManagerDashboardView.jsx # Manager console with volunteer settings
│   │   │   ├── ManagerLoginView.jsx    # Manager login portal
│   │   │   ├── VolunteerLoginView.jsx  # Volunteer login portal
│   │   │   ├── ForgotPasswordPage.jsx  # Manager password reset request
│   │   │   ├── VolunteerForgotPasswordPage.jsx # Volunteer password reset request
│   │   │   ├── ManagerAddAccountView.jsx # Manager creation console
│   │   │   └── VolunteerAddAccountView.jsx # Volunteer creation console
│   │   │
│   │   ├── BloodBadge.jsx    # Renders blood group tags with matching styles
│   │   ├── EyeToggleButton.jsx # Shows/hides visibility of password inputs
│   │   ├── RequestItem.jsx   # Renders details and counts for a filed case
│   │   ├── StatCard.jsx      # Generic dashboard stats widget
│   │   └── StatusPill.jsx    # Status indicators (Pending, Active, Fulfilled)
│   │
│   ├── utils/                # Client-side utility functions
│   │   ├── api.js            # Axios-free Fetch API wrappers mapped to backend endpoints
│   │   ├── constants.js      # Blood compatibility grids and mock templates
│   │   └── helpers.js        # Cooldown validators, group matchers, and date parsers
│   │
│   ├── App.jsx               # Application main state and layout manager
│   ├── main.jsx              # React application renderer
│   └── styles.css            # Vanilla CSS stylesheet containing full styling system
│
├── index.html                # Vite entry template
├── vite.config.js            # Build and development configuration for Vite
└── package.json              # List of dependencies and npm scripts
```

---

## 🛠 File & Folder Descriptions

### 1. Root & Entrypoints (`src/`)
*   **`App.jsx`**: Coordinates state for the active view, the currently authenticated operator (Volunteer or Manager), global alerts, and handles switching dashboard layouts.
*   **`main.jsx`**: Bootstraps the virtual DOM tree.
*   **`styles.css`**: A centralized, custom Vanilla CSS design system. It details the color palette (using teal/slate tones), typography rules, grid alignments, micro-animations, and custom modal transitions.

### 2. UI Views (`src/components/views/`)
*   **`DashboardView.jsx`**: The operator landing hub. Contains statistics cards, a simplified request intake box, and a quick summary list.
*   **`DonorsView.jsx`**: Contains donor roster grids. Integrates the `xlsx` library to allow imports from Excel files and filters exports by cohorts.
*   **`RequestView.jsx` / `RecentRequestsView.jsx`**: Allows volunteers to file new blood drives (patient, location, priority) and review pending cases.
*   **`ManagerDashboardView.jsx`**: Allows super-operators to monitor volunteer activity, update notification parameters, and promote operators.
*   **`ManagerLoginView.jsx` / `VolunteerLoginView.jsx`**: Login forms.

### 3. Modal Overlays (`src/components/modals/`)
*   **`RequestDetailsModal.jsx`**: Highlights match recommendations, filters donors with active cooldowns, and lets operators trigger WhatsApp message templates to matching donors.
*   **`WhatsAppAdminPanel.jsx`**: Live monitoring hub capturing incoming delivery confirmation events and incoming quick replies. Includes click retries.
*   **`BlockFiltersModal.jsx`**: Excludes cohorts dynamically using batch prefix rules.

### 4. Shared Utilities (`src/utils/`)
*   **`api.js`**: Integrates with `/api/*` backend routes. Handles query parsing, response mappings, and authorization token transfers.
*   **`helpers.js`**:
    *   `checkOutreachCooldown`: Verifies if a student has donated or received alerts within 90 days.
    *   `matchCompatibleGroups`: Implements biological compatibility rules (e.g., matching O- donors with O+ requests).
    *   `formatTimeAgo`: Renders date labels dynamically.

---

## 🚀 Installation & Local Launch

### 1. Install Dependencies
Navigate to the `frontend/` directory and install local packages:
```bash
npm install
```

### 2. Run Locally in Development Mode
Starts a local development server using Vite on port `5173`:
```bash
npm run dev
```
Open `http://localhost:5173` in your browser.

### 3. Build for Production
Compiles optimized assets to the `dist/` directory for deployment:
```bash
npm run build
```
To test the production build locally, run:
```bash
npm run preview
```
