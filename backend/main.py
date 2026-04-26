import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Union
from uuid import uuid4

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, Field
import bcrypt
import jwt
from datetime import datetime, timedelta


APP_DIR = Path(__file__).resolve().parent
DATA_FILE = APP_DIR / "medisense-db.json"


class ConsultationCreate(BaseModel):
    name: str = Field(min_length=1)
    age: Union[str, int]
    language: str
    symptomsText: str
    topRisk: str
    urgency: str
    patientId: str = Field(min_length=1)
    status: str = "submitted"  # submitted, reviewing, scheduled, in_progress, completed, cancelled


class PrescriptionCreate(BaseModel):
    patientId: str = Field(min_length=1)
    patientName: str = Field(min_length=1)
    symptoms: str
    urgency: str
    advice: str = Field(min_length=1)


class ChatLogCreate(BaseModel):
    question: str = Field(min_length=1)
    answer: str = Field(min_length=1)


class DoctorRegister(BaseModel):
    doctorId: str = Field(min_length=1)
    name: str = Field(min_length=1)
    email: str = Field(min_length=1)
    phone: str = Field(min_length=1)
    password: str = Field(min_length=6)
    specialization: str = Field(min_length=1)


class DoctorLogin(BaseModel):
    doctorId: str = Field(min_length=1)
    password: str = Field(min_length=1)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    doctor: Dict[str, Any]


# Patient Registration Models
class PatientRegister(BaseModel):
    patientId: str = Field(min_length=1)
    name: str = Field(min_length=1)
    email: str = Field(min_length=1)
    phone: str = Field(min_length=1)
    password: str = Field(min_length=6)
    age: int = Field(ge=1, le=150)
    gender: str
    address: str = Field(min_length=1)


class PatientLogin(BaseModel):
    patientId: str = Field(min_length=1)
    password: str = Field(min_length=1)


# Appointment Models
class AppointmentCreate(BaseModel):
    patientId: str = Field(min_length=1)
    doctorId: str = Field(min_length=1)
    appointmentDate: str
    appointmentTime: str
    reason: str
    status: str = "scheduled"


# Medical Records Models
class MedicalRecordCreate(BaseModel):
    patientId: str = Field(min_length=1)
    recordType: str
    content: str
    doctorId: str = Field(min_length=1)


# Review Models
class ReviewCreate(BaseModel):
    patientId: str = Field(min_length=1)
    doctorId: str = Field(min_length=1)
    rating: int = Field(ge=1, le=5)
    comment: str


# Notification Models
class NotificationCreate(BaseModel):
    userId: str = Field(min_length=1)
    userType: str  # "patient" or "doctor"
    title: str
    message: str
    type: str  # "appointment", "prescription", "message", etc.


# Payment Models
class PaymentCreate(BaseModel):
    appointmentId: str = Field(min_length=1)
    patientId: str = Field(min_length=1)
    doctorId: str = Field(min_length=1)
    amount: float = Field(gt=0)
    status: str = "pending"


class JsonStore:
    def __init__(self, path: Path):
        self.path = path
        self.path.parent.mkdir(parents=True, exist_ok=True)
        if not self.path.exists():
            self._write(self._empty())

    def _empty(self) -> Dict[str, List[Dict[str, Any]]]:
        return {
            "patients": [],
            "doctors": [],
            "consultations": [],
            "symptom_reports": [],
            "chat_logs": [],
            "prescriptions": [],
            "appointments": [],
            "medical_records": [],
            "reviews": [],
            "notifications": [],
            "payments": [],
        }

    def _read(self) -> Dict[str, List[Dict[str, Any]]]:
        try:
            return json.loads(self.path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, FileNotFoundError):
            return self._empty()

    def _write(self, data: Dict[str, List[Dict[str, Any]]]) -> None:
        self.path.write_text(json.dumps(data, indent=2), encoding="utf-8")

    def insert(self, collection: str, document: Dict[str, Any]) -> Dict[str, Any]:
        data = self._read()
        data.setdefault(collection, [])
        data[collection].insert(0, document)
        self._write(data)
        return document

    def list(self, collection: str, limit: int = 20) -> List[Dict[str, Any]]:
        return self._read().get(collection, [])[:limit]

    def update(self, collection: str, document_id: str, document: Dict[str, Any]) -> Dict[str, Any]:
        data = self._read()
        data.setdefault(collection, [])
        for i, doc in enumerate(data[collection]):
            if doc.get("id") == document_id:
                data[collection][i] = document
                break
        self._write(data)
        return document


