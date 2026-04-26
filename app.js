const authShell = document.querySelector("#authShell");
const accessName = document.querySelector("#accessName");
const accessEmail = document.querySelector("#accessEmail");
const enterPlatformButton = document.querySelector("#enterPlatformButton");
const roleCards = document.querySelectorAll("[data-role]");
const sessionCopy = document.querySelector("#sessionCopy");
const nextAppointmentTitle = document.querySelector("#nextAppointmentTitle");
const nextAppointmentMeta = document.querySelector("#nextAppointmentMeta");
const appointmentModeTitle = document.querySelector("#appointmentModeTitle");
const appointmentModeMeta = document.querySelector("#appointmentModeMeta");
const appointmentPriorityTitle = document.querySelector("#appointmentPriorityTitle");
const appointmentPriorityMeta = document.querySelector("#appointmentPriorityMeta");
const symptomInput = document.querySelector("#symptomInput");
const patientName = document.querySelector("#patientName");
const patientAge = document.querySelector("#patientAge");
const patientLanguage = document.querySelector("#patientLanguage");
const analyzeButton = document.querySelector("#analyzeButton");
const bookButton = document.querySelector("#bookButton");
const phoneBookButton = document.querySelector("#phoneBookButton");
const clearButton = document.querySelector("#clearButton");
const symptomChips = document.querySelector("#symptomChips");
const riskList = document.querySelector("#riskList");
const bookingSummary = document.querySelector("#bookingSummary");
const patientList = document.querySelector("#patientList");
const timelineList = document.querySelector("#timelineList");
const selectedPatient = document.querySelector("#selectedPatient");
const prescriptionInput = document.querySelector("#prescriptionInput");
const savePrescriptionButton = document.querySelector("#savePrescriptionButton");
const startConsultationButton = document.querySelector("#startConsultationButton");
const apiBanner = document.querySelector("#apiBanner");
const apiStatusText = document.querySelector("#apiStatusText");
const queueCountPill = document.querySelector("#queueCountPill");
const patientSearch = document.querySelector("#patientSearch");
const filterButtons = document.querySelectorAll("[data-filter]");
const refreshRecordsButton = document.querySelector("#refreshRecordsButton");
const recordTabs = document.querySelectorAll("[data-record-tab]");
const recordsMeta = document.querySelector("#recordsMeta");
const recordList = document.querySelector("#recordList");
const chatForm = document.querySelector("#chatForm");
const chatInput = document.querySelector("#chatInput");
const chatWindow = document.querySelector("#chatWindow");
const modeButtons = document.querySelectorAll(".mode-button");

const storageKey = "medisense-cases";
const sessionKey = "medisense-session";
const apiBaseUrl = "https://medisense-api.onrender.com";
let activeUrgencyFilter = "all";
let activeRecordTab = "consultations";
let apiState = "checking";
let latestRecords = null;
let activeRole = "patient";
let activePatient = {
  name: "Ravi Kumar",
  symptoms: "Fever, headache, body pain",
  urgency: "Medium",
};

const symptomRules = [
  { label: "Fever", words: ["fever", "temperature", "hot"] },
  { label: "Headache", words: ["headache", "head pain", "migraine"] },
  { label: "Cough", words: ["cough", "coughing"] },
  { label: "Sore throat", words: ["sore throat", "throat", "throat pain"] },
  { label: "Body pain", words: ["body pain", "body ache", "aches", "pain"] },
  { label: "Vomiting", words: ["vomit", "vomiting", "nausea"] },
  { label: "Chest tightness", words: ["chest", "breath", "breathing"] },
  { label: "Rash", words: ["rash", "skin", "itch"] },
  { label: "Fatigue", words: ["tired", "fatigue", "weakness"] },
  { label: "Stomach pain", words: ["stomach", "abdominal", "belly"] },
];

const conditionRules = [
  {
    name: "Flu-like illness",
    base: 36,
    symptoms: ["Fever", "Headache", "Cough", "Sore throat", "Body pain", "Fatigue"],
  },
  {
    name: "Viral fever",
    base: 30,
    symptoms: ["Fever", "Headache", "Body pain", "Fatigue"],
  },
  {
    name: "Dengue screening needed",
    base: 22,
    symptoms: ["Fever", "Headache", "Body pain", "Rash", "Vomiting"],
  },
  {
    name: "Respiratory review",
    base: 24,
    symptoms: ["Cough", "Sore throat", "Chest tightness", "Fever"],
  },
  {
    name: "Gastrointestinal issue",
    base: 20,
    symptoms: ["Stomach pain", "Vomiting", "Fever"],
  },
];

