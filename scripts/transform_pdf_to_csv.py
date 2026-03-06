#!/usr/bin/env python3
"""
Transform LA 2028 Olympics PDF schedule into CSV format for database import.
Requires: pip install pdfplumber pandas
"""

import pdfplumber
import pandas as pd
import re
from datetime import datetime

EXCLUDED_ZONES = {
    'OKC Zone',
    'New York Zone',
    'Columbus Zone',
    'Nashville Zone',
    'St. Louis Zone',
    'San Jose Zone',
    'San José Zone',
    'San Diego Zone',
    'Unknown Zone',
}

VENUE_TO_ZONE = {
    'DTLA Arena': 'DTLA Zone',
    'LA Convention Center Hall 1': 'DTLA Zone',
    'LA Convention Center Hall 2': 'DTLA Zone',
    'LA Convention Center Hall 3': 'DTLA Zone',
    'Dodger Stadium': 'DTLA Zone',
    'Peacock Theater': 'DTLA Zone',
    'LA Memorial Coliseum': 'Exposition Park Zone',
    'Exposition Park Stadium': 'Exposition Park Zone',
    'Galen Center': 'Exposition Park Zone',
    'Port of Los Angeles': 'Port of Los Angeles Zone',
    'Riviera Country Club': 'Riviera Zone',
    'Comcast Squash Center at Universal Studios': 'Universal City Zone',
    'Valley Complex 1': 'Valley Zone',
    'Valley Complex 2': 'Valley Zone',
    'Valley Complex 3': 'Valley Zone',
    'Valley Complex 4': 'Valley Zone',
    'Venice Beach': 'Venice Zone',
    'Venice Beach Boardwalk': 'Venice Zone',
    'Venice Beach Boardwalk - Start': 'Venice Zone',
    'Carson Field': 'Carson Zone',
    'Carson Stadium': 'Carson Zone',
    'Carson Courts': 'Carson Zone',
    'Carson Courts 3-11': 'Carson Zone',
    'Carson Velodrome': 'Carson Zone',
    'Carson Center Court': 'Carson Zone',
    'Carson Court 1': 'Carson Zone',
    'Carson Court 2': 'Carson Zone',
    'Intuit Dome': 'Inglewood Zone',
    'Inglewood Dome': 'Inglewood Zone',
    '2028 Stadium': 'Inglewood Zone',
    'Marine Stadium': 'Long Beach Zone',
    'Belmont Shore': 'Long Beach Zone',
    'Long Beach Target Shooting Hall': 'Long Beach Zone',
    'Long Beach Aquatics Center': 'Long Beach Zone',
    'Long Beach Climbing Theater': 'Long Beach Zone',
    'Long Beach Arena': 'Long Beach Zone',
    'Alamitos Beach Stadium': 'Long Beach Zone',
    'Rose Bowl Aquatics Center': 'Pasadena Zone',
    'Rose Bowl Stadium': 'Pasadena Zone',
    'Honda Center': 'Anaheim Zone',
    'Santa Anita Park': 'Arcadia Zone',
    'Industry Hills Mtb Course': 'City of Industry Zone',
    'Industry Hills MTB Course': 'City of Industry Zone',
    'Fairgrounds Cricket Stadium': 'Pomona Zone',
    'Trestles State Beach': 'Trestles Beach Zone',
    'Whittier Narrows Clay Shooting Center': 'Whittier Narrows Zone',
    'TBD': 'Unknown Zone',
    'OKC Softball Park': 'OKC Zone',
    'OKC Whitewater Center': 'OKC Zone',
    'New York Stadium': 'New York Zone',
    'Columbus Stadium': 'Columbus Zone',
    'Nashville Stadium': 'Nashville Zone',
    'St. Louis Stadium': 'St. Louis Zone',
    'San José Stadium': 'San José Zone',
    'San Jose Stadium': 'San José Zone',
    'San Diego Stadium': 'San Diego Zone',
}

def get_zone_from_venue(venue_name):
    if pd.isna(venue_name) or not venue_name:
        return None

    venue_clean = clean_text(str(venue_name))

    if venue_clean in VENUE_TO_ZONE:
        return VENUE_TO_ZONE[venue_clean]

    venue_lower = venue_clean.lower()
    for venue, zone in VENUE_TO_ZONE.items():
        if venue.lower() == venue_lower:
            return zone

    # Partial matching: check if all significant keywords from a mapping are in the venue name
    for venue, zone in VENUE_TO_ZONE.items():
        venue_keywords = venue.lower().split()
        if len(venue_keywords) > 1:
            key_parts = [kw for kw in venue_keywords if len(kw) > 3]
            if key_parts and all(part in venue_lower for part in key_parts):
                return zone
        elif venue_keywords[0] in venue_lower:
            return zone

    # Substring matching in either direction
    for venue, zone in VENUE_TO_ZONE.items():
        if venue.lower() in venue_lower or venue_lower in venue.lower():
            return zone

    return None

