import math

# Mean km per degree of latitude, and per degree of longitude at the equator.
# See https://en.wikipedia.org/wiki/Geographic_coordinate_system.
_KM_PER_DEG_LAT = 110.574
_KM_PER_DEG_LNG_EQUATOR = 111.320


def bounding_box(
    center_lat: float, center_lng: float, radius_km: float
) -> tuple[float, float, float, float]:
    """A lat/lng box that fully contains the given radius around a center point.

    Returns ``(min_lat, min_lng, max_lat, max_lng)``. This is a bounding-box
    approximation of a circle: it over-selects at the corners (a square around
    the circle) but needs no trigonometry at query time, so the same filter
    runs identically on SQLite and Postgres. For an exact great-circle radius,
    reach for PostGIS (``ST_DWithin``); this box is the pragmatic prefilter.
    """
    lat_delta = radius_km / _KM_PER_DEG_LAT

    # Longitude degrees shrink toward the poles by cos(latitude). Guard against
    # the poles, where cos -> 0 would blow the longitude span up to infinity.
    cos_lat = math.cos(math.radians(center_lat))
    if cos_lat < 1e-12:
        lng_delta = 180.0
    else:
        lng_delta = radius_km / (_KM_PER_DEG_LNG_EQUATOR * cos_lat)

    return (
        max(center_lat - lat_delta, -90.0),
        max(center_lng - lng_delta, -180.0),
        min(center_lat + lat_delta, 90.0),
        min(center_lng + lng_delta, 180.0),
    )
