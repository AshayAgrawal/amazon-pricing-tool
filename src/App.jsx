import React, { useMemo, useState } from "react";
import { Calculator, Download, Eye, Pencil, Plus, Settings2, Trash2 } from "lucide-react";
import { REFERRAL_FEE_RULES } from "./referralRules";

const DEFAULT_ASSUMPTIONS = {
  gstOnAmazonFeesPct: 18,
  stepLevel: "Standard",
  shippingRates: {
    "Premium and Advanced": {
      first500g: 53,
      upTo1kg: 73,
      upTo2kg: 110,
      additionalAfter2kg: 34,
      additionalAfter5kg: 18,
    },
    Standard: {
      first500g: 55,
      upTo1kg: 75,
      upTo2kg: 112,
      additionalAfter2kg: 34,
      additionalAfter5kg: 18,
    },
    Basic: {
      first500g: 59,
      upTo1kg: 79,
      upTo2kg: 116,
      additionalAfter2kg: 34,
      additionalAfter5kg: 18,
    },
  },
  closingFeeBands: [
    { upto: 300, fee: 1 },
    { upto: 500, fee: 22 },
    { upto: 1000, fee: 45 },
    { upto: 999999, fee: 76 },
  ],
  referralFeeRules: REFERRAL_FEE_RULES,
};

const DEFAULT_ROW = {
  id: 1,
  productName: "Tote Bag",
  makingCost: 120,
  designCost: 10,
  overheadCost: 50,
  actualWeightG: 600,
  lengthCm: 30,
  breadthCm: 25,
  heightCm: 4,
  referralRule: "Handbags",
  gstPct: 18,
  targetMarginPct: 25,
  marketPrice: 999,
};

const CSV_FIELDS = [
  "productName",
  "makingCost",
  "designCost",
  "overheadCost",
  "actualWeightG",
  "lengthCm",
  "breadthCm",
  "heightCm",
  "referralRule",
  "gstPct",
  "targetMarginPct",
  "marketPrice",
];

function num(value) {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function currency(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);
}

function pct(value) {
  return `${(Number(value) || 0).toFixed(1)}%`;
}

function splitCsvLine(line) {
  const values = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      values.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  values.push(current);
  return values.map((item) => item.trim());
}

function parseCsv(text) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    throw new Error("CSV needs a header row and at least one product row.");
  }

  const headers = splitCsvLine(lines[0]);
  return lines.slice(1).map((line, index) => {
    const values = splitCsvLine(line);
    const mapped = {};
    headers.forEach((header, headerIndex) => {
      mapped[header] = values[headerIndex] ?? "";
    });

    return {
      id: Date.now() + index,
      productName: mapped.productName || `Imported SKU ${index + 1}`,
      makingCost: num(mapped.makingCost),
      designCost: num(mapped.designCost),
      overheadCost: num(mapped.overheadCost),
      actualWeightG: num(mapped.actualWeightG),
      lengthCm: num(mapped.lengthCm),
      breadthCm: num(mapped.breadthCm),
      heightCm: num(mapped.heightCm),
      referralRule: mapped.referralRule || DEFAULT_ASSUMPTIONS.referralFeeRules[0].name,
      gstPct: num(mapped.gstPct || 18),
      targetMarginPct: num(mapped.targetMarginPct || 25),
      marketPrice: num(mapped.marketPrice),
    };
  });
}

function exportCsv(rows) {
  const headers = [
    "Product Name",
    "Referral Rule",
    "GST %",
    "Target Margin %",
    "Market Price",
    "Product Cost",
    "Product GST",
    "Shipping Fee",
    "Referral Fee",
    "Closing Fee",
    "GST On Amazon Fees",
    "Break-even Price",
    "Final Selling Price",
    "Delta Vs Market",
  ];

  const lines = [headers.join(",")];
  rows.forEach((row) => {
    const values = [
      row.productName,
      row.referralRuleApplied,
      row.gstPctApplied,
      row.targetMarginPct,
      row.marketPrice,
      row.productCost,
      row.productGstCost,
      row.shippingFeeAtTarget,
      row.referralFeeAtTarget,
      row.closingFeeAtTarget,
      row.gstOnAmazonFeesAtTarget,
      row.breakEvenPrice,
      row.targetSellingPrice,
      row.marketPriceDelta,
    ].map((value) => `"${String(value ?? "").replaceAll('"', '""')}"`);
    lines.push(values.join(","));
  });

  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "amazon_pricing_recommended_prices.csv";
  anchor.click();
  URL.revokeObjectURL(url);
}

function actualWeightKg(row) {
  return num(row.actualWeightG) / 1000;
}

function volumetricWeightKg(row) {
  return (num(row.lengthCm) * num(row.breadthCm) * num(row.heightCm)) / 5000;
}

