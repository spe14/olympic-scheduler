import "dotenv/config";
import { db } from "./index";
import { session, travelTime, zoneEnum } from "./schema";
import fs from "fs";
import Papa from "papaparse";

const sessionsCsvFile = fs.readFileSync(
  "./scripts/output/la2028_sessions.csv",
  "utf-8"
);

const parsedSessions = Papa.parse(sessionsCsvFile, {
  header: true,
  skipEmptyLines: true,
});

const sessionRows = parsedSessions.data.map((row: any) => ({
  sessionCode: row.session_code,
  sport: row.sport,
  venue: row.venue,
  zone: row.zone,
  sessionDate: row.session_date,
  sessionType: row.session_type,
  sessionDescription: row.session_description || null,
  startTime: row.start_time,
  endTime: row.end_time,
}));

const drivingTimesCsvFile = fs.readFileSync(
  "./scripts/output/driving_times.csv",
  "utf-8"
);

const transitTimesCsvFile = fs.readFileSync(
  "./scripts/output/transit_times.csv",
  "utf-8"
);

const parsedDrivingTimes = Papa.parse(drivingTimesCsvFile, {
  header: true,
  skipEmptyLines: true,
});

const parsedTransitTimes = Papa.parse(transitTimesCsvFile, {
  header: true,
  skipEmptyLines: true,
});

type Zone = (typeof zoneEnum.enumValues)[number];

const drivingTimeRows = (parsedDrivingTimes.data as any[]).flatMap((row) => {
  const originZone = row[""] as Zone;
  return Object.keys(row)
    .filter((key) => key !== "")
    .map((destZone) => ({
      originZone,
      destinationZone: destZone as Zone,
      drivingMinutes: parseFloat(row[destZone]),
    }));
});

const transitTimeRows = (parsedTransitTimes.data as any[]).flatMap((row) => {
  const originZone = row[""] as Zone;
  return Object.keys(row)
    .filter((key) => key !== "")
    .map((destZone) => ({
      originZone,
      destinationZone: destZone as Zone,
      transitMinutes: row[destZone] ? parseFloat(row[destZone]) : null,
    }));
});

const travelTimeRows = drivingTimeRows.map((drivingRow) => {
  const transitRow = transitTimeRows.find(
    (r) =>
      r.originZone === drivingRow.originZone &&
      r.destinationZone === drivingRow.destinationZone
  );
  return {
    originZone: drivingRow.originZone,
    destinationZone: drivingRow.destinationZone,
    drivingMinutes: drivingRow.drivingMinutes,
    transitMinutes: transitRow?.transitMinutes ?? null,
  };
});

async function seed() {
  // Seed sessions
  await db.delete(session);
  await db.insert(session).values(sessionRows);
  console.log(`Seeded ${sessionRows.length} sessions`);

  // Seed travel times
  await db.delete(travelTime);
  await db.insert(travelTime).values(travelTimeRows);
  console.log(`Seeded ${travelTimeRows.length} travel times`);

  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed: ", err);
  process.exit(1);
});
