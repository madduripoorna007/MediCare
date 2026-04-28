# ------------------------------------HEALTH PORTAL-----------------------------------------


import os
import csv
from datetime import datetime, timedelta, date, time
import pandas as pd
import numpy as np


# file paths (assume same folder)

APPOINTMENTS_CSV = "appointments.csv"
DOCTORS_CSV = "doctors.csv"
MEDICAL_DETAILS_CSV = "medical_details.csv"
USERS_CSV = "users.csv"

# Ensure CSV headers (create if missing)


def ensure_file_exists(path, headers):
    # Ensure a CSV exists, if missing then create with given headers.
    if not os.path.exists(path):
        with open(path, "w", newline="", encoding="utf-8") as f:  # utf-8 supports all characters
            writer = csv.writer(f)  # to be able to write rows in csv file
            writer.writerow(headers)  # writes a single row to the file f


ensure_file_exists(APPOINTMENTS_CSV, [
    "id", "user_id", "doctor_id", "start_time", "end_time", "status", "fees", "payment_status", "booking_time",
    "bill_id", "symptoms_summary", "created_by"
])
ensure_file_exists(DOCTORS_CSV, [
    "id", "name", "specialization", "qualifications", "contact", "available_days", "available_from",
    "available_to", "not_available_dates", "fees", "consultation_modes", "languages"
])
ensure_file_exists(MEDICAL_DETAILS_CSV, [
    "bill_id", "user_id", "bill_amount_rs", "paid", "diseases", "medicines", "prescription"
])
ensure_file_exists(USERS_CSV, [
    "id", "username", "name", "password", "role", "email", "phone", "dob", "gender", "bill_ids", "emergency_contact"
])


def parse_list_string(value):
    # parse a string that looks like a simple Python list into a Python list of stripped strings.
    if value is None:
        return []
    v = str(value).strip()
    if not v:
        return []
    if v.startswith("[") and v.endswith("]"):
        inner = v[1:-1].strip()
        if not inner:
            return []
        parts = []
        cur = ""
        in_quotes = False
        for ch in inner:
            if ch in ('"', "'"):
                in_quotes = not in_quotes
                continue
            if ch == "," and not in_quotes:
                if cur.strip():
                    parts.append(cur.strip())
                cur = ""
                continue
            cur += ch
        if cur.strip():
            parts.append(cur.strip())
        return [p.strip().strip('"').strip("'") for p in parts]
    return [p.strip() for p in v.split(",") if p.strip()]


def parse_dict_like_string(value):
    # Parse a very simple dict-like string into a dictionary (only handles basic "key": value pairs).
    if value is None:
        return {}
    v = str(value).strip()
    if not v:
        return {}
    if v.startswith("{") and v.endswith("}"):
        inner = v[1:-1].strip()
        if not inner:
            return {}
        result = {}
        parts = []
        cur = ""
        in_quotes = False
        for ch in inner:
            if ch in ('"', "'"):
                in_quotes = not in_quotes
                cur += ch
                continue
            if ch == "," and not in_quotes:
                parts.append(cur.strip())
                cur = ""
                continue
            cur += ch
        if cur.strip():
            parts.append(cur.strip())
        for part in parts:
            if ":" in part:
                k, val = part.split(":", 1)
                k = k.strip().strip('"').strip("'")
                val = val.strip()
                if val.startswith('"') and val.endswith('"') or val.startswith("'") and val.endswith("'"):
                    val = val[1:-1]
                else:
                    try:
                        if "." in val:
                            val = float(val)
                        else:
                            val = int(val)
                    except Exception:
                        pass
                result[k] = val
        return result
    return {}


def load_csv_as_df(path):
    # load a CSV file into a pandas DataFrame (keeping all fields as strings).
    return pd.read_csv(path, dtype=str, keep_default_na=False)


def save_df_to_csv(df, path):
    # Save a pandas DataFrame back to its CSV file path.
    df.to_csv(path, index=False)


