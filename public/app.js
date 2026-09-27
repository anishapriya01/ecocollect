// EcoCollect High-Contrast Command Center Script

let activeTab = 'request';
let currentSelectedCategory = 'Recyclable';
let autoPollTimer = null;
let currentTrackedId = '';
const API_BASE = '/api';

// Matrix Category Info
const CATEGORY_MATRIX = {
  Organic: {
    name: 'Organic Waste',
    icon: '🥬',
    badge: 'bg-mint-500/15 text-mint-300 border-mint-500/30',
    description: 'Food scraps, yard trimmings, coffee grounds, compostables.',
    accepted: ['Food Scraps', 'Garden Trimmings', 'Coffee Grounds', 'Eggshells'],
    prohibited: ['Plastics', 'Metals', 'Chemicals', 'Treated Wood'],
    tip: 'Keep in compostable bags or covered containers prior to arrival.'
  },
  Recyclable: {
    name: 'Recyclables',
    icon: '♻️',
    badge: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
    description: 'Paper, cardboard, clean PET bottles, cans, glass containers.',
    accepted: ['Cardboard Boxes', 'Plastic Bottles (PET/HDPE)', 'Aluminum Cans', 'Glass Jars'],
    prohibited: ['Stained Packaging', 'Plastic Wrap', 'Ceramics', 'Broken Glass'],
    tip: 'Rinse containers thoroughly and flatten boxes for payload efficiency.'
  },
  'E-Waste': {
    name: 'E-Waste & Hardware',
    icon: '🔌',
    badge: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
    description: 'Laptops, mobile devices, chargers, monitors, appliances.',
    accepted: ['Laptops & PCs', 'Smartphones', 'Chargers & Cables', 'Printers'],
    prohibited: ['Large Refrigerators', 'Leaking Industrial Equipment'],
    tip: 'Sanitize personal storage drives prior to collection dispatch.'
  },
  Hazardous: {
    name: 'Hazardous Materials',
    icon: '⚠️',
    badge: 'bg-copper-500/15 text-copper-300 border-copper-500/30',
    description: 'Paints, solvents, motor oil, household chemicals, batteries.',
    accepted: ['Household Cleaners', 'Paint Tins', 'Motor Oil', 'Fluorescent Lights'],
    prohibited: ['Explosives', 'Radioactive Items', 'Unsealed Syringes'],
    tip: 'Ensure chemical caps are tightly sealed in original container.'
  }
};

// DOM Content Loaded Init
document.addEventListener('DOMContentLoaded', () => {
  initDatePicker();
  selectCategory('Recyclable');
  loadRecentTrackings();
  updateCo2Calculator();
  renderGuideCards();

  // Initial Fetch for Admin Data
  fetchAdminData();

  // Start Live Auto-Polling every 5 seconds
  autoPollTimer = setInterval(() => {
    fetchAdminData(true); // silent background poll
  }, 5000);
});

// Tab Switcher
function switchTab(tabId) {
  activeTab = tabId;
  document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
  document.querySelectorAll('.nav-tab-btn').forEach(btn => btn.classList.remove('active'));

  const targetTab = document.getElementById(`tab-${tabId}`);
  if (targetTab) targetTab.classList.remove('hidden');

  const targetBtn = document.getElementById(`tab-btn-${tabId}`);
  if (targetBtn) targetBtn.classList.add('active');

  if (tabId === 'admin') {
    fetchAdminData();
  }
}

// Mobile Menu Toggle
function toggleMobileMenu() {
  const menu = document.getElementById('mobile-menu');
  menu.classList.toggle('hidden');
}

// Date Picker Init (Min = Today)
function initDatePicker() {
  const input = document.getElementById('form-date');
  if (input) {
    const today = new Date().toISOString().split('T')[0];
    input.min = today;
    input.value = today;
  }
}

// Category Card Selection
function selectCategory(categoryName) {
  currentSelectedCategory = categoryName;
  document.getElementById('selected-category').value = categoryName;

  document.querySelectorAll('.category-card').forEach(card => card.classList.remove('selected'));
  const selectedCard = document.getElementById(`cat-card-${categoryName}`);
  if (selectedCard) selectedCard.classList.add('selected');

  const tipBox = document.getElementById('category-tip-box');
  const tipTitle = document.getElementById('cat-tip-title');
  const tipText = document.getElementById('cat-tip-text');

  const meta = CATEGORY_MATRIX[categoryName];
  if (meta && tipBox) {
    tipTitle.innerText = `${meta.name} Compliance Guidelines:`;
    tipText.innerText = meta.tip;
  }
}

