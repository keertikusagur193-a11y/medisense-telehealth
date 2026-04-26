// Doctor Dashboard JS
const apiBaseUrl = "http://localhost:8000";
const storageKey = "medisense-cases";
const sessionKey = "medisense-session";

let currentSession = null;
let currentToken = null; // JWT token for authenticated requests
let activeUrgencyFilter = "all";
let activeRecordTab = "consultations";
let apiState = "checking";
let allConsultations = [];
let selectedPatientData = null;

// DOM Elements (will be initialized after page loads)
let profileName, profileEmail, profilePhone, profileDoctorId, sessionCopy, patientList, patientSearch;
let filterButtons, selectedPatient, prescriptionInput, savePrescriptionButton;
let apiBanner, apiStatusText, queueCountPill, queueCount;
let recordTabs, recordList, recordsMeta, refreshRecordsButton, refreshQueueButton;
let timelineList, logoutButton;

function initDOMElements() {
  profileName = document.getElementById("profileName");
  profileEmail = document.getElementById("profileEmail");
  profilePhone = document.getElementById("profilePhone");
  profileDoctorId = document.getElementById("profileDoctorId");
  sessionCopy = document.getElementById("sessionCopy");
  patientList = document.getElementById("patientList");
  patientSearch = document.getElementById("patientSearch");
  filterButtons = document.querySelectorAll("[data-filter]");
  selectedPatient = document.getElementById("selectedPatient");
  prescriptionInput = document.getElementById("prescriptionInput");
  savePrescriptionButton = document.getElementById("savePrescriptionButton");
  apiBanner = document.getElementById("apiBanner");
  apiStatusText = document.getElementById("apiStatusText");
  queueCountPill = document.getElementById("queueCountPill");
  queueCount = document.getElementById("queueCount");
  recordTabs = document.querySelectorAll("[data-record-tab]");
  recordList = document.getElementById("recordList");
  recordsMeta = document.getElementById("recordsMeta");
  refreshRecordsButton = document.getElementById("refreshRecordsButton");
  refreshQueueButton = document.getElementById("refreshQueueButton");
  timelineList = document.getElementById("timelineList");
  logoutButton = document.getElementById("logoutButton");
}

// Initialize
function init() {
  console.log("Doctor Dashboard: Initializing...");
  loadSession();
  if (!currentSession) {
    console.warn("Doctor Dashboard: No session found, redirecting to login");
    setTimeout(() => {
      window.location.href = "login.html";
    }, 500);
    return;
  }

  // For doctors, check if we have a JWT token
  if (currentSession.role === "doctor") {
    currentToken = sessionStorage.getItem("medisense-jwt-token");
    if (!currentToken) {
      console.warn("Doctor Dashboard: No JWT token found, redirecting to login");
      setTimeout(() => {
        window.location.href = "login.html";
      }, 500);
      return;
    }
  }

  console.log("Doctor Dashboard: Session loaded", currentSession);
  
  // Add authenticated class to show the dashboard
  document.body.classList.add("authenticated");
  
  if (!profileName) {
    console.error("Doctor Dashboard: DOM elements not initialized");
    return;
  }

  profileName.textContent = currentSession.name;
  profileEmail.textContent = currentSession.email;
  if (profilePhone) profilePhone.textContent = currentSession.phone || "No phone number";
  if (profileDoctorId) profileDoctorId.textContent = `ID: ${currentSession.doctorId || "N/A"}`;
  sessionCopy.textContent = `Welcome, ${currentSession.name}!`;

  console.log("Doctor Dashboard: UI updated");
  checkApiStatus();
  setupEventListeners();
  loadPatientQueue();
  console.log("Doctor Dashboard: Initialization complete");
}

function loadSession() {
  const stored = sessionStorage.getItem(sessionKey);
  if (stored) {
    currentSession = JSON.parse(stored);
  }
}

function checkApiStatus() {
  fetch(`${apiBaseUrl}/health`)
    .then((res) => res.json())
    .then((data) => {
      apiState = "connected";
      apiStatusText.textContent = "Connected to FastAPI backend with " + data.database;
      apiBanner.classList.add("connected");
    })
    .catch(() => {
      apiState = "offline";
      apiStatusText.textContent = "Backend offline - using browser storage";
      apiBanner.classList.add("offline");
    });
}

function setupEventListeners() {
  filterButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      filterButtons.forEach((b) => b.classList.remove("active-filter"));
      btn.classList.add("active-filter");
      activeUrgencyFilter = btn.dataset.filter;
      filterPatients();
    });
  });

  patientSearch.addEventListener("input", filterPatients);
  savePrescriptionButton.addEventListener("click", savePrescription);
  logoutButton.addEventListener("click", logout);
  refreshQueueButton.addEventListener("click", loadPatientQueue);
  refreshRecordsButton.addEventListener("click", loadRecords);

  recordTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      recordTabs.forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      activeRecordTab = tab.dataset.recordTab;
      loadRecords();
    });
  });
}

