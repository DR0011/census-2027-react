import { useEffect, useMemo, useState } from "react";
import "./AdminUnits.css";

const API_URL =
  "http://localhost:5000/api/administrative-units";

/* =========================================================
   HELPERS
========================================================= */

const clean = (value) =>
  String(value ?? "").trim();

const normalize = (value) =>
  clean(value).toLowerCase();

const uniqueBy = (items, keyFn) => {
  const map = new Map();

  for (const item of items) {
    const key = keyFn(item);

    if (!map.has(key)) {
      map.set(key, item);
    }
  }

  return [...map.values()];
};

/* =========================================================
   STATE CODE
========================================================= */

const getStateCode = (row) => {
  const stateName = normalize(row?.stname2027);

  if (stateName === "gujarat") {
    return "25";
  }

  if (
    stateName ===
    "dadra and nagar haveli and daman and diu"
  ) {
    return "26";
  }

  return clean(row?.stsh2027);
};

/* =========================================================
   CODE HELPERS
========================================================= */

const getDistrictCode = (row) =>
  clean(row?.revdtsh2027);

const getSubDistrictCode = (row) =>
  clean(row?.revsdsh2027);

const getVillageTownCode = (row) =>
  clean(row?.revvtsh2027);

const getWardName = (row) =>
  clean(row?.["Name ward"]);

/* =========================================================
   DNHDD CHECK
========================================================= */

const isDnhddDistrict = (row) => {
  const districtCode =
    getDistrictCode(row);

  const districtName =
    normalize(row?.dtname2027);

  return (
    ["035", "036", "037", "35", "36", "37"].includes(
      districtCode
    ) ||
    [
      "dadra and nagar haveli",
      "daman",
      "diu",
    ].includes(districtName)
  );
};

/* =========================================================
   SORT
========================================================= */

const compareValues = (
  a,
  b,
  field,
  direction
) => {
  let aValue = "";
  let bValue = "";

  if (field === "code") {
    aValue = clean(a?.code);
    bValue = clean(b?.code);

    const aNumber = Number(aValue);
    const bNumber = Number(bValue);

    if (
      !Number.isNaN(aNumber) &&
      !Number.isNaN(bNumber)
    ) {
      return direction === "asc"
        ? aNumber - bNumber
        : bNumber - aNumber;
    }
  } else {
    aValue = normalize(a?.name);
    bValue = normalize(b?.name);
  }

  if (aValue < bValue) {
    return direction === "asc"
      ? -1
      : 1;
  }

  if (aValue > bValue) {
    return direction === "asc"
      ? 1
      : -1;
  }

  return 0;
};

/* =========================================================
   COMPONENT
========================================================= */

