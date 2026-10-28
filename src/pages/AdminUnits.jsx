import { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import "./AdminUnits.css";

const API_URL = `${
  import.meta.env.VITE_API_URL || "http://localhost:5000/api"
}/administrative-units`;
const ROW_H = 40;
const VIEW_H = 600;
const OVERSCAN = 10;

/* ================= HELPERS ================= */

const clean = (v) => String(v ?? "").trim();
const normalize = (v) => clean(v).toLowerCase();

const padCode = (v, length) => {
  const value = clean(v);
  return value ? value.padStart(length, "0") : "";
};

const numCmp = (a, b) =>
  clean(a).localeCompare(clean(b), undefined, { numeric: true });

const sortByKeys = (keys) => (a, b) => {
  for (const key of keys) {
    const result = numCmp(a[key], b[key]);
    if (result) return result;
  }
  return 0;
};

const uniqueBy = (items, keyFn) => {
  const map = new Map();

  items.forEach((item) => {
    const key = keyFn(item);
    if (!map.has(key)) map.set(key, item);
  });

  return [...map.values()];
};

/* ================= STATE ================= */

const getStateCode = (row) => {
  const name = normalize(row?.stname2027);

  if (name === "gujarat") return "25";

  if (name === "dadra and nagar haveli and daman and diu") {
    return "26";
  }

  return clean(row?.stsh2027);
};

const getStateName = (row) => {
  const code = getStateCode(row);

  if (code === "25") return "Gujarat";

  if (code === "26") {
    return "Dadra and Nagar Haveli and Daman and Diu";
  }

  return clean(row?.stname2027);
};

/* ================= DISTRICT ================= */

const getDistrictCode = (row) => {
  const raw =
    row?.dtsh2027 ??
    row?.DTSH2027 ??
    row?.districtCode ??
    row?.district_code ??
    row?.dtcode2027 ??
    row?.DTCode2027 ??
    row?.["District Code"] ??
    row?.revdtsh2027;

  let code = clean(raw)
    .replace(/^DT[-\s]?/i, "")
    .replace(/^0+(?=\d)/, "");

  if (!code) return "";

  if (getStateCode(row) === "26") {
    const map = { "35": "01", "36": "02", "37": "03" };
    if (map[code]) code = map[code];
  }

  return code.padStart(2, "0");
};

const getDistrictName = (row) => clean(row?.dtname2027);

const isDnhddDistrict = (code, name) => {
  const raw = clean(code).replace(/^DT[-\s]?/i, "");
  const n = normalize(name);

  return (
    ["35", "36", "37", "035", "036", "037"].includes(raw) ||
    n.includes("dadra and nagar haveli") ||
    n.includes("dadra & nagar haveli") ||
    n === "daman" ||
    n === "diu"
  );
};

/* ================= SUB-DISTRICT ================= */

const getSubDistrictCode = (row) =>
  padCode(row?.revsdsh2027 ?? row?.subDistrictCode, 3);

const getSubDistrictName = (row) => clean(row?.sdname2027);

/* ================= VILLAGE / TOWN ================= */

const getVillageTownCode = (row) =>
  padCode(row?.revvtsh2027 ?? row?.code, 4);

const getVillageTownName = (row) =>
  clean(row?.vtname2027 ?? row?.name);

/* ================= WARD ================= */

const getWardName = (row) =>
  clean(row?.["Name ward"] ?? row?.wardName ?? row?.ward_name);

const getWardCode = (row) =>
  clean(
    row?.wardCode ??
      row?.ward_code ??
      row?.["Ward Code"] ??
      row?.wardsh2027 ??
      row?.wardcode2027
  );

/* ================= TABLE COLUMNS ================= */

const COLUMNS = {
  state: [
    ["code", "State Code"],
    ["name", "State / UT Name"],
  ],
  district: [
    ["stateCode", "State Code"],
    ["stateName", "State / UT Name"],
    ["code", "District Code"],
    ["name", "District Name"],
  ],
  subdistrict: [
    ["stateCode", "State Code"],
    ["stateName", "State / UT Name"],
    ["districtCode", "District Code"],
    ["districtName", "District Name"],
    ["code", "Sub-District Code"],
    ["name", "Sub-District Name"],
  ],
  villageTown: [
    ["stateCode", "State Code"],
    ["stateName", "State / UT Name"],
    ["districtCode", "District Code"],
    ["districtName", "District Name"],
    ["subDistrictCode", "Sub-District Code"],
    ["subDistrictName", "Sub-District Name"],
    ["code", "Village / Town Code"],
    ["name", "Village / Town Name"],
    ["type", "Type"],
    ["wardCode", "Ward Code"],
    ["wardName", "Ward Name"],
  ],
  ward: [
    ["stateCode", "State Code"],
    ["stateName", "State / UT Name"],
    ["districtCode", "District Code"],
    ["districtName", "District Name"],
    ["subDistrictCode", "Sub-District Code"],
    ["subDistrictName", "Sub-District Name"],
    ["villageTownCode", "Village / Town Code"],
    ["villageTownName", "Village / Town Name"],
    ["code", "Ward Code"],
    ["name", "Ward Name"],
  ],
};

const SORTABLE_KEYS = ["code", "name", "type"];

/* ================= COMPONENT ================= */

export default function AdminUnits() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [level, setLevel] = useState("state");
  const [tableMode, setTableMode] = useState("all");

  const [selectedState, setSelectedState] = useState(null);
  const [selectedDistrict, setSelectedDistrict] = useState(null);
  const [selectedSubDistrict, setSelectedSubDistrict] = useState(null);
  const [selectedVillageTown, setSelectedVillageTown] = useState(null);
  const [selectedWard, setSelectedWard] = useState(null);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sortBy, setSortBy] = useState("code");
  const [sortDirection, setSortDirection] = useState("asc");

  const [vtRows, setVtRows] = useState([]);
  const [vtScopeTotal, setVtScopeTotal] = useState(0);
  const [vtLoading, setVtLoading] = useState(false);

  const vtCache = useRef(new Map());
  const scrollRef = useRef(null);
  const [scrollTop, setScrollTop] = useState(0);

  /* ================= FETCH MAIN DATA ================= */

  useEffect(() => {
    const controller = new AbortController();

    async function fetchData() {
      try {
        setLoading(true);
        setError("");

        const response = await fetch(API_URL, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`API Error: ${response.status}`);
        }

        const result = await response.json();

        const rows = Array.isArray(result)
          ? result
          : Array.isArray(result.data)
          ? result.data
          : Array.isArray(result.rows)
          ? result.rows
          : [];

        if (!rows.length) {
          throw new Error("No data array found in API response.");
        }

        setData(rows);
      } catch (err) {
        if (err.name !== "AbortError") {
          setError(
            err.message || "Unable to load administrative units."
          );
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    fetchData();

    return () => controller.abort();
  }, []);

  /* ================= DEBOUNCE SEARCH ================= */

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 250);
    return () => clearTimeout(timer);
  }, [search]);

  /* ================= VILLAGE / TOWN API ================= */

  const vtQuery = (countOnly = false) => {
    const params = new URLSearchParams();

    if (selectedState) {
      params.set("stateCode", selectedState.code);
    }

    if (selectedDistrict) {
      params.set("districtCode", selectedDistrict.code);
    }

    if (selectedSubDistrict) {
      params.set("subdistrictCode", selectedSubDistrict.code);
    }

    if (countOnly) params.set("countOnly", "1");

    return params.toString();
  };

  useEffect(() => {
    const controller = new AbortController();

    async function fetchCount() {
      try {
        const response = await fetch(
          `${API_URL}/villages-towns?${vtQuery(true)}`,
          { signal: controller.signal }
        );

        if (!response.ok) return;

        const result = await response.json();
        setVtScopeTotal(Number(result.total || 0));
      } catch (err) {
        if (err.name !== "AbortError") {
          console.error("Village/Town count error:", err);
        }
      }
    }

    fetchCount();

    return () => controller.abort();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedState, selectedDistrict, selectedSubDistrict]);

  useEffect(() => {
    if (level !== "villageTown") return;

    const query = vtQuery();
    const cacheKey = query;

    if (vtCache.current.has(cacheKey)) {
      setVtRows(vtCache.current.get(cacheKey));
      setVtLoading(false);
      return;
    }

    const controller = new AbortController();

    async function fetchVillageTowns() {
      try {
        setVtLoading(true);
        setError("");

        const response = await fetch(
          `${API_URL}/villages-towns?${query}`,
          { signal: controller.signal }
        );

        if (!response.ok) {
          throw new Error(`API Error: ${response.status}`);
        }

        const result = await response.json();

        const rows = (result.data || []).map((row) => ({
          stateCode: clean(row.stsh2027),
          stateName: clean(row.stname2027),
          districtCode: clean(row.revdtsh2027),
          districtName: clean(row.dtname2027),
          subDistrictCode: clean(row.revsdsh2027),
          subDistrictName: clean(row.sdname2027),
          code: clean(row.revvtsh2027),
          name: clean(row.vtname2027),
          type: clean(row.vtru2027),
          wardCode: getWardCode(row),
          wardName: getWardName(row),
        }));

        vtCache.current.set(cacheKey, rows);
        setVtRows(rows);
      } catch (err) {
        if (err.name !== "AbortError") {
          setError(err.message);
        }
      } finally {
        if (!controller.signal.aborted) setVtLoading(false);
      }
    }

    fetchVillageTowns();

    return () => controller.abort();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level, selectedState, selectedDistrict, selectedSubDistrict]);

  /* ================= VALID DATA ================= */

  const validRows = useMemo(
    () =>
      data.filter((row) => {
        const stateCode = getStateCode(row);

        if (stateCode !== "25" && stateCode !== "26") return false;

        if (
          stateCode === "25" &&
          isDnhddDistrict(getDistrictCode(row), getDistrictName(row))
        ) {
          return false;
        }

        return true;
      }),
    [data]
  );

  /* ================= STATE DATA ================= */

  const allStateData = useMemo(
    () =>
      uniqueBy(validRows, (row) => getStateCode(row))
        .map((row) => ({
          code: getStateCode(row),
          name: getStateName(row),
        }))
        .sort((a, b) => numCmp(a.code, b.code)),
    [validRows]
  );

  /* ================= DISTRICT DATA ================= */

  const allDistrictData = useMemo(
    () =>
      uniqueBy(
        validRows.filter(
          (row) => getDistrictCode(row) && getDistrictName(row)
        ),
        (row) => `${getStateCode(row)}-${getDistrictCode(row)}`
      )
        .map((row) => ({
          stateCode: getStateCode(row),
          stateName: getStateName(row),
          code: getDistrictCode(row),
          name: getDistrictName(row),
        }))
        .sort(sortByKeys(["stateCode", "code"])),
    [validRows]
  );

  /* ================= SUB-DISTRICT DATA ================= */

  const allSubDistrictData = useMemo(
    () =>
      uniqueBy(
        validRows.filter(
          (row) =>
            getDistrictCode(row) &&
            getSubDistrictCode(row) &&
            getSubDistrictName(row)
        ),
        (row) =>
          `${getStateCode(row)}-${getDistrictCode(row)}-${getSubDistrictCode(row)}`
      )
        .map((row) => ({
          stateCode: getStateCode(row),
          stateName: getStateName(row),
          districtCode: getDistrictCode(row),
          districtName: getDistrictName(row),
          code: getSubDistrictCode(row),
          name: getSubDistrictName(row),
        }))
        .sort(sortByKeys(["stateCode", "districtCode", "code"])),
    [validRows]
  );

  /* ================= WARD DATA ================= */

  const allWardData = useMemo(
    () =>
      uniqueBy(
        validRows.filter(
          (row) =>
            getDistrictCode(row) &&
            getSubDistrictCode(row) &&
            getVillageTownCode(row) &&
            getWardName(row)
        ),
        (row) =>
          [
            getStateCode(row),
            getDistrictCode(row),
            getSubDistrictCode(row),
            getVillageTownCode(row),
            getWardCode(row),
            getWardName(row),
          ].join("-")
      )
        .map((row) => ({
          stateCode: getStateCode(row),
          stateName: getStateName(row),
          districtCode: getDistrictCode(row),
          districtName: getDistrictName(row),
          subDistrictCode: getSubDistrictCode(row),
          subDistrictName: getSubDistrictName(row),
          villageTownCode: getVillageTownCode(row),
          villageTownName: getVillageTownName(row),
          code: getWardCode(row),
          name: getWardName(row),
        }))
        .sort(
          sortByKeys([
            "stateCode",
            "districtCode",
            "subDistrictCode",
            "villageTownCode",
            "code",
          ])
        ),
    [validRows]
  );

  /* ================= SELECTED DATA ================= */

  const districtData = useMemo(
    () =>
      selectedState
        ? allDistrictData.filter(
            (row) => row.stateCode === selectedState.code
          )
        : allDistrictData,
    [allDistrictData, selectedState]
  );

  const subDistrictData = useMemo(() => {
    if (selectedDistrict) {
      return allSubDistrictData.filter(
        (row) =>
          row.stateCode === selectedDistrict.stateCode &&
          row.districtCode === selectedDistrict.code
      );
    }

    if (selectedState) {
      return allSubDistrictData.filter(
        (row) => row.stateCode === selectedState.code
      );
    }

    return allSubDistrictData;
  }, [allSubDistrictData, selectedState, selectedDistrict]);

  const scopedWardData = useMemo(() => {
    if (selectedVillageTown) {
      return allWardData.filter(
        (row) =>
          row.stateCode === selectedVillageTown.stateCode &&
          row.districtCode === selectedVillageTown.districtCode &&
          row.subDistrictCode === selectedVillageTown.subDistrictCode &&
          row.villageTownCode === selectedVillageTown.code
      );
    }

    if (selectedSubDistrict) {
      return allWardData.filter(
        (row) =>
          row.stateCode === selectedSubDistrict.stateCode &&
          row.districtCode === selectedSubDistrict.districtCode &&
          row.subDistrictCode === selectedSubDistrict.code
      );
    }

    if (selectedDistrict) {
      return allWardData.filter(
        (row) =>
          row.stateCode === selectedDistrict.stateCode &&
          row.districtCode === selectedDistrict.code
      );
    }

    if (selectedState) {
      return allWardData.filter(
        (row) => row.stateCode === selectedState.code
      );
    }

    return allWardData;
  }, [
    allWardData,
    selectedState,
    selectedDistrict,
    selectedSubDistrict,
    selectedVillageTown,
  ]);

  /* ================= TABLE DATA ================= */

  const currentData = useMemo(() => {
    if (level === "state") return allStateData;

    if (level === "district") {
      return tableMode === "all" ? allDistrictData : districtData;
    }

    if (level === "subdistrict") {
      return tableMode === "all"
        ? allSubDistrictData
        : subDistrictData;
    }

    if (level === "villageTown") return vtRows;

    if (level === "ward") {
      return tableMode === "all" ? allWardData : scopedWardData;
    }

    return [];
  }, [
    level,
    tableMode,
    allStateData,
    allDistrictData,
    districtData,
    allSubDistrictData,
    subDistrictData,
    vtRows,
    allWardData,
    scopedWardData,
  ]);

  const filteredTableData = useMemo(() => {
    const query = normalize(debouncedSearch);

    if (!query) return currentData;

    return currentData.filter((item) =>
      [
        item.code,
        item.name,
        item.type,
        item.stateCode,
        item.stateName,
        item.districtCode,
        item.districtName,
        item.subDistrictCode,
        item.subDistrictName,
        item.villageTownCode,
        item.villageTownName,
        item.wardCode,
        item.wardName,
      ].some((value) => normalize(value).includes(query))
    );
  }, [currentData, debouncedSearch]);

  const sortedTableData = useMemo(() => {
    const rows = [...filteredTableData];

    rows.sort((a, b) => {
      const result = numCmp(a[sortBy], b[sortBy]);
      return sortDirection === "asc" ? result : -result;
    });

    return rows;
  }, [filteredTableData, sortBy, sortDirection]);

  /* ================= CONTROLS ================= */

  const resetTableControls = () => {
    setSearch("");
    setDebouncedSearch("");
    setSortBy("code");
    setSortDirection("asc");
  };

  const handleSort = (column) => {
    if (sortBy === column) {
      setSortDirection((prev) =>
        prev === "asc" ? "desc" : "asc"
      );
    } else {
      setSortBy(column);
      setSortDirection("asc");
    }
  };

  const sortIcon = (column) =>
    sortBy === column
      ? sortDirection === "asc"
        ? " ↑"
        : " ↓"
      : " ↕";

  /* ================= COUNT BOX ACTIONS ================= */

  const handleStateBoxClick = () => {
    resetTableControls();
    setLevel("state");
    setTableMode("all");
  };

  const handleDistrictBoxClick = () => {
    resetTableControls();
    setLevel("district");
    setTableMode(selectedState ? "selected" : "all");
  };

  const handleSubDistrictBoxClick = () => {
    resetTableControls();
    setLevel("subdistrict");
    setTableMode(
      selectedDistrict || selectedState ? "selected" : "all"
    );
  };

  const handleVillageTownBoxClick = () => {
    resetTableControls();
    setLevel("villageTown");
    setTableMode(
      selectedSubDistrict || selectedDistrict || selectedState
        ? "selected"
        : "all"
    );
  };

  const handleWardBoxClick = () => {
    resetTableControls();
    setLevel("ward");
    setTableMode(
      selectedVillageTown ||
        selectedSubDistrict ||
        selectedDistrict ||
        selectedState
        ? "selected"
        : "all"
    );
  };

  /* ================= ROW ACTIONS ================= */

  const handleStateRowClick = (item) => {
    resetTableControls();
    setSelectedState({ code: item.code, name: item.name });
    setSelectedDistrict(null);
    setSelectedSubDistrict(null);
    setSelectedVillageTown(null);
    setSelectedWard(null);
    setLevel("district");
    setTableMode("selected");
  };

  const handleDistrictRowClick = (item) => {
    resetTableControls();

    setSelectedState({
      code: item.stateCode,
      name: item.stateName,
    });

    setSelectedDistrict({
      stateCode: item.stateCode,
      code: item.code,
      name: item.name,
    });

    setSelectedSubDistrict(null);
    setSelectedVillageTown(null);
    setSelectedWard(null);
    setLevel("subdistrict");
    setTableMode("selected");
  };

  const handleSubDistrictRowClick = (item) => {
    resetTableControls();

    setSelectedState({
      code: item.stateCode,
      name: item.stateName,
    });

    setSelectedDistrict({
      stateCode: item.stateCode,
      code: item.districtCode,
      name: item.districtName,
    });

    setSelectedSubDistrict({
      stateCode: item.stateCode,
      districtCode: item.districtCode,
      code: item.code,
      name: item.name,
    });

    setSelectedVillageTown(null);
    setSelectedWard(null);
    setLevel("villageTown");
    setTableMode("selected");
  };

  const handleVillageTownRowClick = (item) => {
    resetTableControls();

    setSelectedState({
      code: item.stateCode,
      name: item.stateName,
    });

    setSelectedDistrict({
      stateCode: item.stateCode,
      code: item.districtCode,
      name: item.districtName,
    });

    setSelectedSubDistrict({
      stateCode: item.stateCode,
      districtCode: item.districtCode,
      code: item.subDistrictCode,
      name: item.subDistrictName,
    });

    setSelectedVillageTown({
      stateCode: item.stateCode,
      districtCode: item.districtCode,
      subDistrictCode: item.subDistrictCode,
      code: item.code,
      name: item.name,
      type: item.type,
    });

    setSelectedWard(null);
    setLevel("ward");
    setTableMode("selected");
  };

  const handleWardRowClick = (item) => {
    setSelectedWard({
      stateCode: item.stateCode,
      districtCode: item.districtCode,
      subDistrictCode: item.subDistrictCode,
      villageTownCode: item.villageTownCode,
      code: item.code,
      name: item.name,
    });
  };

  const handleRowClick = (item) => {
    if (level === "state") return handleStateRowClick(item);
    if (level === "district") return handleDistrictRowClick(item);
    if (level === "subdistrict") return handleSubDistrictRowClick(item);
    if (level === "villageTown") return handleVillageTownRowClick(item);
    if (level === "ward") return handleWardRowClick(item);
  };

  /* ================= BACK ================= */

  const handleBack = () => {
    resetTableControls();

    if (level === "ward" && selectedVillageTown) {
      setSelectedWard(null);
      setLevel("villageTown");
      setTableMode("selected");
      return;
    }

    if (level === "villageTown" && selectedSubDistrict) {
      setSelectedVillageTown(null);
      setSelectedWard(null);
      setLevel("subdistrict");
      setTableMode("selected");
      return;
    }

    if (level === "subdistrict" && selectedDistrict) {
      setSelectedSubDistrict(null);
      setSelectedVillageTown(null);
      setSelectedWard(null);
      setLevel("district");
      setTableMode("selected");
      return;
    }

    if (level === "district" && selectedState) {
      setSelectedDistrict(null);
      setSelectedSubDistrict(null);
      setSelectedVillageTown(null);
      setSelectedWard(null);
      setLevel("state");
      setTableMode("all");
      return;
    }

    setLevel("state");
    setTableMode("all");
  };

  /* ================= BREADCRUMBS ================= */

  const handleBreadcrumbState = () => {
    resetTableControls();
    setSelectedState(null);
    setSelectedDistrict(null);
    setSelectedSubDistrict(null);
    setSelectedVillageTown(null);
    setSelectedWard(null);
    setLevel("state");
    setTableMode("all");
  };

  const handleBreadcrumbSelectedState = () => {
    if (!selectedState) return;

    resetTableControls();
    setSelectedDistrict(null);
    setSelectedSubDistrict(null);
    setSelectedVillageTown(null);
    setSelectedWard(null);
    setLevel("district");
    setTableMode("selected");
  };

  const handleBreadcrumbSelectedDistrict = () => {
    if (!selectedDistrict) return;

    resetTableControls();
    setSelectedSubDistrict(null);
    setSelectedVillageTown(null);
    setSelectedWard(null);
    setLevel("subdistrict");
    setTableMode("selected");
  };

  const handleBreadcrumbSelectedSubDistrict = () => {
    if (!selectedSubDistrict) return;

    resetTableControls();
    setSelectedVillageTown(null);
    setSelectedWard(null);
    setLevel("villageTown");
    setTableMode("selected");
  };

  const handleBreadcrumbSelectedVillageTown = () => {
    if (!selectedVillageTown) return;

    resetTableControls();
    setSelectedWard(null);
    setLevel("ward");
    setTableMode("selected");
  };

  /* ================= TABLE TITLE ================= */

  const getLevelTitle = () => {
    if (level === "state") return "State / UT";

    if (level === "district") {
      return tableMode === "selected" && selectedState
        ? `${selectedState.name} - District`
        : "All Districts";
    }

    if (level === "subdistrict") {
      if (tableMode === "selected" && selectedDistrict) {
        return `${selectedDistrict.name} - Sub-District`;
      }

      if (tableMode === "selected" && selectedState) {
        return `${selectedState.name} - Sub-District`;
      }

      return "All Sub-Districts";
    }

    if (level === "villageTown") {
      if (tableMode === "selected" && selectedSubDistrict) {
        return `${selectedSubDistrict.name} - Village / Town`;
      }

      if (tableMode === "selected" && selectedDistrict) {
        return `${selectedDistrict.name} - Village / Town`;
      }

      if (tableMode === "selected" && selectedState) {
        return `${selectedState.name} - Village / Town`;
      }

      return "All Village / Town";
    }

    if (level === "ward") {
      if (tableMode === "selected" && selectedVillageTown) {
        return `${selectedVillageTown.name} - Ward`;
      }

      if (tableMode === "selected" && selectedSubDistrict) {
        return `${selectedSubDistrict.name} - Ward`;
      }

      if (tableMode === "selected" && selectedDistrict) {
        return `${selectedDistrict.name} - Ward`;
      }

      if (tableMode === "selected" && selectedState) {
        return `${selectedState.name} - Ward`;
      }

      return "All Wards";
    }

    return "Administrative Units";
  };

  /* ================= EXCEL ================= */

  const getCurrentExcelRows = () =>
    sortedTableData.map((item, index) => {
      const common = { "Sr. No.": index + 1 };

      if (level === "state") {
        return {
          ...common,
          "State Code": item.code,
          "State / UT Name": item.name,
        };
      }

      if (level === "district") {
        return {
          ...common,
          "State Code": item.stateCode,
          "State / UT Name": item.stateName,
          "District Code": item.code,
          "District Name": item.name,
        };
      }

      if (level === "subdistrict") {
        return {
          ...common,
          "State Code": item.stateCode,
          "State / UT Name": item.stateName,
          "District Code": item.districtCode,
          "District Name": item.districtName,
          "Sub-District Code": item.code,
          "Sub-District Name": item.name,
        };
      }

      if (level === "villageTown") {
        return {
          ...common,
          "State Code": item.stateCode,
          "State / UT Name": item.stateName,
          "District Code": item.districtCode,
          "District Name": item.districtName,
          "Sub-District Code": item.subDistrictCode,
          "Sub-District Name": item.subDistrictName,
          "Village / Town Code": item.code,
          "Village / Town Name": item.name,
          Type: item.type,
          "Ward Code": item.wardCode,
          "Ward Name": item.wardName,
        };
      }

      return {
        ...common,
        "State Code": item.stateCode,
        "State / UT Name": item.stateName,
        "District Code": item.districtCode,
        "District Name": item.districtName,
        "Sub-District Code": item.subDistrictCode,
        "Sub-District Name": item.subDistrictName,
        "Village / Town Code": item.villageTownCode,
        "Village / Town Name": item.villageTownName,
        "Ward Code": item.code,
        "Ward Name": item.name,
      };
    });

  const downloadCurrentExcel = () => {
    const rows = getCurrentExcelRows();
    if (!rows.length) return;

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      "Administrative Units"
    );

    XLSX.writeFile(workbook, `census-2027-${level}.xlsx`);
  };

  const downloadFullDataExcel = () => {
    if (!data.length) return;

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(workbook, worksheet, "Full Data");
    XLSX.writeFile(workbook, "census-2027-full-data.xlsx");
  };

  /* ================= COUNT BOXES ================= */

  const countBoxes = [
    {
      key: "state",
      label: "State / UT",
      name: selectedState?.name || "Select State / UT",
      selected: Boolean(selectedState),
      count: selectedState ? 1 : allStateData.length,
      onClick: handleStateBoxClick,
    },
    {
      key: "district",
      label: "District",
      name: selectedDistrict?.name || "Select District",
      selected: Boolean(selectedDistrict),
      count: districtData.length,
      onClick: handleDistrictBoxClick,
    },
    {
      key: "subdistrict",
      label: "Sub-District",
      name: selectedSubDistrict?.name || "Select Sub-District",
      selected: Boolean(selectedSubDistrict),
      count: subDistrictData.length,
      onClick: handleSubDistrictBoxClick,
    },
    {
      key: "villageTown",
      label: "Village & Town",
      name: selectedVillageTown?.name || "Select Village & Town",
      selected: Boolean(selectedVillageTown),
      count: vtScopeTotal,
      onClick: handleVillageTownBoxClick,
    },
    {
      key: "ward",
      label: "Ward",
      name: selectedWard?.name || "Select Ward",
      selected: Boolean(selectedWard),
      count: scopedWardData.length,
      onClick: handleWardBoxClick,
    },
  ];

  /* ================= VIRTUAL TABLE ================= */

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
    setScrollTop(0);
  }, [
    level,
    tableMode,
    debouncedSearch,
    sortBy,
    sortDirection,
    selectedState,
    selectedDistrict,
    selectedSubDistrict,
    selectedVillageTown,
  ]);

  const renderTable = () => {
    if (loading || (level === "villageTown" && vtLoading)) {
      return (
        <div className="loading-box">
          Loading administrative units...
        </div>
      );
    }

    if (error) {
      return (
        <div className="error-box">
          <strong>Error:</strong> {error}
          <br />
          <span>Please check backend localhost:5000.</span>
        </div>
      );
    }

    if (!sortedTableData.length) {
      return <div className="empty-box">No records found.</div>;
    }

    const total = sortedTableData.length;

    const start = Math.max(
      Math.floor(scrollTop / ROW_H) - OVERSCAN,
      0
    );

    const end = Math.min(
      start + Math.ceil(VIEW_H / ROW_H) + OVERSCAN * 2,
      total
    );

    const visibleRows = sortedTableData.slice(start, end);

    const columns = COLUMNS[level] || [];
    const colSpan = columns.length + 1;

    return (
      <div
        className="table-scroll"
        ref={scrollRef}
        style={{ maxHeight: VIEW_H, overflow: "auto" }}
        onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
      >
        <table className="admin-table">
          <thead>
            <tr>
              <th className="serial-col">Sr. No.</th>

              {columns.map(([key, label]) => (
                <th
                  key={key}
                  className={
                    SORTABLE_KEYS.includes(key) ? "sortable" : ""
                  }
                  onClick={() => {
                    if (SORTABLE_KEYS.includes(key)) handleSort(key);
                  }}
                >
                  {label}

                  {SORTABLE_KEYS.includes(key) && (
                    <span className="sort-icon">
                      {sortIcon(key)}
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {start > 0 && (
              <tr style={{ height: start * ROW_H }}>
                <td
                  colSpan={colSpan}
                  style={{ padding: 0, border: 0 }}
                />
              </tr>
            )}

            {visibleRows.map((item, i) => {
              const index = start + i;

              const isSelected =
                level === "ward" &&
                selectedWard?.code === item.code &&
                selectedWard?.name === item.name;

              return (
                <tr
                  key={`${item.stateCode || ""}-${
                    item.districtCode || ""
                  }-${item.subDistrictCode || ""}-${
                    item.villageTownCode || ""
                  }-${item.code}-${index}`}
                  onClick={() => handleRowClick(item)}
                  className={isSelected ? "selected-row" : ""}
                >
                  <td className="serial-col">{index + 1}</td>

                  {columns.map(([key]) => (
                    <td key={key} className={`${key}-cell`}>
                      {clean(item[key]) || "-"}
                    </td>
                  ))}
                </tr>
              );
            })}

            {end < total && (
              <tr style={{ height: (total - end) * ROW_H }}>
                <td
                  colSpan={colSpan}
                  style={{ padding: 0, border: 0 }}
                />
              </tr>
            )}
          </tbody>
        </table>
      </div>
    );
  };

  /* ================= JSX ================= */

  return (
    <div className="admin-page">
      {/* HEADER */}

      <div className="admin-header">
        <div>
          <h1>Census 2027</h1>
          <p>Administrative Units</p>
        </div>

        <div className="header-actions">
          <button
            type="button"
            className="excel-btn"
            onClick={downloadCurrentExcel}
          >
            <span>⬇</span> Current Excel
          </button>

          <button
            type="button"
            className="excel-btn full-excel-btn"
            onClick={downloadFullDataExcel}
          >
            <span>⬇</span> Full Data Excel
          </button>
        </div>
      </div>

      {/* COUNT BOXES */}

      <div className="count-grid">
        {countBoxes.map((box) => (
          <button
            key={box.key}
            type="button"
            className={`count-box ${
              level === box.key ? "active-box" : ""
            } ${box.selected ? "has-selection" : ""}`}
            onClick={box.onClick}
            aria-label={
              box.selected
                ? `${box.label}: ${box.name}`
                : `${box.label}: ${box.name}, count ${box.count}`
            }
          >
            <span className="count-box-label">{box.label}</span>

            {box.selected ? (
              <span className="count-box-selected">{box.name}</span>
            ) : (
              <>
                <span className="count-box-name">{box.name}</span>
                <strong>{box.count}</strong>
              </>
            )}
          </button>
        ))}
      </div>

      {/* BREADCRUMB */}

      <div className="breadcrumb">
        <button
          type="button"
          onClick={handleBreadcrumbState}
          className={level === "state" ? "breadcrumb-active" : ""}
        >
          State / UT
        </button>

        {selectedState && (
          <>
            <span>›</span>
            <button
              type="button"
              onClick={handleBreadcrumbSelectedState}
              className={
                level === "district" ? "breadcrumb-active" : ""
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
              type="button"
              onClick={handleBreadcrumbSelectedDistrict}
              className={
                level === "subdistrict" ? "breadcrumb-active" : ""
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
              type="button"
              onClick={handleBreadcrumbSelectedSubDistrict}
              className={
                level === "villageTown" ? "breadcrumb-active" : ""
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
              type="button"
              onClick={handleBreadcrumbSelectedVillageTown}
              className={level === "ward" ? "breadcrumb-active" : ""}
            >
              {selectedVillageTown.name}
            </button>
          </>
        )}
      </div>

      {/* TABLE CARD */}

      <div className="table-card">
        <div className="table-header">
          <div>
            <h2>{getLevelTitle()}</h2>
            <p>
              Showing <strong>{sortedTableData.length}</strong> records
            </p>
          </div>

          <div className="table-tools">
            <button
              type="button"
              className="back-btn"
              onClick={handleBack}
            >
              ← Back
            </button>

            <div className="search-box">
              <span>⌕</span>

              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search..."
              />

              {search && (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={() => setSearch("")}
                >
                  ×
                </button>
              )}
            </div>
          </div>
        </div>

        {renderTable()}
      </div>
    </div>
  );
}