function chargeableWeightKg(row) {
  return Math.max(actualWeightKg(row), volumetricWeightKg(row));
}

function shippingFeeFromWeight(weightKg, assumptions) {
  const rates =
    assumptions.shippingRates[assumptions.stepLevel] ||
    assumptions.shippingRates.Standard;

  if (weightKg <= 0.5) return num(rates.first500g);
  if (weightKg <= 1) return num(rates.upTo1kg);
  if (weightKg <= 2) return num(rates.upTo2kg);
  if (weightKg <= 5) {
    return num(rates.upTo2kg) + Math.ceil(weightKg - 2) * num(rates.additionalAfter2kg);
  }
  return (
    num(rates.upTo2kg) +
    3 * num(rates.additionalAfter2kg) +
    Math.ceil(weightKg - 5) * num(rates.additionalAfter5kg)
  );
}

function closingFeeFromPrice(price, assumptions) {
  const bands = assumptions.closingFeeBands
    .map((band) => ({ upto: num(band.upto), fee: num(band.fee) }))
    .sort((a, b) => a.upto - b.upto);

  const match = bands.find((band) => price <= band.upto);
  return match ? match.fee : bands[bands.length - 1]?.fee || 0;
}

function referralRuleForRow(row, assumptions) {
  return (
    assumptions.referralFeeRules.find((rule) => rule.name === row.referralRule) ||
    assumptions.referralFeeRules[0] ||
    { name: "Default", bands: [{ upto: 999999, feePct: 0 }] }
  );
}

function productCost(row) {
  return num(row.makingCost) + num(row.designCost) + num(row.overheadCost);
}

function productGstCost(row) {
  return (productCost(row) * num(row.gstPct)) / 100;
}

function referralPctAppliedForPrice(price, row, assumptions) {
  const rule = referralRuleForRow(row, assumptions);
  const band = (rule.bands || [])
    .map((item) => ({ upto: num(item.upto), feePct: num(item.feePct) }))
    .sort((a, b) => a.upto - b.upto)
    .find((item) => price <= item.upto);
  return band ? band.feePct : 0;
}

function feeSnapshot(price, row, assumptions) {
  const chargeableWeight = Math.max(chargeableWeightKg(row), 0.001);
  const shippingFee = shippingFeeFromWeight(chargeableWeight, assumptions);
  const closingFee = closingFeeFromPrice(price, assumptions);
  const referralPctApplied = referralPctAppliedForPrice(price, row, assumptions);
  const referralFee = (price * referralPctApplied) / 100;
  const feesBeforeGst = shippingFee + closingFee + referralFee;
  const gstOnAmazonFees = (feesBeforeGst * num(assumptions.gstOnAmazonFeesPct)) / 100;

  return {
    shippingFee,
    closingFee,
    referralPctApplied,
    referralFee,
    gstOnAmazonFees,
    totalAmazonFees: feesBeforeGst + gstOnAmazonFees,
  };
}

function totalCostAtPrice(price, row, assumptions) {
  return productCost(row) + productGstCost(row) + feeSnapshot(price, row, assumptions).totalAmazonFees;
}

function solvePrice(row, assumptions, targetMarginPct) {
  let low = 0;
  let high = 50000;

  for (let index = 0; index < 70; index += 1) {
    const mid = (low + high) / 2;
    const targetProfit = (mid * targetMarginPct) / 100;
    const contribution = mid - totalCostAtPrice(mid, row, assumptions) - targetProfit;

    if (contribution >= 0) high = mid;
    else low = mid;
  }

  return high;
}

function computeRow(row, assumptions) {
  const breakEvenPrice = solvePrice(row, assumptions, 0);
  const breakEvenFees = feeSnapshot(breakEvenPrice, row, assumptions);
  const targetSellingPrice = solvePrice(row, assumptions, num(row.targetMarginPct));
  const targetFees = feeSnapshot(targetSellingPrice, row, assumptions);
  const referralRule = referralRuleForRow(row, assumptions);
  const targetProfitAtTarget = (targetSellingPrice * num(row.targetMarginPct)) / 100;

  return {
    ...row,
    chargeableWeightKg: chargeableWeightKg(row),
    productCost: productCost(row),
    productGstCost: productGstCost(row),
    referralRuleApplied: referralRule.name,
    gstPctApplied: num(row.gstPct),
    breakEvenPrice,
    breakEvenAmazonFees: breakEvenFees.totalAmazonFees,
    targetSellingPrice,
    targetProfitAtTarget,
    marketPriceDelta: targetSellingPrice - num(row.marketPrice),
    shippingFeeAtTarget: targetFees.shippingFee,
    closingFeeAtTarget: targetFees.closingFee,
    referralPctAppliedAtTarget: targetFees.referralPctApplied,
    referralFeeAtTarget: targetFees.referralFee,
    gstOnAmazonFeesAtTarget: targetFees.gstOnAmazonFees,
    totalAmazonFeesAtTarget: targetFees.totalAmazonFees,
  };
}