def load_data():
    # load all databases (appointments, doctors, medical_details, users) into pandas DataFrames.
    appts = load_csv_as_df(APPOINTMENTS_CSV)
    docs = load_csv_as_df(DOCTORS_CSV)
    meds = load_csv_as_df(MEDICAL_DETAILS_CSV)
    users = load_csv_as_df(USERS_CSV)
    if "password_hash" in users.columns and "password" not in users.columns:
        users["password"] = users["password_hash"]
        users.drop(columns=["password_hash"], inplace=True)
    if "rating" in appts.columns:
        appts = appts.drop(columns=["rating"])
    return {"appointments": appts, "doctors": docs, "medical_details": meds, "users": users}


def save_data(data):
    # Task: Save all DataFrames (appointments, doctors, medical_details, users) back to their CSVs.
    save_df_to_csv(data["appointments"], APPOINTMENTS_CSV)
    save_df_to_csv(data["doctors"], DOCTORS_CSV)
    save_df_to_csv(data["medical_details"], MEDICAL_DETAILS_CSV)
    save_df_to_csv(data["users"], USERS_CSV)


def get_next_id(df, id_col):
    # Return the next integer ID for a DataFrame (automatically increase).
    if df.empty:
        return 1
    try:
        existing = pd.to_numeric(
            df[id_col], errors="coerce").dropna().astype(int)
        if existing.empty:
            return 1
        return int(existing.max() + 1)
    except Exception:
        return len(df) + 1


def conflict_check(doctor_id, start_time, end_time, data,
                   exclude_appointment_id):
    # Check whether a proposed appointment time overlaps with existing appointments of the same doctor.
    appts = data["appointments"]
    try:
        new_start = datetime.fromisoformat(start_time)
        new_end = datetime.fromisoformat(end_time)
    except Exception:
        raise ValueError("start_time or end_time not in ISO format")
    for _, row in appts.iterrows():
        if row.get("doctor_id") and str(row["doctor_id"]) == str(doctor_id):
            if exclude_appointment_id and str(row["id"]) == str(exclude_appointment_id):
                continue
            status = row.get("status", "").lower()
            if status in ("canceled", "cancelled"):
                continue
            try:
                existing_start = datetime.fromisoformat(row["start_time"])
                existing_end = datetime.fromisoformat(row["end_time"])
            except Exception:
                continue
            latest_start = max(new_start, existing_start)
            earliest_end = min(new_end, existing_end)
            overlap = (earliest_end > latest_start)
            if overlap:
                return True
    return False

# Authentication


def verify_login(username, password, data):
    # Verify provided credentials against stored plain password; return user row as dict on success.
    users = data["users"]
    matched = users[users["username"] == username]
    if matched.empty:
        return None
    stored = matched.iloc[0].get("password", "")
    if stored == password:
        return matched.iloc[0].to_dict()
    return None


# Doctor Management (Admin)
def add_doctor(doctor_info, data):
    # Add a new doctor row into doctors DataFrame and save.
    docs = data["doctors"]
    new_id = get_next_id(docs, "id")
    doc_row = {
        "id": new_id,
        "name": doctor_info.get("name", ""),
        "specialization": doctor_info.get("specialization", ""),
        "qualifications": doctor_info.get("qualifications", ""),
        "contact": str(doctor_info.get("contact", "")),
        "available_days": str(doctor_info.get("available_days", "")),
        "available_from": doctor_info.get("available_from", ""),
        "available_to": doctor_info.get("available_to", ""),
        "not_available_dates": str(doctor_info.get("not_available_dates", "")),
        "fees": str(doctor_info.get("fees", "")),
        "consultation_modes": str(doctor_info.get("consultation_modes", "")),
        "languages": str(doctor_info.get("languages", ""))
    }
    docs = pd.concat([docs, pd.DataFrame([doc_row])], ignore_index=True)
    data["doctors"] = docs
    save_data(data)
    return doc_row


def edit_doctor(doctor_id, updates, data):
    # Task: Edit fields for a doctor row identified by doctor_id and save changes.
    docs = data["doctors"]
    mask = docs["id"].astype(str) == str(doctor_id)
    if not mask.any():
        return False
    for k, v in updates.items():
        if k in docs.columns:
            docs.loc[mask, k] = str(v)
    data["doctors"] = docs
    save_data(data)
    return True