// Timeslot Selector
function selectTimeSlot(slotValue) {
  document.getElementById('selected-timeslot').value = slotValue;
  document.querySelectorAll('.timeslot-pill').forEach(btn => {
    const check = btn.querySelector('.fa-circle-check');
    if (btn.innerText.includes(slotValue.split(' ')[0])) {
      btn.classList.add('active');
      if (check) check.classList.remove('hidden');
    } else {
      btn.classList.remove('active');
      if (check) check.classList.add('hidden');
    }
  });
}

// Submit Pickup Request
async function handleRequestSubmit(e) {
  e.preventDefault();

  const btn = document.getElementById('submit-request-btn');
  const originalHtml = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = `<i class="fa-solid fa-circle-notch animate-spin text-slate-950"></i> Processing...`;

  const payload = {
    category: document.getElementById('selected-category').value,
    name: document.getElementById('form-name').value.trim(),
    phone: document.getElementById('form-phone').value.trim(),
    address: document.getElementById('form-address').value.trim(),
    date: document.getElementById('form-date').value,
    slot: document.getElementById('selected-timeslot').value,
    notes: document.getElementById('form-notes').value.trim()
  };

  try {
    const res = await fetch(`${API_BASE}/requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (res.ok && data.tracking_id) {
      document.getElementById('pickup-form').reset();
      initDatePicker();
      selectCategory('Recyclable');

      saveRecentTracking(data.tracking_id);
      showSuccessModal(data.tracking_id);
      showToast(`Collection order logged! Tracking ID: ${data.tracking_id}`, 'success');

      fetchAdminData();
    } else {
      showToast(data.error || 'Failed to log request.', 'error');
    }
  } catch (err) {
    showToast('Network error connecting to Express API node.', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalHtml;
  }
}

// Search Order Tracking ID
function handleTrackSearch() {
  const input = document.getElementById('track-id-input');
  const id = input.value.trim();
  if (!id) {
    showToast('Please enter a valid Tracking ID.', 'warning');
    return;
  }
  trackRequest(id);
}

// Fetch Request Tracking Details
async function trackRequest(trackingId) {
  currentTrackedId = trackingId;
  const container = document.getElementById('tracking-result-container');

  try {
    const res = await fetch(`${API_BASE}/requests/${encodeURIComponent(trackingId)}`);
    const data = await res.json();

    if (res.ok && data.tracking_id) {
      container.classList.remove('hidden');
      renderTrackingDetails(data);
      saveRecentTracking(data.tracking_id);
    } else {
      container.classList.add('hidden');
      showToast(data.error || `Tracking ID "${trackingId}" not found.`, 'error');
    }
  } catch (err) {
    showToast('Network error querying tracking record.', 'error');
  }
}

// Render Tracking Details & Timeline
function renderTrackingDetails(req) {
  document.getElementById('result-tracking-id').innerText = req.tracking_id;
  document.getElementById('result-created-date').innerText = formatDate(req.created_at);
  document.getElementById('result-date').innerText = req.date || req.pickup_date || 'Today';
  document.getElementById('result-slot').innerText = req.slot || req.time_slot || 'Morning Window';
  document.getElementById('result-resident').innerText = req.name;
  document.getElementById('result-address').innerText = `${req.address} (Tel: ${req.phone})`;
  document.getElementById('result-notes').innerText = req.notes || 'No dispatch notes attached.';

  // Category Badge
  const catBadge = document.getElementById('result-category-badge');
  const meta = CATEGORY_MATRIX[req.category] || {};
  catBadge.className = `px-3 py-1 rounded-full text-xs font-bold border ${meta.badge || 'bg-slate-800 text-slate-300'}`;
  catBadge.innerText = `${meta.icon || '📦'} ${req.category}`;

  // Status Badge
  const statusBadge = document.getElementById('result-status-badge');
  statusBadge.className = `px-4 py-1.5 rounded-full text-xs font-extrabold uppercase border shadow-sm ${getStatusBadgeClasses(req.status)}`;
  statusBadge.innerText = req.status;

  // Stepper Visual Progress
  const progressMap = { Pending: 0, Scheduled: 50, Completed: 100, Cancelled: 0 };
  const pct = progressMap[req.status] !== undefined ? progressMap[req.status] : 0;
  const progressBar = document.getElementById('stepper-progress-bar');
  
  if (req.status === 'Cancelled') {
    progressBar.style.width = '0%';
  } else {
    progressBar.style.width = `${pct}%`;
  }

  // Stepper Node Icons
  const statuses = ['Pending', 'Scheduled', 'Completed'];
  const curIdx = statuses.indexOf(req.status);

  for (let i = 1; i <= 3; i++) {
    const icon = document.getElementById(`step-icon-${i}`);
    const label = document.getElementById(`step-label-${i}`);

      if (req.status === 'Cancelled') {
      icon.className = 'w-8 h-8 rounded-full bg-gray-100 text-gray-400 font-bold flex items-center justify-center text-xs border border-gray-300';
      if (label) label.className = 'mt-2 text-xs font-semibold text-gray-400';
    } else if (i - 1 <= curIdx) {
      icon.className = 'w-8 h-8 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center text-xs shadow-emerald-glow';
      if (label) label.className = 'mt-2 text-xs font-semibold text-emerald-700';
    } else {
      icon.className = 'w-8 h-8 rounded-full bg-gray-100 text-gray-400 font-bold flex items-center justify-center text-xs border border-gray-300';
      if (label) label.className = 'mt-2 text-xs font-semibold text-gray-500';
    }
  }
}

// Fetch Admin Data
async function fetchAdminData(silent = false) {
  try {
    const res = await fetch(`${API_BASE}/requests`);
    const data = await res.json();

    if (res.ok && Array.isArray(data.requests)) {
      renderAdminTable(data.requests);
      calculateAndRenderMetrics(data.requests);
    }
  } catch (err) {
    if (!silent) showToast('Could not refresh admin dispatch records.', 'error');
  }
}

// Render Admin Request Table
function renderAdminTable(requests) {
  const tbody = document.getElementById('admin-table-body');
  const emptyState = document.getElementById('admin-empty-state');
  const searchVal = (document.getElementById('admin-search-input')?.value || '').toLowerCase().trim();

  if (!tbody) return;

  let filtered = requests;
  if (searchVal) {
    filtered = requests.filter(r => 
      (r.tracking_id || '').toLowerCase().includes(searchVal) ||
      (r.name || '').toLowerCase().includes(searchVal) ||
      (r.address || '').toLowerCase().includes(searchVal) ||
      (r.category || '').toLowerCase().includes(searchVal)
    );
  }

  if (filtered.length === 0) {
    tbody.innerHTML = '';
    emptyState.classList.remove('hidden');
    return;
  }

  emptyState.classList.add('hidden');
  tbody.innerHTML = filtered.map(req => {
    const meta = CATEGORY_MATRIX[req.category] || {};
    return `
      <tr class="hover:bg-obsidian-850/80 transition-colors">
        
        <!-- Tracking ID -->
        <td class="py-4 px-6">
          <button onclick="switchTab('track'); document.getElementById('track-id-input').value='${req.tracking_id}'; trackRequest('${req.tracking_id}')"
            class="font-mono font-black text-mint-400 hover:text-white underline flex items-center gap-1.5 text-sm">
            ${req.tracking_id}
          </button>
          <span class="text-[10px] text-slate-500 block mt-0.5">${formatDate(req.created_at)}</span>
        </td>

        <!-- Category -->
        <td class="py-4 px-4">
          <span class="px-3 py-1 rounded-lg text-xs font-bold border ${meta.badge || 'bg-slate-800 text-slate-300'} inline-flex items-center gap-1.5">
            <span>${meta.icon || '📦'}</span>
            <span>${req.category}</span>
          </span>
        </td>

        <!-- Resident & Contact -->
        <td class="py-4 px-4">
          <span class="font-extrabold text-white block text-xs sm:text-sm">${escapeHtml(req.name)}</span>
          <span class="text-xs text-slate-400 font-mono block">${escapeHtml(req.phone)}</span>
        </td>

        <!-- Address -->
        <td class="py-4 px-4 max-w-xs">
          <span class="text-xs text-slate-300 font-medium line-clamp-2">${escapeHtml(req.address)}</span>
        </td>

        <!-- Window -->
        <td class="py-4 px-4">
          <span class="text-xs font-bold text-white block">${req.date || req.pickup_date || 'Today'}</span>
          <span class="text-[11px] text-slate-400 font-medium block">${(req.slot || req.time_slot || '').split(' ')[0]}</span>
        </td>

        <!-- Glowing Status Dot Badge -->
        <td class="py-4 px-4">
          <span class="px-3.5 py-1.5 rounded-full text-xs font-extrabold border ${getStatusBadgeClasses(req.status)} inline-flex items-center gap-2">
            <span class="w-2 h-2 rounded-full ${getStatusDotBg(req.status)}"></span>
            <span>${req.status}</span>
          </span>
        </td>

        <!-- Dispatch Actions -->
        <td class="py-4 px-6 text-right">
          <div class="flex items-center justify-end gap-2">
            ${renderStatusButtons(req.id, req.status)}
          </div>
        </td>

      </tr>
    `;
  }).join('');
}

// Status Button Renderer
function renderStatusButtons(id, status) {
  if (status === 'Pending') {
    return `
      <button onclick="updateStatus(${id}, 'Scheduled')" class="px-3 py-1.5 text-xs font-extrabold rounded-xl bg-blue-500/15 text-blue-400 hover:bg-blue-500/25 border border-blue-500/30 transition-all flex items-center gap-1 cursor-pointer">
        <i class="fa-solid fa-truck-fast"></i> Schedule
      </button>
    `;
  } else if (status === 'Scheduled') {
    return `
      <button onclick="updateStatus(${id}, 'Completed')" class="px-3 py-1.5 text-xs font-extrabold rounded-xl bg-mint-500/15 text-mint-300 hover:bg-mint-500/25 border border-mint-500/30 transition-all flex items-center gap-1 cursor-pointer">
        <i class="fa-solid fa-circle-check"></i> Complete
      </button>
    `;
  } else if (status === 'Completed') {
    return `
      <span class="text-[11px] font-extrabold text-mint-300 bg-mint-500/10 px-2.5 py-1 rounded-lg border border-mint-500/20">✓ Recovered</span>
    `;
  } else {
    return `
      <button onclick="updateStatus(${id}, 'Pending')" class="px-2.5 py-1 text-xs font-bold rounded-lg bg-slate-800 text-slate-400 hover:text-white cursor-pointer">
        Reset
      </button>
    `;
  }
}

// Update Status Action
async function updateStatus(id, newStatus) {
  try {
    const res = await fetch(`${API_BASE}/requests/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    });

    const data = await res.json();
    if (res.ok) {
      showToast(`Order status updated to "${newStatus}"`, 'success');
      fetchAdminData();
    } else {
      showToast(data.error || 'Failed to update status.', 'error');
    }
  } catch (err) {
    showToast('Network error updating status.', 'error');
  }
}

