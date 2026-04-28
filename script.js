/* ── DATA STORE ───────────────────────────────────────────────────────── */
let DB = {
  users: [
    { id: 1, username: "admin", name: "Admin User", password: "password", role: "admin", email: "admin@medicare.com", phone: "9000000001", dob: "", gender: "", bill_ids: "[]", emergency_contact: "{}" },
    { id: 2, username: "patient1", name: "Aanya Sharma", password: "pass123", role: "client", email: "aanya@gmail.com", phone: "9876543210", dob: "1995-04-12", gender: "Female", bill_ids: "[1,2]", emergency_contact: "{}" },
    { id: 3, username: "patient2", name: "Ravi Kumar", password: "pass123", role: "client", email: "ravi@gmail.com", phone: "9876543211", dob: "1988-07-22", gender: "Male", bill_ids: "[3]", emergency_contact: "{}" }
  ],
  doctors: [
    { id: 1, name: "Dr. Priya Nair", specialization: "Cardiology", qualifications: "MBBS, MD", contact: "priya@hospital.com", available_days: "Mon,Tue,Wed,Thu,Fri", available_from: "09:00", available_to: "17:00", not_available_dates: "", fees: "800", consultation_modes: "in_person,telemedicine", languages: "English,Malayalam,Hindi" },
    { id: 2, name: "Dr. Suresh Babu", specialization: "Neurology", qualifications: "MBBS, DM", contact: "suresh@hospital.com", available_days: "Mon,Wed,Fri", available_from: "10:00", available_to: "16:00", not_available_dates: "", fees: "1200", consultation_modes: "telemedicine", languages: "English,Tamil,Telugu" },
    { id: 3, name: "Dr. Anita Desai", specialization: "Dermatology", qualifications: "MBBS, MD, FRCP", contact: "anita@hospital.com", available_days: "Tue,Thu,Sat", available_from: "11:00", available_to: "18:00", not_available_dates: "", fees: "600", consultation_modes: "in_person,telemedicine", languages: "English,Hindi,Marathi" },
    { id: 4, name: "Dr. Ramesh Iyer", specialization: "Orthopedics", qualifications: "MBBS, MS (Ortho)", contact: "ramesh@hospital.com", available_days: "Mon,Tue,Thu,Fri", available_from: "08:00", available_to: "14:00", not_available_dates: "", fees: "900", consultation_modes: "in_person", languages: "English,Tamil,Kannada" }
  ],
  appointments: [
    { id: 1, user_id: 2, doctor_id: 1, start_time: "2025-08-10T10:00:00", end_time: "2025-08-10T10:20:00", status: "booked", fees: "800", payment_status: "paid", booking_time: "2025-08-05T14:00:00", bill_id: "1", symptoms_summary: "Chest pain and palpitations", created_by: 2 },
    { id: 2, user_id: 2, doctor_id: 3, start_time: "2025-08-15T11:00:00", end_time: "2025-08-15T11:20:00", status: "booked", fees: "600", payment_status: "unpaid", booking_time: "2025-08-06T09:00:00", bill_id: "", symptoms_summary: "Skin rash and itching", created_by: 2 },
    { id: 3, user_id: 3, doctor_id: 2, start_time: "2025-08-12T10:00:00", end_time: "2025-08-12T10:20:00", status: "completed", fees: "1200", payment_status: "paid", booking_time: "2025-08-07T10:00:00", bill_id: "3", symptoms_summary: "Persistent headaches", created_by: 3 }
  ],
  medical_details: [
    { bill_id: 1, user_id: 2, bill_amount_rs: 800, paid: "yes", diseases: "Hypertension", medicines: "Amlodipine 5mg", prescription: "Take 1 tablet daily in the morning. Follow up in 4 weeks." },
    { bill_id: 2, user_id: 2, bill_amount_rs: 600, paid: "no", diseases: "Eczema", medicines: "Hydrocortisone cream 1%", prescription: "Apply twice daily on affected areas. Avoid harsh soaps." },
    { bill_id: 3, user_id: 3, bill_amount_rs: 1200, paid: "yes", diseases: "Migraine", medicines: "Sumatriptan 50mg", prescription: "Take at onset of migraine. Max 2 tablets in 24 hours." }
  ]
};

let currentUser = null;
let currentDoctorDetail = null;
let callActive = false;
let chatMessages = [];
let mutedState = false;
let camState = true;

/* ── PERSISTENCE ──────────────────────────────────────────────────────── */
function saveDB() {
  try { localStorage.setItem('medicare_db', JSON.stringify(DB)); } catch(e) {}
}
function loadDB() {
  try {
    const d = localStorage.getItem('medicare_db');
    if (d) DB = JSON.parse(d);
  } catch(e) {}
}

