import re
from typing import Tuple, Dict, Any, List

def classify_query(query: str) -> Tuple[str, Dict[str, Any]]:
    """
    מזהה קטגוריה (job/apartment/car או unknown)
    וחילוץ פילטרים בסיסי באמצעות regex.
    """
    q = query.lower()

    # עבודה
    if any(w in q for w in ["משרה", "עבודה", "שכר", "fullstack", "backend", "frontend"]):
        category = "job"
        # דוגמה לחילוץ תקציב אם מצוין
        budget = re.search(r"עד\s*([\d,]+)\s*ש\"?ח", q)
        location = re.search(r"ב(צפון|דרום|מרכז|ירושלים|תל אביב|רמת גן|חיפה)", q)
        return category, {
            "budget": budget.group(1) if budget else None,
            "location": location.group(1) if location else None,
            "raw": query
        }

    # דירה
    if any(w in q for w in ["דירה", "חדר", "שכירות", "דירת"]):
        category = "apartment"
        rooms = re.search(r"(\d+)\s*חדר", q)
        price = re.search(r"עד\s*([\d,]+)\s*ש\"?ח", q)
        location = re.search(r"ב(?:עיר|ב)([\w\s]+)", q)
        return category, {
            "rooms": int(rooms.group(1)) if rooms else None,
            "max_price": price.group(1) if price else None,
            "location": location.group(1).strip() if location else None,
            "raw": query
        }

    # רכב
    if any(w in q for w in ["רכב", "קילומטר", "ברדרים", "טויוטה", "אאודי"]):
        category = "car"
        max_price = re.search(r"עד\s*([\d,]+)\s*ש\"?ח", q)
        brand = re.search(r"(טויוטה|אאודי|מאזדה|פורד|במוו)", q)
        return category, {
            "max_price": max_price.group(1) if max_price else None,
            "brand": brand.group(1) if brand else None,
            "raw": query
        }

    return "unknown", {"raw": query}


def fetch_results(category: str, filters: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    מדמה תוצאות עבור כל קטגוריה.
    בפועל כאן תשלב סקרייפרים או API אמיתי.
    """
    fake_db = {
        "job": [
            {
                "title": "מפתח Python בחברת סטארטאפ בצפון",
                "description": "היקף משרה חלקית, עבודה מרחוק חלקית",
                "location": filters.get("location") or "הצפון",
                "salary": f"עד {filters.get('budget') or '8,000'} ש\"ח",
                "url": "https://jobs.example.com/123"
            },
            {
                "title": "מהנדס תוכנה Fullstack בתל אביב",
                "description": "משרה מלאה, תנאים סוציאליים מלאים",
                "location": "תל אביב",
                "salary": "10,000–12,000 ש\"ח",
                "url": "https://jobs.example.com/456"
            },
        ],
        "apartment": [
            {
                "title": f"דירת {filters.get('rooms') or 3} חדרים ב{filters.get('location') or 'רמת גן'}",
                "description": "קומה שנייה ללא מעלית, חניה פרטית",
                "location": filters.get("location") or "רמת גן",
                "price": f"עד {filters.get('max_price') or '6,000'} ש\"ח",
                "url": "https://apartments.example.com/789"
            },
            {
                "title": "דירת 2 חדרים בהרצליה",
                "description": "קומה 3, מרפסת, חדר שירותים נוסף",
                "location": "הרצליה",
                "price": "5,500 ש\"ח",
                "url": "https://apartments.example.com/101"
            },
        ],
        "car": [
            {
                "title": f"{filters.get('brand') or 'טויוטה'} קורולה במצב חדש",
                "description": "קילומטראז' נמוך, טיפולים תקופתיים",
                "location": "כל הארץ",
                "price": f"עד {filters.get('max_price') or '40,000'} ש\"ח",
                "url": "https://cars.example.com/112"
            },
            {
                "title": "מאזדה 3 שנת 2018",
                "description": "קילומטראז' 80,000 ק\"מ, ABS, בקרת שיוט",
                "location": "באר שבע",
                "price": "38,000 ש\"ח",
                "url": "https://cars.example.com/131"
            },
        ]
    }

    return fake_db.get(category, [])