def remove_doctor(doctor_id, data):
    # Task: Remove a doctor from the doctors DataFrame (basic deletion).
    docs = data["doctors"]
    mask = docs["id"].astype(str) == str(doctor_id)
    if not mask.any():
        return False
    docs = docs[~mask]
    data["doctors"] = docs
    save_data(data)
    return True

# -----------------------------
# User Management (Admin
# -----------------------------


def add_user(user_info, data):
    # Task: Add a new user to users DataFrame; stores plain password as provided.
    users = data["users"]
    new_id = get_next_id(users, "id")
    password = user_info.get("password", "")
    user_row = {
        "id": new_id,
        "username": user_info.get("username", ""),
        "name": user_info.get("name", ""),
        "password": password,
        "role": user_info.get("role", "client"),
        "email": user_info.get("email", ""),
        "phone": user_info.get("phone", ""),
        "dob": user_info.get("dob", ""),
        "gender": user_info.get("gender", ""),
        "bill_ids": str(user_info.get("bill_ids", "")),
        "emergency_contact": str(user_info.get("emergency_contact", ""))
    }
    users = pd.concat([users, pd.DataFrame([user_row])], ignore_index=True)
    data["users"] = users
    save_data(data)
    return user_row


def edit_user(user_id, updates, data):
    # Task: Edit user fields for a given user id and save changes.
    users = data["users"]
    mask = users["id"].astype(str) == str(user_id)
    if not mask.any():
        return False
    for k, v in updates.items():
        if k in users.columns:
            users.loc[mask, k] = str(v)
    data["users"] = users
    save_data(data)
    return True


def remove_user(user_id, data):
    # Task: Remove a user row by id from users DataFrame.
    users = data["users"]
    mask = users["id"].astype(str) == str(user_id)
    if not mask.any():
        return False
    users = users[~mask]
    data["users"] = users
    save_data(data)
    return True


def generate_bill(user_id, amount, diseases, medicines,
                  prescription_text, data, paid):
    # Create a new bill entry in medical_details and save.
    meds = data["medical_details"]
    new_bill_id = get_next_id(meds, "bill_id")
    bill_row = {
        "bill_id": new_bill_id,
        "user_id": user_id,
        "bill_amount_rs": float(amount),
        "paid": "yes" if paid else "no",
        "diseases": str(diseases),
        "medicines": str(medicines),
        "prescription": prescription_text
    }
    meds = pd.concat([meds, pd.DataFrame([bill_row])], ignore_index=True)
    data["medical_details"] = meds
    save_data(data)
    return bill_row


def edit_bill(bill_id, updates, data):
    #  Edit an existing bill (medical_details row and save.
    meds = data["medical_details"]
    mask = meds["bill_id"].astype(str) == str(bill_id)
    if not mask.any():
        return False
    for k, v in updates.items():
        if k in meds.columns:
            meds.loc[mask, k] = v
    data["medical_details"] = meds
    save_data(data)
    return True


def view_doctor_performance(doctor_id, data):
    # Aggregate doctor's appointments and unique patients and return summary dictionary.
    appts = data["appointments"]
    doctor_appts = appts[appts["doctor_id"].astype(str) == str(doctor_id)]
    total_patients = doctor_appts["user_id"].nunique()
    summary = {
        "doctor_id": doctor_id,
        "total_appointments": int(len(doctor_appts)),
        "unique_patients": int(total_patients)
    }
    return summary

# -----------------------------
# Appointments Management
# -----------------------------



def view_all_appointments(data):
    # Return the appointments DataFrame for admin viewing.
    return data["appointments"].copy()


def book_appointment(user_id, doctor_id, start_time, end_time,
                     symptoms_summary, data):
    #  Create an appointment if no conflict and add to appointments DataFrame and save.
    if conflict_check(doctor_id, start_time, end_time, data):
        raise ValueError("Time conflict for the doctor")
    appts = data["appointments"]
    new_id = get_next_id(appts, "id")
    booking_time = datetime.now().isoformat()
    docs = data["doctors"]
    doc_row = docs[docs["id"].astype(str) == str(doctor_id)]
    fees = ""
    if not doc_row.empty:
        fees = doc_row.iloc[0].get("fees", "")
    appt_row = {
        "id": new_id,
        "user_id": user_id,
        "doctor_id": doctor_id,
        "start_time": start_time,
        "end_time": end_time,
        "status": "booked",
        "fees": fees,
        "payment_status": "unpaid",
        "booking_time": booking_time,
        "bill_id": "",
        "symptoms_summary": symptoms_summary,
        "created_by": user_id
    }
    appts = pd.concat([appts, pd.DataFrame([appt_row])], ignore_index=True)
    data["appointments"] = appts
    save_data(data)
    return appt_row