// Metrics & Category Distribution Bar
function calculateAndRenderMetrics(requests) {
  const total = requests.length;
  const pending = requests.filter(r => r.status === 'Pending').length;
  const scheduled = requests.filter(r => r.status === 'Scheduled').length;
  const completed = requests.filter(r => r.status === 'Completed').length;
  const divertedKg = completed * 15;

  document.getElementById('stat-total').innerText = total;
  document.getElementById('stat-pending').innerText = pending;
  document.getElementById('stat-scheduled').innerText = scheduled;
  document.getElementById('stat-completed').innerText = completed;
  document.getElementById('stat-diverted').innerText = `${divertedKg} kg Saved`;

  const pPending = total > 0 ? Math.round((pending / total) * 100) : 0;
  const pScheduled = total > 0 ? Math.round((scheduled / total) * 100) : 0;
  const pCompleted = total > 0 ? Math.round((completed / total) * 100) : 0;

  document.getElementById('bar-pending-pct').style.width = `${pPending}%`;
  document.getElementById('bar-scheduled-pct').style.width = `${pScheduled}%`;
  document.getElementById('bar-completed-pct').style.width = `${pCompleted}%`;

  const organicCount = requests.filter(r => r.category === 'Organic').length;
  const recCount = requests.filter(r => r.category === 'Recyclable').length;
  const ewasteCount = requests.filter(r => r.category === 'E-Waste').length;
  const hazCount = requests.filter(r => r.category === 'Hazardous').length;

  document.getElementById('distribution-total-label').innerText = `${total} Total Collection Items`;

  if (total === 0) {
    document.getElementById('dist-organic').style.width = '25%';
    document.getElementById('dist-recyclable').style.width = '25%';
    document.getElementById('dist-ewaste').style.width = '25%';
    document.getElementById('dist-hazardous').style.width = '25%';

    document.getElementById('pct-organic').innerText = '0%';
    document.getElementById('pct-recyclable').innerText = '0%';
    document.getElementById('pct-ewaste').innerText = '0%';
    document.getElementById('pct-hazardous').innerText = '0%';
  } else {
    const pOrg = Math.round((organicCount / total) * 100);
    const pRec = Math.round((recCount / total) * 100);
    const pEwa = Math.round((ewasteCount / total) * 100);
    const pHaz = Math.round((hazCount / total) * 100);

    document.getElementById('dist-organic').style.width = `${pOrg}%`;
    document.getElementById('dist-recyclable').style.width = `${pRec}%`;
    document.getElementById('dist-ewaste').style.width = `${pEwa}%`;
    document.getElementById('dist-hazardous').style.width = `${pHaz}%`;

    document.getElementById('pct-organic').innerText = `${pOrg}%`;
    document.getElementById('pct-recyclable').innerText = `${pRec}%`;
    document.getElementById('pct-ewaste').innerText = `${pEwa}%`;
    document.getElementById('pct-hazardous').innerText = `${pHaz}%`;
  }
}