function Metric({ label, value }) {
  return (
    <div className="metric-card">
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}</div>
    </div>
  );
}

function AssumptionField({ label, value, onChange }) {
  return (
    <div className="field">
      <label>{label}</label>
      <input type="number" value={value} onChange={onChange} />
    </div>
  );
}

function formatReferralBands(rule) {
  return (rule.bands || [])
    .map((band, index) => {
      const upperBound = num(band.upto);
      const rate = pct(band.feePct);
      if (index === 0) {
        return `Up to ${currency(upperBound)}: ${rate}`;
      }

      const lowerBound = num(rule.bands[index - 1]?.upto) + 0.01;
      if (upperBound >= 999999) {
        return `Above ${currency(lowerBound)}: ${rate}`;
      }

      return `${currency(lowerBound)} to ${currency(upperBound)}: ${rate}`;
    })
    .join(" | ");
}

function referralBandLabelForPrice(price, rule) {
  const bands = (rule.bands || [])
    .map((band) => ({ upto: num(band.upto), feePct: num(band.feePct) }))
    .sort((a, b) => a.upto - b.upto);

  const matchIndex = bands.findIndex((band) => price <= band.upto);
  if (matchIndex === -1) return "No matching referral slab";

  const match = bands[matchIndex];
  if (matchIndex === 0) {
    return `Up to ${currency(match.upto)}: ${pct(match.feePct)}`;
  }

  const lowerBound = bands[matchIndex - 1].upto + 0.01;
  if (match.upto >= 999999) {
    return `Above ${currency(lowerBound)}: ${pct(match.feePct)}`;
  }

  return `${currency(lowerBound)} to ${currency(match.upto)}: ${pct(match.feePct)}`;
}