/* ── UTILITIES ────────────────────────────────────────────────────────── */
function getNextId(arr) {
  if (!arr.length) return 1;
  return Math.max(...arr.map(r => r.id || r.bill_id || 0)) + 1;
}
function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });
}
function formatDateShort(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });
}
function getDayAbbr(dateStr) {
  const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  return days[new Date(dateStr).getDay()];
}
function statusBadge(status) {
  const map = { booked:'badge-blue', completed:'badge-green', canceled:'badge-red', cancelled:'badge-red' };
  return `<span class="badge ${map[status]||'badge-gray'}">${status}</span>`;
}
function payBadge(status) {
  return status === 'paid'
    ? `<span class="badge badge-green">Paid</span>`
    : `<span class="badge badge-amber">Unpaid</span>`;
}
function toast(msg, type='success') {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  const icon = type==='success' ? '✓' : type==='error' ? '✕' : 'ℹ';
  el.innerHTML = `<span>${icon}</span> ${msg}`;
  document.getElementById('toast-container').appendChild(el);
  setTimeout(() => el.remove(), 3500);
}
function showPage(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}
function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }
function closeModalOut(e, id) { if (e.target === e.currentTarget) closeModal(id); }

/* ── AUTH ─────────────────────────────────────────────────────────────── */
function switchAuthTab(tab) {
  document.querySelectorAll('.auth-tab').forEach((t,i) => {
    t.classList.toggle('active', (i===0 && tab==='login') || (i===1 && tab==='register'));
  });
  document.getElementById('tab-login').classList.toggle('active', tab==='login');
  document.getElementById('tab-register').classList.toggle('active', tab==='register');
}

function handleLogin() {
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value.trim();
  const errEl = document.getElementById('login-error');
  const user = DB.users.find(u => u.username === username && u.password === password);
  if (!user) { errEl.textContent = 'Invalid username or password.'; return; }
  errEl.textContent = '';
  currentUser = user;
  if (user.role === 'admin') loadAdminDashboard();
  else loadClientDashboard();
}

function handleRegister() {
  const username = document.getElementById('reg-username').value.trim();
  const name = document.getElementById('reg-name').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const phone = document.getElementById('reg-phone').value.trim();
  const password = document.getElementById('reg-password').value.trim();
  const errEl = document.getElementById('reg-error');
  if (!username || !name || !password) { errEl.textContent = 'Username, name, and password are required.'; return; }
  if (DB.users.find(u => u.username === username)) { errEl.textContent = 'Username already taken.'; return; }
  errEl.textContent = '';
  const newUser = { id: getNextId(DB.users), username, name, email, phone, password, role: 'client', dob:'', gender:'', bill_ids:'[]', emergency_contact:'{}' };
  DB.users.push(newUser);
  saveDB();
  toast('Account created! Please sign in.');
  switchAuthTab('login');
  document.getElementById('login-username').value = username;
}

function logout() {
  currentUser = null;
  callActive = false;
  chatMessages = [];
  showPage('page-auth');
  document.getElementById('login-username').value = '';
  document.getElementById('login-password').value = '';
}

