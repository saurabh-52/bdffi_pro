export const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

export const BLOOD_COUNTS = { 'A+': 14, 'A-': 5, 'B+': 11, 'B-': 3, 'AB+': 7, 'AB-': 2, 'O+': 10, 'O-': 4 };

export const BLOOD_ALIASES = {
  'a+': 'A+',
  'apositive': 'A+',
  'a positive': 'A+',
  'a-': 'A-',
  'anegative': 'A-',
  'a negative': 'A-',
  'b+': 'B+',
  'bpositive': 'B+',
  'b positive': 'B+',
  'b-': 'B-',
  'bnegative': 'B-',
  'b negative': 'B-',
  'ab+': 'AB+',
  'abpositive': 'AB+',
  'ab positive': 'AB+',
  'ab-': 'AB-',
  'abnegative': 'AB-',
  'ab negative': 'AB-',
  'o+': 'O+',
  'opositive': 'O+',
  'o positive': 'O+',
  'o-': 'O-',
  'onegative': 'O-',
  'o negative': 'O-'
};

export const MOCK_REQUESTS = [
  { id: 1, patient: 'Ravi Shankar', hospital: 'AIIMS Delhi', blood: 'B+', contact: '9876543210', status: 'pending', time: '2 min ago', donors: 6, createdAt: new Date(Date.now() - 2 * 60 * 1000).toISOString() },
  { id: 2, patient: 'Priya Mehta', hospital: 'Apollo, Mumbai', blood: 'O-', contact: '9123456789', status: 'active', time: '18 min ago', donors: 3, createdAt: new Date(Date.now() - 18 * 60 * 1000).toISOString() },
  { id: 3, patient: 'Arjun Das', hospital: 'Manipal Hospital', blood: 'A+', contact: '9988776655', status: 'fulfilled', time: '1 hr ago', donors: 8, createdAt: new Date(Date.now() - 60 * 60 * 1000).toISOString() },
  { id: 4, patient: 'Sunita Rao', hospital: 'KGH Vizag', blood: 'AB+', contact: '9765432100', status: 'pending', time: '3 hr ago', donors: 2, createdAt: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000).toISOString() },
  { id: 5, patient: 'Mohit Gupta', hospital: 'PGIMER', blood: 'B-', contact: '9654321098', status: 'active', time: '5 hr ago', donors: 5, createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString() },
];

export const MOCK_DONORS = [
  { id: 1, name: 'Ankit Sharma', admission: 'ISM/2022/001', gender: 'Male', programme: 'B.Tech', blood: 'B+', mobile: '9810101010', lastDon: null, eligible: true, notified: false },
  { id: 2, name: 'Divya Pillai', admission: 'ISM/2022/047', gender: 'Female', programme: 'M.Tech', blood: 'O-', mobile: '9820202020', lastDon: null, eligible: true, notified: true },
  { id: 3, name: 'Karan Singh', admission: 'ISM/2023/012', gender: 'Male', programme: 'MBA', blood: 'A+', mobile: '9830303030', lastDon: null, eligible: false, notified: false },
  { id: 4, name: 'Nisha Patel', admission: 'ISM/2021/088', gender: 'Female', programme: 'B.Sc', blood: 'AB+', mobile: '9840404040', lastDon: null, eligible: true, notified: false },
  { id: 5, name: 'Rahul Joshi', admission: 'ISM/2023/055', gender: 'Male', programme: 'B.Tech', blood: 'B-', mobile: '9850505050', lastDon: null, eligible: true, notified: true },
  { id: 6, name: 'Sneha Reddy', admission: 'ISM/2022/033', gender: 'Female', programme: 'MCA', blood: 'A-', mobile: '9860606060', lastDon: null, eligible: true, notified: false },
  { id: 7, name: 'Vikram Nair', admission: 'ISM/2024/011', gender: 'Male', programme: 'B.Tech', blood: 'O+', mobile: '9870707070', lastDon: null, eligible: true, notified: false },
];

export const BLOOD_NOTIFICATION_LOGS = [
  { id: 1, donor: 'Divya Pillai', request: 'Priya Mehta (O-)', status: 'accepted', time: '10 min ago', msg: 'Confirmed via WhatsApp ✓' },
  { id: 2, donor: 'Rahul Joshi', request: 'Mohit Gupta (B-)', status: 'sent', time: '22 min ago', msg: 'WhatsApp message delivered' },
  { id: 3, donor: 'Ankit Sharma', request: 'Ravi Shankar (B+)', status: 'pending', time: '35 min ago', msg: 'Awaiting reply…' },
  { id: 4, donor: 'Karan Singh', request: 'Arjun Das (A+)', status: 'declined', time: '1 hr ago', msg: 'Declined — ineligible cooldown' },
  { id: 5, donor: 'Nisha Patel', request: 'Sunita Rao (AB+)', status: 'sent', time: '2 hr ago', msg: 'WhatsApp message delivered' },
  { id: 6, donor: 'Sneha Reddy', request: 'Arjun Das (A+)', status: 'accepted', time: '3 hr ago', msg: 'Donor confirmed. NGO notified.' },
];

export const MANAGER_NOTIFICATION_LOGS = [
  { id: 1, donor: 'Manager', request: 'Imported donor sheet', status: 'accepted', time: '5 min ago', msg: 'Active Excel sheet replaced and saved to backend.' },
  { id: 2, donor: 'Manager', request: 'Deleted donor sheet', status: 'declined', time: '18 min ago', msg: 'Current active sheet was cleared from backend storage.' },
  { id: 3, donor: 'Manager', request: 'Updated donor source', status: 'sent', time: '1 hr ago', msg: 'Fresh donor sheet synchronized for all users.' },
  { id: 4, donor: 'Manager', request: 'Opened sheet preview', status: 'pending', time: '2 hr ago', msg: 'Viewed the active donor sheet before export.' },
];

export const ACTIVITY = [
  { color: 'red', text: 'New request from AIIMS Delhi — B+ needed urgently', time: '2 min ago' },
  { color: 'green', text: 'Divya Pillai accepted O− donation for Apollo Mumbai', time: '10 min ago' },
  { color: 'amber', text: 'WhatsApp alert sent to 5 eligible B− donors', time: '22 min ago' },
  { color: 'blue', text: 'Arjun Das (A+) — request fulfilled', time: '1 hr ago' },
  { color: 'green', text: 'Sneha Reddy confirmed donation commitment', time: '3 hr ago' },
];

export const NAV = [
  { key: 'dashboard', label: 'Dashboard', icon: '⚡', badge: null },
  { key: 'request', label: 'New Request', icon: '➕', badge: null },
  { key: 'recent', label: 'Recent Requests', icon: '📋', badge: null },
  { key: 'donors', label: 'Donors', icon: '👥', badge: '56' },
  { key: 'logs', label: 'Notifications', icon: '📲', badge: '3' },
];