class MongoStore:
    def __init__(self, uri: str, database_name: str):
        from pymongo import MongoClient

        self.client = MongoClient(uri, serverSelectionTimeoutMS=2500)
        self.client.admin.command("ping")
        self.db = self.client[database_name]

    def insert(self, collection: str, document: Dict[str, Any]) -> Dict[str, Any]:
        self.db[collection].insert_one(document.copy())
        return document

    def list(self, collection: str, limit: int = 20) -> List[Dict[str, Any]]:
        records = self.db[collection].find({}, {"_id": 0}).sort("createdAt", -1).limit(limit)
        return list(records)

    def update(self, collection: str, document_id: str, document: Dict[str, Any]) -> Dict[str, Any]:
        self.db[collection].update_one({"id": document_id}, {"$set": document})
        return document


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def make_document(payload: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "id": str(uuid4()),
        "createdAt": utc_now(),
        **payload,
    }


def create_store() -> JsonStore | MongoStore:
    mongo_uri = os.getenv("MONGODB_URI")
    database_name = os.getenv("MONGODB_DATABASE", "medisense")

    if mongo_uri and mongo_uri != "YOUR_MONGODB_ATLAS_CONNECTION_STRING":
        try:
            return MongoStore(mongo_uri, database_name)
        except Exception as e:
            print(f"Warning: MongoDB connection failed ({e}), falling back to JSON store")
            return JsonStore(DATA_FILE)
    else:
        return JsonStore(DATA_FILE)


load_dotenv()
store = create_store()

# JWT Configuration
SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 480  # 8 hours

security = HTTPBearer()

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))

def create_access_token(data: Dict[str, Any]) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)) -> Dict[str, Any]:
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        doctor_id: str = payload.get("sub")
        if doctor_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

app = FastAPI(title="MediSense API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> Dict[str, str]:
    return {"status": "ok", "database": store.__class__.__name__}


@app.get("/consultations")
def list_consultations() -> List[Dict[str, Any]]:
    return store.list("consultations")


@app.post("/consultations")
def create_consultation(payload: ConsultationCreate) -> Dict[str, Any]:
    consultation = make_document(payload.dict())
    patient = make_document(
        {
            "name": payload.name,
            "age": payload.age,
            "language": payload.language,
            "latestSymptoms": payload.symptomsText,
        }
    )
    symptom_report = make_document(
        {
            "patientName": payload.name,
            "symptomsText": payload.symptomsText,
            "topRisk": payload.topRisk,
            "urgency": payload.urgency,
        }
    )

    store.insert("patients", patient)
    store.insert("symptom_reports", symptom_report)
    return store.insert("consultations", consultation)


@app.put("/consultations/{consultation_id}/status")
def update_consultation_status(consultation_id: str, status: str) -> dict[str, Any]:
    """Update consultation status for progress tracking"""
    consultations = store.list("consultations", limit=1000)
    consultation = next((c for c in consultations if c.get("id") == consultation_id), None)

    if not consultation:
        raise HTTPException(status_code=404, detail="Consultation not found")

    # Update the consultation status
    consultation["status"] = status
    consultation["updatedAt"] = datetime.now(timezone.utc)

    # Save the updated consultation
    store.update("consultations", consultation_id, consultation)

    # Create notification for patient
    notification = make_document({
        "userId": consultation.get("patientId"),
        "userType": "patient",
        "title": "Consultation Status Update",
        "message": f"Your consultation status has been updated to: {status}",
        "type": "consultation_update"
    })
    store.insert("notifications", notification)

    return {"message": "Consultation status updated", "status": status}


@app.get("/prescriptions")
def list_prescriptions() -> list[dict[str, Any]]:
    return store.list("prescriptions")


@app.post("/prescriptions")
def create_prescription(payload: PrescriptionCreate) -> dict[str, Any]:
    return store.insert("prescriptions", make_document(payload.dict()))


@app.post("/chat-logs")
def create_chat_log(payload: ChatLogCreate) -> dict[str, Any]:
    return store.insert("chat_logs", make_document(payload.dict()))


@app.get("/records")
def list_records() -> dict[str, list[dict[str, Any]]]:
    return {
        "patients": store.list("patients"),
        "doctors": store.list("doctors"),
        "consultations": store.list("consultations"),
        "symptom_reports": store.list("symptom_reports"),
        "chat_logs": store.list("chat_logs"),
        "prescriptions": store.list("prescriptions"),
        "appointments": store.list("appointments"),
        "medical_records": store.list("medical_records"),
        "reviews": store.list("reviews"),
        "notifications": store.list("notifications"),
        "payments": store.list("payments"),
    }


# Doctor Authentication Endpoints
@app.post("/doctors/register")
def register_doctor(payload: DoctorRegister) -> dict[str, str]:
    # Check if doctor ID already exists
    existing_doctors = store.list("doctors", limit=1000)
    if any(doc.get("doctorId") == payload.doctorId for doc in existing_doctors):
        raise HTTPException(status_code=400, detail="Doctor ID already exists")
    
    # Check if email already exists
    if any(doc.get("email") == payload.email for doc in existing_doctors):
        raise HTTPException(status_code=400, detail="Email already registered")
    
    doctor = make_document({
        "doctorId": payload.doctorId,
        "name": payload.name,
        "email": payload.email,
        "phone": payload.phone,
        "password": hash_password(payload.password),
        "specialization": payload.specialization,
        "isActive": True
    })
    
    store.insert("doctors", doctor)
    return {"message": "Doctor registered successfully", "doctorId": payload.doctorId}


@app.post("/doctors/login")
def login_doctor(payload: DoctorLogin) -> TokenResponse:
    doctors = store.list("doctors", limit=1000)
    doctor = next((doc for doc in doctors if doc.get("doctorId") == payload.doctorId), None)
    
    if not doctor:
        raise HTTPException(status_code=401, detail="Invalid doctor ID")
    
    if not verify_password(payload.password, doctor["password"]):
        raise HTTPException(status_code=401, detail="Invalid password")
    
    if not doctor.get("isActive", True):
        raise HTTPException(status_code=401, detail="Account is deactivated")
    
    # Create access token
    access_token = create_access_token({"sub": doctor["doctorId"]})
    
    # Return doctor info (excluding password)
    doctor_info = {k: v for k, v in doctor.items() if k != "password"}
    
    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        doctor=doctor_info
    )


