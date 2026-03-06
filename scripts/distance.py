import os
import pandas as pd
import googlemaps
import time
from dotenv import load_dotenv

# --- CONFIGURATION ---
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env.local'))
API_KEY = os.getenv("GOOGLE_MAPS_API_KEY")
# 2. File names as provided
MATRIX_FILE = 'matrix.csv'
MAPPINGS_FILE = 'mappings.csv'

def normalize(name):
    """Standardizes zone names for reliable matching."""
    if not isinstance(name, str): return ""
    name = name.lower().strip()
    # Remove "zone" suffix if present
    if name.endswith(' zone'):
        name = name[:-5]
    elif name.endswith('zone'):
        name = name[:-4]
    # Handle special cases
    if 'port of los angeles' in name:
        return 'port of la'
    return name.strip()

def fill_matrix_with_api():
    if API_KEY == 'YOUR_GOOGLE_MAPS_API_KEY':
        print("Error: Please provide a valid Google Maps API Key.")
        return

    # Initialize Google Maps client
    gmaps = googlemaps.Client(key=API_KEY)

    # 1. Load Data
    # index_col=0 ensures the 'Unnamed: 0' column (Zone names) becomes our row index
    df = pd.read_csv(MATRIX_FILE, index_col=0)
    map_df = pd.read_csv(MAPPINGS_FILE)

    # 2. Create a lookup dictionary: {normalized_zone: location_address}
    # This handles matches like "Valley Zone" in the matrix to "Valley" in mappings
    location_lookup = {normalize(row['Zone']): row['Location'] for _, row in map_df.iterrows()}

    # 3. Iterate through the Matrix
    print("Starting distance calculations...")
    print(f"Loaded {len(location_lookup)} zone mappings")
    
    # Show mappings for debugging
    print("\nZone mappings:")
    for zone, loc in location_lookup.items():
        print(f"  {zone} -> {loc}")
    print()
    
    for row_zone in df.index:
        for col_zone in df.columns:
            # Skip if it's the diagonal (distance to itself is 0)
            if row_zone == col_zone:
                df.at[row_zone, col_zone] = 0.00
                continue
            
            # Look up physical locations
            normalized_row = normalize(row_zone)
            normalized_col = normalize(col_zone)
            origin_loc = location_lookup.get(normalized_row)
            dest_loc = location_lookup.get(normalized_col)

            if origin_loc and dest_loc:
                try:
                    # 4. Fetch distance from Google Maps
                    # We use units='imperial' but convert the raw 'value' (meters) 
                    # manually to ensure high precision before rounding.
                    result = gmaps.distance_matrix(
                        origins=[origin_loc],
                        destinations=[dest_loc],
                        mode='driving'
                    )

                    if result['status'] == 'OK':
                        element = result['rows'][0]['elements'][0]
                        if element['status'] == 'OK':
                            # 'value' is in meters
                            meters = element['distance']['value']
                            miles = meters * 0.000621371
                            
                            # Store rounded distance
                            df.at[row_zone, col_zone] = round(miles, 2)
                            # Warn if distance seems unreasonable (likely wrong address)
                            if miles > 500:
                                print(f"WARNING: {row_zone} to {col_zone} -> {round(miles, 2)} miles (seems high, check addresses)")
                            else:
                                print(f"Filled: {row_zone} to {col_zone} -> {round(miles, 2)} miles")
                        else:
                            print(f"Could not find route: {origin_loc} to {dest_loc} (status: {element.get('status', 'UNKNOWN')})")
                    else:
                        print(f"API Error: {result['status']}")

                    # Respect API limits with a small delay
                    time.sleep(0.05)

                except Exception as e:
                    print(f"Error at {row_zone} to {col_zone}: {e}")
            else:
                missing = []
                if not origin_loc:
                    missing.append(f"{row_zone} (normalized: '{normalized_row}')")
                if not dest_loc:
                    missing.append(f"{col_zone} (normalized: '{normalized_col}')")
                print(f"Missing mapping for: {', '.join(missing)}")

    # 5. Overwrite the original file
    df.to_csv(MATRIX_FILE)
    print(f"\nSuccess! {MATRIX_FILE} has been updated with API distances.")

if __name__ == "__main__":
    fill_matrix_with_api()