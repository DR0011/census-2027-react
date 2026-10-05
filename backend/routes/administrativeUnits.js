const express = require("express");
const router = express.Router();
const db = require("../db/db");

/*
====================================================================
 CENSUS 2027 - ADMINISTRATIVE UNITS API
====================================================================

Database View:
  rural_urban_view

Hierarchy:
  State / UT
    stsh2027
    stname2027

  District
    revdtsh2027
    dtname2027

  Sub-District
    revsdsh2027
    sdname2027

  Village / Town
    revvtsh2027
    vtname2027

  Rural / Urban
    vtru2027

  Ward
    `Name ward`

STATE NORMALIZATION:
  Gujarat = 25
  Dadra and Nagar Haveli and Daman and Diu = 26
====================================================================
*/


/* ================================================================
   NORMALIZED STATE CODE
================================================================ */

const NORMALIZED_STATE_CODE = `
  CASE
    WHEN LOWER(TRIM(stname2027)) = 'gujarat'
      THEN '25'

    WHEN LOWER(TRIM(stname2027)) =
      'dadra and nagar haveli and daman and diu'
      THEN '26'

    ELSE TRIM(stsh2027)
  END
`;


/* ================================================================
   NORMALIZED STATE NAME
================================================================ */

const NORMALIZED_STATE_NAME = `
  TRIM(stname2027)
`;


/* ================================================================
   STATE FILTER HELPER
================================================================ */

function addStateFilter(
  conditions,
  params,
  state,
  stateCode
) {
  const cleanStateCode = String(stateCode || "").trim();
  const cleanState = String(state || "").trim();

  /*
  ---------------------------------------------------------------
  STATE CODE
  ---------------------------------------------------------------
  */

  if (cleanStateCode !== "") {
    conditions.push(`
      ${NORMALIZED_STATE_CODE} = ?
    `);

    params.push(cleanStateCode);

    return;
  }


  /*
  ---------------------------------------------------------------
  STATE NAME
  ---------------------------------------------------------------
  */

  if (cleanState !== "") {
    const lowerState = cleanState.toLowerCase();

    if (lowerState === "gujarat") {
      conditions.push(`
        ${NORMALIZED_STATE_CODE} = '25'
      `);

      return;
    }


    if (
      lowerState ===
      "dadra and nagar haveli and daman and diu"
    ) {
      conditions.push(`
        ${NORMALIZED_STATE_CODE} = '26'
      `);

      return;
    }


    conditions.push(`
      LOWER(TRIM(stname2027)) = LOWER(?)
    `);

    params.push(cleanState);
  }
}


/* ================================================================
   GET SUMMARY
================================================================ */

