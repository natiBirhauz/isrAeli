import os
import json
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, ValidationError
from typing import List, Dict, Any
from openai import OpenAI

# --- Setup and Initialization ---

print("📂 Current working directory:", os.getcwd())

if os.path.exists(".env"):
    print("✅ .env file FOUND")
else:
    print("❌ .env file NOT FOUND")

load_dotenv()

api_key = os.getenv("OPENAI_API_KEY")

# בדיקה קריטית בזמן הטעינה של האפליקציה
if not api_key:
    print("🚨 FATAL: OPENAI_API_KEY environment variable is not set. The application cannot start properly.")
    # במצב אמיתי, אפשר אפילו לגרום לאפליקציה לקרוס כאן כדי למנוע ריצה במצב לא תקין
else:
    print("✅ OpenAI API key loaded successfully.")

client = OpenAI(api_key=api_key)

SYSTEM_PROMPT = """
אתה בוט AI בשם 'ישראלi' – עוזר חיפוש חכם לישראלים, שתפקידו לאתר ולהחזיר תוצאות אמיתיות, עדכניות ורלוונטיות בלבד ממקורות מהימנים בישראל (כגון יד2, AllJobs, הומלס וכדומה), בהתאם לשאילתה החופשית של המשתמש.

המשימה שלך:
1. להבין את השאילתה בעברית חופשית ולסווג אותה לאחת מהקטגוריות הבאות:
    - 'job' – חיפוש משרות ועבודות.
    - 'apartment' – חיפוש דירות למכירה או להשכרה.
    - 'car' – חיפוש רכבים יד שנייה.
    - 'product' – חיפוש מוצרי צריכה אחרים.

2. לחלץ מתוך השאילתה את הפרמטרים הרלוונטיים.

3. **לייצר רשימה של עד 5 תוצאות חיפוש היפותטיות אך ריאליסטיות**, המתבססות על הידע שלך לגבי סוגי מודעות, מחירים ומיקומים בישראל.

4. להחזיר תשובה במבנה JSON תקני, כאשר שדות ה-details משתנים לפי סוג הקטגוריה.

פורמט JSON:
{
  "category": "job" | "apartment" | "car" | "product",
  "filters": {
    "location": "שם מקום",
    "price_range": "טווח מחירים (אופציונלי)",
    "rooms": "מספר חדרים (בדירות בלבד)",
    "vehicle_type": "סוג רכב (לרכב בלבד)",
    "job_type": "סוג משרה (למשרות בלבד)",
    "other": "פילטרים נוספים לפי צורך"
  },
  "results": [
    {
      "title": "כותרת ברורה ורלוונטית",
      "description": "תיאור קצר וקולע של המודעה",
      "location": "מיקום מדויק בישראל",
      "price": "מחיר או שכר, כולל מטבע",
      "url": "קישור ישיר למודעה",
      "details": {
        "job_type": "משרה מלאה | משרה חלקית | פרילנס", "company": "שם החברה (אופציונלי)",
        "year": "שנת ייצור", "hand": "יד", "engine": "נפח מנוע בסמ״ק", "kilometers": "קילומטראז׳",
        "floor": "קומה", "area": "שטח דירה במ״ר", "entry_date": "תאריך כניסה",
        "brand": "מותג", "specs": "מפרט עיקרי"
      }
    }
  ]
}

ודא שהפלט הוא אובייקט JSON תקני בלבד, ללא כל טקסט מקדים או מסביב. אם אין תוצאות תואמות – החזר מערך results ריק בתוך ה-JSON.
"""

# --- Pydantic Models ---

class Item(BaseModel):
    title: str
    description: str
    location: str
    price: str
    url: str
    details: Dict[str, Any]

class SearchResponse(BaseModel):
    category: str
    filters: Dict[str, Any]
    results: List[Item]

# --- FastAPI App Initialization ---

