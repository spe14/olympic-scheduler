#!/usr/bin/env python3
"""
Transform LA 2028 Olympics PDF schedule into CSV format for database import.
Requires: pip install pdfplumber pandas
"""

import pdfplumber
import pandas as pd
import re
from datetime import datetime

def clean_text(text):
    """Remove extra whitespace and clean text"""
    if pd.isna(text) or text is None or text == "":
        return ""
    return " ".join(str(text).split())

def clean_session_description(text):
    """Clean session description while preserving event separators"""
    if pd.isna(text) or text is None or text == "":
        return ""
    
    text = str(text)
    
    # Split by newlines if present (newlines in PDF indicate separate events)
    if '\n' in text:
        lines = [line.strip() for line in text.split('\n') if line.strip()]
        # Join with a delimiter to separate events (using semicolon for readability)
        return '; '.join(lines)
    else:
        # If no newlines, try to detect multiple events by patterns
        # Look for patterns like "Men's ... Women's ..." or multiple capitalized words
        # For now, just clean the text normally
        # The semicolon delimiter will make it easy to split later if needed
        return clean_text(text)

def parse_time(time_str):
    """Parse time string into HH:MM:SS format (24-hour format expected)"""
    if pd.isna(time_str) or not time_str:
        return None
    
    time_str = clean_text(time_str).upper().strip()
    
    # Handle special cases
    if time_str in ['START TIME', 'END TIME', 'TBD', 'TBA']:
        return None
    
    # Extract time from strings like "9:00 OKC LOCAL TIME (CT)" or "14:00"
    # Use regex to find HH:MM or H:MM pattern
    time_match = re.search(r'(\d{1,2}):(\d{2})', time_str)
    if not time_match:
        # Try to parse just a number as hour
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
        
        # Check for AM/PM in original string
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
    """Parse date string into YYYY-MM-DD format.
    All dates in the PDF follow format: [day_of_the_week], [month] [day]
    Year is always 2028.
    """
    if pd.isna(date_str) or not date_str:
        return None
    
    date_str = clean_text(date_str)
    
    # Skip header rows
    if date_str.upper() in ['DATE', 'GAMES DAY']:
        return None
    
    # Primary format: [day_of_the_week], [month] [day] (e.g., "Sunday, July 16")
    # All dates are from 2028
    primary_formats = [
        '%A, %B %d',      # Sunday, July 16 (most common format)
        '%a, %b %d',      # Sun, Jul 16 (abbreviated)
    ]
    
    # Try primary formats first
    for fmt in primary_formats:
        try:
            dt = datetime.strptime(date_str, fmt)
            # Set year to 2028 (default is 1900 when no year specified)
            dt = dt.replace(year=2028)
            return dt.strftime('%Y-%m-%d')
        except:
            continue
    
    # Fallback formats (in case some dates have year or different format)
    fallback_formats = [
        '%A, %B %d, %Y',  # Sunday, July 16, 2028
        '%a, %b %d, %Y',  # Sun, Jul 16, 2028
        '%B %d, %Y',      # July 16, 2028
        '%b %d, %Y',      # Jul 16, 2028
        '%B %d',          # July 16 (no year - add 2028)
        '%b %d',          # Jul 16 (no year - add 2028)
        '%Y-%m-%d',       # 2028-07-16
        '%m/%d/%Y',       # 07/16/2028
        '%d/%m/%Y',       # 16/07/2028
        '%d %B %Y',       # 16 July 2028
        '%d %b %Y'        # 16 Jul 2028
    ]
    
    for fmt in fallback_formats:
        try:
            dt = datetime.strptime(date_str, fmt)
            # If the format didn't include a year, add 2028
            if dt.year == 1900:
                dt = dt.replace(year=2028)
            return dt.strftime('%Y-%m-%d')
        except:
            continue
    
    # Try to extract date components manually if standard parsing fails
    # Look for month name and day
    month_names = ['january', 'february', 'march', 'april', 'may', 'june',
                   'july', 'august', 'september', 'october', 'november', 'december']
    month_abbrev = ['jan', 'feb', 'mar', 'apr', 'may', 'jun',
                    'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
    
    date_lower = date_str.lower()
    for i, month in enumerate(month_names + month_abbrev, 1):
        if month in date_lower:
            # Try to extract day
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
    """Extract all tables from PDF"""
    all_rows = []
    header_row = None
    
    # Keywords that indicate a real header row
    header_keywords = ['sport', 'venue', 'session', 'date', 'time', 'code', 'type', 'description']
    # Keywords that indicate non-table content to skip
    skip_keywords = ['competition schedule', 'subject to change', 'los angeles 2028', 
                    'times listed are', '24-hour', 'pacific time']
    
    with pdfplumber.open(pdf_path) as pdf:
        print(f"Processing {len(pdf.pages)} pages...")
        
        for page_num, page in enumerate(pdf.pages, 1):
            print(f"  Page {page_num}...", end=' ', flush=True)
            
            # Extract tables from page
            tables = page.extract_tables()
            
            if not tables:
                print(f"no tables found")
                continue
            
            for table_idx, table in enumerate(tables):
                if not table or len(table) == 0:
                    continue
                
                # Process each row
                for row_idx, row in enumerate(table):
                    if not row or not any(row):
                        continue
                    
                    # Create row text for analysis
                    row_text = ' '.join([str(c) if c else '' for c in row]).lower()
                    
                    # Skip rows with disclaimer text
                    if any(skip in row_text for skip in skip_keywords):
                        continue
                    
                    # Check if this looks like a header row
                    if any(keyword in row_text for keyword in header_keywords):
                        # Make sure it looks like a real header (has multiple keywords)
                        keyword_count = sum(1 for keyword in header_keywords if keyword in row_text)
                        if keyword_count >= 3:
                            if header_row is None:
                                header_row = row
                                print(f"found header row", end=' ')
                            # Skip duplicate header rows
                            continue
                    
                    # Check if row looks like data (has reasonable number of cells and valid content)
                    non_empty = sum(1 for cell in row if cell and str(cell).strip())
                    if non_empty >= 5:
                        # Check that the row doesn't start with header keywords
                        first_cell = str(row[0]) if row[0] else ''
                        if first_cell.lower() not in ['sport', 'venue', 'session', 'date']:
                            all_rows.append(row)
            
            print(f"extracted {len(tables)} tables")
    
    return header_row, all_rows

def process_schedule_data(header_row, data_rows):
    """Process extracted rows into structured DataFrame"""
    
    # Expected column order: Sport, Venue, Zone, Session Code, Date, Games Day, 
    #                        Session Type, Session Description, Start Time, End Time
    expected_columns = ['sport', 'venue', 'zone', 'session_code', 'date', 
                       'games_day', 'session_type', 'session_description', 
                       'start_time', 'end_time']
    
    # Create DataFrame
    df = pd.DataFrame(data_rows)
    
    # If we have a header row, use it; otherwise use expected columns
    if header_row:
        # Clean header row
        header_cleaned = [clean_text(str(h)).lower().replace(' ', '_') if h else f'col_{i}' 
                         for i, h in enumerate(header_row)]
        
        # Ensure we have enough columns
        while len(header_cleaned) < len(df.columns):
            header_cleaned.append(f'col_{len(header_cleaned)}')
        
        df.columns = header_cleaned[:len(df.columns)]
    else:
        # Use expected columns or default
        if len(df.columns) >= len(expected_columns):
            df.columns = expected_columns[:len(df.columns)]
        else:
            df.columns = [f'col_{i}' for i in range(len(df.columns))]
    
    # Print columns for debugging
    print(f"\nDetected columns: {df.columns.tolist()}")
    
    # Map columns to expected names (flexible matching)
    column_mapping = {}
    for col in df.columns:
        col_lower = str(col).lower()
        if 'sport' in col_lower:
            column_mapping[col] = 'sport'
        elif 'venue' in col_lower:
            column_mapping[col] = 'venue'
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
    
    # Rename columns
    df = df.rename(columns=column_mapping)
    
    # If we don't have mapped columns, try positional assignment
    # Expected order: Sport, Venue, Zone, Session Code, Date, Games Day, 
    #                 Session Type, Session Description, Start Time, End Time
    if 'sport' not in df.columns and len(df.columns) >= 10:
        # Use positional mapping
        df = df.rename(columns={
            df.columns[0]: 'sport',
            df.columns[1]: 'venue',
            df.columns[3]: 'session_code',  # Skip Zone (index 2)
            df.columns[4]: 'date',          # Skip Games Day (index 5) - but it's here
            df.columns[6]: 'session_type',
            df.columns[7]: 'session_description',
            df.columns[8]: 'start_time',
            df.columns[9]: 'end_time'
        })
    elif 'sport' not in df.columns and len(df.columns) >= 8:
        # Try without zone and games day
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
    
    # Clean text fields
    for col in ['sport', 'venue', 'session_code', 'session_type']:
        if col in df.columns:
            df[col] = df[col].apply(clean_text)
    
    # Special handling for session_description to preserve event separators
    if 'session_description' in df.columns:
        df['session_description'] = df['session_description'].apply(clean_session_description)
    
    # Parse dates
    if 'date' in df.columns:
        df['session_date'] = df['date'].apply(parse_date)
        if 'date' in df.columns:
            df = df.drop(columns=['date'])
    elif 'session_date' not in df.columns:
        # Try to find date column by looking for columns with dates
        for col in df.columns:
            if 'date' in str(col).lower() or col.startswith('col_'):
                # Try to parse a few rows to see if this looks like a date column
                sample_values = df[col].dropna().head(5)
                parsed_count = sum(1 for v in sample_values if parse_date(v))
                if parsed_count > 0:
                    df['session_date'] = df[col].apply(parse_date)
                    break
    
    # Parse times
    if 'start_time' in df.columns:
        df['start_time'] = df['start_time'].apply(parse_time)
    if 'end_time' in df.columns:
        df['end_time'] = df['end_time'].apply(parse_time)
    
    # Remove rows with missing critical data
    required_cols = ['sport', 'venue', 'session_date', 'start_time', 'end_time']
    missing_cols = [col for col in required_cols if col not in df.columns]
    if missing_cols:
        print(f"\nWarning: Missing required columns: {missing_cols}")
        print(f"Available columns: {df.columns.tolist()}")
        print(f"\nSample row data:")
        if len(df) > 0:
            print(df.head(3))
        return None
    
    # Drop rows with missing critical data (None or empty values)
    initial_count = len(df)
    df = df.dropna(subset=required_cols)
    
    # Also filter out rows where date parsing failed (None values)
    if 'session_date' in df.columns:
        df = df[df['session_date'].notna()]
    
    filtered_count = len(df)
    if initial_count != filtered_count:
        print(f"\nFiltered out {initial_count - filtered_count} rows with missing/invalid data")
    
    # Reorder columns to match expected output
    column_order = ['sport', 'venue', 'session_code', 'session_date', 
                   'session_type', 'session_description', 'start_time', 'end_time']
    df = df[[col for col in column_order if col in df.columns]]
    
    return df

def main():
    """Main execution"""
    import sys
    
    if len(sys.argv) < 2:
        print("Usage: python transform_pdf_to_csv.py <path_to_pdf> [output_csv]")
        print("Example: python transform_pdf_to_csv.py LA28OlympicGamesCompetitionScheduleByEventV2Final.pdf")
        sys.exit(1)
    
    pdf_path = sys.argv[1]
    output_path = sys.argv[2] if len(sys.argv) > 2 else "la2028_sessions.csv"
    
    print(f"Reading PDF: {pdf_path}")
    print()
    
    # Extract tables
    header_row, data_rows = extract_tables_from_pdf(pdf_path)
    print(f"\nExtracted {len(data_rows)} data rows")
    
    if len(data_rows) == 0:
        print("Error: No data rows extracted from PDF")
        sys.exit(1)
    
    # Process data
    df = process_schedule_data(header_row, data_rows)
    
    if df is None or len(df) == 0:
        print("Error: Could not process data into valid format")
        sys.exit(1)
    
    # Display summary
    print(f"\nProcessed {len(df)} valid sessions")
    print(f"\nSample data (first 5 rows):")
    print(df.head(5).to_string())
    
    print(f"\nData summary:")
    print(f"  Sports: {df['sport'].nunique()}")
    print(f"  Venues: {df['venue'].nunique()}")
    if 'session_date' in df.columns:
        print(f"  Date range: {df['session_date'].min()} to {df['session_date'].max()}")
    if 'session_type' in df.columns:
        print(f"  Session types: {sorted(df['session_type'].unique().tolist())}")
    
    # Export to CSV
    df.to_csv(output_path, index=False)
    print(f"\n✓ Exported to: {output_path}")
    
    # Check for any issues
    print("\nData quality check:")
    print(f"  Missing sport: {df['sport'].isna().sum()}")
    print(f"  Missing venue: {df['venue'].isna().sum()}")
    if 'session_date' in df.columns:
        print(f"  Missing dates: {df['session_date'].isna().sum()}")
    print(f"  Missing start times: {df['start_time'].isna().sum()}")
    print(f"  Missing end times: {df['end_time'].isna().sum()}")

if __name__ == "__main__":
    main()