// Search Filter
function filterAdminTable() {
  fetchAdminData(true);
}

// Render Recycling Matrix Cards
function renderGuideCards() {
  const grid = document.getElementById('guide-cards-grid');
  if (!grid) return;

    grid.innerHTML = Object.entries(CATEGORY_MATRIX).map(([key, cat]) => `
    <div class="bg-white rounded-xl p-6 border border-gray-200 shadow-sm space-y-5 flex flex-col justify-between hover:shadow-md transition-shadow">
      <div class="space-y-3">
        <div class="flex items-center gap-3">
          <span class="text-3xl p-3 bg-gray-50 rounded-xl border border-gray-200">${cat.icon}</span>
          <div>
            <h3 class="font-display font-bold text-base text-gray-900">${cat.name}</h3>
            <span class="text-xs font-semibold px-2.5 py-0.5 rounded-md border ${
              key === 'Organic' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
              key === 'Recyclable' ? 'bg-blue-50 text-blue-800 border-blue-200' :
              key === 'E-Waste' ? 'bg-purple-50 text-purple-800 border-purple-200' :
              'bg-amber-50 text-amber-800 border-amber-200'
            }">${key}</span>
          </div>
        </div>

        <p class="text-xs text-gray-600 leading-relaxed">${cat.description}</p>

        <!-- Accepted -->
        <div class="space-y-1.5">
          <span class="text-xs font-bold uppercase tracking-wider text-emerald-700 flex items-center gap-1.5">
            <i class="fa-solid fa-circle-check"></i> Accepted Items
          </span>
          <div class="flex flex-wrap gap-1.5">
            ${cat.accepted.map(i => `<span class="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 text-xs font-semibold border border-emerald-100">${i}</span>`).join('')}
          </div>
        </div>

        <!-- Prohibited -->
        <div class="space-y-1.5">
          <span class="text-xs font-bold uppercase tracking-wider text-red-600 flex items-center gap-1.5">
            <i class="fa-solid fa-circle-xmark"></i> Prohibited Items
          </span>
          <div class="flex flex-wrap gap-1.5">
            ${cat.prohibited.map(i => `<span class="px-2.5 py-1 rounded-lg bg-red-50 text-red-700 text-xs font-semibold border border-red-100">${i}</span>`).join('')}
          </div>
        </div>
      </div>

      <div class="pt-3 border-t border-gray-100 text-xs text-gray-600 flex items-start gap-2">
        <i class="fa-solid fa-lightbulb text-amber-500 text-sm mt-0.5"></i>
        <span><strong class="text-gray-800">Tip:</strong> ${cat.tip}</span>
      </div>
    </div>
  `).join('');
}