def cancel_appointment(appointment_id, data):
    #  Mark an appointment as canceled and save to CSV.
    appts = data["appointments"]
    mask = appts["id"].astype(str) == str(appointment_id)
    if not mask.any():
        return False
    appts.loc[mask, "status"] = "canceled"
    data["appointments"] = appts
    save_data(data)
    return True

# -----------------------------
# Medical details / bills
# -----------------------------


def view_bills(data):
    # Return medical details DataFrame for admin/client viewing.
    return data["medical_details"].copy()


def search_doctor(filters, data):
    #  Search doctors by filters (specialization, available_day, language, consultation_mode).
    docs = doctor_availability_dataframe(data)
    df = docs.copy()
    spec = filters.get("specialization")
    if spec:
        df = df[df["specialization"].str.contains(
            str(spec), case=False, na=False)]
    day = filters.get("day")
    if day:
        df = df[df["available_days_parsed"].apply(
            lambda arr: day in arr if isinstance(arr, list) else False)]
    language = filters.get("language")
    if language:
        df = df[df["languages"].str.contains(
            str(language), case=False, na=False)]
    mode = filters.get("mode")
    if mode:
        df = df[df["consultation_modes"].str.contains(
            str(mode), case=False, na=False)]
    return df


def revenue_summary(data):
    # Aggregate total consultation fees per doctor (from appointments) and return a DataFrame.
    appts = data["appointments"].copy()
    appts["fees_numeric"] = pd.to_numeric(
        appts["fees"], errors="coerce").fillna(0.0)
    agg = appts.groupby("doctor_id", dropna=False)["fees_numeric"].sum().reset_index().rename(
        columns={"fees_numeric": "total_revenue_rs"}
    )
    docs = data["doctors"][["id", "name"]].copy()
    docs.rename(columns={"id": "doctor_id"}, inplace=True)
    merged = agg.merge(docs, on="doctor_id", how="left")
    return merged.sort_values("total_revenue_rs", ascending=False)


def doctor_availability_dataframe(data):
    # Return doctors DataFrame with parsed availability columns for display (simple parsing).
    docs = data["doctors"].copy()
    docs["available_days_parsed"] = docs["available_days"].apply(
        parse_list_string)
    docs["not_available_dates_parsed"] = docs["not_available_dates"].apply(
        parse_list_string)
    return docs


def total_bills_amount(data):
    # Sum all bills amount using numpy.
    meds = data["medical_details"].copy()
    arr = pd.to_numeric(meds["bill_amount_rs"], errors="coerce").fillna(
        0.0).to_numpy(dtype=float)
    return float(np.sum(arr))


def median_fee_of_doctors(data):
    # Task (NumPy): Compute median of doctors' fee amounts (from doctors table).
    docs = data["doctors"].copy()
    fees_list = []
    for v in docs["fees"]:
        parsed = parse_dict_like_string(v)
        if isinstance(parsed, dict):
            nums = []
            for val in parsed.values():
                try:
                    nums.append(float(val))
                except Exception:
                    pass
            if nums:
                fees_list.append(np.mean(nums))
        else:
            try:
                fees_list.append(float(str(v)))
            except Exception:
                pass
    if not fees_list:
        return float("nan")
    arr = np.array(fees_list, dtype=float)
    return float(np.median(arr))


def count_unpaid_bills(data):
    # Task (NumPy): Count unpaid bills (numpy used for array operations).
    meds = data["medical_details"].copy()
    unpaid_mask = meds["paid"].str.lower() != "yes"
    arr = unpaid_mask.to_numpy()
    return int(np.sum(arr))


def doctor_patient_counts(data):
    # (NumPy & Pandas): Compute number of unique patients per doctor.
    appts = data["appointments"].copy()
    agg = appts.groupby("doctor_id")["user_id"].nunique().reset_index().rename(
        columns={"user_id": "unique_patient_count"})
    agg["unique_patient_count"] = agg["unique_patient_count"].astype(int)
    return agg

