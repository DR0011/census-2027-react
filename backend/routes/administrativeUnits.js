const express = require("express");
const router = express.Router();
const db = require("../db/db");

/*
====================================================================
 CENSUS 2027 - ADMINISTRATIVE UNITS API
====================================================================
 View   : rural_urban_view
 Table  : admin_villages_towns  (fast, indexed - run villages_table.sql)

 STATE NORMALIZATION:
   Gujarat = 25
   Dadra and Nagar Haveli and Daman and Diu = 26
====================================================================
*/

/* ================================================================
   SIMPLE IN-MEMORY CACHE
================================================================ */

const cache = new Map();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes
const CACHE_MAX = 300;

async function cached(key, loader) {
  const hit = cache.get(key);

  if (hit && Date.now() - hit.time < CACHE_TTL) {
    return hit.value;
  }

  const value = await loader();

  cache.set(key, { value, time: Date.now() });

  if (cache.size > CACHE_MAX) {
    cache.delete(cache.keys().next().value);
  }

  return value;
}

/* ================================================================
   NORMALIZED STATE CODE / NAME
================================================================ */

const NORMALIZED_STATE_CODE = `
  CASE
    WHEN LOWER(TRIM(stname2027)) = 'gujarat'
      THEN '25'
    WHEN LOWER(TRIM(stname2027)) = 'dadra and nagar haveli and daman and diu'
      THEN '26'
    ELSE TRIM(stsh2027)
  END
`;

const NORMALIZED_STATE_NAME = `TRIM(stname2027)`;

/* ================================================================
   QUERY HELPERS
================================================================ */

const str = (v) => String(v ?? "").trim();

function readState(q) {
  return {
    state: q.state || q.stname2027 || q.stateName || "",
    stateCode: q.stateCode || q.stsh2027 || q.code || "",
  };
}

function readDistrict(q) {
  return {
    district: q.district || q.dtname2027 || q.districtName || "",
    districtCode: q.districtCode || q.revdtsh2027 || "",
  };
}

function readSubDistrict(q) {
  return {
    subdistrict: q.subdistrict || q.sdname2027 || q.subdistrictName || "",
    subdistrictCode: q.subdistrictCode || q.revsdsh2027 || "",
  };
}

function readVillageTown(q) {
  return {
    villageTown: q.villageTown || q.vtname2027 || q.villageTownName || "",
    villageTownCode: q.villageTownCode || q.revvtsh2027 || "",
  };
}

function addStateFilter(conditions, params, state, stateCode) {
  const cleanStateCode = str(stateCode);
  const cleanState = str(state);

  if (cleanStateCode !== "") {
    conditions.push(`${NORMALIZED_STATE_CODE} = ?`);
    params.push(cleanStateCode);
    return;
  }

  if (cleanState !== "") {
    const lowerState = cleanState.toLowerCase();

    if (lowerState === "gujarat") {
      conditions.push(`${NORMALIZED_STATE_CODE} = '25'`);
      return;
    }

    if (lowerState === "dadra and nagar haveli and daman and diu") {
      conditions.push(`${NORMALIZED_STATE_CODE} = '26'`);
      return;
    }

    conditions.push(`LOWER(TRIM(stname2027)) = LOWER(?)`);
    params.push(cleanState);
  }
}

function addCodeOrNameFilter(conditions, params, code, name, codeCol, nameCol) {
  if (str(code) !== "") {
    conditions.push(`TRIM(${codeCol}) = ?`);
    params.push(str(code));
  } else if (str(name) !== "") {
    conditions.push(`LOWER(TRIM(${nameCol})) = LOWER(?)`);
    params.push(str(name));
  }
}

const sendError = (res, label, message, error) => {
  console.error(label, error);
  res.status(500).json({ success: false, message, error: error.message });
};

/* ================================================================
   GET SUMMARY  (cached)
================================================================ */