// Environmental Savings Calculator
function updateCo2Calculator() {
  const slider = document.getElementById('co2-slider');
  if (!slider) return;

  const kg = parseInt(slider.value, 10);
  document.getElementById('calc-weight-label').innerText = `${kg} kg / week`;

  const annualCo2 = Math.round(kg * 52 * 2.2);
  const trees = (annualCo2 / 21).toFixed(1);

  document.getElementById('calc-co2').innerText = `${annualCo2.toLocaleString()} kg`;
  document.getElementById('calc-trees').innerText = `${trees} 🌲`;
}

// LocalStorage Tracking History Memory
function saveRecentTracking(id) {
  if (!id) return;
  let recent = JSON.parse(localStorage.getItem('ecocollect_recent_ids') || '[]');
  if (!recent.includes(id)) {
    recent.unshift(id);
    if (recent.length > 4) recent.pop();
    localStorage.setItem('ecocollect_recent_ids', JSON.stringify(recent));
  }
  loadRecentTrackings();
}

function loadRecentTrackings() {
  const container = document.getElementById('recent-trackings-container');
  const pills = document.getElementById('recent-track-pills');
  let recent = JSON.parse(localStorage.getItem('ecocollect_recent_ids') || '[]');

  if (recent.length === 0) {
    container.classList.add('hidden');
    return;
  }

  container.classList.remove('hidden');
  pills.innerHTML = recent.map(id => `
    <button onclick="document.getElementById('track-id-input').value='${id}'; trackRequest('${id}')"
      class="px-3 py-1 rounded-xl bg-obsidian-950 hover:bg-obsidian-850 text-mint-400 font-mono text-xs font-bold border border-slate-800 transition-all flex items-center gap-1.5 cursor-pointer">
      <i class="fa-solid fa-clock-rotate-left text-slate-500"></i> ${id}
    </button>
  `).join('');
}