def clean_text(text):
    if pd.isna(text) or text is None or text == "":
        return ""
    return " ".join(str(text).split())

def clean_session_description(text):
    if pd.isna(text) or text is None or text == "":
        return ""

    text = str(text)

    # Newlines in PDF indicate separate events within a session
    if '\n' in text:
        lines = [line.strip() for line in text.split('\n') if line.strip()]
        return '; '.join(lines)
    else:
        return clean_text(text)

def parse_time(time_str):
    if pd.isna(time_str) or not time_str:
        return None

    time_str = clean_text(time_str).upper().strip()

    if time_str in ['START TIME', 'END TIME', 'TBD', 'TBA']:
        return None

    # Handle strings like "9:00 OKC LOCAL TIME (CT)"
    time_match = re.search(r'(\d{1,2}):(\d{2})', time_str)
    if not time_match:
        try:
            hour = int(time_str.split()[0])
            if 0 <= hour <= 23:
                return f"{hour:02d}:00:00"
        except:
            pass
        return None

    try:
        hour = int(time_match.group(1))
        minute = int(time_match.group(2))

        if 'PM' in time_str and hour != 12:
            hour += 12
        elif 'AM' in time_str and hour == 12:
            hour = 0

        if 0 <= hour <= 23 and 0 <= minute <= 59:
            return f"{hour:02d}:{minute:02d}:00"
        else:
            return None
    except:
        return None

