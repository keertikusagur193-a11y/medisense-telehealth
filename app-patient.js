// Patient Dashboard JS
const apiBaseUrl = "https://medisense-api.onrender.com";
const storageKey = "medisense-cases";
const sessionKey = "medisense-session";

let currentSession = null;
let activeRecordTab = "consultations";
let apiState = "checking";

// DOM Elements (will be initialized after page loads)
let profileName, profileEmail, profilePhone, sessionCopy, symptomInput, patientAge, patientLanguage;
let analyzeButton, bookButton, clearButton, symptomChips, riskList, bookingSummary;
let chatForm, chatInput, chatWindow, apiBanner, apiStatusText;
let newConsultationButton, logoutButton, refreshRecordsButton;
let recordTabs, recordList, recordsMeta, consultationCount, appointmentCount, chatCount;

function initDOMElements() {
  profileName = document.getElementById("profileName");
  profileEmail = document.getElementById("profileEmail");
  profilePhone = document.getElementById("profilePhone");
  sessionCopy = document.getElementById("sessionCopy");
  symptomInput = document.getElementById("symptomInput");
  patientAge = document.getElementById("patientAge");
  patientLanguage = document.getElementById("patientLanguage");
  analyzeButton = document.getElementById("analyzeButton");
  bookButton = document.getElementById("phoneBookButton");
  clearButton = document.getElementById("clearButton");
  symptomChips = document.getElementById("symptomChips");
  riskList = document.getElementById("riskList");
  bookingSummary = document.getElementById("bookingSummary");
  chatForm = document.getElementById("chatForm");
  chatInput = document.getElementById("chatInput");
  chatWindow = document.getElementById("chatWindow");
  apiBanner = document.getElementById("apiBanner");
  apiStatusText = document.getElementById("apiStatusText");
  newConsultationButton = document.getElementById("newConsultationButton");
  logoutButton = document.getElementById("logoutButton");
  refreshRecordsButton = document.getElementById("refreshRecordsButton");
  recordTabs = document.querySelectorAll("[data-record-tab]");
  recordList = document.getElementById("recordList");
  recordsMeta = document.getElementById("recordsMeta");
  consultationCount = document.getElementById("consultationCount");
  appointmentCount = document.getElementById("appointmentCount");
  chatCount = document.getElementById("chatCount");
}

// Initialize
function init() {
  console.log("Patient Dashboard: Initializing...");
  loadSession();
  if (!currentSession) {
    console.warn("Patient Dashboard: No session found, redirecting to login");
    setTimeout(() => {
      window.location.href = "login.html";
    }, 500);
    return;
  }

  console.log("Patient Dashboard: Session loaded", currentSession);
  
  // Add authenticated class to show the dashboard
  document.body.classList.add("authenticated");
  
  if (!profileName) {
    console.error("Patient Dashboard: DOM elements not initialized");
    return;
  }

  profileName.textContent = currentSession.name;
  profileEmail.textContent = currentSession.email;
  if (profilePhone) profilePhone.textContent = currentSession.phone || "No phone number";
  sessionCopy.textContent = `Welcome, ${currentSession.name}!`;

  console.log("Patient Dashboard: UI updated");
  checkApiStatus();
  loadConsultationStats();
  setupEventListeners();
  console.log("Patient Dashboard: Initialization complete");
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
      apiStatusText.textContent = "Connected to FastAPI backend";
      apiBanner.classList.add("connected");
    })
    .catch(() => {
      apiState = "offline";
      apiStatusText.textContent = "Backend offline - using browser storage";
      apiBanner.classList.add("offline");
    });
}

function setupEventListeners() {
  try {
    if (analyzeButton) analyzeButton.addEventListener("click", analyzeSymptoms);
    if (bookButton) bookButton.addEventListener("click", bookDoctor);
    if (clearButton) clearButton.addEventListener("click", clearForm);
    if (chatForm) chatForm.addEventListener("submit", handleChatSubmit);
    if (logoutButton) logoutButton.addEventListener("click", logout);
    if (refreshRecordsButton) refreshRecordsButton.addEventListener("click", loadConsultationRecords);
    if (newConsultationButton) {
      newConsultationButton.addEventListener("click", () => {
        const triageSection = document.querySelector("#triage");
        if (triageSection) triageSection.scrollIntoView({ behavior: "smooth" });
      });
    }

    if (recordTabs) {
      recordTabs.forEach((tab) => {
        tab.addEventListener("click", () => {
          recordTabs.forEach((t) => t.classList.remove("active"));
          tab.classList.add("active");
          activeRecordTab = tab.dataset.recordTab;
          loadConsultationRecords();
        });
      });
    }
    console.log("Patient Dashboard: Event listeners attached");
  } catch (error) {
    console.warn("Patient Dashboard: Error setting up event listeners:", error);
  }
}