router.get("/summary", async (req, res) => {
  try {

    const sql = `
      SELECT

        /* ========================================================
           STATES
        ======================================================== */

        COUNT(
          DISTINCT CASE
            WHEN TRIM(COALESCE(stname2027, '')) <> ''
            THEN CONCAT(
              ${NORMALIZED_STATE_CODE},
              '|',
              ${NORMALIZED_STATE_NAME}
            )
          END
        ) AS states,


        /* ========================================================
           DISTRICTS
        ======================================================== */

        COUNT(
          DISTINCT CASE
            WHEN TRIM(COALESCE(revdtsh2027, '')) <> ''
             AND TRIM(COALESCE(dtname2027, '')) <> ''
            THEN CONCAT(
              ${NORMALIZED_STATE_CODE},
              '|',
              TRIM(revdtsh2027),
              '|',
              TRIM(dtname2027)
            )
          END
        ) AS districts,


        /* ========================================================
           SUB-DISTRICTS
        ======================================================== */

        COUNT(
          DISTINCT CASE
            WHEN TRIM(COALESCE(revdtsh2027, '')) <> ''
             AND TRIM(COALESCE(revsdsh2027, '')) <> ''
             AND TRIM(COALESCE(sdname2027, '')) <> ''
            THEN CONCAT(
              ${NORMALIZED_STATE_CODE},
              '|',
              TRIM(revdtsh2027),
              '|',
              TRIM(revsdsh2027),
              '|',
              TRIM(sdname2027)
            )
          END
        ) AS subDistricts,


        /* ========================================================
           VILLAGES / TOWNS
        ======================================================== */

        COUNT(
          DISTINCT CASE
            WHEN TRIM(COALESCE(revdtsh2027, '')) <> ''
             AND TRIM(COALESCE(revsdsh2027, '')) <> ''
             AND TRIM(COALESCE(revvtsh2027, '')) <> ''
             AND TRIM(COALESCE(vtname2027, '')) <> ''
            THEN CONCAT(
              ${NORMALIZED_STATE_CODE},
              '|',
              TRIM(revdtsh2027),
              '|',
              TRIM(revsdsh2027),
              '|',
              TRIM(revvtsh2027),
              '|',
              TRIM(vtname2027)
            )
          END
        ) AS villagesTowns,


        /* ========================================================
           WARDS
        ======================================================== */

        COUNT(
          DISTINCT CASE
            WHEN TRIM(COALESCE(revdtsh2027, '')) <> ''
             AND TRIM(COALESCE(revsdsh2027, '')) <> ''
             AND TRIM(COALESCE(revvtsh2027, '')) <> ''
             AND TRIM(COALESCE(vtname2027, '')) <> ''
             AND TRIM(COALESCE(\`Name ward\`, '')) <> ''
            THEN CONCAT(
              ${NORMALIZED_STATE_CODE},
              '|',
              TRIM(revdtsh2027),
              '|',
              TRIM(revsdsh2027),
              '|',
              TRIM(revvtsh2027),
              '|',
              TRIM(vtname2027),
              '|',
              TRIM(\`Name ward\`)
            )
          END
        ) AS wards

      FROM rural_urban_view
    `;


    const [rows] = await db.query(sql);


    res.json({
      success: true,

      data: {
        states: Number(rows[0]?.states || 0),

        districts: Number(
          rows[0]?.districts || 0
        ),

        subDistricts: Number(
          rows[0]?.subDistricts || 0
        ),

        villagesTowns: Number(
          rows[0]?.villagesTowns || 0
        ),

        wards: Number(
          rows[0]?.wards || 0
        )
      }
    });

  } catch (error) {

    console.error(
      "SUMMARY API ERROR:",
      error
    );

    res.status(500).json({
      success: false,
      message:
        "Failed to load administrative unit summary",
      error: error.message
    });
  }
});


/* ================================================================
   GET ALL ADMINISTRATIVE DATA

   IMPORTANT:
   DISTINCT is inside subquery.
   ORDER BY is outside subquery.

   This FIXES:

   Expression #1 of ORDER BY clause is not in SELECT list
================================================================ */

