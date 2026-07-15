import uuid
from datetime import datetime, date, timedelta

from icalendar import Calendar, Event
from dateutil.parser import parse as parse_date


def create_ics(deadlines: list[dict]) -> bytes:
    cal = Calendar()
    cal.add("prodid", "-//Deadline Extractor//EN")
    cal.add("version", "2.0")
    cal.add("calscale", "GREGORIAN")
    cal.add("method", "PUBLISH")

    for item in deadlines:
        event = Event()
        event.add("uid", str(uuid.uuid4()))
        event.add("summary", item.get("title", "Deadline"))

        dt = _parse_datetime(item.get("date", ""), item.get("time", "23:59"))
        if dt:
            event.add("dtstart", dt)
            event.add("dtend", dt + timedelta(hours=1))
        else:
            continue

        if desc := item.get("description", ""):
            event.add("description", desc)

        cal.add_component(event)

    return cal.to_ical()


def _parse_datetime(date_str: str, time_str: str) -> datetime | None:
    combined = f"{date_str} {time_str}".strip()
    if not combined:
        return None
    try:
        return parse_date(combined)
    except (ValueError, OverflowError):
        try:
            return parse_date(date_str)
        except (ValueError, OverflowError):
            return None