function analyzeSymptoms() {
  const symptoms = symptomInput.value.trim();
  if (!symptoms) {
    alert("Please describe your symptoms");
    return;
  }

  const age = patientAge.value || "Not specified";
  const language = patientLanguage.value || "English";

  // Extract symptoms (simple NLP)
  const extractedSymptoms = extractSymptomList(symptoms);
  const conditions = predictConditions(extractedSymptoms);

  // Display results
  displaySymptomChips(extractedSymptoms);
  displayRiskCards(conditions);

  bookingSummary.innerHTML = `
    <strong>Analysis Complete</strong>
    <p>Found ${extractedSymptoms.length} symptoms suggesting ${conditions.length} possible conditions.</p>
    <button class="primary-button" id="bookAfterAnalysis" type="button">Book Doctor Now</button>
  `;

  document.getElementById("bookAfterAnalysis").addEventListener("click", bookDoctor);
}

function extractSymptomList(text) {
  const commonSymptoms = [
    "fever", "headache", "cough", "sore throat", "body pain",
    "fatigue", "nausea", "vomiting", "diarrhea", "rash",
    "chest pain", "difficulty breathing", "chills", "congestion"
  ];

  const found = [];
  const lowerText = text.toLowerCase();
  commonSymptoms.forEach((symptom) => {
    if (lowerText.includes(symptom)) {
      found.push(symptom);
    }
  });

  return found.length > 0 ? found : ["general malaise"];
}

function predictConditions(symptoms) {
  const conditionMap = {
    fever: ["Flu-like illness", "Viral infection", "Common cold"],
    cough: ["Respiratory infection", "Bronchitis", "Pneumonia"],
    headache: ["Migraine", "Tension headache", "Viral syndrome"],
    "sore throat": ["Pharyngitis", "Strep throat", "Viral infection"],
    "body pain": ["Muscular strain", "Viral syndrome", "Infection"],
  };

  const conditions = new Set();
  symptoms.forEach((symptom) => {
    if (conditionMap[symptom]) {
      conditionMap[symptom].forEach((c) => conditions.add(c));
    }
  });

  return Array.from(conditions).slice(0, 5);
}

function displaySymptomChips(symptoms) {
  symptomChips.innerHTML = symptoms
    .map((s) => `<span class="chip">${s}</span>`)
    .join("");
}

function displayRiskCards(conditions) {
  riskList.innerHTML = conditions
    .map((c, i) => {
      const risk = ["high", "medium", "low"][i % 3];
      return `<div class="risk-card risk-${risk}"><strong>${c}</strong><small>${risk} risk</small></div>`;
    })
    .join("");
}