function loadPatientQueue() {
  if (apiState === "connected") {
    fetch(`${apiBaseUrl}/consultations`)
      .then((res) => res.json())
      .then((data) => {
        allConsultations = data;
        displayQueue();
      })
      .catch(() => {
        loadQueueLocal();
      });
  } else {
    loadQueueLocal();
  }
}

function loadQueueLocal() {
  const cases = JSON.parse(localStorage.getItem(storageKey) || "[]");
  allConsultations = cases;
  displayQueue();
}

function displayQueue() {
  const uniquePatients = [];
  const seen = new Set();

  allConsultations.forEach((c) => {
    const key = c.name;
    if (!seen.has(key)) {
      seen.add(key);
      uniquePatients.push(c);
    }
  });

  filterPatients();
  queueCount.textContent = uniquePatients.length;
  queueCountPill.textContent = `${uniquePatients.length} active`;
}

function filterPatients() {
  let filtered = allConsultations;

  // Filter by urgency
  if (activeUrgencyFilter !== "all") {
    filtered = filtered.filter(
      (p) => p.urgency?.toLowerCase() === activeUrgencyFilter.toLowerCase()
    );
  }

  // Filter by search
  const searchTerm = patientSearch.value.toLowerCase();
  if (searchTerm) {
    filtered = filtered.filter(
      (p) =>
        p.name?.toLowerCase().includes(searchTerm) ||
        p.symptomsText?.toLowerCase().includes(searchTerm) ||
        p.topRisk?.toLowerCase().includes(searchTerm)
    );
  }

  displayPatientList(filtered);
}

function displayPatientList(patients) {
  if (!patients || patients.length === 0) {
    patientList.innerHTML =
      '<div style="padding: 20px; text-align: center; color: #999;">No patients in queue.</div>';
    return;
  }

  patientList.innerHTML = patients
    .map((patient, idx) => {
      const urgency = patient.urgency || "Medium";
      const status = patient.status || "submitted";
      const statusClass = getStatusClass(status);
      const statusText = getStatusText(status);
      const initials = patient.name
        ?.split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase() || "?";
      const colors = ["teal", "coral", "violet", "amber"];
      const color = colors[idx % colors.length];

      return `
      <article class="patient-row" data-patient-id="${patient.id || idx}">
        <div class="avatar ${color}">${initials}</div>
        <div class="patient-info">
          <strong>${patient.name || "Unknown"}</strong>
          <small>${patient.symptomsText?.substring(0, 50) || "No symptoms recorded"}...</small>
          <div class="patient-status">
            <span class="status-badge ${statusClass}">${statusText}</span>
          </div>
        </div>
        <div class="patient-actions">
          <span class="urgency ${urgency?.toLowerCase() || "medium"}">${urgency}</span>
          <select class="status-select" data-patient-id="${patient.id || idx}" onchange="updateConsultationStatus('${patient.id || idx}', this.value)">
            <option value="submitted" ${status === 'submitted' ? 'selected' : ''}>Submitted</option>
            <option value="reviewing" ${status === 'reviewing' ? 'selected' : ''}>Reviewing</option>
            <option value="scheduled" ${status === 'scheduled' ? 'selected' : ''}>Scheduled</option>
            <option value="in_progress" ${status === 'in_progress' ? 'selected' : ''}>In Progress</option>
            <option value="completed" ${status === 'completed' ? 'selected' : ''}>Completed</option>
            <option value="cancelled" ${status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
          </select>
        </div>
      </article>
    `;
    })
    .join("");

  // Add click listeners
  document.querySelectorAll(".patient-row").forEach((row) => {
    row.addEventListener("click", () => selectPatient(row, patients));
  });
}

function selectPatient(row, patients) {
  document.querySelectorAll(".patient-row").forEach((r) => r.classList.remove("active"));
  row.classList.add("active");

  const patientId = row.dataset.patientId;
  const patient = patients.find(
    (p) => (p.id || patients.indexOf(p)) == patientId
  );

  if (patient) {
    selectedPatientData = patient;
    selectedPatient.innerHTML = `
      <strong>${patient.name}</strong>
      <small>${patient.symptomsText?.substring(0, 80) || "N/A"}...</small>
    `;
    updateTimeline(patient);
  }
}

function updateTimeline(patient) {
  timelineList.innerHTML = `
    <li>
      <span></span>
      <div>
        <strong>Symptoms reported</strong>
        <small>${patient.symptomsText?.substring(0, 100) || "N/A"}...</small>
      </div>
    </li>
    <li>
      <span></span>
      <div>
        <strong>AI assessment</strong>
        <small>Top risk: ${patient.topRisk || "N/A"} (${patient.urgency || "Medium"} priority)</small>
      </div>
    </li>
    <li>
      <span></span>
      <div>
        <strong>Ready for review</strong>
        <small>Patient: ${patient.name || "Unknown"} | Age: ${patient.age || "N/A"}</small>
      </div>
    </li>
  `;
}