// Modals
function showSuccessModal(trackingId) {
  document.getElementById('modal-tracking-id').innerText = trackingId;
  document.getElementById('success-modal').classList.remove('hidden');
}

function closeSuccessModal() {
  document.getElementById('success-modal').classList.add('hidden');
}

function closeModalAndTrack() {
  const id = document.getElementById('modal-tracking-id').innerText;
  closeSuccessModal();
  switchTab('track');
  document.getElementById('track-id-input').value = id;
  trackRequest(id);
}

function copyModalTrackingId() {
  const id = document.getElementById('modal-tracking-id').innerText;
  navigator.clipboard.writeText(id);
  showToast(`Copied ${id} to clipboard!`, 'info');
}

// Toast Notifications
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const bgMap = {
    success: 'bg-white text-gray-900 border-emerald-400 shadow-lg',
    error:   'bg-white text-gray-900 border-red-400 shadow-lg',
    warning: 'bg-white text-gray-900 border-amber-400 shadow-lg',
    info:    'bg-white text-gray-900 border-blue-300 shadow-lg'
  };

  const iconMap = {
    success: 'fa-circle-check text-emerald-600',
    error:   'fa-circle-xmark text-red-500',
    warning: 'fa-triangle-exclamation text-amber-500',
    info:    'fa-circle-info text-blue-500'
  };

  const toast = document.createElement('div');
  toast.className = `pointer-events-auto flex items-center gap-3 px-4 py-3.5 rounded-2xl shadow-2xl border text-xs font-bold animate-fade-in ${bgMap[type] || bgMap.info}`;
  toast.innerHTML = `
    <i class="fa-solid ${iconMap[type] || iconMap.info} text-base"></i>
    <span>${escapeHtml(message)}</span>
  `;

  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// Helpers
function getStatusBadgeClasses(status) {
  const getStatusBadgeClasses_map = {
    Pending:   'bg-amber-50 text-amber-800 border-amber-200',
    Scheduled: 'bg-blue-50 text-blue-800 border-blue-200',
    Completed: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    Cancelled: 'bg-red-50 text-red-700 border-red-200'
  };
  return getStatusBadgeClasses_map[status] || 'bg-gray-100 text-gray-700 border-gray-200';
}

function getStatusDotBg(status) {
  const dotMap = {
    Pending:   'bg-amber-500 animate-ping',
    Scheduled: 'bg-blue-500 animate-pulse',
    Completed: 'bg-emerald-500',
    Cancelled: 'bg-red-500'
  };
  return dotMap[status] || 'bg-gray-400';
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>"']/g, match => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[match]);
}