router.get("/", async (req, res) => {
  try {

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

          /* STATE */
          ${NORMALIZED_STATE_CODE}
            AS stsh2027,

          TRIM(stname2027)
            AS stname2027,


          /* DISTRICT */
          TRIM(revdtsh2027)
            AS revdtsh2027,

          TRIM(dtname2027)
            AS dtname2027,


          /* SUB-DISTRICT */
          TRIM(revsdsh2027)
            AS revsdsh2027,

          TRIM(sdname2027)
            AS sdname2027,


          /* VILLAGE / TOWN */
          TRIM(revvtsh2027)
            AS revvtsh2027,

          TRIM(vtname2027)
            AS vtname2027,


          /* RURAL / URBAN */
          TRIM(vtru2027)
            AS vtru2027,


          /* WARD */
          TRIM(\`Name ward\`)
            AS \`Name ward\`

        FROM rural_urban_view

        WHERE
          TRIM(COALESCE(stname2027, '')) <> ''

      ) AS admin_data


      ORDER BY

        CAST(
          admin_data.stsh2027
          AS UNSIGNED
        ),

        admin_data.stname2027,

        CAST(
          admin_data.revdtsh2027
          AS UNSIGNED
        ),

        admin_data.dtname2027,

        CAST(
          admin_data.revsdsh2027
          AS UNSIGNED
        ),

        admin_data.sdname2027,

        CAST(
          admin_data.revvtsh2027
          AS UNSIGNED
        ),

        admin_data.vtname2027,

        admin_data.vtru2027,

        admin_data.\`Name ward\`
    `;


    const [rows] = await db.query(sql);


    res.json({
      success: true,
      count: rows.length,
      data: rows
    });

  } catch (error) {

    console.error(
      "ADMINISTRATIVE DATA API ERROR:",
      error
    );

    res.status(500).json({
      success: false,
      message:
        "Failed to load administrative data",
      error: error.message
    });
  }
});


/* ================================================================
   GET STATES

   /api/administrative-units/states
================================================================ */

router.get("/states", async (req, res) => {
  try {

    const sql = `
      SELECT
        state_code AS stsh2027,
        state_name AS stname2027

      FROM (

        SELECT DISTINCT

          ${NORMALIZED_STATE_CODE}
            AS state_code,

          TRIM(stname2027)
            AS state_name

        FROM rural_urban_view

        WHERE
          TRIM(COALESCE(stname2027, '')) <> ''

      ) AS states

      ORDER BY
        CAST(state_code AS UNSIGNED),
        state_name
    `;


    const [rows] = await db.query(sql);


    res.json({
      success: true,
      count: rows.length,
      data: rows
    });

  } catch (error) {

    console.error(
      "STATES API ERROR:",
      error
    );

    res.status(500).json({
      success: false,
      message: "Failed to load states",
      error: error.message
    });
  }
});


/* ================================================================
   GET DISTRICTS

   Examples:

   /districts?stateCode=25
   /districts?stateCode=26
   /districts?state=Gujarat
   /districts?state=Dadra%20and%20Nagar%20Haveli%20and%20Daman%20and%20Diu
================================================================ */

router.get("/districts", async (req, res) => {
  try {

    const state =
      req.query.state ||
      req.query.stname2027 ||
      req.query.stateName ||
      "";


    const stateCode =
      req.query.stateCode ||
      req.query.stsh2027 ||
      req.query.code ||
      "";


    const conditions = [

      `TRIM(COALESCE(dtname2027, '')) <> ''`,

      `TRIM(COALESCE(revdtsh2027, '')) <> ''`

    ];


    const params = [];


    addStateFilter(
      conditions,
      params,
      state,
      stateCode
    );


    const sql = `
      SELECT

        state_code AS stsh2027,

        state_name AS stname2027,

        district_code AS revdtsh2027,

        district_name AS dtname2027

      FROM (

        SELECT DISTINCT

          ${NORMALIZED_STATE_CODE}
            AS state_code,

          TRIM(stname2027)
            AS state_name,

          TRIM(revdtsh2027)
            AS district_code,

          TRIM(dtname2027)
            AS district_name

        FROM rural_urban_view

        WHERE
          ${conditions.join("\nAND ")}

      ) AS districts


      ORDER BY

        CAST(state_code AS UNSIGNED),

        CAST(district_code AS UNSIGNED),

        district_name
    `;


    const [rows] =
      await db.query(
        sql,
        params
      );


    res.json({
      success: true,
      count: rows.length,
      data: rows
    });

  } catch (error) {

    console.error(
      "DISTRICTS API ERROR:",
      error
    );

    res.status(500).json({
      success: false,
      message: "Failed to load districts",
      error: error.message
    });
  }
});


/* ================================================================
   GET SUB-DISTRICTS

   Examples:

   /subdistricts?stateCode=25&districtCode=01

   /subdistricts?
     stateCode=25&
     district=Ahmedabad
================================================================ */

router.get("/subdistricts", async (req, res) => {
  try {

    const state =
      req.query.state ||
      req.query.stname2027 ||
      req.query.stateName ||
      "";


    const stateCode =
      req.query.stateCode ||
      req.query.stsh2027 ||
      req.query.code ||
      "";


    const district =
      req.query.district ||
      req.query.dtname2027 ||
      req.query.districtName ||
      "";


    const districtCode =
      req.query.districtCode ||
      req.query.revdtsh2027 ||
      "";


    const conditions = [

      `TRIM(COALESCE(dtname2027, '')) <> ''`,

      `TRIM(COALESCE(revdtsh2027, '')) <> ''`,

      `TRIM(COALESCE(sdname2027, '')) <> ''`,

      `TRIM(COALESCE(revsdsh2027, '')) <> ''`

    ];


    const params = [];


    addStateFilter(
      conditions,
      params,
      state,
      stateCode
    );


    if (
      String(districtCode).trim() !== ""
    ) {

      conditions.push(`
        TRIM(revdtsh2027) = ?
      `);

      params.push(
        String(districtCode).trim()
      );

    } else if (
      String(district).trim() !== ""
    ) {

      conditions.push(`
        LOWER(TRIM(dtname2027)) = LOWER(?)
      `);

      params.push(
        String(district).trim()
      );
    }


    const sql = `
      SELECT

        state_code AS stsh2027,

        state_name AS stname2027,

        district_code AS revdtsh2027,

        district_name AS dtname2027,

        subdistrict_code AS revsdsh2027,

        subdistrict_name AS sdname2027

      FROM (

        SELECT DISTINCT

          ${NORMALIZED_STATE_CODE}
            AS state_code,

          TRIM(stname2027)
            AS state_name,

          TRIM(revdtsh2027)
            AS district_code,

          TRIM(dtname2027)
            AS district_name,

          TRIM(revsdsh2027)
            AS subdistrict_code,

          TRIM(sdname2027)
            AS subdistrict_name

        FROM rural_urban_view

        WHERE
          ${conditions.join("\nAND ")}

      ) AS subdistricts


      ORDER BY

        CAST(state_code AS UNSIGNED),

        CAST(district_code AS UNSIGNED),

        CAST(subdistrict_code AS UNSIGNED),

        subdistrict_name
    `;


    const [rows] =
      await db.query(
        sql,
        params
      );


    res.json({
      success: true,
      count: rows.length,
      data: rows
    });

  } catch (error) {

    console.error(
      "SUBDISTRICTS API ERROR:",
      error
    );

    res.status(500).json({
      success: false,
      message: "Failed to load sub-districts",
      error: error.message
    });
  }
});


/* ================================================================
   GET VILLAGES / TOWNS

   Examples:

   /villages-towns?
     stateCode=25&
     districtCode=01&
     subdistrictCode=001
================================================================ */

router.get("/villages-towns", async (req, res) => {
  try {

    const state =
      req.query.state ||
      req.query.stname2027 ||
      req.query.stateName ||
      "";


    const stateCode =
      req.query.stateCode ||
      req.query.stsh2027 ||
      req.query.code ||
      "";


    const district =
      req.query.district ||
      req.query.dtname2027 ||
      req.query.districtName ||
      "";


    const districtCode =
      req.query.districtCode ||
      req.query.revdtsh2027 ||
      "";


    const subdistrict =
      req.query.subdistrict ||
      req.query.sdname2027 ||
      req.query.subdistrictName ||
      "";


    const subdistrictCode =
      req.query.subdistrictCode ||
      req.query.revsdsh2027 ||
      "";


    const conditions = [

      `TRIM(COALESCE(dtname2027, '')) <> ''`,

      `TRIM(COALESCE(revdtsh2027, '')) <> ''`,

      `TRIM(COALESCE(sdname2027, '')) <> ''`,

      `TRIM(COALESCE(revsdsh2027, '')) <> ''`,

      `TRIM(COALESCE(vtname2027, '')) <> ''`,

      `TRIM(COALESCE(revvtsh2027, '')) <> ''`

    ];


    const params = [];


    addStateFilter(
      conditions,
      params,
      state,
      stateCode
    );


    /* ==========================================================
       DISTRICT
    ========================================================== */

    if (
      String(districtCode).trim() !== ""
    ) {

      conditions.push(`
        TRIM(revdtsh2027) = ?
      `);

      params.push(
        String(districtCode).trim()
      );

    } else if (
      String(district).trim() !== ""
    ) {

      conditions.push(`
        LOWER(TRIM(dtname2027)) = LOWER(?)
      `);

      params.push(
        String(district).trim()
      );
    }


    /* ==========================================================
       SUB-DISTRICT
    ========================================================== */

    if (
      String(subdistrictCode).trim() !== ""
    ) {

      conditions.push(`
        TRIM(revsdsh2027) = ?
      `);

      params.push(
        String(subdistrictCode).trim()
      );

    } else if (
      String(subdistrict).trim() !== ""
    ) {

      conditions.push(`
        LOWER(TRIM(sdname2027)) = LOWER(?)
      `);

      params.push(
        String(subdistrict).trim()
      );
    }


    const sql = `
      SELECT

        state_code AS stsh2027,

        state_name AS stname2027,

        district_code AS revdtsh2027,

        district_name AS dtname2027,

        subdistrict_code AS revsdsh2027,

        subdistrict_name AS sdname2027,

        village_town_code AS revvtsh2027,

        village_town_name AS vtname2027,

        rural_urban AS vtru2027

      FROM (

        SELECT DISTINCT

          ${NORMALIZED_STATE_CODE}
            AS state_code,

          TRIM(stname2027)
            AS state_name,

          TRIM(revdtsh2027)
            AS district_code,

          TRIM(dtname2027)
            AS district_name,

          TRIM(revsdsh2027)
            AS subdistrict_code,

          TRIM(sdname2027)
            AS subdistrict_name,

          TRIM(revvtsh2027)
            AS village_town_code,

          TRIM(vtname2027)
            AS village_town_name,

          TRIM(vtru2027)
            AS rural_urban

        FROM rural_urban_view

        WHERE
          ${conditions.join("\nAND ")}

      ) AS villages_towns


      ORDER BY

        CAST(state_code AS UNSIGNED),

        CAST(district_code AS UNSIGNED),

        CAST(subdistrict_code AS UNSIGNED),

        CAST(village_town_code AS UNSIGNED),

        village_town_name
    `;


    const [rows] =
      await db.query(
        sql,
        params
      );


    res.json({
      success: true,
      count: rows.length,
      data: rows
    });

  } catch (error) {

    console.error(
      "VILLAGES/TOWNS API ERROR:",
      error
    );

    res.status(500).json({
      success: false,
      message:
        "Failed to load villages/towns",
      error: error.message
    });
  }
});


/* ================================================================
   GET WARDS

   Examples:

   /wards?
     stateCode=25&
     districtCode=01&
     subdistrictCode=001&
     villageTownCode=0001
================================================================ */

router.get("/wards", async (req, res) => {
  try {

    const state =
      req.query.state ||
      req.query.stname2027 ||
      req.query.stateName ||
      "";


    const stateCode =
      req.query.stateCode ||
      req.query.stsh2027 ||
      req.query.code ||
      "";


    const district =
      req.query.district ||
      req.query.dtname2027 ||
      req.query.districtName ||
      "";


    const districtCode =
      req.query.districtCode ||
      req.query.revdtsh2027 ||
      "";


    const subdistrict =
      req.query.subdistrict ||
      req.query.sdname2027 ||
      req.query.subdistrictName ||
      "";


    const subdistrictCode =
      req.query.subdistrictCode ||
      req.query.revsdsh2027 ||
      "";


    const villageTown =
      req.query.villageTown ||
      req.query.vtname2027 ||
      req.query.villageTownName ||
      "";


    const villageTownCode =
      req.query.villageTownCode ||
      req.query.revvtsh2027 ||
      "";


    const conditions = [

      `TRIM(COALESCE(dtname2027, '')) <> ''`,

      `TRIM(COALESCE(revdtsh2027, '')) <> ''`,

      `TRIM(COALESCE(sdname2027, '')) <> ''`,

      `TRIM(COALESCE(revsdsh2027, '')) <> ''`,

      `TRIM(COALESCE(vtname2027, '')) <> ''`,

      `TRIM(COALESCE(revvtsh2027, '')) <> ''`,

      `TRIM(COALESCE(\`Name ward\`, '')) <> ''`

    ];


    const params = [];


    addStateFilter(
      conditions,
      params,
      state,
      stateCode
    );


    /* ==========================================================
       DISTRICT
    ========================================================== */

    if (
      String(districtCode).trim() !== ""
    ) {

      conditions.push(`
        TRIM(revdtsh2027) = ?
      `);

      params.push(
        String(districtCode).trim()
      );

    } else if (
      String(district).trim() !== ""
    ) {

      conditions.push(`
        LOWER(TRIM(dtname2027)) = LOWER(?)
      `);

      params.push(
        String(district).trim()
      );
    }


    /* ==========================================================
       SUB-DISTRICT
    ========================================================== */

    if (
      String(subdistrictCode).trim() !== ""
    ) {

      conditions.push(`
        TRIM(revsdsh2027) = ?
      `);

      params.push(
        String(subdistrictCode).trim()
      );

    } else if (
      String(subdistrict).trim() !== ""
    ) {

      conditions.push(`
        LOWER(TRIM(sdname2027)) = LOWER(?)
      `);

      params.push(
        String(subdistrict).trim()
      );
    }


    /* ==========================================================
       VILLAGE / TOWN
    ========================================================== */

    if (
      String(villageTownCode).trim() !== ""
    ) {

      conditions.push(`
        TRIM(revvtsh2027) = ?
      `);

      params.push(
        String(villageTownCode).trim()
      );

    } else if (
      String(villageTown).trim() !== ""
    ) {

      conditions.push(`
        LOWER(TRIM(vtname2027)) = LOWER(?)
      `);

      params.push(
        String(villageTown).trim()
      );
    }


    const sql = `
      SELECT

        state_code AS stsh2027,

        state_name AS stname2027,

        district_code AS revdtsh2027,

        district_name AS dtname2027,

        subdistrict_code AS revsdsh2027,

        subdistrict_name AS sdname2027,

        village_town_code AS revvtsh2027,

        village_town_name AS vtname2027,

        rural_urban AS vtru2027,

        ward_name AS \`Name ward\`

      FROM (

        SELECT DISTINCT

          ${NORMALIZED_STATE_CODE}
            AS state_code,

          TRIM(stname2027)
            AS state_name,

          TRIM(revdtsh2027)
            AS district_code,

          TRIM(dtname2027)
            AS district_name,

          TRIM(revsdsh2027)
            AS subdistrict_code,

          TRIM(sdname2027)
            AS subdistrict_name,

          TRIM(revvtsh2027)
            AS village_town_code,

          TRIM(vtname2027)
            AS village_town_name,

          TRIM(vtru2027)
            AS rural_urban,

          TRIM(\`Name ward\`)
            AS ward_name

        FROM rural_urban_view

        WHERE
          ${conditions.join("\nAND ")}

      ) AS wards


      ORDER BY

        CAST(state_code AS UNSIGNED),

        CAST(district_code AS UNSIGNED),

        CAST(subdistrict_code AS UNSIGNED),

        CAST(village_town_code AS UNSIGNED),

        ward_name
    `;


    const [rows] =
      await db.query(
        sql,
        params
      );


    res.json({
      success: true,
      count: rows.length,
      data: rows
    });

  } catch (error) {

    console.error(
      "WARDS API ERROR:",
      error
    );

    res.status(500).json({
      success: false,
      message: "Failed to load wards",
      error: error.message
    });
  }
});


/* ================================================================
   EXPORT
================================================================ */

module.exports = router;