def parse_date(date_str):
    """All dates in the PDF follow format: [day_of_week], [month] [day]. Year is always 2028."""
    if pd.isna(date_str) or not date_str:
        return None

    date_str = clean_text(date_str)

    if date_str.upper() in ['DATE', 'GAMES DAY']:
        return None

    primary_formats = [
        '%A, %B %d',
        '%a, %b %d',
    ]

    for fmt in primary_formats:
        try:
            dt = datetime.strptime(date_str, fmt)
            dt = dt.replace(year=2028)
            return dt.strftime('%Y-%m-%d')
        except:
            continue

    fallback_formats = [
        '%A, %B %d, %Y',
        '%a, %b %d, %Y',
        '%B %d, %Y',
        '%b %d, %Y',
        '%B %d',
        '%b %d',
        '%Y-%m-%d',
        '%m/%d/%Y',
        '%d/%m/%Y',
        '%d %B %Y',
        '%d %b %Y',
    ]

    for fmt in fallback_formats:
        try:
            dt = datetime.strptime(date_str, fmt)
            if dt.year == 1900:
                dt = dt.replace(year=2028)
            return dt.strftime('%Y-%m-%d')
        except:
            continue

    # Last resort: extract month name + day number manually
    month_names = ['january', 'february', 'march', 'april', 'may', 'june',
                   'july', 'august', 'september', 'october', 'november', 'december']
    month_abbrev = ['jan', 'feb', 'mar', 'apr', 'may', 'jun',
                    'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

    date_lower = date_str.lower()
    for i, month in enumerate(month_names + month_abbrev, 1):
        if month in date_lower:
            day_match = re.search(r'\b(\d{1,2})\b', date_str)
            if day_match:
                try:
                    day = int(day_match.group(1))
                    month_num = (i - 1) % 12 + 1
                    dt = datetime(2028, month_num, day)
                    return dt.strftime('%Y-%m-%d')
                except:
                    pass

    return None

def extract_tables_from_pdf(pdf_path):
    all_rows = []
    header_row = None

    header_keywords = ['sport', 'venue', 'session', 'date', 'time', 'code', 'type', 'description']
    skip_keywords = ['competition schedule', 'subject to change', 'los angeles 2028',
                    'times listed are', '24-hour', 'pacific time']

    with pdfplumber.open(pdf_path) as pdf:
        print(f"Processing {len(pdf.pages)} pages...")

        for page_num, page in enumerate(pdf.pages, 1):
            print(f"  Page {page_num}...", end=' ', flush=True)

            tables = page.extract_tables()

            if not tables:
                print(f"no tables found")
                continue

            for table in tables:
                if not table or len(table) == 0:
                    continue

                for row in table:
                    if not row or not any(row):
                        continue

                    row_text = ' '.join([str(c) if c else '' for c in row]).lower()

                    if any(skip in row_text for skip in skip_keywords):
                        continue

                    if any(keyword in row_text for keyword in header_keywords):
                        keyword_count = sum(1 for keyword in header_keywords if keyword in row_text)
                        if keyword_count >= 3:
                            if header_row is None:
                                header_row = row
                                print(f"found header row", end=' ')
                            continue

                    non_empty = sum(1 for cell in row if cell and str(cell).strip())
                    if non_empty >= 5:
                        first_cell = str(row[0]) if row[0] else ''
                        if first_cell.lower() not in ['sport', 'venue', 'session', 'date']:
                            all_rows.append(row)

            print(f"extracted {len(tables)} tables")

    return header_row, all_rows

def process_schedule_data(header_row, data_rows):
    expected_columns = ['sport', 'venue', 'zone', 'session_code', 'date',
                       'games_day', 'session_type', 'session_description',
                       'start_time', 'end_time']

    df = pd.DataFrame(data_rows)

    if header_row:
        header_cleaned = [clean_text(str(h)).lower().replace(' ', '_') if h else f'col_{i}'
                         for i, h in enumerate(header_row)]

        while len(header_cleaned) < len(df.columns):
            header_cleaned.append(f'col_{len(header_cleaned)}')

        df.columns = header_cleaned[:len(df.columns)]
    else:
        if len(df.columns) >= len(expected_columns):
            df.columns = expected_columns[:len(df.columns)]
        else:
            df.columns = [f'col_{i}' for i in range(len(df.columns))]

    print(f"\nDetected columns: {df.columns.tolist()}")

    column_mapping = {}
    for col in df.columns:
        col_lower = str(col).lower()
        if 'sport' in col_lower:
            column_mapping[col] = 'sport'
        elif 'venue' in col_lower:
            column_mapping[col] = 'venue'
        elif 'zone' in col_lower:
            column_mapping[col] = 'zone'
        elif 'session_code' in col_lower or ('code' in col_lower and 'session' in col_lower):
            column_mapping[col] = 'session_code'
        elif 'date' in col_lower and 'games' not in col_lower:
            column_mapping[col] = 'date'
        elif 'session_type' in col_lower or ('type' in col_lower and 'session' in col_lower):
            column_mapping[col] = 'session_type'
        elif 'description' in col_lower:
            column_mapping[col] = 'session_description'
        elif 'start' in col_lower and 'time' in col_lower:
            column_mapping[col] = 'start_time'
        elif 'end' in col_lower and 'time' in col_lower:
            column_mapping[col] = 'end_time'

    df = df.rename(columns=column_mapping)

    # Fallback: positional column assignment if header matching failed
    if 'sport' not in df.columns and len(df.columns) >= 10:
        df = df.rename(columns={
            df.columns[0]: 'sport',
            df.columns[1]: 'venue',
            df.columns[3]: 'session_code',
            df.columns[4]: 'date',
            df.columns[6]: 'session_type',
            df.columns[7]: 'session_description',
            df.columns[8]: 'start_time',
            df.columns[9]: 'end_time'
        })
    elif 'sport' not in df.columns and len(df.columns) >= 8:
        df = df.rename(columns={
            df.columns[0]: 'sport',
            df.columns[1]: 'venue',
            df.columns[2]: 'session_code',
            df.columns[3]: 'date',
            df.columns[4]: 'session_type',
            df.columns[5]: 'session_description',
            df.columns[6]: 'start_time',
            df.columns[7]: 'end_time'
        })

    for col in ['sport', 'venue', 'session_code', 'session_type']:
        if col in df.columns:
            df[col] = df[col].apply(clean_text)

    # Override PDF's zone column with our own mapping for consistency
    if 'venue' in df.columns:
        df['zone'] = df['venue'].apply(get_zone_from_venue)
        unmapped = df[df['zone'].isna() & df['venue'].notna()]
        if len(unmapped) > 0:
            unique_unmapped = unmapped['venue'].unique()
            print(f"\nWarning: {len(unmapped)} rows with unmapped venues:")
            for venue in unique_unmapped[:10]:
                print(f"  - {venue}")
            if len(unique_unmapped) > 10:
                print(f"  ... and {len(unique_unmapped) - 10} more")

    if 'session_description' in df.columns:
        df['session_description'] = df['session_description'].apply(clean_session_description)

    if 'date' in df.columns:
        df['session_date'] = df['date'].apply(parse_date)
        df = df.drop(columns=['date'])
    elif 'session_date' not in df.columns:
        for col in df.columns:
            if 'date' in str(col).lower() or col.startswith('col_'):
                sample_values = df[col].dropna().head(5)
                parsed_count = sum(1 for v in sample_values if parse_date(v))
                if parsed_count > 0:
                    df['session_date'] = df[col].apply(parse_date)
                    break

    if 'start_time' in df.columns:
        df['start_time'] = df['start_time'].apply(parse_time)
    if 'end_time' in df.columns:
        df['end_time'] = df['end_time'].apply(parse_time)

    required_cols = ['sport', 'venue', 'session_date', 'start_time', 'end_time']
    missing_cols = [col for col in required_cols if col not in df.columns]
    if missing_cols:
        print(f"\nWarning: Missing required columns: {missing_cols}")
        print(f"Available columns: {df.columns.tolist()}")
        if len(df) > 0:
            print(f"\nSample row data:")
            print(df.head(3))
        return None

    if 'session_description' in df.columns:
        not_ticketed = df['session_description'].str.contains('Not Ticketed', case=False, na=False)
        if not_ticketed.any():
            print(f"\nFiltered out {not_ticketed.sum()} non-ticketed sessions")
            df = df[~not_ticketed]

    initial_count = len(df)
    df = df.dropna(subset=required_cols)

    if 'session_date' in df.columns:
        df = df[df['session_date'].notna()]

    filtered_count = len(df)
    if initial_count != filtered_count:
        print(f"\nFiltered out {initial_count - filtered_count} rows with missing/invalid data")

    column_order = ['sport', 'venue', 'zone', 'session_code', 'session_date',
                   'session_type', 'session_description', 'start_time', 'end_time']
    df = df[[col for col in column_order if col in df.columns]]

    return df

def main():
    import sys

    if len(sys.argv) < 2:
        print("Usage: python transform_pdf_to_csv.py <path_to_pdf> [output_csv]")
        print("Example: python transform_pdf_to_csv.py LA28OlympicGamesCompetitionScheduleByEventV2Final.pdf")
        sys.exit(1)

    pdf_path = sys.argv[1]
    output_path = sys.argv[2] if len(sys.argv) > 2 else "la2028_sessions.csv"

    print(f"Reading PDF: {pdf_path}\n")

    header_row, data_rows = extract_tables_from_pdf(pdf_path)
    print(f"\nExtracted {len(data_rows)} data rows")

    if len(data_rows) == 0:
        print("Error: No data rows extracted from PDF")
        sys.exit(1)

    df = process_schedule_data(header_row, data_rows)

    if df is None or len(df) == 0:
        print("Error: Could not process data into valid format")
        sys.exit(1)

    pre_filter_count = len(df)
    excluded = df[df['zone'].isin(EXCLUDED_ZONES)]
    if len(excluded) > 0:
        print(f"\nFiltering out {len(excluded)} sessions from non-LA zones:")
        for zone in sorted(excluded['zone'].unique()):
            zone_count = len(excluded[excluded['zone'] == zone])
            zone_sports = ', '.join(sorted(excluded[excluded['zone'] == zone]['sport'].unique()))
            print(f"  - {zone}: {zone_count} sessions ({zone_sports})")
        df = df[~df['zone'].isin(EXCLUDED_ZONES)]

    print(f"\nProcessed {len(df)} valid sessions (filtered {pre_filter_count - len(df)} non-LA)")
    print(f"\nSample data (first 5 rows):")
    print(df.head(5).to_string())

    print(f"\nData summary:")
    print(f"  Sports: {df['sport'].nunique()}")
    print(f"  Venues: {df['venue'].nunique()}")
    if 'zone' in df.columns:
        print(f"  Zones: {df['zone'].nunique()} ({', '.join(sorted(df['zone'].dropna().unique().tolist()))})")
    if 'session_date' in df.columns:
        print(f"  Date range: {df['session_date'].min()} to {df['session_date'].max()}")
    if 'session_type' in df.columns:
        print(f"  Session types: {sorted(df['session_type'].unique().tolist())}")

    df.to_csv(output_path, index=False)
    print(f"\nExported to: {output_path}")

    print("\nData quality check:")
    print(f"  Missing sport: {df['sport'].isna().sum()}")
    print(f"  Missing venue: {df['venue'].isna().sum()}")
    if 'zone' in df.columns:
        print(f"  Missing zones: {df['zone'].isna().sum()}")
    if 'session_date' in df.columns:
        print(f"  Missing dates: {df['session_date'].isna().sum()}")
    print(f"  Missing start times: {df['start_time'].isna().sum()}")
    print(f"  Missing end times: {df['end_time'].isna().sum()}")

if __name__ == "__main__":
    main()