function bookDoctor() {
  const symptoms = symptomInput.value.trim();
  const age = patientAge.value || "20";
  const language = patientLanguage.value || "English";

  if (!symptoms) {
    alert("Please describe your symptoms first");
    return;
  }

  const extractedSymptoms = extractSymptomList(symptoms);
  const topRisk = predictConditions(extractedSymptoms)[0] || "General consultation";
  const urgency = ["High", "Medium", "Low"][Math.floor(Math.random() * 3)];

  const consultation = {
    name: currentSession.name,
    age: age,
    language: language,
    symptomsText: symptoms,
    topRisk: topRisk,
    urgency: urgency,
  };

  if (apiState === "connected") {
    fetch(`${apiBaseUrl}/consultations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(consultation),
    })
      .then((res) => res.json())
      .then((data) => {
        showSuccessMessage("Consultation booked! Doctor will review shortly.");
        clearForm();
        loadConsultationStats();
      })
      .catch(() => {
        saveCaseLocal(consultation);
        showSuccessMessage("Consultation saved locally. Will sync when backend is available.");
      });
  } else {
    saveCaseLocal(consultation);
    showSuccessMessage("Consultation saved to your device.");
  }
}

function saveCaseLocal(consultation) {
  const cases = JSON.parse(localStorage.getItem(storageKey) || "[]");
  cases.unshift({ ...consultation, id: Date.now() });
  localStorage.setItem(storageKey, JSON.stringify(cases));
}

function clearForm() {
  symptomInput.value = "";
  patientAge.value = "";
  symptomChips.innerHTML = "";
  riskList.innerHTML = "";
  bookingSummary.textContent = "Analyze your symptoms to get AI insights and book a doctor.";
}

function handleChatSubmit(e) {
  e.preventDefault();
  const question = chatInput.value.trim();
  if (!question) return;

  // Add user message
  const userBubble = document.createElement("div");
  userBubble.className = "chat-bubble patient";
  userBubble.textContent = question;
  chatWindow.appendChild(userBubble);

  // Simulate bot response
  setTimeout(() => {
    const botBubble = document.createElement("div");
    botBubble.className = "chat-bubble bot";
    botBubble.textContent = "I understand. For serious symptoms, please contact a doctor immediately. Would you like to book a consultation?";
    chatWindow.appendChild(botBubble);
    chatWindow.scrollTop = chatWindow.scrollHeight;
  }, 500);

  chatInput.value = "";
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

function loadConsultationStats() {
  if (!currentSession || !currentSession.patientId) {
    consultationCount.textContent = "0";
    appointmentCount.textContent = "0";
    chatCount.textContent = "0";
    return;
  }

  if (apiState === "connected") {
    // Load patient-specific stats
    fetch(`${apiBaseUrl}/consultations`)
      .then((res) => res.json())
      .then((data) => {
        const patientConsultations = data.filter(c => c.patientId === currentSession.patientId);
        consultationCount.textContent = patientConsultations.length;

        // Load appointments for this patient
        fetch(`${apiBaseUrl}/appointments`)
          .then((res) => res.json())
          .then((appointments) => {
            const patientAppointments = appointments.filter(a => a.patientId === currentSession.patientId);
            appointmentCount.textContent = patientAppointments.length;
            chatCount.textContent = Math.floor(Math.random() * 5); // Placeholder for chat count
          })
          .catch(() => {
            appointmentCount.textContent = "0";
            chatCount.textContent = "0";
          });
      })
      .catch(() => {
        consultationCount.textContent = "0";
        appointmentCount.textContent = "0";
        chatCount.textContent = "0";
      });
  } else {
    // Fallback to local storage (though this should be patient-specific too)
    const cases = JSON.parse(localStorage.getItem(storageKey) || "[]");
    consultationCount.textContent = cases.length;
    appointmentCount.textContent = Math.max(0, cases.length - Math.floor(cases.length / 2));
    chatCount.textContent = Math.floor(Math.random() * 5);
  }
}

function loadConsultationRecords() {
  if (!currentSession || !currentSession.patientId) {
    recordList.innerHTML = "<p style='padding: 20px; color: #999;'>Please login to view your records.</p>";
    recordsMeta.textContent = "Authentication required.";
    return;
  }

  if (apiState === "connected") {
    fetch(`${apiBaseUrl}/consultations`)
      .then((res) => res.json())
      .then((data) => {
        // Filter records to only show this patient's consultations
        const patientRecords = data.filter(record => record.patientId === currentSession.patientId);
        displayRecords(patientRecords);
      })
      .catch(() => {
        loadLocalRecords();
      });
  } else {
    loadLocalRecords();
  }
}

function loadLocalRecords() {
  const cases = JSON.parse(localStorage.getItem(storageKey) || "[]");
  displayRecords(cases);
}

function displayRecords(records) {
  if (!records || records.length === 0) {
    recordList.innerHTML = "<p style='padding: 20px; color: #999;'>No records found.</p>";
    recordsMeta.textContent = "No consultation records yet.";
    return;
  }

  recordsMeta.textContent = `Found ${records.length} record(s)`;
  recordList.innerHTML = records
    .map(
      (r, i) => {
        const status = r.status || "submitted";
        const statusClass = getStatusClass(status);
        const statusText = getStatusText(status);
        const progressSteps = getProgressSteps(status);

        return `
    <div class="record-item consultation-progress">
      <div class="consultation-header">
        <strong>#${i + 1} - ${r.name || "Unknown"}</strong>
        <span class="status-badge ${statusClass}">${statusText}</span>
      </div>
      <small>Symptoms: ${r.symptomsText?.substring(0, 50) || "N/A"}...</small>
      <small>Risk: ${r.topRisk || "N/A"} | Urgency: ${r.urgency || "N/A"}</small>
      <div class="progress-tracker">
        ${progressSteps.map(step => `
          <div class="progress-step ${step.active ? 'active' : ''} ${step.completed ? 'completed' : ''}">
            <div class="step-circle">${step.icon}</div>
            <div class="step-label">${step.label}</div>
          </div>
        `).join('')}
      </div>
      <small class="consultation-date">Submitted: ${new Date(r.createdAt).toLocaleDateString()}</small>
    </div>
  `;}
    )
    .join("");
}

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

function getProgressSteps(currentStatus) {
  const allSteps = [
    { key: 'submitted', label: 'Submitted', icon: '📝', completed: false, active: false },
    { key: 'reviewing', label: 'Reviewing', icon: '👀', completed: false, active: false },
    { key: 'scheduled', label: 'Scheduled', icon: '📅', completed: false, active: false },
    { key: 'in_progress', label: 'In Progress', icon: '⚕️', completed: false, active: false },
    { key: 'completed', label: 'Completed', icon: '✅', completed: false, active: false }
  ];

  const statusOrder = ['submitted', 'reviewing', 'scheduled', 'in_progress', 'completed'];
  const currentIndex = statusOrder.indexOf(currentStatus);

  return allSteps.map((step, index) => ({
    ...step,
    completed: index < currentIndex,
    active: index === currentIndex && currentStatus !== 'completed' && currentStatus !== 'cancelled'
  }));
}

function logout() {
  sessionStorage.removeItem(sessionKey);
  window.location.href = "login.html";
}

// Start app
document.addEventListener("DOMContentLoaded", () => {
  console.log("Patient Dashboard: DOM Content Loaded");
  try {
    initDOMElements();
    console.log("Patient Dashboard: DOM Elements initialized");
    init();
  } catch (error) {
    console.error("Patient Dashboard Error:", error);
    alert("Error loading dashboard: " + error.message);
  }
});

// Also run on window load as backup
window.addEventListener("load", () => {
  console.log("Patient Dashboard: Window loaded");
  if (!currentSession) {
    try {
      initDOMElements();
      init();
    } catch (error) {
      console.error("Patient Dashboard window.load error:", error);
    }
  }
});
