from datetime import date, timedelta


def date_floor(dt: date, interval: str) -> date:
    interval = interval.lower().strip().replace("_", "-")

    if interval == "daily":
        return dt

    elif interval == "weekly":
        return dt - timedelta(days=dt.weekday())

    elif interval == "monthly":
        return dt.replace(day=1)

    elif interval == "quarterly":
        month = ((dt.month - 1) // 3) * 3 + 1
        return dt.replace(month=month, day=1)

    elif interval == "biannually":
        month = 1 if dt.month <= 6 else 7
        return dt.replace(month=month, day=1)

    elif interval == "annually":
        return dt.replace(month=1, day=1)

    raise ValueError(f"Unsupported interval: {interval}")


def add_interval(dt: date, interval: str) -> date:
    """Advance a date that is already aligned to an interval."""
    interval = interval.lower().strip().replace("_", "-")

    if interval == "daily":
        return dt + timedelta(days=1)

    elif interval == "weekly":
        return dt + timedelta(days=7)

    elif interval == "monthly":
        if dt.month == 12:
            return dt.replace(year=dt.year + 1, month=1)
        return dt.replace(month=dt.month + 1)

    elif interval == "quarterly":
        month = dt.month + 3
        year = dt.year
        if month > 12:
            month -= 12
            year += 1
        return dt.replace(year=year, month=month)

    elif interval == "biannually":
        month = dt.month + 6
        year = dt.year
        if month > 12:
            month -= 12
            year += 1
        return dt.replace(year=year, month=month)

    elif interval == "annually":
        return dt.replace(year=dt.year + 1)

    raise ValueError(f"Unsupported interval: {interval}")


def date_ceil(dt: date, interval: str) -> date:
    """
    Returns the start of the interval containing dt, or the next interval
    if dt is not already on a boundary.
    """
    floor = date_floor(dt, interval)

    if dt == floor:
        return floor

    return add_interval(floor, interval)