# -----------------------------
# Availability checks
# -----------------------------


def check_doctor_available(doctor_id, requested_start, requested_end, data):
    # Check doctor's weekly availability, not_available_dates, and conflict with current appointments.
    docs = data["doctors"]
    doc = docs[docs["id"].astype(str) == str(doctor_id)]
    if doc.empty:
        return False
    doc = doc.iloc[0]
    try:
        rs = datetime.fromisoformat(requested_start)
        re = datetime.fromisoformat(requested_end)
    except Exception:
        raise ValueError("Requested start/end time not ISO format")
    weekday_str = rs.strftime("%a")
    available_days = parse_list_string(doc.get("available_days", ""))
    if isinstance(available_days, list) and weekday_str not in available_days:
        return False
    try:
        avail_from = datetime.strptime(
            str(doc["available_from"]), "%H:%M").time()
        avail_to = datetime.strptime(str(doc["available_to"]), "%H:%M").time()
        if not (avail_from <= rs.time() < avail_to and avail_from < re.time() <= avail_to):
            return False
    except Exception:
        pass
    not_avail = parse_list_string(doc.get("not_available_dates", ""))
    if rs.date().isoformat() in [str(d) for d in not_avail]:
        return False
    if conflict_check(doctor_id, requested_start, requested_end, data):
        return False
    return True


def mark_doctor_unavailable(doctor_id, date_str, data):
    # Add a date to a doctor's not_available_dates list and save.
    docs = data["doctors"]
    mask = docs["id"].astype(str) == str(doctor_id)
    if not mask.any():
        return False
    current = docs.loc[mask, "not_available_dates"].iloc[0]
    parsed = parse_list_string(current)
    if date_str not in parsed:
        parsed.append(date_str)
    docs.loc[mask, "not_available_dates"] = str(parsed)
    data["doctors"] = docs
    save_data(data)
    return True


def get_user_appointments(user_id, data):
    # Return a DataFrame of appointments belonging to a particular user.
    appts = data["appointments"].copy()
    user_appts = appts[appts["user_id"].astype(str) == str(user_id)]
    return user_appts.sort_values("start_time")


def get_user_medical_records(user_id, data):
    #  Return medical_details rows linked to a user.
    meds = data["medical_details"].copy()
    user_meds = meds[meds["user_id"].astype(str) == str(user_id)]
    return user_meds


# health_portal