app = FastAPI(
    title="ישראלi API",
    version="1.1",
    description="API לבוט AI למציאת עבודה, דירה או רכב בישראל, עם דיבאגינג מפורט."
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- API Endpoints ---

@app.get("/", include_in_schema=False)
async def root():
    return RedirectResponse(url="/docs")

@app.get("/validate-key")
async def validate_key(user_api_key: str = Query(..., description="OpenAI API key to validate")):
    """Validates a user-provided OpenAI API key by making a minimal test call."""
    print("\n--- /validate-key endpoint entered ---")
    try:
        test_client = OpenAI(api_key=user_api_key)
        test_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": "ping"}],
            max_tokens=1,
        )
        print("--- Key is valid ---")
        return {"valid": True}
    except Exception as e:
        print(f"--- Key validation failed: {e} ---")
        err = getattr(e, "error", {})
        code = err.get("code") or getattr(e, "status_code", None)
        if code == 401 or "Incorrect API key" in str(e):
            raise HTTPException(status_code=401, detail="Invalid API key.")
        if code == "insufficient_quota" or code == 429:
            raise HTTPException(status_code=429, detail="API key has exceeded its quota.")
        raise HTTPException(status_code=400, detail=f"Could not validate key: {str(e)}")


@app.get("/search")
async def search(
    q: str = Query(..., description="תיאור של מה שאתה מחפש"),
    user_api_key: str = Query(None, description="Optional user-provided OpenAI API key"),
):
    print("\n--- 1. Search endpoint entered ---")

    # Use user-provided key if supplied, otherwise fall back to server key
    effective_key = user_api_key if user_api_key else api_key

    if not effective_key:
        print("--- FATAL ERROR: No OpenAI API key available! ---")
        raise HTTPException(
            status_code=400,
            detail="No OpenAI API key provided. Please add your API key in the settings."
        )

    # Build a client with whichever key we're using
    active_client = OpenAI(api_key=effective_key) if user_api_key else client

    print(f"--- 2. Query received: '{q}' | Using {'user' if user_api_key else 'server'} key ---")

    try:
        print("--- 3. Preparing to call OpenAI API... ---")
        chat = active_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": q}
            ],
            temperature=0.2,
            max_tokens=1024,
            response_format={"type": "json_object"},
        )
        print("--- 4. OpenAI API call FINISHED successfully. ---")
        response_content = chat.choices[0].message.content

    except Exception as e:
        print(f"--- CRITICAL ERROR during OpenAI API call: {type(e).__name__} - {e} ---")
        err = getattr(e, "error", {})
        code = err.get("code") or getattr(e, "status_code", None)
        is_quota = code == "insufficient_quota" or code == 429
        if is_quota:
            raise HTTPException(status_code=429, detail="OpenAI quota exceeded.")
        if code == 401 or "Incorrect API key" in str(e):
            raise HTTPException(status_code=401, detail="Invalid API key provided.")
        raise HTTPException(status_code=500, detail=f"An unexpected error occurred with the OpenAI API: {str(e)}")

    print("--- 5. RAW OPENAI RESPONSE ---")
    print(response_content)
    print("----------------------------")

    try:
        print("--- 6. Attempting to parse JSON... ---")
        data = json.loads(response_content)
        validated_data = SearchResponse(**data)
        print("--- 7. JSON parsed and validated successfully! Returning data. ---")
        return validated_data
    except ValidationError as e:
        print(f"--- ERROR: Pydantic validation failed. Details: {e.errors()} ---")
        raise HTTPException(
            status_code=500,
            detail={
                "error": "OpenAI response structure does not match the expected format.",
                "validation_errors": e.errors(),
                "raw_response": response_content
            }
        )
    except Exception as e:
        print(f"--- ERROR: Failed to process response. Type: {type(e).__name__}, Details: {e} ---")
        raise HTTPException(
            status_code=500,
            detail={
                "error": "An unexpected error occurred while processing the response.",
                "raw_response": response_content
            }
        )