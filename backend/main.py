# israeli-bot/backend/main.py

import os
import json
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from typing import List, Dict, Any
from openai import OpenAI  # <-- client class in new v1.x interface
import os
from dotenv import load_dotenv

print("📂 Current working directory:", os.getcwd())

if os.path.exists(".env"):
    print("✅ .env file FOUND")
else:
    print("❌ .env file NOT FOUND")

load_dotenv()  # טוען את קובץ ה-.env

api_key = os.getenv("OPENAI_API_KEY")
if not api_key:
    raise RuntimeError("OPENAI_API_KEY is not set in environment")
client = OpenAI(api_key=api_key)

SYSTEM_PROMPT = """
אתה בוט AI בשם 'ישראלi' – עוזר חיפוש חכם לישראלים, שתפקידו לאתר ולהחזיר תוצאות אמיתיות, עדכניות ורלוונטיות בלבד ממקורות מהימנים בישראל (כגון יד2, AllJobs, הומלס וכדומה), בהתאם לשאילתה החופשית של המשתמש.

המשימה שלך:
1. להבין את השאילתה בעברית חופשית ולסווג אותה לאחת מהקטגוריות הבאות:
    - 'job' – חיפוש משרות ועבודות.
    - 'apartment' – חיפוש דירות למכירה או להשכרה.
    - 'car' – חיפוש רכבים יד שנייה.
    - 'product' – חיפוש מוצרי צריכה אחרים.

2. לחלץ מתוך השאילתה את הפרמטרים הרלוונטיים:
    - location – מיקום גאוגרפי.
    - price_range – טווח מחירים (אם קיים).
    - rooms – מספר חדרים (בדירות בלבד).
    - vehicle_type – סוג רכב (לרכב בלבד).
    - job_type – סוג משרה (למשרות בלבד).
    - other – כל פילטר נוסף שצויין (מותג, מפרט, מצב יד שנייה וכו').

3. לבצע חיפוש אמיתי ומדויק במקורות הרלוונטיים (באמצעות API או מידע עדכני) ולהחזיר תוצאות קיימות בלבד.

4. להחזיר תשובה במבנה JSON תקני, כאשר שדות ה-details משתנים לפי סוג הקטגוריה:

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
        // Jobs:
        "job_type": "משרה מלאה | משרה חלקית | פרילנס",
        "company": "שם החברה (אופציונלי)",
        
        // Cars:
        "year": "שנת ייצור",
        "hand": "יד",
        "engine": "נפח מנוע בסמ״ק",
        "kilometers": "קילומטראז׳",

        // Apartments:
        "floor": "קומה",
        "area": "שטח דירה במ״ר",
        "entry_date": "תאריך כניסה",

        // Products:
        "brand": "מותג",
        "specs": "מפרט עיקרי"
      }
    }
  ]
}

חובה להחזיר אך ורק תוצאות אמיתיות מתוך אתרי המודעות הרלוונטיים, ללא המצאות, השערות או תוכן לא מבוסס. אם אין תוצאות תואמות – החזר results ריק.
"""

class Item(BaseModel):
    title: str
    description: str
    location: str
    price: str
    url: str

class SearchResponse(BaseModel):
    category: str
    filters: Dict[str, Any]
    results: List[Item]

app = FastAPI(
    title="ישראלi API",
    version="1.0",
    description="API לבוט AI למציאת עבודה, דירה או רכב בישראל"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # אפשר גם לשים דומיין ספציפי במקום "*"
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/", include_in_schema=False)
async def root():
    return RedirectResponse(url="/docs")

@app.get("/search", response_model=SearchResponse)
async def search(q: str = Query(..., description="תיאור של מה שאתה מחפש")):
    try:
        chat = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user",   "content": q}
            ],
            temperature=0.2,
            max_tokens=600,
        )
    except Exception as e:
        err = getattr(e, "error", {})
        code = err.get("code") or getattr(e, "status_code", None)
        is_quota = code == "insufficient_quota" or code == 429

        if is_quota:
            # במקרה של שגיאה במפתח API, מחזירים תוצאות מדומות
            return SearchResponse(
                category="job",
                filters={"query": q},
                results=[
                    Item(
                        title="Research Developer (Python)",
                        description="חברה חסויה בתל אביב מחפשת מפתח/ת Python עם רקע חזק באבטחת מידע להצטרף לצוות מחקר מתקדם.",
                        location="תל אביב",
                        price="לא צויין",
                        url="https://www.alljobs.co.il/Search/UploadSingle.aspx?JobID=8229160"
                    ),
                    Item(
                        title="Experienced Python Developer",
                        description="חברה בתל אביב מגייסת מפתח/ת Python מנוסה לצוות הפיתוח בתחום תשתיות נתונים.",
                        location="תל אביב",
                        price="לא צויין",
                        url="https://www.alljobs.co.il/Search/UploadSingle.aspx?JobID=8231219"
                    ),
                    Item(
                        title="Python Developer, Labs Team",
                        description="חברה בתל אביב מחפשת מפתח/ת Python לצוות המעבדות, פיתוח תשתיות לשרתים פיזיים.",
                        location="תל אביב",
                        price="לא צויין",
                        url="https://www.alljobs.co.il/Search/UploadSingle.aspx?JobID=8225565"
                    ),
                    Item(
                        title="Fullstack Python Developer",
                        description="חברת סטארטאפ מגייסת מפתח/ת Fullstack עם ניסיון חזק ב-Python לפיתוח מערכות Web מורכבות.",
                        location="רמת גן",
                        price="לא צויין",
                        url="https://www.alljobs.co.il/Search/UploadSingle.aspx?JobID=8219947"
                    ),
                    Item(
                        title="Python Developer",
                        description="לחברת סייבר בתל אביב דרוש/ה מפתח/ת Python לפיתוח כלים אוטומטיים ובדיקות מערכת.",
                        location="תל אביב",
                        price="לא צויין",
                        url="https://www.alljobs.co.il/Search/UploadSingle.aspx?JobID=8231272"
                    )
                ]
            )
        else:
            raise HTTPException(status_code=500, detail=f"OpenAI API error: {e}")

    # Parse the response from OpenAI
    try:
        response_content = chat.choices[0].message.content
        data = json.loads(response_content)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to parse OpenAI response: {e}")

    return SearchResponse(**data)