class HealthPortal:
    # Main CLI interface class that orchestrates operations and provides simple shell-based menus as methods
    # all the menus/pages are a method in this portal class so that we can properly go from one page to any other
    # required page, this portal uses above helper functions to read and modify data from the database

    def __init__(self):
        self.data = load_data()
        self.current_user = None

    def header(self, title: str):
        # Print a nice header for CLI pages.
        print("\n" + "=" * 60)
        print(f"{title.center(60)}")
        print("=" * 60 + "\n")

    def main_menu(self):
        # display main menu(home screen) and dispatch to login/register/quit/create admin.
        while True:
            self.header("HEALTH PORTAL")
            print("1. Login")
            print("2. Register (client)")
            print("3. Quit")
            print("4. Create Admin (requires secret)")
            choice = input("Choose an option (1/2/3/4): ").strip()
            if choice in ("1", "1."):
                self.login()
            elif choice in ("2", "2."):
                self.register()
            elif choice in ("3", "3.", "q", "quit"):
                print("Goodbye.")
                break
            elif choice in ("4", "4."):
                self.create_admin_flow()
            else:
                print("Invalid input. Try again.")

    def login(self):
        # ask for credentials and set current_user on success.
        username = input("Username: ").strip()
        password = input("Password: ").strip()
        user = verify_login(username, password, self.data)
        if not user:
            print("Invalid username/password.")
            return
        self.current_user = user
        print(f"Welcome, {user.get('name')}.")
        if user.get("role") == "admin":
            self.admin_dashboard()
        else:
            self.client_dashboard()

    def register(self):

        username = input("Choose a username: ").strip()
        name = input("Full name: ").strip()
        password = input("Choose a password: ").strip()
        phone = input("Phone: ").strip()
        email = input("Email: ").strip()
        new = {
            "username": username,
            "name": name,
            "password": password,
            "role": "client",
            "email": email,
            "phone": phone,
            "dob": "",
            "gender": "",
            "bill_ids": "[]",
            "emergency_contact": "{}"
        }
        created = add_user(new, self.data)
        print("Account created. Please login.")
        return created

    def create_admin_flow(self):
        # Create a new admin account if the secret matches; admin password will be 'password'.
        secret = input("Enter admin creation secret: ").strip()
        if secret != "password":
            print("Incorrect secret. Cannot create admin.")
            return
        username = input("Admin username: ").strip()
        name = input("Admin full name: ").strip()
        # default admin password is 'password'
        admin_password = "password"
        phone = input("Phone (optional): ").strip()
        email = input("Email (optional): ").strip()
        new = {
            "username": username,
            "name": name,
            "password": admin_password,
            "role": "admin",
            "email": email,
            "phone": phone,
            "dob": "",
            "gender": "",
            "bill_ids": "[]",
            "emergency_contact": "{}"
        }
        created = add_user(new, self.data)
        print("Admin account created with default password. Please login as admin to continue.")
        return created

    # -------------------
    # Admin Dashboard
    # -------------------
    def admin_dashboard(self):
        # Task: Admin menu with management options and analytics.
        while True:
            self.header("ADMIN DASHBOARD")
            print("1. Manage Doctors")
            print("2. Manage Users")
            print("3. View All Appointments")
            print("4. View Bills & Medical Records")
            print("5. Analytics")
            print("6. Logout")
            ch = input("Choose an option: ").strip()
            if ch == "1":
                self.manage_doctors_menu()
            elif ch == "2":
                self.manage_users_menu()
            elif ch == "3":
                df = view_all_appointments(self.data)
                print(df.to_string(index=False))
                input("Press Enter to continue...")
            elif ch == "4":
                df = view_bills(self.data)
                print(df.to_string(index=False))
                input("Press Enter to continue...")
            elif ch == "5":
                self.admin_analytics_menu()
            elif ch in ("6", "logout"):
                self.current_user = None
                break
            else:
                print("Invalid choice.")

    def manage_doctors_menu(self):
        #  Admin menu for doctor CRUD operations.
        while True:
            self.header("MANAGE DOCTORS")
            print("1. Add Doctor")
            print("2. Edit Doctor")
            print("3. Remove Doctor")
            print("4. Back")
            ch = input("Choice: ").strip()
            if ch == "1":
                name = input("Name: ")
                specialization = input("Specialization: ")
                qualifications = input("Qualifications: ")
                contact_input = input(
                    "Contact as simple dict-like string (e.g. {'email':'a@b','phone':'9191'}): ")
                available_days = input(
                    "Available days as list-like (e.g. ['Mon','Tue']): ")
                available_from = input("Available from (HH:MM): ")
                available_to = input("Available to (HH:MM): ")
                not_avail = input(
                    "Not available dates as list-like (e.g. ['2025-12-01']): ")
                fees = input("Fees (or dict-like for modes): ")
                modes = input("Consultation modes as list-like: ")
                languages = input("Languages as list-like: ")
                doctor_info = {
                    "name": name, "specialization": specialization,
                    "qualifications": qualifications, "contact": contact_input,
                    "available_days": available_days, "available_from": available_from,
                    "available_to": available_to, "not_available_dates": not_avail,
                    "fees": fees, "consultation_modes": modes, "languages": languages
                }
                added = add_doctor(doctor_info, self.data)
                print("Doctor added:", added)
            elif ch == "2":
                did = input("Doctor id to edit: ")
                updates_raw = input(
                    "Provide updates as key=value pairs separated by comma: ")
                updates = {}
                for pair in updates_raw.split(","):
                    if "=" in pair:
                        k, v = pair.split("=", 1)
                        updates[k.strip()] = v.strip()
                success = edit_doctor(int(did), updates, self.data)
                print("Updated:" if success else "Doctor not found.")
            elif ch == "3":
                did = input("Doctor id to remove: ")
                success = remove_doctor(int(did), self.data)
                print("Removed." if success else "Not found.")
            elif ch == "4":
                break
            else:
                print("Invalid choice.")

    def manage_users_menu(self):
        # Task- Admin menu to add/edit/remove users.
        while True:
            self.header("MANAGE USERS")
            print("1. Add User")
            print("2. Edit User")
            print("3. Remove User")
            print("4. Back")
            ch = input("Choice: ").strip()
            if ch == "1":
                username = input("Username: ")
                name = input("Full name: ")
                password = input("Password: ")
                role = input("Role (admin/client): ")
                email = input("Email: ")
                phone = input("Phone: ")
                info = {
                    "username": username, "name": name, "password": password, "role": role,
                    "email": email, "phone": phone, "dob": "", "gender": "", "bill_ids": "[]",
                    "emergency_contact": "{}"
                }
                u = add_user(info, self.data)
                print("Added:", u)
            elif ch == "2":
                uid = input("User id to edit: ")
                updates_raw = input("key=value pairs comma separated: ")
                updates = {}
                for pair in updates_raw.split(","):
                    if "=" in pair:
                        k, v = pair.split("=", 1)
                        updates[k.strip()] = v.strip()
                success = edit_user(int(uid), updates, self.data)
                print("Updated." if success else "User not found.")
            elif ch == "3":
                uid = input("User id to remove: ")
                success = remove_user(int(uid), self.data)
                print("Removed." if success else "User not found.")
            elif ch == "4":
                break
            else:
                print("Invalid choice.")

    def admin_analytics_menu(self):
        #  Admin analytics menu: revenue, bills, doctor performance.
        while True:
            self.header("ADMIN ANALYTICS")
            print("1. Revenue Summary (per doctor)")
            print("2. Total Bills Amount")
            print("3. Count Unpaid Bills")
            print("4. Doctor Performance (by id)")
            print("5. Back")
            ch = input("Choice: ").strip()
            if ch == "1":
                df = revenue_summary(self.data)
                print(df.to_string(index=False))
                input("Enter to continue...")
            elif ch == "2":
                print("Not available for now, please try again later!")
            #     total = total_bills_amount(self.data)
            #     print(f"Total bills amount: Rs {total:.2f}")
                input("Enter to continue...")
            elif ch == "3":
                cnt = count_unpaid_bills(self.data)
                print(f"Unpaid bills count: {cnt}")
                input("Enter to continue...")
            elif ch == "4":
                did = input("Enter doctor id: ")
                perf = view_doctor_performance(int(did), self.data)
                print(perf)
                input("Enter to continue...")
            elif ch == "5":
                break
            else:
                print("Invalid choice.")

    # -------------------
    # Client Dashboard
    # -------------------
    def client_dashboard(self):
        # Task: Client menu with actions for logged-in users.
        while True:
            self.header("CLIENT DASHBOARD")
            print("1. View/Edit Profile")
            print("2. Search Doctors")
            print("3. My Appointments")
            print("4. Book Appointment")
            print("5. View Medical Records & Bills")
            print("6. Logout")
            ch = input("Choice: ").strip()
            if ch == "1":
                self.view_edit_profile()
            elif ch == "2":
                self.search_doctors_ui()
            elif ch == "3":
                uid = int(self.current_user["id"])
                df = get_user_appointments(uid, self.data)
                print(df.to_string(index=False))
                input("Enter to continue...")
            elif ch == "4":
                self.book_appointment_ui()
            elif ch == "5":
                uid = int(self.current_user["id"])
                records = get_user_medical_records(uid, self.data)
                print(records.to_string(index=False))
                input("Enter to continue...")
            elif ch in ("6", "logout"):
                self.current_user = None
                break
            else:
                print("Invalid choice.")

    def view_edit_profile(self):
        # Task: Allow the logged-in user to view and edit some profile fields (admin-only fields excluded).
        uid = int(self.current_user["id"])
        users = self.data["users"]
        row = users[users["id"].astype(str) == str(uid)].iloc[0]
        print("Your profile:")
        print({
            "id": row["id"],
            "username": row["username"],
            "name": row["name"],
            "email": row["email"],
            "phone": row["phone"]
        })
        if input("Edit profile? (y/N): ").strip().lower() == "y":
            updates_raw = input(
                "Enter key=value pairs separated by commas (allowed: name, password, phone, email): ")
            updates = {}
            for pair in updates_raw.split(","):
                if "=" in pair:
                    k, v = pair.split("=", 1)
                    key = k.strip()
                    if key in ("name", "password", "phone", "email"):
                        updates[key] = v.strip()
            success = edit_user(uid, updates, self.data)
            print("Updated." if success else "Failed.")
            self.data = load_data()
            if "password" in updates:
                self.current_user = verify_login(
                    row["username"], updates["password"], self.data) or self.current_user