function extractSymptoms(text) {
  const cleanText = text.toLowerCase();
  const found = symptomRules
    .filter((rule) => rule.words.some((word) => cleanText.includes(word)))
    .map((rule) => rule.label);

  return [...new Set(found)];
}

function scoreConditions(symptoms) {
  const symptomSet = new Set(symptoms);

  return conditionRules
    .map((condition) => {
      const matches = condition.symptoms.filter((symptom) => symptomSet.has(symptom));
      const score = Math.min(94, condition.base + matches.length * 12);
      return { name: condition.name, score, matches: matches.length };
    })
    .filter((condition) => condition.matches > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}

function renderSymptoms(symptoms) {
  symptomChips.innerHTML = "";

  if (!symptoms.length) {
    symptomChips.innerHTML = '<span class="chip">No clear symptoms found</span>';
    return;
  }

  symptoms.forEach((symptom) => {
    const chip = document.createElement("span");
    chip.className = "chip";
    chip.textContent = symptom;
    symptomChips.appendChild(chip);
  });
}

function renderRisks(conditions) {
  riskList.innerHTML = "";

  if (!conditions.length) {
    riskList.innerHTML = `
      <div class="risk-item">
        <div class="risk-top"><span>Needs more details</span><span>--</span></div>
        <div class="bar"><span style="width: 12%"></span></div>
      </div>
    `;
    return;
  }

  conditions.forEach((condition) => {
    const item = document.createElement("div");
    item.className = "risk-item";
    item.innerHTML = `
      <div class="risk-top">
        <span>${condition.name}</span>
        <span>${condition.score}%</span>
      </div>
      <div class="bar"><span style="width: ${condition.score}%"></span></div>
    `;
    riskList.appendChild(item);
  });
}

function analyzeSymptoms() {
  const symptoms = extractSymptoms(symptomInput.value);
  const risks = scoreConditions(symptoms);
  renderSymptoms(symptoms);
  renderRisks(risks);
  return { symptoms, risks };
}

function getInitials(name) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("") || "PT";
}

function getUrgency(risks) {
  const topScore = risks[0]?.score || 0;
  if (topScore >= 72) return "High";
  if (topScore >= 48) return "Medium";
  return "Low";
}

function urgencyClass(urgency) {
  return urgency.toLowerCase();
}

function loadSavedCases() {
  try {
    return JSON.parse(localStorage.getItem(storageKey)) || [];
  } catch {
    return [];
  }
}

function saveCases(cases) {
  localStorage.setItem(storageKey, JSON.stringify(cases));
}

function loadSession() {
  try {
    return JSON.parse(localStorage.getItem(sessionKey)) || null;
  } catch {
    return null;
  }
}

function saveSession(session) {
  localStorage.setItem(sessionKey, JSON.stringify(session));
}

function updateRoleUI() {
  const isDoctor = activeRole === "doctor";
  sessionCopy.textContent = isDoctor
    ? "Signed in as doctor workspace."
    : "Signed in as patient workspace.";
  nextAppointmentTitle.textContent = isDoctor ? "Morning review block" : "General consultation";
  nextAppointmentMeta.textContent = isDoctor
    ? "Today, 9:00 AM to 12:00 PM, telehealth queue"
    : "Today, 6:30 PM with Dr. Sneha Rao";
  appointmentModeTitle.textContent = isDoctor ? "Doctor operations" : "Patient journey";
  appointmentModeMeta.textContent = isDoctor
    ? "Queue triage, records review, prescription handoff"
    : "Symptom summary, booking, follow-up";
  appointmentPriorityTitle.textContent = isDoctor ? "4 high-priority cases" : "Medium watch";
  appointmentPriorityMeta.textContent = isDoctor
    ? "Respiratory review and fever escalation first"
    : "Hydration, fever tracking, review in 24h";

  modeButtons.forEach((button) => {
    if (button.dataset.mode === "doctor" && !isDoctor) {
      button.textContent = "Doctor dashboard";
    }
  });
}

function enterPlatform() {
  const session = {
    role: activeRole,
    name: accessName.value.trim() || "Guest User",
    email: accessEmail.value.trim() || "guest@example.com",
  };
  saveSession(session);
  document.body.classList.add("authenticated");
  patientName.value = session.name;
  updateRoleUI();
}