@app.get("/doctors/me")
def get_current_doctor(current_doctor: dict[str, Any] = Depends(verify_token)) -> dict[str, Any]:
    doctors = store.list("doctors", limit=1000)
    doctor = next((doc for doc in doctors if doc.get("doctorId") == current_doctor["sub"]), None)
    
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")
    
    # Return doctor info (excluding password)
    return {k: v for k, v in doctor.items() if k != "password"}


@app.get("/doctors/verify/{doctor_id}")
def verify_doctor_exists(doctor_id: str) -> dict[str, bool]:
    doctors = store.list("doctors", limit=1000)
    exists = any(doc.get("doctorId") == doctor_id for doc in doctors)
    return {"exists": exists}


# Patient Registration and Authentication Endpoints
@app.post("/patients/register")
def register_patient(payload: PatientRegister) -> dict[str, str]:
    # Check if patient ID already exists
    existing_patients = store.list("patients", limit=1000)
    if any(p.get("patientId") == payload.patientId for p in existing_patients):
        raise HTTPException(status_code=400, detail="Patient ID already exists")

    # Check if email already exists
    if any(p.get("email") == payload.email for p in existing_patients):
        raise HTTPException(status_code=400, detail="Email already registered")

    patient = make_document({
        "patientId": payload.patientId,
        "name": payload.name,
        "email": payload.email,
        "phone": payload.phone,
        "password": hash_password(payload.password),
        "age": payload.age,
        "gender": payload.gender,
        "address": payload.address,
        "isActive": True,
        "medicalHistory": [],
        "allergies": [],
        "currentMedications": []
    })

    store.insert("patients", patient)
    return {"message": "Patient registered successfully", "patientId": payload.patientId}


@app.post("/patients/login")
def login_patient(payload: PatientLogin) -> dict[str, Any]:
    patients = store.list("patients", limit=1000)
    patient = next((p for p in patients if p.get("patientId") == payload.patientId), None)

    if not patient:
        raise HTTPException(status_code=401, detail="Invalid patient ID")

    if not verify_password(payload.password, patient["password"]):
        raise HTTPException(status_code=401, detail="Invalid password")

    if not patient.get("isActive", True):
        raise HTTPException(status_code=401, detail="Account is deactivated")

    # Return patient info (excluding password)
    patient_info = {k: v for k, v in patient.items() if k != "password"}
    return {"message": "Login successful", "patient": patient_info}