router.get("/summary", async (req, res) => {
  try {
    const data = await cached("summary", async () => {
      const sql = `
        SELECT
          COUNT(DISTINCT CASE
            WHEN TRIM(COALESCE(stname2027, '')) <> ''
            THEN CONCAT(${NORMALIZED_STATE_CODE}, '|', ${NORMALIZED_STATE_NAME})
          END) AS states,

          COUNT(DISTINCT CASE
            WHEN TRIM(COALESCE(revdtsh2027, '')) <> ''
             AND TRIM(COALESCE(dtname2027, '')) <> ''
            THEN CONCAT(${NORMALIZED_STATE_CODE}, '|', TRIM(revdtsh2027), '|', TRIM(dtname2027))
          END) AS districts,

          COUNT(DISTINCT CASE
            WHEN TRIM(COALESCE(revdtsh2027, '')) <> ''
             AND TRIM(COALESCE(revsdsh2027, '')) <> ''
             AND TRIM(COALESCE(sdname2027, '')) <> ''
            THEN CONCAT(${NORMALIZED_STATE_CODE}, '|', TRIM(revdtsh2027), '|',
                        TRIM(revsdsh2027), '|', TRIM(sdname2027))
          END) AS subDistricts,

          COUNT(DISTINCT CASE
            WHEN TRIM(COALESCE(revdtsh2027, '')) <> ''
             AND TRIM(COALESCE(revsdsh2027, '')) <> ''
             AND TRIM(COALESCE(revvtsh2027, '')) <> ''
             AND TRIM(COALESCE(vtname2027, '')) <> ''
            THEN CONCAT(${NORMALIZED_STATE_CODE}, '|', TRIM(revdtsh2027), '|',
                        TRIM(revsdsh2027), '|', TRIM(revvtsh2027), '|', TRIM(vtname2027))
          END) AS villagesTowns,

          COUNT(DISTINCT CASE
            WHEN TRIM(COALESCE(revdtsh2027, '')) <> ''
             AND TRIM(COALESCE(revsdsh2027, '')) <> ''
             AND TRIM(COALESCE(revvtsh2027, '')) <> ''
             AND TRIM(COALESCE(vtname2027, '')) <> ''
             AND TRIM(COALESCE(\`Name ward\`, '')) <> ''
            THEN CONCAT(${NORMALIZED_STATE_CODE}, '|', TRIM(revdtsh2027), '|',
                        TRIM(revsdsh2027), '|', TRIM(revvtsh2027), '|',
                        TRIM(vtname2027), '|', TRIM(\`Name ward\`))
          END) AS wards
        FROM rural_urban_view
      `;

      const [rows] = await db.query(sql);
      const r = rows[0] || {};

      return {
        states: Number(r.states || 0),
        districts: Number(r.districts || 0),
        subDistricts: Number(r.subDistricts || 0),
        villagesTowns: Number(r.villagesTowns || 0),
        wards: Number(r.wards || 0),
      };
    });

    res.json({ success: true, data });
  } catch (error) {
    sendError(res, "SUMMARY API ERROR:", "Failed to load administrative unit summary", error);
  }
});

/* ================================================================
   GET ALL ADMINISTRATIVE DATA  (cached)
================================================================ */

router.get("/", async (req, res) => {
  try {
    const rows = await cached("all-admin-data", async () => {
      const sql = `
        SELECT
          admin_data.stsh2027,
          admin_data.stname2027,
          admin_data.revdtsh2027,
          admin_data.dtname2027,
          admin_data.revsdsh2027,
          admin_data.sdname2027,
          admin_data.revvtsh2027,
          admin_data.vtname2027,
          admin_data.vtru2027,
          admin_data.\`Name ward\`
        FROM (
          SELECT DISTINCT
            ${NORMALIZED_STATE_CODE} AS stsh2027,
            TRIM(stname2027)         AS stname2027,
            TRIM(revdtsh2027)        AS revdtsh2027,
            TRIM(dtname2027)         AS dtname2027,
            TRIM(revsdsh2027)        AS revsdsh2027,
            TRIM(sdname2027)         AS sdname2027,
            TRIM(revvtsh2027)        AS revvtsh2027,
            TRIM(vtname2027)         AS vtname2027,
            TRIM(vtru2027)           AS vtru2027,
            TRIM(\`Name ward\`)      AS \`Name ward\`
          FROM rural_urban_view
          WHERE TRIM(COALESCE(stname2027, '')) <> ''
        ) AS admin_data
        ORDER BY
          CAST(admin_data.stsh2027 AS UNSIGNED),
          admin_data.stname2027,
          CAST(admin_data.revdtsh2027 AS UNSIGNED),
          admin_data.dtname2027,
          CAST(admin_data.revsdsh2027 AS UNSIGNED),
          admin_data.sdname2027,
          CAST(admin_data.revvtsh2027 AS UNSIGNED),
          admin_data.vtname2027,
          admin_data.vtru2027,
          admin_data.\`Name ward\`
      `;

      const [r] = await db.query(sql);
      return r;
    });

    res.json({ success: true, count: rows.length, data: rows });
  } catch (error) {
    sendError(res, "ADMINISTRATIVE DATA API ERROR:", "Failed to load administrative data", error);
  }
});

/* ================================================================
   GET STATES  (cached)
================================================================ */