export default function AdminUnits() {
  const [data, setData] = useState([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [level, setLevel] =
    useState("state");

  /* =======================================================
     SELECTED LEVELS
  ======================================================= */

  const [selectedState, setSelectedState] =
    useState(null);

  const [selectedDistrict, setSelectedDistrict] =
    useState(null);

  const [
    selectedSubDistrict,
    setSelectedSubDistrict,
  ] = useState(null);

  const [
    selectedVillageTown,
    setSelectedVillageTown,
  ] = useState(null);

  const [
    selectedWard,
    setSelectedWard,
  ] = useState(null);

  /* =======================================================
     SEARCH / SORT
  ======================================================= */

  const [search, setSearch] =
    useState("");

  const [sortField, setSortField] =
    useState("code");

  const [
    sortDirection,
    setSortDirection,
  ] = useState("asc");

  /* =======================================================
     LOAD API
  ======================================================= */

  useEffect(() => {
    const loadAdministrativeData =
      async () => {
        try {
          setLoading(true);
          setError("");

          const response =
            await fetch(API_URL);

          if (!response.ok) {
            throw new Error(
              `HTTP ${response.status}`
            );
          }

          const result =
            await response.json();

          if (!result.success) {
            throw new Error(
              result.message ||
                "Failed to load administrative data"
            );
          }

          const rows = Array.isArray(
            result.data
          )
            ? result.data
            : [];

          setData(rows);
        } catch (err) {
          console.error(
            "ADMINISTRATIVE DATA ERROR:",
            err
          );

          setError(
            err?.message ||
              "Failed to load administrative data"
          );
        } finally {
          setLoading(false);
        }
      };

    loadAdministrativeData();
  }, []);

  /* =======================================================
     STATES
  ======================================================= */

  const stateData = useMemo(() => {
    const rows = data
      .filter((row) => {
        const stateCode =
          getStateCode(row);

        return (
          stateCode === "25" ||
          stateCode === "26"
        );
      })
      .map((row) => {
        const stateCode =
          getStateCode(row);

        return {
          code: stateCode,

          name:
            stateCode === "25"
              ? "Gujarat"
              : "Dadra and Nagar Haveli and Daman and Diu",
        };
      });

    return uniqueBy(
      rows,
      (item) => item.code
    );
  }, [data]);

  /* =======================================================
     DISTRICTS
  ======================================================= */

  const districtData = useMemo(() => {
    if (!selectedState) {
      return [];
    }

    const stateCode =
      clean(selectedState.code);

    const rows = data.filter((row) => {
      const rowStateCode =
        getStateCode(row);

      if (
        rowStateCode !== stateCode
      ) {
        return false;
      }

      const districtCode =
        getDistrictCode(row);

      const districtName =
        clean(row?.dtname2027);

      if (
        districtCode === "" &&
        districtName === ""
      ) {
        return false;
      }

      /* Gujarat */
      if (
        stateCode === "25" &&
        isDnhddDistrict(row)
      ) {
        return false;
      }

      /* DNHDD */
      if (
        stateCode === "26" &&
        !isDnhddDistrict(row)
      ) {
        return false;
      }

      return true;
    });

    const mapped = rows.map((row) => ({
      code: getDistrictCode(row),
      name: clean(row?.dtname2027),
    }));

    return uniqueBy(
      mapped,
      (item) =>
        `${item.code}-${normalize(
          item.name
        )}`
    );
  }, [data, selectedState]);

  /* =======================================================
     SUB DISTRICTS
  ======================================================= */

  const subDistrictData = useMemo(() => {
    if (
      !selectedState ||
      !selectedDistrict
    ) {
      return [];
    }

    const stateCode =
      clean(selectedState.code);

    const districtCode =
      clean(selectedDistrict.code);

    const rows = data.filter((row) => {
      if (
        getStateCode(row) !==
        stateCode
      ) {
        return false;
      }

      if (
        getDistrictCode(row) !==
        districtCode
      ) {
        return false;
      }

      return (
        getSubDistrictCode(row) !==
          "" ||
        clean(row?.sdname2027) !==
          ""
      );
    });

    const mapped = rows.map((row) => ({
      code: getSubDistrictCode(row),
      name: clean(row?.sdname2027),
    }));

    return uniqueBy(
      mapped,
      (item) =>
        `${item.code}-${normalize(
          item.name
        )}`
    );
  }, [
    data,
    selectedState,
    selectedDistrict,
  ]);

  /* =======================================================
     VILLAGE / TOWN
  ======================================================= */

  const villageTownData = useMemo(() => {
    if (
      !selectedState ||
      !selectedDistrict ||
      !selectedSubDistrict
    ) {
      return [];
    }

    const stateCode =
      clean(selectedState.code);

    const districtCode =
      clean(selectedDistrict.code);

    const subDistrictCode =
      clean(selectedSubDistrict.code);

    const rows = data.filter((row) => {
      if (
        getStateCode(row) !==
        stateCode
      ) {
        return false;
      }

      if (
        getDistrictCode(row) !==
        districtCode
      ) {
        return false;
      }

      if (
        getSubDistrictCode(row) !==
        subDistrictCode
      ) {
        return false;
      }

      return (
        getVillageTownCode(row) !==
          "" ||
        clean(row?.vtname2027) !==
          ""
      );
    });

    const mapped = rows.map((row) => ({
      code: getVillageTownCode(row),

      name: clean(
        row?.vtname2027
      ),

      type: clean(
        row?.vtru2027
      ),
    }));

    return uniqueBy(
      mapped,
      (item) =>
        [
          item.code,
          normalize(item.name),
          normalize(item.type),
        ].join("-")
    );
  }, [
    data,
    selectedState,
    selectedDistrict,
    selectedSubDistrict,
  ]);

  /* =======================================================
     WARDS
  ======================================================= */

  const wardData = useMemo(() => {
    if (
      !selectedState ||
      !selectedDistrict ||
      !selectedSubDistrict ||
      !selectedVillageTown
    ) {
      return [];
    }

    const stateCode =
      clean(selectedState.code);

    const districtCode =
      clean(selectedDistrict.code);

    const subDistrictCode =
      clean(selectedSubDistrict.code);

    const villageTownCode =
      clean(selectedVillageTown.code);

    const villageTownName =
      normalize(
        selectedVillageTown.name
      );

    const rows = data.filter((row) => {
      if (
        getStateCode(row) !==
        stateCode
      ) {
        return false;
      }

      if (
        getDistrictCode(row) !==
        districtCode
      ) {
        return false;
      }

      if (
        getSubDistrictCode(row) !==
        subDistrictCode
      ) {
        return false;
      }

      if (
        getVillageTownCode(row) !==
        villageTownCode
      ) {
        return false;
      }

      if (
        normalize(
          row?.vtname2027
        ) !== villageTownName
      ) {
        return false;
      }

      return (
        getWardName(row) !== ""
      );
    });

    const mapped = rows.map(
      (row) => ({
        code: getWardName(row),
        name: getWardName(row),
      })
    );

    return uniqueBy(
      mapped,
      (item) =>
        normalize(item.name)
    );
  }, [
    data,
    selectedState,
    selectedDistrict,
    selectedSubDistrict,
    selectedVillageTown,
  ]);

  /* =======================================================
     TOTAL DISTRICTS
  ======================================================= */

  const totalDistricts =
    useMemo(() => {
      const rows = data.filter(
        (row) => {
          const stateCode =
            getStateCode(row);

          if (
            stateCode !== "25" &&
            stateCode !== "26"
          ) {
            return false;
          }

          if (
            stateCode === "25" &&
            isDnhddDistrict(row)
          ) {
            return false;
          }

          if (
            stateCode === "26" &&
            !isDnhddDistrict(row)
          ) {
            return false;
          }

          return (
            getDistrictCode(row) !==
              "" ||
            clean(
              row?.dtname2027
            ) !== ""
          );
        }
      );

      return uniqueBy(
        rows,
        (row) =>
          [
            getStateCode(row),
            getDistrictCode(row),
            normalize(
              row?.dtname2027
            ),
          ].join("-")
      ).length;
    }, [data]);

  /* =======================================================
     TOTAL SUB DISTRICTS
  ======================================================= */

  const totalSubDistricts =
    useMemo(() => {
      const rows = data.filter(
        (row) => {
          const stateCode =
            getStateCode(row);

          if (
            stateCode !== "25" &&
            stateCode !== "26"
          ) {
            return false;
          }

          if (
            stateCode === "25" &&
            isDnhddDistrict(row)
          ) {
            return false;
          }

          if (
            stateCode === "26" &&
            !isDnhddDistrict(row)
          ) {
            return false;
          }

          return (
            getSubDistrictCode(
              row
            ) !== "" ||
            clean(
              row?.sdname2027
            ) !== ""
          );
        }
      );

      return uniqueBy(
        rows,
        (row) =>
          [
            getStateCode(row),
            getDistrictCode(row),
            getSubDistrictCode(
              row
            ),
            normalize(
              row?.sdname2027
            ),
          ].join("-")
      ).length;
    }, [data]);

  /* =======================================================
     TOTAL VILLAGE / TOWN
  ======================================================= */

  const totalVillageTowns =
    useMemo(() => {
      const rows = data.filter(
        (row) => {
          const stateCode =
            getStateCode(row);

          if (
            stateCode !== "25" &&
            stateCode !== "26"
          ) {
            return false;
          }

          if (
            stateCode === "25" &&
            isDnhddDistrict(row)
          ) {
            return false;
          }

          if (
            stateCode === "26" &&
            !isDnhddDistrict(row)
          ) {
            return false;
          }

          return (
            getVillageTownCode(
              row
            ) !== "" ||
            clean(
              row?.vtname2027
            ) !== ""
          );
        }
      );

      return uniqueBy(
        rows,
        (row) =>
          [
            getStateCode(row),
            getDistrictCode(row),
            getSubDistrictCode(
              row
            ),
            getVillageTownCode(
              row
            ),
            normalize(
              row?.vtname2027
            ),
          ].join("-")
      ).length;
    }, [data]);

  /* =======================================================
     TOTAL WARDS
  ======================================================= */

  const totalWards = useMemo(() => {
    const rows = data.filter(
      (row) => {
        const stateCode =
          getStateCode(row);

        if (
          stateCode !== "25" &&
          stateCode !== "26"
        ) {
          return false;
        }

        if (
          stateCode === "25" &&
          isDnhddDistrict(row)
        ) {
          return false;
        }

        if (
          stateCode === "26" &&
          !isDnhddDistrict(row)
        ) {
          return false;
        }

        return (
          getWardName(row) !== ""
        );
      }
    );

    return uniqueBy(
      rows,
      (row) =>
        [
          getStateCode(row),
          getDistrictCode(row),
          getSubDistrictCode(
            row
          ),
          getVillageTownCode(
            row
          ),
          normalize(
            row?.vtname2027
          ),
          normalize(
            getWardName(row)
          ),
        ].join("-")
    ).length;
  }, [data]);

  /* =======================================================
     CURRENT LIST
  ======================================================= */

  const currentData = useMemo(() => {
    let result = [];

    if (level === "state") {
      result = stateData;
    }

    if (level === "district") {
      result = districtData;
    }

    if (level === "subdistrict") {
      result = subDistrictData;
    }

    if (level === "villageTown") {
      result = villageTownData;
    }

    if (level === "ward") {
      result = wardData;
    }

    if (search.trim() !== "") {
      const searchValue =
        normalize(search);

      result = result.filter(
        (item) =>
          normalize(
            item.name
          ).includes(
            searchValue
          ) ||
          normalize(
            item.code
          ).includes(
            searchValue
          )
      );
    }

    return [...result].sort(
      (a, b) =>
        compareValues(
          a,
          b,
          sortField,
          sortDirection
        )
    );
  }, [
    level,
    stateData,
    districtData,
    subDistrictData,
    villageTownData,
    wardData,
    search,
    sortField,
    sortDirection,
  ]);

  /* =======================================================
     COUNT BOX COUNTS
  ======================================================= */

  const stateBoxCount = selectedState
    ? districtData.length
    : stateData.length;

  const districtBoxCount =
    selectedDistrict
      ? subDistrictData.length
      : selectedState
      ? districtData.length
      : totalDistricts;

  const subDistrictBoxCount =
    selectedSubDistrict
      ? villageTownData.length
      : selectedDistrict
      ? subDistrictData.length
      : totalSubDistricts;

  const villageTownBoxCount =
    selectedVillageTown
      ? wardData.length
      : selectedSubDistrict
      ? villageTownData.length
      : totalVillageTowns;

  const wardBoxCount =
    selectedVillageTown
      ? wardData.length
      : totalWards;

  /* =======================================================
     SORT HANDLER
  ======================================================= */

  const handleSort = (field) => {
    if (
      sortField === field
    ) {
      setSortDirection(
        (previous) =>
          previous === "asc"
            ? "desc"
            : "asc"
      );
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  /* =======================================================
     STATE CLICK
  ======================================================= */

  const handleStateClick = (
    state
  ) => {
    const code =
      clean(state.code);

    if (
      code !== "25" &&
      code !== "26"
    ) {
      return;
    }

    setSelectedState({
      code,

      name:
        code === "25"
          ? "Gujarat"
          : "Dadra and Nagar Haveli and Daman and Diu",
    });

    setSelectedDistrict(null);
    setSelectedSubDistrict(null);
    setSelectedVillageTown(null);
    setSelectedWard(null);

    setSearch("");

    setSortField("code");
    setSortDirection("asc");

    setLevel("district");
  };

  /* =======================================================
     DISTRICT CLICK
  ======================================================= */

  const handleDistrictClick = (
    district
  ) => {
    setSelectedDistrict({
      code: clean(
        district.code
      ),

      name: clean(
        district.name
      ),
    });

    setSelectedSubDistrict(null);
    setSelectedVillageTown(null);
    setSelectedWard(null);

    setSearch("");

    setSortField("code");
    setSortDirection("asc");

    setLevel("subdistrict");
  };

  /* =======================================================
     SUB DISTRICT CLICK
  ======================================================= */

  const handleSubDistrictClick = (
    subDistrict
  ) => {
    setSelectedSubDistrict({
      code: clean(
        subDistrict.code
      ),

      name: clean(
        subDistrict.name
      ),
    });

    setSelectedVillageTown(null);
    setSelectedWard(null);

    setSearch("");

    setSortField("code");
    setSortDirection("asc");

    setLevel("villageTown");
  };

  /* =======================================================
     VILLAGE / TOWN CLICK
  ======================================================= */

  const handleVillageTownClick = (
    villageTown
  ) => {
    setSelectedVillageTown({
      code: clean(
        villageTown.code
      ),

      name: clean(
        villageTown.name
      ),

      type: clean(
        villageTown.type
      ),
    });

    setSelectedWard(null);

    setSearch("");

    setSortField("code");
    setSortDirection("asc");

    setLevel("ward");
  };

  /* =======================================================
     WARD CLICK
  ======================================================= */

  const handleWardClick = (
    ward
  ) => {
    setSelectedWard({
      code: clean(ward.code),
      name: clean(ward.name),
    });

    setSearch("");

    setSortField("code");
    setSortDirection("asc");
  };

  /* =======================================================
     ROW CLICK
  ======================================================= */

  const handleItemClick = (
    item
  ) => {
    if (level === "state") {
      handleStateClick(item);
      return;
    }

    if (level === "district") {
      handleDistrictClick(item);
      return;
    }

    if (
      level === "subdistrict"
    ) {
      handleSubDistrictClick(
        item
      );
      return;
    }

    if (
      level === "villageTown"
    ) {
      handleVillageTownClick(
        item
      );
      return;
    }

    if (level === "ward") {
      handleWardClick(item);
    }
  };

  /* =======================================================
     BACK
  ======================================================= */

  const handleBack = () => {
    setSearch("");

    setSortField("code");
    setSortDirection("asc");

    if (level === "ward") {
      setSelectedWard(null);
      setSelectedVillageTown(null);

      setLevel(
        "villageTown"
      );

      return;
    }

    if (
      level === "villageTown"
    ) {
      setSelectedSubDistrict(null);
      setSelectedVillageTown(null);
      setSelectedWard(null);

      setLevel(
        "subdistrict"
      );

      return;
    }

    if (
      level === "subdistrict"
    ) {
      setSelectedDistrict(null);
      setSelectedSubDistrict(null);
      setSelectedVillageTown(null);
      setSelectedWard(null);

      setLevel("district");

      return;
    }

    if (
      level === "district"
    ) {
      setSelectedState(null);
      setSelectedDistrict(null);
      setSelectedSubDistrict(null);
      setSelectedVillageTown(null);
      setSelectedWard(null);

      setLevel("state");
    }
  };

  /* =======================================================
     BREADCRUMB - STATE
  ======================================================= */

  const goState = () => {
    setSelectedState(null);
    setSelectedDistrict(null);
    setSelectedSubDistrict(null);
    setSelectedVillageTown(null);
    setSelectedWard(null);

    setSearch("");

    setSortField("code");
    setSortDirection("asc");

    setLevel("state");
  };

  /* =======================================================
     BREADCRUMB - DISTRICT
  ======================================================= */

  const goDistrict = () => {
    if (!selectedState) {
      goState();
      return;
    }

    setSelectedDistrict(null);
    setSelectedSubDistrict(null);
    setSelectedVillageTown(null);
    setSelectedWard(null);

    setSearch("");

    setSortField("code");
    setSortDirection("asc");

    setLevel("district");
  };

  /* =======================================================
     BREADCRUMB - SUB DISTRICT
  ======================================================= */

  const goSubDistrict = () => {
    if (!selectedState) {
      goState();
      return;
    }

    if (!selectedDistrict) {
      goDistrict();
      return;
    }

    setSelectedSubDistrict(null);
    setSelectedVillageTown(null);
    setSelectedWard(null);

    setSearch("");

    setSortField("code");
    setSortDirection("asc");

    setLevel("subdistrict");
  };

  /* =======================================================
     BREADCRUMB - VILLAGE / TOWN
  ======================================================= */

  const goVillageTown = () => {
    if (!selectedState) {
      goState();
      return;
    }

    if (!selectedDistrict) {
      goDistrict();
      return;
    }

    if (!selectedSubDistrict) {
      goSubDistrict();
      return;
    }

    setSelectedVillageTown(null);
    setSelectedWard(null);

    setSearch("");

    setSortField("code");
    setSortDirection("asc");

    setLevel("villageTown");
  };

  /* =======================================================
     BREADCRUMB - WARD
  ======================================================= */

  const goWard = () => {
    if (!selectedState) {
      goState();
      return;
    }

    if (!selectedDistrict) {
      goDistrict();
      return;
    }

    if (!selectedSubDistrict) {
      goSubDistrict();
      return;
    }

    if (!selectedVillageTown) {
      goVillageTown();
      return;
    }

    setSearch("");

    setSortField("code");
    setSortDirection("asc");

    setLevel("ward");
  };

  /* =======================================================
     TABLE TITLE
  ======================================================= */

  const getTableTitle = () => {
    if (level === "state") {
      return "State / UT";
    }

    if (level === "district") {
      return (
        selectedState?.name ||
        "District"
      );
    }

    if (
      level === "subdistrict"
    ) {
      return (
        selectedDistrict?.name ||
        "Sub-District"
      );
    }

    if (
      level === "villageTown"
    ) {
      return (
        selectedSubDistrict?.name ||
        "Village & Town"
      );
    }

    return (
      selectedVillageTown?.name ||
      "Ward"
    );
  };

  /* =======================================================
     LOADING
  ======================================================= */

  if (loading) {
    return (
      <div className="admin-page">
        <div className="loading-box">
          Loading administrative data...
        </div>
      </div>
    );
  }

  /* =======================================================
     ERROR
  ======================================================= */

  if (error) {
    return (
      <div className="admin-page">
        <div className="error-box">
          <h3>
            Failed to load administrative data
          </h3>

          <p>{error}</p>

          <button
            onClick={() =>
              window.location.reload()
            }
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  /* =======================================================
     MAIN UI
  ======================================================= */

  return (
    <div className="admin-page">

      {/* =================================================
          HEADER
      ================================================= */}

      <div className="admin-header">
        <div>
          <h1>
            Census 2027
          </h1>

          <p>
            Administrative Units
          </p>
        </div>
      </div>

      {/* =================================================
          COUNT BOXES
          
          IMPORTANT:
          Selected level = ONLY NAME
          Unselected level = NAME + COUNT
      ================================================= */}

      <div className="count-grid">

        {/* ================= STATE / UT ================= */}

        <div className={`count-box ${selectedState ? "selected-box" : ""}`}>
          <span className="count-label">State / UT</span>
          {selectedState ? (
            <strong className="selected-name">{selectedState.name}</strong>
          ) : (
            <strong>{stateBoxCount}</strong>
          )}
        </div>

        {/* ================= DISTRICT ================= */}

        <div className={`count-box ${selectedDistrict ? "selected-box" : ""}`}>
          <span className="count-label">District</span>
          {selectedDistrict ? (
            <strong className="selected-name">{selectedDistrict.name}</strong>
          ) : (
            <strong>{districtBoxCount}</strong>
          )}
        </div>

        {/* ================= SUB DISTRICT ================= */}

        <div className={`count-box ${selectedSubDistrict ? "selected-box" : ""}`}>
          <span className="count-label">Sub-District</span>
          {selectedSubDistrict ? (
            <strong className="selected-name">{selectedSubDistrict.name}</strong>
          ) : (
            <strong>{subDistrictBoxCount}</strong>
          )}
        </div>

        {/* ================= VILLAGE / TOWN ================= */}

        <div className={`count-box ${selectedVillageTown ? "selected-box" : ""}`}>
          <span className="count-label">Village & Town</span>
          {selectedVillageTown ? (
            <strong className="selected-name">{selectedVillageTown.name}</strong>
          ) : (
            <strong>{villageTownBoxCount}</strong>
          )}
        </div>

        {/* ================= WARD ================= */}

        <div className={`count-box ${selectedWard ? "selected-box" : ""}`}>
          <span className="count-label">Ward</span>
          {selectedWard ? (
            <strong className="selected-name">{selectedWard.name}</strong>
          ) : (
            <strong>{wardBoxCount}</strong>
          )}
        </div>

      </div>

      {/* =================================================
          BREADCRUMB
      ================================================= */}

      <div className="breadcrumb">

        <button
          onClick={goState}
          className={
            level === "state"
              ? "active"
              : ""
          }
        >
          State / UT
        </button>

        {selectedState && (
          <>
            <span>›</span>

            <button
              onClick={goDistrict}
              className={
                level === "district"
                  ? "active"
                  : ""
              }
            >
              {selectedState.name}
            </button>
          </>
        )}

        {selectedDistrict && (
          <>
            <span>›</span>

            <button
              onClick={
                goSubDistrict
              }
              className={
                level ===
                "subdistrict"
                  ? "active"
                  : ""
              }
            >
              {selectedDistrict.name}
            </button>
          </>
        )}

        {selectedSubDistrict && (
          <>
            <span>›</span>

            <button
              onClick={
                goVillageTown
              }
              className={
                level ===
                "villageTown"
                  ? "active"
                  : ""
              }
            >
              {selectedSubDistrict.name}
            </button>
          </>
        )}

        {selectedVillageTown && (
          <>
            <span>›</span>

            <button
              onClick={goWard}
              className={
                level === "ward"
                  ? "active"
                  : ""
              }
            >
              {selectedVillageTown.name}
            </button>
          </>
        )}

        {selectedWard && (
          <>
            <span>›</span>

            <button className="active">
              {selectedWard.name}
            </button>
          </>
        )}

      </div>

      {/* =================================================
          TOOLBAR
      ================================================= */}

      <div className="toolbar">

        {level !== "state" && (
          <button
            className="back-button"
            onClick={handleBack}
          >
            ← Back
          </button>
        )}

        <div className="search-box">
          <input
            type="text"
            value={search}
            onChange={(event) =>
              setSearch(
                event.target.value
              )
            }
            placeholder={`Search ${getTableTitle()}...`}
          />
        </div>

      </div>

      {/* =================================================
          TABLE CARD
      ================================================= */}

      <div className="table-card">

        <div className="table-card-header">

          <div>

            <h2>
              {getTableTitle()}
            </h2>

            <p>
              {currentData.length} record
              {currentData.length !==
              1
                ? "s"
                : ""}
            </p>

          </div>

        </div>

        {/* =================================================
            DESKTOP TABLE
        ================================================= */}

        <div className="desktop-table">

          <table>

            <thead>

              <tr>

                <th>
                  Sr. No.
                </th>

                <th
                  className="sortable"
                  onClick={() =>
                    handleSort("code")
                  }
                >
                  Code

                  {sortField ===
                    "code" &&
                    (sortDirection ===
                    "asc"
                      ? " ↑"
                      : " ↓")}
                </th>

                <th
                  className="sortable"
                  onClick={() =>
                    handleSort("name")
                  }
                >
                  Name

                  {sortField ===
                    "name" &&
                    (sortDirection ===
                    "asc"
                      ? " ↑"
                      : " ↓")}
                </th>

                {level ===
                  "villageTown" && (
                  <th>
                    Type
                  </th>
                )}

              </tr>

            </thead>

            <tbody>

              {currentData.length ===
              0 ? (
                <tr>

                  <td
                    colSpan={
                      level ===
                      "villageTown"
                        ? 4
                        : 3
                    }
                    className="no-data"
                  >
                    No data found
                  </td>

                </tr>
              ) : (
                currentData.map(
                  (
                    item,
                    index
                  ) => (
                    <tr
                      key={`${item.code}-${item.name}-${index}`}
                      className={
                        level !==
                        "ward"
                          ? "clickable-row"
                          : "clickable-row"
                      }
                      onClick={() =>
                        handleItemClick(
                          item
                        )
                      }
                    >

                      <td>
                        {index + 1}
                      </td>

                      <td>
                        {item.code ||
                          "-"}
                      </td>

                      <td>

                        <span className="clickable-name">
                          {item.name ||
                            "-"}
                        </span>

                      </td>

                      {level ===
                        "villageTown" && (
                        <td>
                          {item.type ||
                            "-"}
                        </td>
                      )}

                    </tr>
                  )
                )
              )}

            </tbody>

          </table>

        </div>

        {/* =================================================
            MOBILE / TABLET
            Same table is used at every screen size.
            CSS below makes this area horizontally scrollable.
        ================================================= */}

      </div>

    </div>
  );
}