@app.get("/patients/{patient_id}")
def get_patient(patient_id: str) -> dict[str, Any]:
    patients = store.list("patients", limit=1000)
    patient = next((p for p in patients if p.get("patientId") == patient_id), None)

    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    return {k: v for k, v in patient.items() if k != "password"}


# Appointment Management Endpoints
@app.get("/appointments")
def list_appointments() -> list[dict[str, Any]]:
    return store.list("appointments")


@app.post("/appointments")
def create_appointment(payload: AppointmentCreate) -> dict[str, Any]:
    # Verify doctor exists
    doctors = store.list("doctors", limit=1000)
    doctor_exists = any(doc.get("doctorId") == payload.doctorId for doc in doctors)
    if not doctor_exists:
        raise HTTPException(status_code=400, detail="Doctor not found")

    # Verify patient exists
    patients = store.list("patients", limit=1000)
    patient_exists = any(p.get("patientId") == payload.patientId for p in patients)
    if not patient_exists:
        raise HTTPException(status_code=400, detail="Patient not found")

    appointment = make_document(payload.dict())
    result = store.insert("appointments", appointment)

    # Create notification for doctor
    notification = make_document({
        "userId": payload.doctorId,
        "userType": "doctor",
        "title": "New Appointment",
        "message": f"New appointment scheduled with patient {payload.patientId}",
        "type": "appointment"
    })
    store.insert("notifications", notification)

    return result


@app.get("/appointments/patient/{patient_id}")
def get_patient_appointments(patient_id: str) -> list[dict[str, Any]]:
    appointments = store.list("appointments", limit=1000)
    return [apt for apt in appointments if apt.get("patientId") == patient_id]


@app.get("/appointments/doctor/{doctor_id}")
def get_doctor_appointments(doctor_id: str) -> list[dict[str, Any]]:
    appointments = store.list("appointments", limit=1000)
    return [apt for apt in appointments if apt.get("doctorId") == doctor_id]


@app.put("/appointments/{appointment_id}")
def update_appointment_status(appointment_id: str, status: str) -> dict[str, str]:
    # This would need to be implemented in the store class for updates
    # For now, return a placeholder
    return {"message": f"Appointment {appointment_id} status updated to {status}"}


# Medical Records Endpoints
@app.get("/medical-records")
def list_medical_records() -> list[dict[str, Any]]:
    return store.list("medical_records")


@app.post("/medical-records")
def create_medical_record(payload: MedicalRecordCreate) -> dict[str, Any]:
    # Verify doctor exists
    doctors = store.list("doctors", limit=1000)
    doctor_exists = any(doc.get("doctorId") == payload.doctorId for doc in doctors)
    if not doctor_exists:
        raise HTTPException(status_code=400, detail="Doctor not found")

    # Verify patient exists
    patients = store.list("patients", limit=1000)
    patient_exists = any(p.get("patientId") == payload.patientId for p in patients)
    if not patient_exists:
        raise HTTPException(status_code=400, detail="Patient not found")

    record = make_document(payload.dict())
    return store.insert("medical_records", record)


@app.get("/medical-records/patient/{patient_id}")
def get_patient_medical_records(patient_id: str) -> list[dict[str, Any]]:
    records = store.list("medical_records", limit=1000)
    return [rec for rec in records if rec.get("patientId") == patient_id]


# Reviews and Ratings Endpoints
@app.get("/reviews")
def list_reviews() -> list[dict[str, Any]]:
    return store.list("reviews")


@app.post("/reviews")
def create_review(payload: ReviewCreate) -> dict[str, Any]:
    # Verify doctor exists
    doctors = store.list("doctors", limit=1000)
    doctor_exists = any(doc.get("doctorId") == payload.doctorId for doc in doctors)
    if not doctor_exists:
        raise HTTPException(status_code=400, detail="Doctor not found")

    # Verify patient exists
    patients = store.list("patients", limit=1000)
    patient_exists = any(p.get("patientId") == payload.patientId for p in patients)
    if not patient_exists:
        raise HTTPException(status_code=400, detail="Patient not found")

    review = make_document(payload.dict())
    return store.insert("reviews", review)


@app.get("/reviews/doctor/{doctor_id}")
def get_doctor_reviews(doctor_id: str) -> list[dict[str, Any]]:
    reviews = store.list("reviews", limit=1000)
    return [rev for rev in reviews if rev.get("doctorId") == doctor_id]