# Alok's code ends-----------------------------------------------------------------------------------------------------------------------
# Harsha re-begins--------------------------------------------------------------------------------------------------------------------

    def search_doctors_ui(self):

        spec = input("Specialization (leave blank for any): ").strip()
        day = input("Day (Mon/Tue/Wed... leave blank): ").strip()
        lang = input("Language (leave blank): ").strip()
        mode = input(
            "Consultation mode (in_person/telemedicine leave blank): ").strip()
        filters = {}
        if spec:
            filters["specialization"] = spec
        if day:
            filters["day"] = day
        if lang:
            filters["language"] = lang
        if mode:
            filters["mode"] = mode
        df = search_doctor(filters, self.data)
        print(df[["id", "name", "specialization",
              "available_days", "fees"]].to_string(index=False))
        input("Enter to continue...")

    def book_appointment_ui(self):
        # - ask date as DD-MM-YYYY
        # - ask hour as HH (24-hour)

        uid = int(self.current_user["id"])
        did_raw = input("Doctor id: ").strip()
        try:
            did = int(did_raw)
        except Exception:
            print("Invalid doctor id.")
            return
        # Validate doctor exists
        docs = self.data["doctors"]
        # boolean indexing/masking i.e search based on the condition and .iloc[0] would give first row that matches
        if docs[docs["id"].astype(str) == str(did)].empty:
            print("Doctor not found.")
            return

        date_str = input("Date (DD-MM-YYYY): ").strip()
        try:
            day_dt = datetime.strptime(date_str, "%d-%m-%Y").date()
        except Exception:
            print("Invalid date format.")
            return

        while True:
            hour_input = input(
                "Hour of the day (HH in 24-hour format, or 'c' to cancel): ").strip()
            if hour_input.lower() in ("c", "cancel"):
                print("Booking cancelled.")
                return
            if not hour_input.isdigit() or not (0 <= int(hour_input) <= 23):
                print("Invalid hour. Enter HH between 00 and 23.")
                continue
            hour_int = int(hour_input)
            # generate candidate 20-min slots: start minutes 0,20,40
            candidate_starts = [0, 20, 40]
            slot_found = None
            for start_min in candidate_starts:
                slot_start = datetime.combine(
                    day_dt, time(hour_int, start_min, 0))
                slot_end = slot_start + timedelta(minutes=20)
                # ensure slot_end does not overflow next day (shouldn't for single hour)
                # check doctor's working hours and not_available_dates via check_doctor_available
                try:
                    iso_start = slot_start.isoformat()
                    iso_end = slot_end.isoformat()
                    # check doctor's availability for that slot (includes not_available_dates, working hours, conflicts)
                    if check_doctor_available(did, iso_start, iso_end, self.data):
                        slot_found = (iso_start, iso_end)
                        break
                except Exception:
                    continue
            if slot_found:
                summary = input("Symptoms summary (short): ").strip()
                appt = book_appointment(
                    uid, did, slot_found[0], slot_found[1], summary, self.data)

                human_start = datetime.fromisoformat(
                    slot_found[0]).strftime("%d-%m-%Y %H:%M")
                human_end = datetime.fromisoformat(
                    slot_found[1]).strftime("%d-%m-%Y %H:%M")
                print(f"Appointment booked for {human_start} to {human_end}.")
                print(appt)
                input("Enter to continue...")
                return
            else:
                print(
                    f"No 20-minute slot available in hour {hour_int:02d}. Please choose another hour or cancel (c).")
                continue



# If run directly, start portal
# -----------------------------
if __name__ == "__main__":
    portal = HealthPortal()
    portal.main_menu()
