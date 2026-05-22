// Quick debug script to validate IST period computation
const IST_DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Kolkata',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function getISTDateKey(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const parts = IST_DATE_FORMATTER.formatToParts(date);
  const year = parts.find(part => part.type === 'year')?.value;
  const month = parts.find(part => part.type === 'month')?.value;
  const day = parts.find(part => part.type === 'day')?.value;

  return year && month && day ? `${year}-${month}-${day}` : '';
}

function daysAgo(days) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

function getRequestPeriod(createdAt) {
  const createdKey = getISTDateKey(createdAt);
  if (!createdKey) return 'older';

  const now = new Date();
  const todayKey = getISTDateKey(now);
  if (!todayKey) return 'older';

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = getISTDateKey(yesterday);

  const createdMonthKey = createdKey.slice(0, 7);
  const currentMonthKey = todayKey.slice(0, 7);

  if (createdKey === todayKey) return 'today';
  if (createdKey === yesterdayKey) return 'yesterday';
  if (createdMonthKey === currentMonthKey) return 'this-month';
  return 'older';
}

const MOCK_REQUESTS = [
  { id: 1, patient: 'Ravi Shankar', createdAt: daysAgo(0) },
  { id: 2, patient: 'Priya Mehta', createdAt: daysAgo(0) },
  { id: 3, patient: 'Arjun Das', createdAt: daysAgo(1) },
  { id: 4, patient: 'Sunita Rao', createdAt: daysAgo(35) },
  { id: 5, patient: 'Mohit Gupta', createdAt: daysAgo(0) },
];

console.log('Now (local):', new Date().toString());
console.log('Now (IST key):', getISTDateKey(new Date()));

console.log('\nMock requests periods:');
MOCK_REQUESTS.forEach(r => {
  console.log(`id=${r.id} patient=${r.patient} createdAt=${r.createdAt} istKey=${getISTDateKey(r.createdAt)} period=${getRequestPeriod(r.createdAt)}`);
});

// extra: sample 5 hours ago
const fiveHoursAgo = new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString();
console.log('\nSample 5 hours ago:', fiveHoursAgo);
console.log('IST key:', getISTDateKey(fiveHoursAgo));
console.log('Period:', getRequestPeriod(fiveHoursAgo));