function restoreSession() {
  const session = loadSession();
  if (!session) return;

  activeRole = session.role || "patient";
  accessName.value = session.name || "Ravi Kumar";
  accessEmail.value = session.email || "ravi@example.com";
  roleCards.forEach((card) => {
    card.classList.toggle("active-role", card.dataset.role === activeRole);
  });
  enterPlatform();
}

function setApiStatus(state, message) {
  apiState = state;
  apiBanner.classList.remove("online", "offline");
  if (state === "online") apiBanner.classList.add("online");
  if (state === "offline") apiBanner.classList.add("offline");
  apiStatusText.textContent = message;
}

async function apiRequest(path, options = {}) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }

  return response.json();
}

async function createConsultation(caseData) {
  try {
    const saved = await apiRequest("/consultations", {
      method: "POST",
      body: JSON.stringify(caseData),
    });
    setApiStatus("online", "FastAPI connected. New cases are saved to the backend.");
    return { ...caseData, ...saved, source: "FastAPI" };
  } catch {
    setApiStatus("offline", "Backend offline. Saving to browser storage fallback.");
    const cases = [caseData, ...loadSavedCases()].slice(0, 8);
    saveCases(cases);
    return { ...caseData, source: "browser storage" };
  }
}

async function fetchConsultations() {
  try {
    const consultations = await apiRequest("/consultations");
    setApiStatus("online", "FastAPI connected. Queue and records are live.");
    return consultations.map((item) => ({ ...item, source: "FastAPI" }));
  } catch {
    setApiStatus("offline", "FastAPI not reachable. Showing browser-stored cases.");
    return loadSavedCases().map((item) => ({ ...item, source: "browser storage" }));
  }
}

async function savePrescription(advice) {
  try {
    await apiRequest("/prescriptions", {
      method: "POST",
      body: JSON.stringify({
        patientName: activePatient.name,
        symptoms: activePatient.symptoms,
        urgency: activePatient.urgency,
        advice,
      }),
    });
    setApiStatus("online", "Prescription saved through FastAPI.");
    return "FastAPI";
  } catch {
    setApiStatus("offline", "Prescription kept in the UI timeline only.");
    return "timeline only";
  }
}

async function saveChatLog(question, answer) {
  try {
    await apiRequest("/chat-logs", {
      method: "POST",
      body: JSON.stringify({ question, answer }),
    });
    setApiStatus("online", "Chat logs are being stored through FastAPI.");
  } catch {
    setApiStatus("offline", "Chat still works without the backend.");
  }
}

async function fetchHealth() {
  try {
    const health = await apiRequest("/health");
    setApiStatus("online", `FastAPI ready. Data store: ${health.database}.`);
  } catch {
    setApiStatus("offline", "FastAPI not running. Using local demo mode.");
  }
}

async function fetchRecords() {
  try {
    const records = await apiRequest("/records");
    latestRecords = records;
    recordsMeta.textContent = "Showing backend collections from FastAPI.";
    setApiStatus("online", "Backend records loaded successfully.");
  } catch {
    latestRecords = {
      consultations: loadSavedCases(),
      patients: loadSavedCases().map((item) => ({
        name: item.name,
        age: item.age,
        language: item.language,
        latestSymptoms: item.symptomsText,
      })),
      prescriptions: [],
    };
    recordsMeta.textContent = "Backend unavailable. Showing browser fallback records.";
    setApiStatus("offline", "Records panel switched to browser fallback.");
  }

  renderRecordTab(activeRecordTab);
}

function createPatientRow(caseData, isActive = false) {
  const row = document.createElement("article");
  row.className = `patient-row${isActive ? " active" : ""}`;
  row.dataset.patient = caseData.name;
  row.dataset.symptoms = caseData.symptomsText;
  row.dataset.urgency = caseData.urgency;

  const avatar = document.createElement("div");
  avatar.className = "avatar teal";
  avatar.textContent = getInitials(caseData.name);

  const detail = document.createElement("div");
  const name = document.createElement("strong");
  name.textContent = caseData.name;
  const symptoms = document.createElement("small");
  symptoms.textContent = caseData.symptomsText || "Symptoms pending";
  detail.append(name, symptoms);

  const urgency = document.createElement("span");
  urgency.className = `urgency ${urgencyClass(caseData.urgency)}`;
  urgency.textContent = caseData.urgency;

  row.append(avatar, detail, urgency);
  row.addEventListener("click", () => selectPatient(row));
  return row;
}