router.get("/states", async (req, res) => {
  try {
    const rows = await cached("states", async () => {
      const sql = `
        SELECT state_code AS stsh2027, state_name AS stname2027
        FROM (
          SELECT DISTINCT
            ${NORMALIZED_STATE_CODE} AS state_code,
            TRIM(stname2027)         AS state_name
          FROM rural_urban_view
          WHERE TRIM(COALESCE(stname2027, '')) <> ''
        ) AS states
        ORDER BY CAST(state_code AS UNSIGNED), state_name
      `;
      const [r] = await db.query(sql);
      return r;
    });

    res.json({ success: true, count: rows.length, data: rows });
  } catch (error) {
    sendError(res, "STATES API ERROR:", "Failed to load states", error);
  }
});

/* ================================================================
   GET DISTRICTS  (cached)
   /districts?stateCode=25
================================================================ */

router.get("/districts", async (req, res) => {
  try {
    const { state, stateCode } = readState(req.query);

    const conditions = [
      `TRIM(COALESCE(dtname2027, '')) <> ''`,
      `TRIM(COALESCE(revdtsh2027, '')) <> ''`,
    ];
    const params = [];

    addStateFilter(conditions, params, state, stateCode);

    const rows = await cached(`districts|${conditions.join()}|${params}`, async () => {
      const sql = `
        SELECT
          state_code    AS stsh2027,
          state_name    AS stname2027,
          district_code AS revdtsh2027,
          district_name AS dtname2027
        FROM (
          SELECT DISTINCT
            ${NORMALIZED_STATE_CODE} AS state_code,
            TRIM(stname2027)         AS state_name,
            TRIM(revdtsh2027)        AS district_code,
            TRIM(dtname2027)         AS district_name
          FROM rural_urban_view
          WHERE ${conditions.join("\nAND ")}
        ) AS districts
        ORDER BY
          CAST(state_code AS UNSIGNED),
          CAST(district_code AS UNSIGNED),
          district_name
      `;
      const [r] = await db.query(sql, params);
      return r;
    });

    res.json({ success: true, count: rows.length, data: rows });
  } catch (error) {
    sendError(res, "DISTRICTS API ERROR:", "Failed to load districts", error);
  }
});

/* ================================================================
   GET SUB-DISTRICTS  (cached)
   /subdistricts?stateCode=25&districtCode=01
================================================================ */

router.get("/subdistricts", async (req, res) => {
  try {
    const { state, stateCode } = readState(req.query);
    const { district, districtCode } = readDistrict(req.query);

    const conditions = [
      `TRIM(COALESCE(dtname2027, '')) <> ''`,
      `TRIM(COALESCE(revdtsh2027, '')) <> ''`,
      `TRIM(COALESCE(sdname2027, '')) <> ''`,
      `TRIM(COALESCE(revsdsh2027, '')) <> ''`,
    ];
    const params = [];

    addStateFilter(conditions, params, state, stateCode);
    addCodeOrNameFilter(conditions, params, districtCode, district, "revdtsh2027", "dtname2027");

    const rows = await cached(`subdistricts|${conditions.join()}|${params}`, async () => {
      const sql = `
        SELECT
          state_code        AS stsh2027,
          state_name        AS stname2027,
          district_code     AS revdtsh2027,
          district_name     AS dtname2027,
          subdistrict_code  AS revsdsh2027,
          subdistrict_name  AS sdname2027
        FROM (
          SELECT DISTINCT
            ${NORMALIZED_STATE_CODE} AS state_code,
            TRIM(stname2027)         AS state_name,
            TRIM(revdtsh2027)        AS district_code,
            TRIM(dtname2027)         AS district_name,
            TRIM(revsdsh2027)        AS subdistrict_code,
            TRIM(sdname2027)         AS subdistrict_name
          FROM rural_urban_view
          WHERE ${conditions.join("\nAND ")}
        ) AS subdistricts
        ORDER BY
          CAST(state_code AS UNSIGNED),
          CAST(district_code AS UNSIGNED),
          CAST(subdistrict_code AS UNSIGNED),
          subdistrict_name
      `;
      const [r] = await db.query(sql, params);
      return r;
    });

    res.json({ success: true, count: rows.length, data: rows });
  } catch (error) {
    sendError(res, "SUBDISTRICTS API ERROR:", "Failed to load sub-districts", error);
  }
});

/* ================================================================
   GET VILLAGES / TOWNS  (FAST - indexed table, no pagination)

   /villages-towns?stateCode=25&districtCode=01&subdistrictCode=001
   /villages-towns?stateCode=25&countOnly=1
================================================================ */