/* ── ADMIN DASHBOARD ─────────────────────────────────────────────────── */
function loadAdminDashboard() {
  showPage('page-admin');
  document.getElementById('admin-name').textContent = currentUser.name;
  document.getElementById('admin-avatar').textContent = currentUser.name.charAt(0).toUpperCase();
  document.getElementById('today-date').textContent = new Date().toLocaleDateString('en-IN', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
  renderAdminStats();
  renderRecentAppts();
  renderRevenueChart();
  renderDoctorsTable();
  renderUsersTable();
  renderAppointmentsTable();
  renderBillsTable();
  renderAnalytics();
}

function adminNav(el, section) {
  event.preventDefault();
  document.querySelectorAll('#page-admin .nav-item').forEach(n => n.classList.remove('active'));
  el.classList.add('active');
  document.querySelectorAll('#page-admin .dashboard-section').forEach(s => s.classList.remove('active'));
  document.getElementById('admin-'+section).classList.add('active');
}

function renderAdminStats() {
  const totalDocs = DB.doctors.length;
  const totalUsers = DB.users.filter(u => u.role==='client').length;
  const totalAppts = DB.appointments.length;
  const revenue = DB.appointments.reduce((s,a) => s + parseFloat(a.fees||0), 0);
  const unpaidBills = DB.medical_details.filter(b => b.paid !== 'yes').length;
  document.getElementById('admin-stats').innerHTML = `
    <div class="stat-card"><div class="stat-label">Total Doctors</div><div class="stat-value stat-accent">${totalDocs}</div><div class="stat-sub">Registered</div></div>
    <div class="stat-card"><div class="stat-label">Patients</div><div class="stat-value stat-blue">${totalUsers}</div><div class="stat-sub">Active clients</div></div>
    <div class="stat-card"><div class="stat-label">Appointments</div><div class="stat-value">${totalAppts}</div><div class="stat-sub">Total booked</div></div>
    <div class="stat-card"><div class="stat-label">Revenue</div><div class="stat-value stat-accent">₹${revenue.toLocaleString()}</div><div class="stat-sub">From consultations</div></div>
    <div class="stat-card"><div class="stat-label">Unpaid Bills</div><div class="stat-value stat-amber">${unpaidBills}</div><div class="stat-sub">Pending payment</div></div>
  `;
}

function renderRecentAppts() {
  const list = document.getElementById('recent-appts-list');
  const recent = [...DB.appointments].reverse().slice(0, 5);
  if (!recent.length) { list.innerHTML = '<div class="empty-state">No appointments yet</div>'; return; }
  list.innerHTML = recent.map(a => {
    const doc = DB.doctors.find(d => d.id == a.doctor_id);
    const pat = DB.users.find(u => u.id == a.user_id);
    return `<div class="recent-appt-item">
      <div>
        <div style="font-weight:500;color:var(--text)">${pat ? pat.name : 'Unknown'}</div>
        <div style="font-size:12px;color:var(--text-3)">${doc ? doc.name : 'Unknown Dr.'} · ${formatDateShort(a.start_time)}</div>
      </div>
      ${statusBadge(a.status)}
    </div>`;
  }).join('');
}

function renderRevenueChart() {
  const container = document.getElementById('revenue-chart');
  const revenueByDoc = {};
  DB.appointments.forEach(a => {
    const k = a.doctor_id;
    revenueByDoc[k] = (revenueByDoc[k]||0) + parseFloat(a.fees||0);
  });
  const max = Math.max(...Object.values(revenueByDoc), 1);
  const sorted = Object.entries(revenueByDoc).sort((a,b) => b[1]-a[1]);
  container.innerHTML = sorted.map(([did, rev]) => {
    const doc = DB.doctors.find(d => d.id == did);
    const pct = (rev/max)*100;
    return `<div class="rev-bar-row">
      <div class="rev-bar-label">${doc ? doc.name.replace('Dr. ','') : 'Dr. #'+did}</div>
      <div class="rev-bar-track"><div class="rev-bar-fill" style="width:${pct}%"></div></div>
      <div class="rev-bar-val">₹${rev.toLocaleString()}</div>
    </div>`;
  }).join('') || '<div class="empty-state">No revenue data</div>';
}

function renderDoctorsTable() {
  document.getElementById('doctors-tbody').innerHTML = DB.doctors.map(d => `
    <tr>
      <td>${d.id}</td>
      <td style="color:var(--text);font-weight:500">${d.name}</td>
      <td>${d.specialization}</td>
      <td style="font-size:12px">${d.available_days}</td>
      <td style="color:var(--accent)">₹${d.fees}</td>
      <td>
        <button class="btn-sm del" onclick="removeDoctor(${d.id})">Remove</button>
      </td>
    </tr>
  `).join('');
}

function renderUsersTable() {
  document.getElementById('users-tbody').innerHTML = DB.users.map(u => `
    <tr>
      <td>${u.id}</td>
      <td style="color:var(--text)">${u.username}</td>
      <td>${u.name}</td>
      <td>${u.role === 'admin' ? '<span class="badge badge-amber">Admin</span>' : '<span class="badge badge-blue">Client</span>'}</td>
      <td>${u.email||'—'}</td>
      <td>${u.phone||'—'}</td>
      <td>
        <button class="btn-sm del" onclick="removeUser(${u.id})">Remove</button>
      </td>
    </tr>
  `).join('');
}

function renderAppointmentsTable() {
  document.getElementById('appointments-tbody').innerHTML = DB.appointments.map(a => {
    const doc = DB.doctors.find(d => d.id == a.doctor_id);
    const pat = DB.users.find(u => u.id == a.user_id);
    return `<tr>
      <td>${a.id}</td>
      <td>${pat ? pat.name : '—'}</td>
      <td>${doc ? doc.name : '—'}</td>
      <td>${formatDate(a.start_time)}</td>
      <td>${statusBadge(a.status)}</td>
      <td style="color:var(--accent)">₹${a.fees}</td>
      <td>${payBadge(a.payment_status)}</td>
    </tr>`;
  }).join('');
}

function renderBillsTable() {
  document.getElementById('bills-tbody').innerHTML = DB.medical_details.map(b => `
    <tr>
      <td>${b.bill_id}</td>
      <td>${b.user_id}</td>
      <td style="color:var(--accent)">₹${b.bill_amount_rs}</td>
      <td>${b.paid === 'yes' ? '<span class="badge badge-green">Paid</span>' : '<span class="badge badge-amber">Unpaid</span>'}</td>
      <td>${b.diseases||'—'}</td>
      <td>${b.medicines||'—'}</td>
    </tr>
  `).join('');
}

function renderAnalytics() {
  const totalBillAmt = DB.medical_details.reduce((s,b) => s + parseFloat(b.bill_amount_rs||0), 0);
  const unpaid = DB.medical_details.filter(b => b.paid !== 'yes').length;
  const fees = DB.doctors.map(d => parseFloat(d.fees||0)).filter(Boolean);
  const median = fees.length ? fees.sort((a,b)=>a-b)[Math.floor(fees.length/2)] : 0;
  document.getElementById('analytics-stats').innerHTML = `
    <div class="stat-card"><div class="stat-label">Total Billed</div><div class="stat-value stat-accent">₹${totalBillAmt.toLocaleString()}</div></div>
    <div class="stat-card"><div class="stat-label">Unpaid Bills</div><div class="stat-value stat-amber">${unpaid}</div></div>
    <div class="stat-card"><div class="stat-label">Median Doctor Fee</div><div class="stat-value">₹${median}</div></div>
    <div class="stat-card"><div class="stat-label">Active Doctors</div><div class="stat-value stat-blue">${DB.doctors.length}</div></div>
  `;

  // Appts per doctor
  const apptCounts = {};
  DB.appointments.forEach(a => { apptCounts[a.doctor_id] = (apptCounts[a.doctor_id]||0)+1; });
  const maxAppt = Math.max(...Object.values(apptCounts), 1);
  document.getElementById('appt-per-doctor').innerHTML = Object.entries(apptCounts).map(([did, cnt]) => {
    const doc = DB.doctors.find(d=>d.id==did);
    return `<div class="rev-bar-row">
      <div class="rev-bar-label">${doc ? doc.name.replace('Dr. ','') : '#'+did}</div>
      <div class="rev-bar-track"><div class="rev-bar-fill" style="width:${(cnt/maxAppt)*100}%;background:var(--blue)"></div></div>
      <div class="rev-bar-val">${cnt} appts</div>
    </div>`;
  }).join('') || '<div class="empty-state">No data</div>';

  // Revenue by doctor (analytics tab)
  const rev = {};
  DB.appointments.forEach(a => { rev[a.doctor_id] = (rev[a.doctor_id]||0)+parseFloat(a.fees||0); });
  const maxRev = Math.max(...Object.values(rev), 1);
  document.getElementById('revenue-by-doctor').innerHTML = Object.entries(rev).map(([did, r]) => {
    const doc = DB.doctors.find(d=>d.id==did);
    return `<div class="rev-bar-row">
      <div class="rev-bar-label">${doc ? doc.name.replace('Dr. ','') : '#'+did}</div>
      <div class="rev-bar-track"><div class="rev-bar-fill" style="width:${(r/maxRev)*100}%"></div></div>
      <div class="rev-bar-val">₹${r.toLocaleString()}</div>
    </div>`;
  }).join('') || '<div class="empty-state">No data</div>';
}

/* ── ADMIN ACTIONS ──────────────────────────────────────────────────────── */
function addDoctor() {
  const name = document.getElementById('doc-name').value.trim();
  const spec = document.getElementById('doc-spec').value.trim();
  if (!name || !spec) { toast('Name and specialization required', 'error'); return; }
  const doc = {
    id: getNextId(DB.doctors),
    name, specialization: spec,
    qualifications: document.getElementById('doc-qual').value.trim(),
    contact: document.getElementById('doc-contact').value.trim(),
    available_days: document.getElementById('doc-days').value.trim(),
    fees: document.getElementById('doc-fees').value.trim(),
    available_from: document.getElementById('doc-from').value,
    available_to: document.getElementById('doc-to').value,
    not_available_dates: '',
    consultation_modes: document.getElementById('doc-modes').value.trim(),
    languages: document.getElementById('doc-langs').value.trim()
  };
  DB.doctors.push(doc);
  saveDB();
  closeModal('modal-add-doctor');
  renderDoctorsTable(); renderAdminStats();
  toast('Doctor added successfully');
}

function removeDoctor(id) {
  if (!confirm('Remove this doctor?')) return;
  DB.doctors = DB.doctors.filter(d => d.id !== id);
  saveDB();
  renderDoctorsTable(); renderAdminStats();
  toast('Doctor removed');
}

function addUser() {
  const username = document.getElementById('new-user-username').value.trim();
  const name = document.getElementById('new-user-name').value.trim();
  const password = document.getElementById('new-user-password').value.trim();
  if (!username || !name || !password) { toast('Username, name, password required', 'error'); return; }
  if (DB.users.find(u => u.username===username)) { toast('Username already exists', 'error'); return; }
  DB.users.push({
    id: getNextId(DB.users),
    username, name, password,
    email: document.getElementById('new-user-email').value.trim(),
    phone: document.getElementById('new-user-phone').value.trim(),
    role: document.getElementById('new-user-role').value,
    dob:'', gender:'', bill_ids:'[]', emergency_contact:'{}'
  });
  saveDB();
  closeModal('modal-add-user');
  renderUsersTable(); renderAdminStats();
  toast('User added');
}

function removeUser(id) {
  if (id === currentUser.id) { toast('Cannot remove yourself', 'error'); return; }
  if (!confirm('Remove this user?')) return;
  DB.users = DB.users.filter(u => u.id !== id);
  saveDB();
  renderUsersTable(); renderAdminStats();
  toast('User removed');
}

function generateBill() {
  const uid = parseInt(document.getElementById('bill-user-id').value);
  const amount = parseFloat(document.getElementById('bill-amount').value);
  if (!uid || !amount) { toast('User ID and amount required', 'error'); return; }
  const bill = {
    bill_id: DB.medical_details.length ? Math.max(...DB.medical_details.map(b=>b.bill_id))+1 : 1,
    user_id: uid,
    bill_amount_rs: amount,
    paid: document.getElementById('bill-paid').value,
    diseases: document.getElementById('bill-diseases').value.trim(),
    medicines: document.getElementById('bill-medicines').value.trim(),
    prescription: document.getElementById('bill-prescription').value.trim()
  };
  DB.medical_details.push(bill);
  saveDB();
  closeModal('modal-add-bill');
  renderBillsTable(); renderAdminStats();
  toast('Bill generated');
}

/* ── CLIENT DASHBOARD ─────────────────────────────────────────────────── */
function loadClientDashboard() {
  showPage('page-client');
  document.getElementById('client-name').textContent = currentUser.name;
  document.getElementById('client-welcome-name').textContent = currentUser.name.split(' ')[0];
  document.getElementById('client-avatar').textContent = currentUser.name.charAt(0).toUpperCase();
  document.getElementById('profile-avatar-large').textContent = currentUser.name.charAt(0).toUpperCase();
  document.getElementById('client-today-date').textContent = new Date().toLocaleDateString('en-IN', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
  renderClientStats();
  renderClientUpcoming();
  renderClientDoctors();
  renderClientAppointments();
  renderClientRecords();
  renderTelehealthAppts();
  loadProfileForm();
  populateDoctorSelect();
  populateHours();
}

function clientNav(el, section) {
  event.preventDefault();
  document.querySelectorAll('#page-client .nav-item').forEach(n => n.classList.remove('active'));
  el.classList.add('active');
  document.querySelectorAll('#page-client .dashboard-section').forEach(s => s.classList.remove('active'));
  document.getElementById(section).classList.add('active');
}

function renderClientStats() {
  const uid = currentUser.id;
  const myAppts = DB.appointments.filter(a => a.user_id == uid);
  const upcoming = myAppts.filter(a => a.status === 'booked').length;
  const bills = DB.medical_details.filter(b => b.user_id == uid);
  const unpaidBills = bills.filter(b => b.paid !== 'yes').length;
  const totalSpent = bills.filter(b => b.paid === 'yes').reduce((s,b) => s+parseFloat(b.bill_amount_rs||0), 0);
  document.getElementById('client-stats').innerHTML = `
    <div class="stat-card"><div class="stat-label">Upcoming</div><div class="stat-value stat-blue">${upcoming}</div><div class="stat-sub">Appointments</div></div>
    <div class="stat-card"><div class="stat-label">Total Visits</div><div class="stat-value">${myAppts.length}</div><div class="stat-sub">All time</div></div>
    <div class="stat-card"><div class="stat-label">Unpaid Bills</div><div class="stat-value stat-amber">${unpaidBills}</div><div class="stat-sub">Pending</div></div>
    <div class="stat-card"><div class="stat-label">Total Spent</div><div class="stat-value stat-accent">₹${totalSpent.toLocaleString()}</div><div class="stat-sub">On healthcare</div></div>
  `;
}

function renderClientUpcoming() {
  const uid = currentUser.id;
  const upcoming = DB.appointments.filter(a => a.user_id == uid && a.status === 'booked').slice(0, 3);
  const el = document.getElementById('client-upcoming');
  if (!upcoming.length) { el.innerHTML = '<div class="empty-state">No upcoming appointments</div>'; return; }
  el.innerHTML = upcoming.map(a => {
    const doc = DB.doctors.find(d => d.id == a.doctor_id);
    return `<div class="recent-appt-item">
      <div>
        <div style="font-weight:500;color:var(--text)">${doc ? doc.name : 'Unknown Doctor'}</div>
        <div style="font-size:12px;color:var(--text-3)">${doc ? doc.specialization : ''} · ${formatDate(a.start_time)}</div>
      </div>
      <span class="badge badge-blue">Booked</span>
    </div>`;
  }).join('');
}

function renderClientDoctors(filters = {}) {
  let docs = DB.doctors.filter(d => {
    if (filters.spec && !d.specialization.toLowerCase().includes(filters.spec.toLowerCase())) return false;
    if (filters.lang && !d.languages.toLowerCase().includes(filters.lang.toLowerCase())) return false;
    if (filters.mode && !d.consultation_modes.toLowerCase().includes(filters.mode.toLowerCase())) return false;
    return true;
  });
  document.getElementById('doctors-cards').innerHTML = docs.map(d => `
    <div class="doctor-card" onclick="showDoctorDetail(${d.id})">
      <div class="doc-card-top">
        <div class="doc-avatar">${d.name.split(' ')[1]?.charAt(0) || d.name.charAt(0)}</div>
        <div>
          <div class="doc-card-name">${d.name}</div>
          <div class="doc-card-spec">${d.specialization}</div>
        </div>
      </div>
      <div style="font-size:12px;color:var(--text-2);margin-bottom:0.5rem">${d.qualifications}</div>
      <div style="font-size:12px;color:var(--text-3);margin-bottom:0.75rem">🌐 ${d.languages}</div>
      <div class="doc-card-row">
        <div class="doc-card-fee">₹${d.fees}</div>
        <div class="doc-card-days">${d.available_days}</div>
      </div>
    </div>
  `).join('') || '<div class="empty-state">No doctors found matching your criteria</div>';
}

function searchDoctors() {
  renderClientDoctors({
    spec: document.getElementById('doc-search-spec').value.trim(),
    lang: document.getElementById('doc-search-lang').value.trim(),
    mode: document.getElementById('doc-search-mode').value
  });
}

function showDoctorDetail(id) {
  const d = DB.doctors.find(doc => doc.id === id);
  if (!d) return;
  currentDoctorDetail = d;
  document.getElementById('detail-doc-name').textContent = d.name;
  document.getElementById('modal-doctor-detail-body').innerHTML = `
    <div style="display:flex;gap:1rem;align-items:center;margin-bottom:1.25rem">
      <div class="doc-avatar" style="width:56px;height:56px;font-size:1.3rem">${d.name.split(' ')[1]?.charAt(0) || d.name.charAt(0)}</div>
      <div>
        <div style="font-size:1.1rem;font-weight:600;color:var(--text)">${d.name}</div>
        <div style="color:var(--text-2)">${d.specialization}</div>
        <div style="font-size:12px;color:var(--text-3)">${d.qualifications}</div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem">
      <div class="form-group"><label>Contact</label><div style="color:var(--text-2);padding:0.4rem 0">${d.contact||'—'}</div></div>
      <div class="form-group"><label>Fees</label><div style="color:var(--accent);font-weight:700;padding:0.4rem 0">₹${d.fees}</div></div>
      <div class="form-group"><label>Available Days</label><div style="color:var(--text-2);padding:0.4rem 0;font-size:13px">${d.available_days}</div></div>
      <div class="form-group"><label>Hours</label><div style="color:var(--text-2);padding:0.4rem 0">${d.available_from} – ${d.available_to}</div></div>
      <div class="form-group"><label>Languages</label><div style="color:var(--text-2);padding:0.4rem 0;font-size:13px">${d.languages}</div></div>
      <div class="form-group"><label>Consultation Modes</label><div style="color:var(--text-2);padding:0.4rem 0;font-size:13px">${d.consultation_modes}</div></div>
    </div>
  `;
  openModal('modal-doctor-detail');
}

function bookFromDetail() {
  if (!currentDoctorDetail) return;
  closeModal('modal-doctor-detail');
  document.getElementById('appt-doctor-id').value = currentDoctorDetail.id;
  openModal('modal-book-appt');
}

function renderClientAppointments() {
  const uid = currentUser.id;
  const appts = DB.appointments.filter(a => a.user_id == uid);
  const el = document.getElementById('client-appts-list');
  if (!appts.length) { el.innerHTML = '<div class="empty-state">No appointments yet. Book your first consultation!</div>'; return; }
  el.innerHTML = appts.map(a => {
    const doc = DB.doctors.find(d => d.id == a.doctor_id);
    return `<div class="appt-card">
      <div class="appt-card-info">
        <div class="appt-card-title">${doc ? doc.name : 'Unknown Doctor'} <span style="font-size:12px;font-weight:400;color:var(--text-2)">· ${doc ? doc.specialization : ''}</span></div>
        <div class="appt-card-sub">${formatDate(a.start_time)} · ₹${a.fees} · ${a.symptoms_summary||'No symptoms noted'}</div>
      </div>
      <div class="appt-card-actions">
        ${statusBadge(a.status)}
        ${payBadge(a.payment_status)}
        ${a.status === 'booked' ? `<button class="btn-sm del" onclick="cancelAppt(${a.id})">Cancel</button>` : ''}
        ${doc && doc.consultation_modes.includes('telemedicine') ? `<button class="btn-sm tele" onclick="startCallForAppt(${a.id})">Join Call</button>` : ''}
      </div>
    </div>`;
  }).join('');
}

function cancelAppt(id) {
  if (!confirm('Cancel this appointment?')) return;
  const a = DB.appointments.find(x => x.id === id);
  if (!a) return;
  a.status = 'canceled';
  saveDB();
  renderClientAppointments(); renderClientStats(); renderClientUpcoming(); renderTelehealthAppts();
  toast('Appointment cancelled');
}

function renderClientRecords() {
  const uid = currentUser.id;
  const records = DB.medical_details.filter(b => b.user_id == uid);
  const el = document.getElementById('client-records-list');
  if (!records.length) { el.innerHTML = '<div class="empty-state">No medical records found</div>'; return; }
  el.innerHTML = records.map(r => `
    <div class="record-card">
      <div class="record-header">
        <div class="record-id">Bill #${r.bill_id}</div>
        <div class="record-amount">₹${r.bill_amount_rs}</div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;margin-bottom:0.75rem">
        <div><div style="font-size:11px;color:var(--text-3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">Diagnosis</div><div class="record-meta">${r.diseases||'—'}</div></div>
        <div><div style="font-size:11px;color:var(--text-3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">Payment</div><div>${r.paid==='yes'?'<span class="badge badge-green">Paid</span>':'<span class="badge badge-amber">Unpaid</span>'}</div></div>
      </div>
      <div style="margin-bottom:0.5rem"><div style="font-size:11px;color:var(--text-3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">Medicines</div><div class="record-meta">${r.medicines||'—'}</div></div>
      <div><div style="font-size:11px;color:var(--text-3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">Prescription</div><div class="record-meta" style="font-size:13px;line-height:1.6;padding:0.75rem;background:var(--bg-3);border-radius:8px;border:1px solid var(--border)">${r.prescription||'—'}</div></div>
    </div>
  `).join('');
}

/* ── BOOKING ──────────────────────────────────────────────────────────── */
function populateDoctorSelect() {
  const sel = document.getElementById('appt-doctor-id');
  sel.innerHTML = DB.doctors.map(d => `<option value="${d.id}">${d.name} — ${d.specialization}</option>`).join('');
}

function populateHours() {
  const sel = document.getElementById('appt-hour');
  sel.innerHTML = '<option value="">Select hour</option>';
  for (let h = 0; h < 24; h++) {
    sel.innerHTML += `<option value="${h}">${String(h).padStart(2,'0')}:00</option>`;
  }
}

function bookAppointment() {
  const docId = parseInt(document.getElementById('appt-doctor-id').value);
  const dateStr = document.getElementById('appt-date').value;
  const hour = document.getElementById('appt-hour').value;
  const symptoms = document.getElementById('appt-symptoms').value.trim();
  const errEl = document.getElementById('appt-error');

  if (!dateStr || hour === '') { errEl.textContent = 'Please select date and hour.'; return; }

  const doc = DB.doctors.find(d => d.id === docId);
  if (!doc) { errEl.textContent = 'Doctor not found.'; return; }

  // Check day availability
  const selectedDay = getDayAbbr(dateStr);
  if (!doc.available_days.includes(selectedDay)) {
    errEl.textContent = `Dr. ${doc.name.split(' ')[1]} is not available on ${selectedDay}s.`;
    return;
  }

  const h = parseInt(hour);
  const startISO = `${dateStr}T${String(h).padStart(2,'0')}:00:00`;
  const endISO = `${dateStr}T${String(h).padStart(2,'0')}:20:00`;

  // Check conflict
  const conflict = DB.appointments.some(a => {
    if (a.doctor_id != docId) return false;
    if (a.status === 'canceled' || a.status === 'cancelled') return false;
    const as = new Date(a.start_time), ae = new Date(a.end_time);
    const ns = new Date(startISO), ne = new Date(endISO);
    return ns < ae && ne > as;
  });

  if (conflict) { errEl.textContent = 'This slot is already booked. Try another hour.'; return; }

  errEl.textContent = '';
  const appt = {
    id: getNextId(DB.appointments),
    user_id: currentUser.id,
    doctor_id: docId,
    start_time: startISO,
    end_time: endISO,
    status: 'booked',
    fees: doc.fees,
    payment_status: 'unpaid',
    booking_time: new Date().toISOString(),
    bill_id: '',
    symptoms_summary: symptoms,
    created_by: currentUser.id
  };
  DB.appointments.push(appt);
  saveDB();
  closeModal('modal-book-appt');
  renderClientAppointments(); renderClientStats(); renderClientUpcoming(); renderTelehealthAppts();
  toast(`Appointment booked with ${doc.name}!`);
}

/* ── TELEHEALTH ───────────────────────────────────────────────────────── */
function renderTelehealthAppts() {
  const uid = currentUser.id;
  const appts = DB.appointments.filter(a => a.user_id == uid && a.status === 'booked');
  const el = document.getElementById('telehealth-appts');
  if (!appts.length) { el.innerHTML = '<div class="empty-state">No active appointments available for telehealth</div>'; return; }
  el.innerHTML = appts.map(a => {
    const doc = DB.doctors.find(d => d.id == a.doctor_id);
    const isTele = doc && doc.consultation_modes.includes('telemedicine');
    return `<div class="tele-appt-item">
      <div class="tele-appt-info">
        <div class="tele-title">${doc ? doc.name : 'Unknown Doctor'}</div>
        <div class="tele-sub">${formatDate(a.start_time)} · ${doc ? doc.specialization : ''} · ${a.symptoms_summary||'No notes'}</div>
      </div>
      <div style="display:flex;align-items:center;gap:0.5rem">
        ${isTele
          ? `<button class="btn-primary" style="font-size:12px;padding:0.4rem 1rem" onclick="startCallForAppt(${a.id})">▶ Join Call</button>`
          : `<span class="badge badge-gray">In-Person Only</span>`
        }
      </div>
    </div>`;
  }).join('');
}

function startCallForAppt(apptId) {
  const a = DB.appointments.find(x => x.id === apptId);
  if (!a) return;
  const doc = DB.doctors.find(d => d.id == a.doctor_id);

  // Navigate to telehealth section
  const telehealthLink = document.querySelector('#page-client [data-section="client-telehealth"]');
  if (telehealthLink) clientNav(telehealthLink, 'client-telehealth');

  const roomId = `medicare-appt-${apptId}-${a.doctor_id}`;
  const roomName = doc ? `Consultation with ${doc.name}` : `Appointment #${apptId}`;

  document.getElementById('video-room-name').textContent = roomName;
  document.getElementById('live-badge').classList.add('active');
  document.getElementById('chat-status').textContent = 'Online';
  document.getElementById('chat-status').classList.add('online');

  const jitsiUrl = `https://meet.jit.si/${roomId}`;
  const frame = document.getElementById('jitsi-frame');
  frame.src = jitsiUrl;
  frame.style.display = 'block';
  document.getElementById('video-placeholder').style.display = 'none';

  document.getElementById('chat-input').disabled = false;
  document.getElementById('btn-send-chat').disabled = false;

  callActive = true;
  chatMessages = [];
  renderChatMessages();

  addSystemMessage(`Joined: ${roomName}`);
  if (doc) {
    setTimeout(() => addBotMessage(`Hello! Dr. ${doc.name.split(' ')[1]} will join shortly. Please describe your symptoms if you haven't already.`), 1500);
  }
  toast('Video consultation started!', 'info');
}

function endCall() {
  if (!callActive && !confirm('End the current session?')) return;
  const frame = document.getElementById('jitsi-frame');
  frame.src = '';
  frame.style.display = 'none';
  document.getElementById('video-placeholder').style.display = 'flex';
  document.getElementById('video-room-name').textContent = 'No active session';
  document.getElementById('live-badge').classList.remove('active');
  document.getElementById('chat-status').textContent = 'Offline';
  document.getElementById('chat-status').classList.remove('online');
  document.getElementById('chat-input').disabled = true;
  document.getElementById('btn-send-chat').disabled = true;
  callActive = false;
  addSystemMessage('Session ended');
  toast('Call ended');
}

function toggleMute() {
  mutedState = !mutedState;
  const btn = document.getElementById('btn-mute');
  btn.textContent = mutedState ? '🎙 Unmute' : '🎙 Mute';
  btn.classList.toggle('active', mutedState);
  toast(mutedState ? 'Microphone muted' : 'Microphone unmuted', 'info');
}

function toggleCam() {
  camState = !camState;
  const btn = document.getElementById('btn-cam');
  btn.textContent = camState ? '📷 Camera' : '📷 Camera Off';
  btn.classList.toggle('active', !camState);
  toast(camState ? 'Camera on' : 'Camera off', 'info');
}

function sendChat() {
  const input = document.getElementById('chat-input');
  const msg = input.value.trim();
  if (!msg || !callActive) return;
  addMessage(msg, 'me');
  input.value = '';
  // Simulate doctor response
  const responses = [
    'I understand. Can you tell me more about when the symptoms started?',
    'Thank you for sharing that. I will review your medical history shortly.',
    'Noted. I will prescribe the appropriate medication after our consultation.',
    'That is helpful. How would you rate the pain on a scale of 1–10?',
    'I see. Please ensure you follow the medication schedule we discussed.'
  ];
  setTimeout(() => {
    addBotMessage(responses[Math.floor(Math.random() * responses.length)]);
  }, 1200 + Math.random() * 800);
}

function addMessage(text, sender) {
  const time = new Date().toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit' });
  chatMessages.push({ text, sender, time });
  renderChatMessages();
}

function addBotMessage(text) {
  addMessage(text, 'them');
}

function addSystemMessage(text) {
  chatMessages.push({ text, sender: 'system' });
  renderChatMessages();
}

function renderChatMessages() {
  const container = document.getElementById('chat-messages');
  container.innerHTML = chatMessages.map(m => {
    if (m.sender === 'system') return `<div class="chat-system-msg">${m.text}</div>`;
    return `<div class="chat-msg ${m.sender}">
      <div class="chat-bubble">${m.text}</div>
      ${m.time ? `<div class="chat-time">${m.time}</div>` : ''}
    </div>`;
  }).join('');
  container.scrollTop = container.scrollHeight;
}

/* ── PROFILE ──────────────────────────────────────────────────────────── */
function loadProfileForm() {
  document.getElementById('profile-name').value = currentUser.name || '';
  document.getElementById('profile-username').value = currentUser.username || '';
  document.getElementById('profile-email').value = currentUser.email || '';
  document.getElementById('profile-phone').value = currentUser.phone || '';
  document.getElementById('profile-password').value = '';
}

function saveProfile() {
  const name = document.getElementById('profile-name').value.trim();
  const email = document.getElementById('profile-email').value.trim();
  const phone = document.getElementById('profile-phone').value.trim();
  const password = document.getElementById('profile-password').value.trim();
  const user = DB.users.find(u => u.id === currentUser.id);
  if (!user) return;
  if (name) user.name = name;
  if (email) user.email = email;
  if (phone) user.phone = phone;
  if (password) user.password = password;
  currentUser = { ...user };
  saveDB();
  document.getElementById('client-name').textContent = currentUser.name;
  document.getElementById('client-welcome-name').textContent = currentUser.name.split(' ')[0];
  document.getElementById('client-avatar').textContent = currentUser.name.charAt(0).toUpperCase();
  document.getElementById('profile-avatar-large').textContent = currentUser.name.charAt(0).toUpperCase();
  document.getElementById('profile-success').textContent = '✓ Profile updated successfully';
  setTimeout(() => { document.getElementById('profile-success').textContent = ''; }, 3000);
  toast('Profile saved');
}

/* ── INIT ──────────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  loadDB();
  document.getElementById('today-date') && (document.getElementById('today-date').textContent = '');
  // Set today's date as default for booking
  const apptDate = document.getElementById('appt-date');
  if (apptDate) apptDate.valueAsDate = new Date();
});