function renderTimeline(eventTitle, detailText) {
  const item = document.createElement("li");
  const dot = document.createElement("span");
  const detail = document.createElement("div");
  const title = document.createElement("strong");
  const small = document.createElement("small");

  title.textContent = eventTitle;
  small.textContent = detailText;
  detail.append(title, small);
  item.append(dot, detail);
  timelineList.prepend(item);
}

function updateQueueCount() {
  const visibleRows = [...patientList.querySelectorAll(".patient-row")].filter(
    (row) => row.style.display !== "none"
  );
  const label = visibleRows.length === 1 ? "active" : "active";
  queueCountPill.textContent = `${visibleRows.length} ${label}`;
}

function applyQueueFilters() {
  const query = patientSearch.value.trim().toLowerCase();

  patientList.querySelectorAll(".patient-row").forEach((row) => {
    const name = row.dataset.patient.toLowerCase();
    const symptoms = row.dataset.symptoms.toLowerCase();
    const urgency = row.dataset.urgency.toLowerCase();
    const matchesQuery = !query || name.includes(query) || symptoms.includes(query);
    const matchesUrgency = activeUrgencyFilter === "all" || urgency === activeUrgencyFilter;

    row.style.display = matchesQuery && matchesUrgency ? "" : "none";
  });

  updateQueueCount();
}

function selectPatient(row) {
  document.querySelectorAll(".patient-row").forEach((item) => item.classList.remove("active"));
  row.classList.add("active");
  activePatient = {
    name: row.dataset.patient,
    symptoms: row.dataset.symptoms,
    urgency: row.dataset.urgency,
  };
  selectedPatient.querySelector("strong").textContent = activePatient.name;
  selectedPatient.querySelector("small").textContent = `${activePatient.symptoms} | ${activePatient.urgency} urgency`;
}

async function bookConsultation() {
  const { symptoms, risks } = analyzeSymptoms();
  const name = patientName.value.trim() || "New Patient";
  const age = patientAge.value || "Not provided";
  const language = patientLanguage.value;
  const urgency = getUrgency(risks);
  const symptomsText = symptoms.length ? symptoms.join(", ") : "More details needed";
  const topRisk = risks[0]?.name || "Doctor review required";
  const caseData = {
    id: Date.now(),
    name,
    age,
    language,
    symptomsText,
    topRisk,
    urgency,
    patientId: currentSession?.patientId || "guest",
    status: "submitted",
    createdAt: new Date().toLocaleString(),
  };
  const savedCase = await createConsultation(caseData);

  const row = createPatientRow(savedCase, true);
  patientList.prepend(row);
  selectPatient(row);
  renderTimeline("Consultation booked", `${name}, age ${age}, ${language}. AI note: ${topRisk}.`);
  bookingSummary.textContent = `Consultation booked for ${name}. Symptoms: ${symptomsText}. Priority: ${urgency}. Saved in ${savedCase.source}.`;
  applyQueueFilters();
  fetchRecords();
}

async function renderSavedCases() {
  const cases = await fetchConsultations();
  cases.forEach((caseData) => {
    patientList.appendChild(createPatientRow(caseData));
  });
  applyQueueFilters();
}

function renderRecordTab(tabName) {
  const items = latestRecords?.[tabName] || [];
  recordList.innerHTML = "";

  if (!items.length) {
    recordList.innerHTML = `
      <div class="record-item">
        <strong>No records yet</strong>
        <small>New bookings and prescriptions will appear here.</small>
      </div>
    `;
    return;
  }

  items.slice(0, 8).forEach((item) => {
    const card = document.createElement("div");
    card.className = "record-item";

    if (tabName === "consultations") {
      card.innerHTML = `
        <strong>${item.name || "Patient"}</strong>
        <small>${item.symptomsText || "Symptoms pending"}</small>
        <span>${item.urgency || "Unknown"} urgency | ${item.topRisk || "Review needed"}</span>
      `;
    } else if (tabName === "patients") {
      card.innerHTML = `
        <strong>${item.name || "Patient"}</strong>
        <small>Age: ${item.age || "N/A"} | ${item.language || "N/A"}</small>
        <span>${item.latestSymptoms || item.symptomsText || "No symptom summary"}</span>
      `;
    } else {
      card.innerHTML = `
        <strong>${item.patientName || "Patient"}</strong>
        <small>${item.symptoms || "No symptom note"}</small>
        <span>${item.advice || "No advice saved"}</span>
      `;
    }

    recordList.appendChild(card);
  });
}