router.get("/villages-towns", async (req, res) => {
  try {
    const q = req.query;

    const stateCode = str(q.stateCode || q.stsh2027);
    const districtCode = str(q.districtCode || q.revdtsh2027);
    const subdistrictCode = str(q.subdistrictCode || q.revsdsh2027);

    const where = ["1=1"];
    const params = [];

    if (stateCode) {
      where.push("state_code = ?");
      params.push(stateCode);
    }
    if (districtCode) {
      where.push("district_code = ?");
      params.push(districtCode);
    }
    if (subdistrictCode) {
      where.push("subdistrict_code = ?");
      params.push(subdistrictCode);
    }

    const whereSql = where.join(" AND ");

    /* tiny request used by the count box */
    if (q.countOnly === "1") {
      const total = await cached(`vt-count|${whereSql}|${params}`, async () => {
        const [r] = await db.query(
          `SELECT COUNT(*) AS total FROM admin_villages_towns WHERE ${whereSql}`,
          params
        );
        return Number(r[0].total);
      });

      return res.json({ success: true, total });
    }

    /* all rows of the selected scope */
    const rows = await cached(`vt-rows|${whereSql}|${params}`, async () => {
      const [r] = await db.query(
        `SELECT
           state_code        AS stsh2027,
           state_name        AS stname2027,
           district_code     AS revdtsh2027,
           district_name     AS dtname2027,
           subdistrict_code  AS revsdsh2027,
           subdistrict_name  AS sdname2027,
           village_town_code AS revvtsh2027,
           village_town_name AS vtname2027,
           rural_urban       AS vtru2027
         FROM admin_villages_towns
         WHERE ${whereSql}
         ORDER BY state_code, district_code, subdistrict_code, village_town_code`,
        params
      );
      return r;
    });

    res.json({ success: true, count: rows.length, data: rows });
  } catch (error) {
    sendError(res, "VILLAGES/TOWNS API ERROR:", "Failed to load villages/towns", error);
  }
});

/* ================================================================
   GET WARDS  (cached)
   /wards?stateCode=25&districtCode=01&subdistrictCode=001&villageTownCode=0001
================================================================ */

router.get("/wards", async (req, res) => {
  try {
    const { state, stateCode } = readState(req.query);
    const { district, districtCode } = readDistrict(req.query);
    const { subdistrict, subdistrictCode } = readSubDistrict(req.query);
    const { villageTown, villageTownCode } = readVillageTown(req.query);

    const conditions = [
      `TRIM(COALESCE(dtname2027, '')) <> ''`,
      `TRIM(COALESCE(revdtsh2027, '')) <> ''`,
      `TRIM(COALESCE(sdname2027, '')) <> ''`,
      `TRIM(COALESCE(revsdsh2027, '')) <> ''`,
      `TRIM(COALESCE(vtname2027, '')) <> ''`,
      `TRIM(COALESCE(revvtsh2027, '')) <> ''`,
      `TRIM(COALESCE(\`Name ward\`, '')) <> ''`,
    ];
    const params = [];

    addStateFilter(conditions, params, state, stateCode);
    addCodeOrNameFilter(conditions, params, districtCode, district, "revdtsh2027", "dtname2027");
    addCodeOrNameFilter(conditions, params, subdistrictCode, subdistrict, "revsdsh2027", "sdname2027");
    addCodeOrNameFilter(conditions, params, villageTownCode, villageTown, "revvtsh2027", "vtname2027");

    const rows = await cached(`wards|${conditions.join()}|${params}`, async () => {
      const sql = `
        SELECT
          state_code        AS stsh2027,
          state_name        AS stname2027,
          district_code     AS revdtsh2027,
          district_name     AS dtname2027,
          subdistrict_code  AS revsdsh2027,
          subdistrict_name  AS sdname2027,
          village_town_code AS revvtsh2027,
          village_town_name AS vtname2027,
          rural_urban       AS vtru2027,
          ward_name         AS \`Name ward\`
        FROM (
          SELECT DISTINCT
            ${NORMALIZED_STATE_CODE} AS state_code,
            TRIM(stname2027)         AS state_name,
            TRIM(revdtsh2027)        AS district_code,
            TRIM(dtname2027)         AS district_name,
            TRIM(revsdsh2027)        AS subdistrict_code,
            TRIM(sdname2027)         AS subdistrict_name,
            TRIM(revvtsh2027)        AS village_town_code,
            TRIM(vtname2027)         AS village_town_name,
            TRIM(vtru2027)           AS rural_urban,
            TRIM(\`Name ward\`)      AS ward_name
          FROM rural_urban_view
          WHERE ${conditions.join("\nAND ")}
        ) AS wards
        ORDER BY
          CAST(state_code AS UNSIGNED),
          CAST(district_code AS UNSIGNED),
          CAST(subdistrict_code AS UNSIGNED),
          CAST(village_town_code AS UNSIGNED),
          ward_name
      `;
      const [r] = await db.query(sql, params);
      return r;
    });

    res.json({ success: true, count: rows.length, data: rows });
  } catch (error) {
    sendError(res, "WARDS API ERROR:", "Failed to load wards", error);
  }
});

/* ================================================================
   EXPORT
================================================================ */

module.exports = router;