@app.get("/reviews/doctor/{doctor_id}/average")
def get_doctor_average_rating(doctor_id: str) -> dict[str, float]:
    reviews = store.list("reviews", limit=1000)
    doctor_reviews = [rev for rev in reviews if rev.get("doctorId") == doctor_id]

    if not doctor_reviews:
        return {"averageRating": 0.0, "totalReviews": 0}

    total_rating = sum(rev.get("rating", 0) for rev in doctor_reviews)
    average = total_rating / len(doctor_reviews)

    return {"averageRating": round(average, 1), "totalReviews": len(doctor_reviews)}


# Notifications Endpoints
@app.get("/notifications")
def list_notifications() -> list[dict[str, Any]]:
    return store.list("notifications")


@app.post("/notifications")
def create_notification(payload: NotificationCreate) -> dict[str, Any]:
    notification = make_document(payload.dict())
    return store.insert("notifications", notification)


@app.get("/notifications/user/{user_id}")
def get_user_notifications(user_id: str, user_type: str = None) -> list[dict[str, Any]]:
    notifications = store.list("notifications", limit=1000)
    user_notifications = [notif for notif in notifications if notif.get("userId") == user_id]

    if user_type:
        user_notifications = [notif for notif in user_notifications if notif.get("userType") == user_type]

    return user_notifications


@app.put("/notifications/{notification_id}/read")
def mark_notification_read(notification_id: str) -> dict[str, str]:
    # This would need update functionality in the store
    return {"message": f"Notification {notification_id} marked as read"}


# Payment Endpoints
@app.get("/payments")
def list_payments() -> list[dict[str, Any]]:
    return store.list("payments")


@app.post("/payments")
def create_payment(payload: PaymentCreate) -> dict[str, Any]:
    # Verify appointment exists
    appointments = store.list("appointments", limit=1000)
    appointment_exists = any(apt.get("id") == payload.appointmentId for apt in appointments)
    if not appointment_exists:
        raise HTTPException(status_code=400, detail="Appointment not found")

    payment = make_document(payload.dict())
    result = store.insert("payments", payment)

    # Create notification for patient
    notification = make_document({
        "userId": payload.patientId,
        "userType": "patient",
        "title": "Payment Processed",
        "message": f"Payment of ${payload.amount} processed for appointment {payload.appointmentId}",
        "type": "payment"
    })
    store.insert("notifications", notification)

    return result


@app.get("/payments/patient/{patient_id}")
def get_patient_payments(patient_id: str) -> list[dict[str, Any]]:
    payments = store.list("payments", limit=1000)
    return [pay for pay in payments if pay.get("patientId") == patient_id]


@app.get("/payments/doctor/{doctor_id}")
def get_doctor_payments(doctor_id: str) -> list[dict[str, Any]]:
    payments = store.list("payments", limit=1000)
    return [pay for pay in payments if pay.get("doctorId") == doctor_id]


# Analytics and Admin Endpoints
@app.get("/analytics/overview")
def get_analytics_overview() -> dict[str, Any]:
    patients = store.list("patients", limit=1000)
    doctors = store.list("doctors", limit=1000)
    appointments = store.list("appointments", limit=1000)
    consultations = store.list("consultations", limit=1000)
    payments = store.list("payments", limit=1000)

    total_revenue = sum(pay.get("amount", 0) for pay in payments)

    return {
        "totalPatients": len(patients),
        "totalDoctors": len(doctors),
        "totalAppointments": len(appointments),
        "totalConsultations": len(consultations),
        "totalRevenue": total_revenue,
        "activeAppointments": len([apt for apt in appointments if apt.get("status") == "scheduled"])
    }


@app.get("/analytics/doctor/{doctor_id}")
def get_doctor_analytics(doctor_id: str) -> dict[str, Any]:
    appointments = store.list("appointments", limit=1000)
    reviews = store.list("reviews", limit=1000)
    payments = store.list("payments", limit=1000)

    doctor_appointments = [apt for apt in appointments if apt.get("doctorId") == doctor_id]
    doctor_reviews = [rev for rev in reviews if rev.get("doctorId") == doctor_id]
    doctor_payments = [pay for pay in payments if pay.get("doctorId") == doctor_id]

    total_earnings = sum(pay.get("amount", 0) for pay in doctor_payments)

    return {
        "totalAppointments": len(doctor_appointments),
        "completedAppointments": len([apt for apt in doctor_appointments if apt.get("status") == "completed"]),
        "totalReviews": len(doctor_reviews),
        "averageRating": sum(rev.get("rating", 0) for rev in doctor_reviews) / len(doctor_reviews) if doctor_reviews else 0,
        "totalEarnings": total_earnings
    }
