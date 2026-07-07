import math

from app.core.geo import bounding_box


def test_box_contains_center() -> None:
    min_lat, min_lng, max_lat, max_lng = bounding_box(45.52, -122.68, 10)
    assert min_lat < 45.52 < max_lat
    assert min_lng < -122.68 < max_lng


def test_larger_radius_makes_a_larger_box() -> None:
    small = bounding_box(45.52, -122.68, 1)
    large = bounding_box(45.52, -122.68, 50)
    assert (large[2] - large[0]) > (small[2] - small[0])
    assert (large[3] - large[1]) > (small[3] - small[1])


def test_latitude_span_matches_radius() -> None:
    # ~111 km per degree of latitude, so a 111 km radius is ~1 degree each way.
    min_lat, _, max_lat, _ = bounding_box(0.0, 0.0, 111.0)
    assert math.isclose((max_lat - min_lat) / 2, 1.0, abs_tol=0.05)


def test_longitude_span_widens_near_the_poles() -> None:
    # A degree of longitude covers less ground at high latitude, so the same
    # radius spans more longitude degrees there than at the equator.
    equator = bounding_box(0.0, 0.0, 50)
    high = bounding_box(60.0, 0.0, 50)
    assert (high[3] - high[1]) > (equator[3] - equator[1])


def test_coordinates_stay_within_valid_ranges() -> None:
    min_lat, min_lng, max_lat, max_lng = bounding_box(89.9, 179.9, 500)
    assert -90.0 <= min_lat <= max_lat <= 90.0
    assert -180.0 <= min_lng <= max_lng <= 180.0
