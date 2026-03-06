import pandas as pd
import googlemaps
import time
from datetime import datetime, timedelta
import pytz
import os
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env.local'))
API_KEY = os.getenv("GOOGLE_MAPS_API_KEY")
MATRIX_FILE = 'matrix.csv'
MAPPINGS_FILE = 'mappings.csv'
OUTPUT_FILE = 'driving_times.csv'

# Using Pacific timezone since all venues are in the LA area
PACIFIC = pytz.timezone('America/Los_Angeles')
FIXED_DEPARTURE_TIME = datetime.now(PACIFIC).replace(hour=9, minute=0, second=0, microsecond=0)
if FIXED_DEPARTURE_TIME.weekday() != 0:
    days_until_monday = (7 - FIXED_DEPARTURE_TIME.weekday()) % 7
    if days_until_monday == 0:
        days_until_monday = 7
    FIXED_DEPARTURE_TIME = FIXED_DEPARTURE_TIME + timedelta(days=days_until_monday)

def normalize(name):
    if not isinstance(name, str): return ""
    name = name.lower().strip()
    if name.endswith(' zone'):
        name = name[:-5]
    elif name.endswith('zone'):
        name = name[:-4]
    if 'port of los angeles' in name:
        return 'port of la'
    return name.strip()

def fill_driving_times():
    if API_KEY == 'YOUR_GOOGLE_MAPS_API_KEY':
        print("Error: Please provide a valid Google Maps API Key.")
        return

    gmaps = googlemaps.Client(key=API_KEY)

    df = pd.read_csv(MATRIX_FILE, index_col=0)
    map_df = pd.read_csv(MAPPINGS_FILE)
    zones = list(df.index)

    # Load existing output to reuse cached values and avoid redundant API calls
    existing_df = None
    if os.path.exists(OUTPUT_FILE):
        existing_df = pd.read_csv(OUTPUT_FILE, index_col=0)

    driving_df = pd.DataFrame(index=zones, columns=zones)
    driving_df.index.name = df.index.name

    location_lookup = {normalize(row['Zone']): row['Location'] for _, row in map_df.iterrows()}

    pacific_time_str = FIXED_DEPARTURE_TIME.astimezone(PACIFIC).strftime('%A, %B %d, %Y at %I:%M %p %Z')
    print(f"Starting driving time calculations for {len(zones)} zones...")
    print(f"Departure time: {pacific_time_str} (Pacific Time)")
    print(f"Output: {OUTPUT_FILE}\n")

    api_calls = 0
    cached = 0

    for row_zone in zones:
        for col_zone in zones:
            if row_zone == col_zone:
                driving_df.at[row_zone, col_zone] = 0.00
                continue

            # Reuse existing value if available
            if existing_df is not None and row_zone in existing_df.index and col_zone in existing_df.columns:
                val = existing_df.at[row_zone, col_zone]
                if pd.notna(val):
                    driving_df.at[row_zone, col_zone] = val
                    cached += 1
                    continue

            normalized_row = normalize(row_zone)
            normalized_col = normalize(col_zone)
            origin_loc = location_lookup.get(normalized_row)
            dest_loc = location_lookup.get(normalized_col)

            if origin_loc and dest_loc:
                try:
                    result = gmaps.distance_matrix(
                        origins=[origin_loc],
                        destinations=[dest_loc],
                        mode='driving',
                        departure_time=FIXED_DEPARTURE_TIME
                    )

                    if result['status'] == 'OK':
                        element = result['rows'][0]['elements'][0]
                        if element['status'] == 'OK':
                            seconds = element['duration']['value']
                            minutes = seconds / 60.0
                            driving_df.at[row_zone, col_zone] = round(minutes, 2)
                            print(f"  {row_zone} -> {col_zone}: {round(minutes, 2)} min")
                        else:
                            print(f"  No route: {origin_loc} -> {dest_loc} ({element.get('status')})")
                            driving_df.at[row_zone, col_zone] = None
                    else:
                        print(f"  API Error: {result['status']}")

                    api_calls += 1
                    time.sleep(0.5)

                except Exception as e:
                    print(f"  Error {row_zone} -> {col_zone}: {e}")
                    driving_df.at[row_zone, col_zone] = None
            else:
                missing = []
                if not origin_loc:
                    missing.append(f"{row_zone} ('{normalized_row}')")
                if not dest_loc:
                    missing.append(f"{col_zone} ('{normalized_col}')")
                print(f"  Missing mapping: {', '.join(missing)}")
                driving_df.at[row_zone, col_zone] = None

    driving_df.to_csv(OUTPUT_FILE)
    print(f"\nDone! {api_calls} API calls, {cached} cached. Saved to {OUTPUT_FILE}")

if __name__ == "__main__":
    fill_driving_times()