export default function App() {
  const [activePage, setActivePage] = useState("pricing");
  const [assumptions, setAssumptions] = useState(DEFAULT_ASSUMPTIONS);
  const [rows, setRows] = useState([DEFAULT_ROW]);
  const [expandedRowId, setExpandedRowId] = useState(DEFAULT_ROW.id);
  const [csvMessage, setCsvMessage] = useState("");
  const [referralSearch, setReferralSearch] = useState("");

  const computedRows = useMemo(() => rows.map((row) => computeRow(row, assumptions)), [rows, assumptions]);

  const updateRow = (id, key, value) => {
    setRows((current) => current.map((row) => (row.id === id ? { ...row, [key]: value } : row)));
  };

  const updateShippingRate = (stepLevel, key, value) => {
    setAssumptions((current) => ({
      ...current,
      shippingRates: {
        ...current.shippingRates,
        [stepLevel]: { ...current.shippingRates[stepLevel], [key]: value },
      },
    }));
  };

  const updateClosingFeeBand = (index, key, value) => {
    setAssumptions((current) => ({
      ...current,
      closingFeeBands: current.closingFeeBands.map((band, i) => (i === index ? { ...band, [key]: value } : band)),
    }));
  };

  const addRow = () => {
    const nextId = Date.now();
    setRows((current) => [...current, { ...DEFAULT_ROW, id: nextId, productName: "" }]);
    setExpandedRowId(nextId);
  };

  const removeRow = (id) => {
    setRows((current) => {
      const nextRows = current.filter((row) => row.id !== id);
      if (expandedRowId === id && nextRows.length > 0) {
        setExpandedRowId(nextRows[0].id);
      }
      return nextRows;
    });
  };

  const handleCsvUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const importedRows = parseCsv(text);
      setRows(importedRows);
      setCsvMessage(`Imported ${importedRows.length} rows from ${file.name}.`);
    } catch (error) {
      setCsvMessage(error.message || "Could not parse CSV.");
    } finally {
      event.target.value = "";
    }
  };

  const filteredReferralRules = useMemo(() => {
    const query = referralSearch.trim().toLowerCase();
    if (!query) return assumptions.referralFeeRules;

    return assumptions.referralFeeRules.filter((rule) => rule.name.toLowerCase().includes(query));
  }, [assumptions.referralFeeRules, referralSearch]);

  return (
    <div className="app-shell">
      <style>{`
        :root { color: #20312d; background: linear-gradient(180deg, #f5efe3 0%, #fbf8f2 100%); font-family: "Avenir Next", "Segoe UI", sans-serif; }
        * { box-sizing: border-box; }
        body { margin: 0; }
        button, input, select { font: inherit; }
        .app-shell { min-height: 100vh; padding: 24px 16px 40px; }
        .page { max-width: 1280px; margin: 0 auto; display: grid; gap: 18px; }
        .hero, .card { background: rgba(255, 252, 247, 0.95); border: 1px solid rgba(32, 49, 45, 0.08); border-radius: 24px; box-shadow: 0 18px 44px rgba(32, 49, 45, 0.07); }
        .hero { padding: 28px; display: flex; flex-wrap: wrap; justify-content: space-between; gap: 16px; background: linear-gradient(145deg, #184f42, #143630); color: #fbf8f2; }
        .hero h1 { margin: 0; font-size: clamp(2rem, 4vw, 3rem); letter-spacing: -0.05em; line-height: 0.98; }
        .hero p { margin: 10px 0 0; max-width: 760px; color: rgba(251, 248, 242, 0.78); line-height: 1.6; }
        .eyebrow { font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.12em; color: rgba(251, 248, 242, 0.7); }
        .toolbar, .page-nav, .section-toolbar { display: flex; flex-wrap: wrap; gap: 10px; }
        .button, .button-ghost, .upload-label, .page-tab { border: none; border-radius: 999px; padding: 12px 18px; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; }
        .button { background: #f1a258; color: #17302b; font-weight: 700; }
        .button-ghost, .upload-label { background: rgba(251, 248, 242, 0.12); color: #fbf8f2; border: 1px solid rgba(251, 248, 242, 0.18); }
        .page-tab { background: rgba(255, 252, 247, 0.78); color: #24423b; border: 1px solid rgba(32, 49, 45, 0.12); }
        .page-tab.active { background: #184f42; border-color: #184f42; color: #fbf8f2; }
        .product-fields, .metric-grid, .subgrid, .result-grid, .formula-grid, .pricing-sections { display: grid; gap: 16px; }
        .product-fields { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .metric-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
        .subgrid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .formula-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
        .result-grid { grid-template-columns: 1.1fr 1fr; gap: 12px; margin-bottom: 14px; }
        .pricing-sections { grid-template-columns: 1fr 1fr; }
        .card { padding: 18px; }
        .section-label, .metric-label { font-size: 0.76rem; text-transform: uppercase; letter-spacing: 0.1em; color: rgba(32, 49, 45, 0.58); }
        .section-copy, .csv-message, .helper { margin-top: 6px; color: rgba(32, 49, 45, 0.62); line-height: 1.5; }
        .helper-highlight {
          margin-top: 10px;
          padding: 10px 12px;
          border-radius: 14px;
          background: rgba(241, 162, 88, 0.14);
          border: 1px solid rgba(241, 162, 88, 0.28);
          color: #24423b;
        }
        .helper-highlight strong { color: #17302b; }
        .calculation-list { display: grid; gap: 8px; margin-top: 12px; }
        .calculation-card {
          padding: 12px;
          border-radius: 16px;
          background: rgba(255, 255, 255, 0.72);
          border: 1px solid rgba(32, 49, 45, 0.08);
        }
        .calculation-expression {
          margin-top: 6px;
          font-weight: 600;
          line-height: 1.6;
          color: #17302b;
        }
        .section-head { margin-bottom: 16px; }
        .section-head h2 { margin: 6px 0 0; font-size: 1.35rem; letter-spacing: -0.03em; }
        .field { display: grid; gap: 6px; }
        .field label { font-size: 0.84rem; color: rgba(32, 49, 45, 0.72); }
        .field input, .field select { width: 100%; border: 1px solid rgba(32, 49, 45, 0.12); border-radius: 14px; padding: 11px 12px; background: white; }
        .products-wrap, .assumptions-wrap { display: grid; gap: 14px; }
        .product-card { border: 1px solid rgba(32, 49, 45, 0.08); border-radius: 20px; padding: 18px; background: rgba(255, 255, 255, 0.85); }
        .product-card.saved { padding: 18px; background: linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(248, 243, 233, 0.96)); }
        .product-head { display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; margin-bottom: 14px; }
        .product-head h3 { margin: 0; font-size: 1.1rem; }
        .saved-grid { display: grid; grid-template-columns: 1.15fr repeat(5, minmax(0, 1fr)) 220px; gap: 10px; align-items: stretch; }
        .saved-actions { display: flex; gap: 10px; align-items: center; }
        .saved-title { display: grid; gap: 4px; }
        .metric-card, .formula-card { background: #f5efe2; border-radius: 16px; padding: 12px; }
        .metric-value { margin-top: 6px; font-weight: 700; }
        .saved-list-card { padding: 18px; }
        .saved-header-row, .saved-item-row { display: grid; grid-template-columns: 1.15fr repeat(5, minmax(0, 1fr)) 220px; gap: 10px; align-items: center; }
        .saved-header-row { margin-top: 16px; }
        .saved-column-head { font-size: 0.76rem; text-transform: uppercase; letter-spacing: 0.1em; color: rgba(32, 49, 45, 0.58); padding: 0 4px; text-align: center; }
        .saved-item-row { padding: 14px 0; border-top: 1px solid rgba(32, 49, 45, 0.08); }
        .saved-item-row:first-of-type { border-top: none; }
        .saved-cell { background: #f5efe2; border-radius: 16px; padding: 12px; }
        .saved-cell-label { font-size: 0.76rem; text-transform: uppercase; letter-spacing: 0.1em; color: rgba(32, 49, 45, 0.58); }
        .saved-cell-value { margin-top: 6px; font-weight: 700; font-size: 1rem; }
        .saved-actions-row { display: flex; justify-content: flex-end; gap: 10px; }
        .result-card { border-radius: 18px; padding: 16px; background: #183f36; color: #fbf8f2; }
        .result-card .metric-label { color: rgba(251, 248, 242, 0.72); }
        .result-card .metric-value { font-size: 1.7rem; letter-spacing: -0.04em; }
        .icon-button { width: 38px; height: 38px; border: 1px solid rgba(32, 49, 45, 0.12); border-radius: 12px; background: white; display: grid; place-items: center; cursor: pointer; }
        .helper-list { margin: 0; padding-left: 18px; color: rgba(32, 49, 45, 0.72); line-height: 1.6; }
        .band-row { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
        .section-box { border: 1px solid rgba(32, 49, 45, 0.08); border-radius: 18px; padding: 14px; background: rgba(245, 239, 226, 0.45); }
        .section-box h4 { margin: 0 0 12px; font-size: 1rem; }
        .section-output { margin-top: 12px; }
        @media (max-width: 1100px) {
          .product-fields, .metric-grid, .subgrid, .result-grid, .formula-grid, .band-row, .pricing-sections, .saved-grid, .saved-header-row, .saved-item-row { grid-template-columns: 1fr; }
          .saved-actions-row { justify-content: flex-start; }
        }
      `}</style>

      <div className="page">
        <section className="hero">
          <div>
            <div className="eyebrow">Pricing Playbook Version</div>
            <h1>Amazon Product Pricing Calculator</h1>
            <p>
              This version calculates final selling price per product using product cost, product GST,
              Amazon charges, target margin, and market comparison.
            </p>
          </div>
        </section>

        <nav className="page-nav">
          <button className={`page-tab ${activePage === "pricing" ? "active" : ""}`} onClick={() => setActivePage("pricing")}>
            <Calculator size={16} /> Pricing
          </button>
          <button className={`page-tab ${activePage === "assumptions" ? "active" : ""}`} onClick={() => setActivePage("assumptions")}>
            <Settings2 size={16} /> Assumptions
          </button>
        </nav>

        {csvMessage ? <div className="csv-message">{csvMessage}</div> : null}

        {activePage === "pricing" ? (
          <>
            <section className="card">
              <div className="section-head">
                <div>
                  <div className="section-label">Pricing</div>
                  <h2>How price is calculated</h2>
                  <div className="section-copy">
                    Product cost + product GST + Amazon charges + target margin = final selling price.
                  </div>
                </div>
              </div>
              <div className="formula-grid">
                <div className="formula-card"><div className="metric-label">1. Product cost</div><div className="helper">Making + design + overhead</div></div>
                <div className="formula-card"><div className="metric-label">2. Taxes and fees</div><div className="helper">Product GST + shipping + referral + closing + GST on Amazon fees</div></div>
                <div className="formula-card"><div className="metric-label">3. Final price</div><div className="helper">Price needed to meet the selected target margin</div></div>
              </div>
              <div className="helper">
                Active assumptions: {assumptions.stepLevel} shipping rates, {pct(assumptions.gstOnAmazonFeesPct)} GST on Amazon fees,
                and referral slabs from your latest Amazon fee sheet.
              </div>
              <div className="csv-message">CSV headers: {CSV_FIELDS.join(", ")}</div>
              <div className="section-output" style={{ display: "flex", justifyContent: "flex-end" }}>
                <button className="button" onClick={addRow}>
                  <Plus size={16} /> Add SKU
                </button>
              </div>
            </section>

            <section className="products-wrap">
              {computedRows.filter((row) => expandedRowId !== row.id).length > 0 ? (
                <section className="card saved-list-card">
                  <div className="product-head" style={{ marginBottom: 0 }}>
                    <h2 style={{ margin: "6px 0 0", fontSize: "1.35rem", letterSpacing: "-0.03em" }}>SKU Price List</h2>
                    <div className="saved-actions">
                      <button className="button" onClick={() => exportCsv(computedRows)}>
                        <Download size={16} /> Download
                      </button>
                    </div>
                  </div>

                  <div className="saved-header-row">
                    <div className="saved-column-head">Product</div>
                    <div className="saved-column-head">Total price</div>
                    <div className="saved-column-head">Margin</div>
                    <div className="saved-column-head">Cost</div>
                    <div className="saved-column-head">Total cost</div>
                    <div className="saved-column-head">Amazon fees</div>
                    <div className="saved-column-head">Actions</div>
                  </div>

                  {computedRows
                    .filter((row) => expandedRowId !== row.id)
                    .map((row) => (
                      <div className="saved-item-row" key={row.id}>
                        <div className="saved-cell">
                          <div className="saved-cell-value">{row.productName || "Untitled SKU"}</div>
                        </div>
                        <div className="saved-cell">
                          <div className="saved-cell-value">{currency(row.targetSellingPrice)}</div>
                        </div>
                        <div className="saved-cell">
                          <div className="saved-cell-value">{pct(row.targetMarginPct)}</div>
                        </div>
                        <div className="saved-cell">
                          <div className="saved-cell-value">{currency(row.productCost)}</div>
                        </div>
                        <div className="saved-cell">
                          <div className="saved-cell-value">{currency(row.productCost + row.productGstCost)}</div>
                        </div>
                        <div className="saved-cell">
                          <div className="saved-cell-value">{currency(row.totalAmazonFeesAtTarget)}</div>
                        </div>
                        <div className="saved-actions-row">
                          <button className="icon-button" onClick={() => setExpandedRowId(row.id)} aria-label="Edit saved SKU" title="Edit saved SKU">
                            <Pencil size={16} />
                          </button>
                          <button className="icon-button" onClick={() => setExpandedRowId(row.id)} aria-label="View SKU details" title="View SKU details">
                            <Eye size={16} />
                          </button>
                          {rows.length > 1 ? (
                            <button className="icon-button" onClick={() => removeRow(row.id)} aria-label="Delete saved SKU" title="Delete saved SKU">
                              <Trash2 size={16} />
                            </button>
                          ) : null}
                        </div>
                      </div>
                    ))}
                </section>
              ) : null}

              {computedRows.map((row) => (
                expandedRowId === row.id ? (
                <article className="product-card" key={row.id}>
                  <div className="product-head">
                    <div>
                      <h3>{row.productName || "Untitled SKU"}</h3>
                      <div className="helper">Use the final selling price as the listing price.</div>
                    </div>
                    <div className="saved-actions">
                      {rows.length > 1 ? (
                        <button className="icon-button" onClick={() => removeRow(row.id)} aria-label="Delete SKU" title="Delete SKU">
                          <Trash2 size={16} />
                        </button>
                      ) : null}
                    </div>
                  </div>

                  <div className="pricing-sections">
                    <div className="section-box">
                      <h4>1. Basic Details</h4>
                      <div className="product-fields">
                        <div className="field">
                          <label>Product name</label>
                          <input value={row.productName} onChange={(event) => updateRow(row.id, "productName", event.target.value)} />
                        </div>
                        <div className="field">
                          <label>Market price</label>
                          <input type="number" value={row.marketPrice} onChange={(event) => updateRow(row.id, "marketPrice", event.target.value)} />
                        </div>
                        <div className="field">
                          <label>Target margin %</label>
                          <input type="number" value={row.targetMarginPct} onChange={(event) => updateRow(row.id, "targetMarginPct", event.target.value)} />
                        </div>
                        <div className="field">
                          <label>GST %</label>
                          <input type="number" value={row.gstPct} onChange={(event) => updateRow(row.id, "gstPct", event.target.value)} />
                        </div>
                      </div>
                    </div>

                    <div className="section-box">
                      <h4>2. Cost Inputs</h4>
                      <div className="product-fields">
                        <div className="field">
                          <label>Making cost</label>
                          <input type="number" value={row.makingCost} onChange={(event) => updateRow(row.id, "makingCost", event.target.value)} />
                        </div>
                        <div className="field">
                          <label>Design cost</label>
                          <input type="number" value={row.designCost} onChange={(event) => updateRow(row.id, "designCost", event.target.value)} />
                        </div>
                        <div className="field">
                          <label>Overhead cost</label>
                          <input type="number" value={row.overheadCost} onChange={(event) => updateRow(row.id, "overheadCost", event.target.value)} />
                        </div>
                      </div>
                      <div className="section-output">
                        <Metric label="Calculated product cost" value={currency(row.productCost)} />
                      </div>
                    </div>

                    <div className="section-box">
                      <h4>3. Amazon Fees</h4>
                      <div className="section-box" style={{ marginTop: 12 }}>
                        <h4>Referral fee</h4>
                        <div className="product-fields">
                          <div className="field">
                            <label>Referral fee category</label>
                            <input
                              list={`referral-categories-${row.id}`}
                              value={row.referralRule}
                              onChange={(event) => updateRow(row.id, "referralRule", event.target.value)}
                              placeholder="Search referral category"
                            />
                            <datalist id={`referral-categories-${row.id}`}>
                              {assumptions.referralFeeRules.map((rule) => (
                                <option key={rule.name} value={rule.name} />
                              ))}
                            </datalist>
                          </div>
                          <Metric label={`Referral fee (${pct(row.referralPctAppliedAtTarget)})`} value={currency(row.referralFeeAtTarget)} />
                        </div>
                        <div className="helper section-output">
                          Selected slabs: {formatReferralBands(referralRuleForRow(row, assumptions))}
                        </div>
                        <div className="helper helper-highlight">
                          Applied referral slab at final selling price:{" "}
                          <strong>{referralBandLabelForPrice(row.targetSellingPrice, referralRuleForRow(row, assumptions))}</strong>
                        </div>
                      </div>
                      <div className="section-box" style={{ marginTop: 12 }}>
                        <h4>Shipping Fee</h4>
                        <div className="product-fields">
                          <div className="field">
                            <label>Weight (g)</label>
                            <input type="number" value={row.actualWeightG} onChange={(event) => updateRow(row.id, "actualWeightG", event.target.value)} />
                          </div>
                          <div className="field">
                            <label>Length (cm)</label>
                            <input type="number" value={row.lengthCm} onChange={(event) => updateRow(row.id, "lengthCm", event.target.value)} />
                          </div>
                          <div className="field">
                            <label>Breadth (cm)</label>
                            <input type="number" value={row.breadthCm} onChange={(event) => updateRow(row.id, "breadthCm", event.target.value)} />
                          </div>
                          <div className="field">
                            <label>Height (cm)</label>
                            <input type="number" value={row.heightCm} onChange={(event) => updateRow(row.id, "heightCm", event.target.value)} />
                          </div>
                        </div>
                        <div className="metric-grid section-output">
                          <Metric label="Chargeable weight" value={`${row.chargeableWeightKg.toFixed(2)} kg`} />
                          <Metric label="Calculated shipping fee" value={currency(row.shippingFeeAtTarget)} />
                        </div>
                      </div>
                      <div className="metric-grid section-output">
                        <Metric label="Closing fee" value={currency(row.closingFeeAtTarget)} />
                        <Metric label="GST on Amazon fees" value={currency(row.gstOnAmazonFeesAtTarget)} />
                        <Metric label="Total Amazon fees" value={currency(row.totalAmazonFeesAtTarget)} />
                      </div>
                    </div>

                    <div className="section-box">
                      <h4>4. Final selling price</h4>
                      <div className="metric-grid">
                        <Metric label="GST" value={`${pct(row.gstPctApplied)} - ${currency(row.productGstCost)}`} />
                        <Metric label="Break even price" value={currency(row.breakEvenPrice)} />
                      </div>
                      <div className="calculation-list">
                        <div className="calculation-card">
                          <div className="metric-label">Break-even calculation</div>
                          <div className="calculation-expression">
                            {currency(row.productCost)} + {currency(row.productGstCost)} + {currency(row.breakEvenAmazonFees)} = {currency(row.breakEvenPrice)}
                          </div>
                          <div className="helper">
                            Product cost + product GST + Amazon fees at break-even price.
                          </div>
                        </div>
                        <div className="calculation-card">
                          <div className="metric-label">Final selling price calculation</div>
                          <div className="calculation-expression">
                            {currency(row.productCost)} + {currency(row.productGstCost)} + {currency(row.totalAmazonFeesAtTarget)} + {currency(row.targetProfitAtTarget)} = {currency(row.targetSellingPrice)}
                          </div>
                          <div className="helper">
                            Product cost + product GST + Amazon fees + target profit at {pct(row.targetMarginPct)} margin.
                          </div>
                        </div>
                      </div>
                      <div className="result-grid section-output">
                        <div className="result-card">
                          <div className="metric-label">Final selling price</div>
                          <div className="metric-value">{currency(row.targetSellingPrice)}</div>
                          <div className="helper" style={{ color: "rgba(251, 248, 242, 0.76)" }}>
                            Generated using this product's target margin of {pct(row.targetMarginPct)}.
                          </div>
                        </div>
                        <div className="metric-card">
                          <div className="metric-label">Delta vs market</div>
                          <div className="metric-value">{currency(row.marketPriceDelta)}</div>
                          <div className="helper">
                            {num(row.marketPrice) > 0 ? `Compared with market price ${currency(row.marketPrice)}` : "Add market price to compare."}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </article>
                ) : null
              ))}
            </section>
          </>
        ) : null}

        {activePage === "assumptions" ? (
          <section className="assumptions-wrap">
            <section className="card">
              <div className="section-head">
                <div>
                  <div className="section-label">General Rules</div>
                  <h2>Shared assumptions</h2>
                  <div className="section-copy">Update these when Amazon changes fee structure.</div>
                </div>
              </div>
              <div className="subgrid">
                <div className="field">
                  <label>GST on Amazon fees %</label>
                  <input type="number" value={assumptions.gstOnAmazonFeesPct} onChange={(event) => setAssumptions((current) => ({ ...current, gstOnAmazonFeesPct: event.target.value }))} />
                </div>
                <div className="field">
                  <label>Default STEP level</label>
                  <select value={assumptions.stepLevel} onChange={(event) => setAssumptions((current) => ({ ...current, stepLevel: event.target.value }))}>
                    {Object.keys(assumptions.shippingRates).map((stepLevel) => <option key={stepLevel} value={stepLevel}>{stepLevel}</option>)}
                  </select>
                </div>
              </div>
            </section>

            <section className="card">
              <div className="section-head">
                <div>
                  <div className="section-label">Shipping Rules</div>
                  <h2>Easy Ship rates</h2>
                </div>
              </div>
              <div className="assumptions-wrap">
                {Object.entries(assumptions.shippingRates).map(([stepLevel, rates]) => (
                  <div className="card" key={stepLevel}>
                    <div className="metric-label">{stepLevel}</div>
                    <div className="subgrid" style={{ marginTop: 12 }}>
                      <AssumptionField label="First 500 g" value={rates.first500g} onChange={(event) => updateShippingRate(stepLevel, "first500g", event.target.value)} />
                      <AssumptionField label="500 g - 1 kg" value={rates.upTo1kg} onChange={(event) => updateShippingRate(stepLevel, "upTo1kg", event.target.value)} />
                      <AssumptionField label="1 kg - 2 kg" value={rates.upTo2kg} onChange={(event) => updateShippingRate(stepLevel, "upTo2kg", event.target.value)} />
                      <AssumptionField label="Each extra kg after 2 kg" value={rates.additionalAfter2kg} onChange={(event) => updateShippingRate(stepLevel, "additionalAfter2kg", event.target.value)} />
                      <AssumptionField label="Each extra kg after 5 kg" value={rates.additionalAfter5kg} onChange={(event) => updateShippingRate(stepLevel, "additionalAfter5kg", event.target.value)} />
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="card">
              <div className="section-head">
                <div>
                  <div className="section-label">Closing Fee Rules</div>
                  <h2>Closing fee bands</h2>
                  <div className="section-copy">Closing fee is picked from the selling price band and added into Amazon fees.</div>
                </div>
              </div>
              <ul className="helper-list">
                <li>Closing fee = fixed fee based on selling price band</li>
                <li>GST on Amazon fees = GST % applied on shipping + referral + closing fee</li>
              </ul>
              <div className="assumptions-wrap" style={{ marginTop: 16 }}>
                {assumptions.closingFeeBands.map((band, index) => (
                  <div className="subgrid" key={`${band.upto}-${index}`}>
                    <AssumptionField label="Selling price up to" value={band.upto} onChange={(event) => updateClosingFeeBand(index, "upto", event.target.value)} />
                    <AssumptionField label="Closing fee" value={band.fee} onChange={(event) => updateClosingFeeBand(index, "fee", event.target.value)} />
                  </div>
                ))}
              </div>
            </section>

            <section className="card">
              <div className="section-head">
                <div>
                  <div className="section-label">Referral Fee Rules</div>
                  <h2>Referral fee categories</h2>
                  <div className="section-copy">Referral fee is selected from the category slab that matches the final selling price.</div>
                </div>
              </div>
              <ul className="helper-list">
                <li>Referral fee = selling price × referral fee %</li>
                <li>The applied % changes automatically based on the selected category and selling price band</li>
              </ul>
              <div className="assumptions-wrap" style={{ marginTop: 16 }}>
                <div className="field">
                  <label>Find referral category</label>
                  <input
                    value={referralSearch}
                    onChange={(event) => setReferralSearch(event.target.value)}
                    placeholder="Search category name"
                  />
                </div>
                <div className="helper">
                  Loaded {assumptions.referralFeeRules.length} referral fee categories from the latest fee sheet.
                </div>
                {filteredReferralRules.map((rule) => (
                  <div className="section-box" key={rule.name}>
                    <div className="metric-label">{rule.name}</div>
                    <div className="helper" style={{ marginTop: 8 }}>
                      {formatReferralBands(rule)}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </section>
        ) : null}
      </div>
    </div>
  );
}