function chatbotReply(question) {
  const text = question.toLowerCase();

  if (text.includes("fever")) {
    return "For fever, drink fluids, rest, and monitor temperature. Please consult a doctor urgently for very high fever, breathing trouble, confusion, or symptoms lasting more than three days.";
  }

  if (text.includes("cough")) {
    return "For cough, warm fluids and steam may help. A doctor should review chest pain, breathing difficulty, blood in sputum, or fever with cough.";
  }

  if (text.includes("headache")) {
    return "For headache, rest in a quiet room and stay hydrated. Seek care if it is sudden, severe, after injury, or with weakness, vomiting, or vision changes.";
  }

  if (text.includes("rash") || text.includes("skin")) {
    return "For rash, avoid scratching and note triggers. Uploading an image and speaking to a doctor is better if it spreads, hurts, or comes with fever.";
  }

  return "I can give general guidance, but this is not a diagnosis. Share symptoms, duration, age, and warning signs so the doctor can review safely.";
}

function appendMessage(message, type) {
  const bubble = document.createElement("div");
  bubble.className = `chat-bubble ${type}`;
  bubble.textContent = message;
  chatWindow.appendChild(bubble);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

analyzeButton.addEventListener("click", analyzeSymptoms);

bookButton.addEventListener("click", bookConsultation);

phoneBookButton.addEventListener("click", bookConsultation);

startConsultationButton.addEventListener("click", () => {
  document.querySelector("#triage").scrollIntoView({ behavior: "smooth", block: "start" });
  symptomInput.focus();
});

clearButton.addEventListener("click", () => {
  symptomInput.value = "";
  analyzeSymptoms();
  symptomInput.focus();
});

chatForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const question = chatInput.value.trim();
  if (!question) return;

  appendMessage(question, "patient");
  chatInput.value = "";

  window.setTimeout(() => {
    const answer = chatbotReply(question);
    appendMessage(answer, "bot");
    saveChatLog(question, answer);
  }, 250);
});

savePrescriptionButton.addEventListener("click", async () => {
  const advice = prescriptionInput.value.trim();
  if (!advice) return;

  const source = await savePrescription(advice);
  renderTimeline("Prescription saved", `${activePatient.name}: ${advice}`);
  bookingSummary.textContent = `Prescription note saved for ${activePatient.name} in ${source}.`;
  fetchRecords();
});

patientSearch.addEventListener("input", applyQueueFilters);

filterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    filterButtons.forEach((item) => item.classList.remove("active-filter"));
    button.classList.add("active-filter");
    activeUrgencyFilter = button.dataset.filter;
    applyQueueFilters();
  });
});

refreshRecordsButton.addEventListener("click", fetchRecords);

roleCards.forEach((card) => {
  card.addEventListener("click", () => {
    roleCards.forEach((item) => item.classList.remove("active-role"));
    card.classList.add("active-role");
    activeRole = card.dataset.role;
    updateRoleUI();
  });
});

enterPlatformButton.addEventListener("click", enterPlatform);

recordTabs.forEach((button) => {
  button.addEventListener("click", () => {
    recordTabs.forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    activeRecordTab = button.dataset.recordTab;
    renderRecordTab(activeRecordTab);
  });
});

document.querySelectorAll(".patient-row").forEach((row) => {
  row.addEventListener("click", () => selectPatient(row));
});

modeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    modeButtons.forEach((item) => item.classList.remove("active"));
    button.classList.add("active");

    const target = {
      patient: "#triage",
      doctor: "#patients",
      database: ".database-panel",
    }[button.dataset.mode];

    document.querySelector(target).scrollIntoView({ behavior: "smooth", block: "start" });
  });
});

document.querySelectorAll(".nav-item").forEach((item) => {
  item.addEventListener("click", () => {
    document.querySelectorAll(".nav-item").forEach((link) => link.classList.remove("active"));
    item.classList.add("active");
  });
});

restoreSession();
fetchHealth();
renderSavedCases();
fetchRecords();
analyzeSymptoms();