function savePrescription() {
  if (!selectedPatientData) {
    alert("Please select a patient first");
    return;
  }

  const advice = prescriptionInput.value.trim();
  if (!advice) {
    alert("Please enter medical advice");
    return;
  }

  const prescription = {
    patientName: selectedPatientData.name,
    symptoms: selectedPatientData.symptomsText,
    urgency: selectedPatientData.urgency,
    advice: advice,
    doctorName: currentSession.name,
  };

  if (apiState === "connected") {
    fetch(`${apiBaseUrl}/prescriptions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(prescription),
    })
      .then((res) => res.json())
      .then(() => {
        showSuccessMessage("Prescription saved to patient record");
        prescriptionInput.value = "";
        loadRecords();
      })
      .catch(() => {
        savePrescriptionLocal(prescription);
      });
  } else {
    savePrescriptionLocal(prescription);
  }
}

function savePrescriptionLocal(prescription) {
  const prescriptions = JSON.parse(localStorage.getItem("medisense-prescriptions") || "[]");
  prescriptions.unshift(prescription);
  localStorage.setItem("medisense-prescriptions", JSON.stringify(prescriptions));
  showSuccessMessage("Prescription saved to device");
}

function loadRecords() {
  if (apiState === "connected") {
    fetch(`${apiBaseUrl}/consultations`)
      .then((res) => res.json())
      .then((data) => {
        displayRecords(data);
      })
      .catch(() => {
        loadRecordsLocal();
      });
  } else {
    loadRecordsLocal();
  }
}

function loadRecordsLocal() {
  const records =
    activeRecordTab === "prescriptions"
      ? JSON.parse(localStorage.getItem("medisense-prescriptions") || "[]")
      : JSON.parse(localStorage.getItem(storageKey) || "[]");
  displayRecords(records);
}

function displayRecords(records) {
  if (!records || records.length === 0) {
    recordList.innerHTML = "<p style='padding: 20px; color: #999;'>No records found.</p>";
    recordsMeta.textContent = "No records in this category.";
    return;
  }

  recordsMeta.textContent = `Found ${records.length} record(s)`;
  recordList.innerHTML = records
    .slice(0, 10)
    .map(
      (r, i) => `
    <div class="record-item">
      <strong>#${i + 1} - ${r.name || r.patientName || "Unknown"}</strong>
      <small>${r.symptomsText || r.advice || "No details"}...</small>
      <small>Priority: ${r.urgency || "N/A"}</small>
    </div>
  `
    )
    .join("");
}

function showSuccessMessage(msg) {
  const div = document.createElement("div");
  div.style.cssText =
    "position: fixed; top: 20px; right: 20px; background: #4caf50; color: white; padding: 15px 20px; border-radius: 4px; z-index: 1000;";
  div.textContent = msg;
  document.body.appendChild(div);
  setTimeout(() => div.remove(), 3000);
}

// Global function for status updates
window.updateConsultationStatus = async function(consultationId, newStatus) {
  try {
    const response = await fetch(`${apiBaseUrl}/consultations/${consultationId}/status?status=${encodeURIComponent(newStatus)}`, {
      method: 'PUT',
    });

    if (response.ok) {
      showMessage(`Consultation status updated to ${getStatusText(newStatus)}`, 'success');
      loadPatientQueue(); // Refresh the queue
    } else {
      showMessage('Failed to update consultation status', 'error');
    }
  } catch (error) {
    console.error('Error updating status:', error);
    showMessage('Error updating consultation status', 'error');
  }
};

function getStatusClass(status) {
  const statusClasses = {
    'submitted': 'status-submitted',
    'reviewing': 'status-reviewing',
    'scheduled': 'status-scheduled',
    'in_progress': 'status-in-progress',
    'completed': 'status-completed',
    'cancelled': 'status-cancelled'
  };
  return statusClasses[status] || 'status-submitted';
}

function getStatusText(status) {
  const statusTexts = {
    'submitted': 'Submitted',
    'reviewing': 'Under Review',
    'scheduled': 'Appointment Scheduled',
    'in_progress': 'In Progress',
    'completed': 'Completed',
    'cancelled': 'Cancelled'
  };
  return statusTexts[status] || 'Submitted';
}

// Start app
document.addEventListener("DOMContentLoaded", () => {
  console.log("Doctor Dashboard: DOM Content Loaded");
  try {
    initDOMElements();
    console.log("Doctor Dashboard: DOM Elements initialized");
    init();
  } catch (error) {
    console.error("Doctor Dashboard Error:", error);
    alert("Error loading dashboard: " + error.message);
  }
});

// Also run on window load as backup
window.addEventListener("load", () => {
  console.log("Doctor Dashboard: Window loaded");
  if (!currentSession) {
    try {
      initDOMElements();
      init();
    } catch (error) {
      console.error("Doctor Dashboard window.load error:", error);
    }
  }
});
