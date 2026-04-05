import React, { useMemo, useState } from "react";
import { Calculator, Download, Plus, Settings2, Trash2, Upload } from "lucide-react";

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
  referralFeeRules: [
    { name: "Handbags", feePct: 12, zeroBelowPrice: 1000 },
    { name: "Backpacks", feePct: 14.5, zeroBelowPrice: 0 },
  ],
  gstRules: [
    { name: "Bags", hsnCode: "42022220", productTaxCode: "A_GEN_STANDARD", gstPct: 18 },
    { name: "Exempt", hsnCode: "", productTaxCode: "A_GEN_EXEMPT", gstPct: 0 },
  ],
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
  gstRule: "Bags",
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
  "gstRule",
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
      gstRule: mapped.gstRule || DEFAULT_ASSUMPTIONS.gstRules[0].name,
      targetMarginPct: num(mapped.targetMarginPct || 25),
      marketPrice: num(mapped.marketPrice),
    };
  });
}

function exportCsv(rows) {
  const headers = [
    "Product Name",
    "Referral Rule",
    "GST Rule",
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
      row.gstRuleApplied,
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
    { name: "Default", feePct: 0, zeroBelowPrice: 0 }
  );
}

function gstRuleForRow(row, assumptions) {
  return (
    assumptions.gstRules.find((rule) => rule.name === row.gstRule) ||
    assumptions.gstRules[0] ||
    { name: "Default", hsnCode: "", productTaxCode: "", gstPct: 0 }
  );
}

function productCost(row) {
  return num(row.makingCost) + num(row.designCost) + num(row.overheadCost);
}

function productGstCost(row, assumptions) {
  return (productCost(row) * num(gstRuleForRow(row, assumptions).gstPct)) / 100;
}

function referralPctAppliedForPrice(price, row, assumptions) {
  const rule = referralRuleForRow(row, assumptions);
  if (num(rule.zeroBelowPrice) > 0 && price <= num(rule.zeroBelowPrice)) {
    return 0;
  }
  return num(rule.feePct);
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
  return productCost(row) + productGstCost(row, assumptions) + feeSnapshot(price, row, assumptions).totalAmazonFees;
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
  const targetSellingPrice = solvePrice(row, assumptions, num(row.targetMarginPct));
  const targetFees = feeSnapshot(targetSellingPrice, row, assumptions);
  const referralRule = referralRuleForRow(row, assumptions);
  const gstRule = gstRuleForRow(row, assumptions);

  return {
    ...row,
    chargeableWeightKg: chargeableWeightKg(row),
    productCost: productCost(row),
    productGstCost: productGstCost(row, assumptions),
    referralRuleApplied: referralRule.name,
    gstRuleApplied: gstRule.name,
    hsnCodeApplied: gstRule.hsnCode,
    productTaxCodeApplied: gstRule.productTaxCode,
    gstPctApplied: gstRule.gstPct,
    breakEvenPrice,
    targetSellingPrice,
    marketPriceDelta: targetSellingPrice - num(row.marketPrice),
    shippingFeeAtTarget: targetFees.shippingFee,
    closingFeeAtTarget: targetFees.closingFee,
    referralPctAppliedAtTarget: targetFees.referralPctApplied,
    referralFeeAtTarget: targetFees.referralFee,
    gstOnAmazonFeesAtTarget: targetFees.gstOnAmazonFees,
    totalAmazonFeesAtTarget: targetFees.totalAmazonFees,
  };
}

function SummaryCard({ label, value, hint }) {
  return (
    <div className="summary-card">
      <div className="summary-label">{label}</div>
      <div className="summary-value">{value}</div>
      <div className="summary-hint">{hint}</div>
    </div>
  );
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

export default function App() {
  const [activePage, setActivePage] = useState("pricing");
  const [assumptions, setAssumptions] = useState(DEFAULT_ASSUMPTIONS);
  const [rows, setRows] = useState([DEFAULT_ROW]);
  const [csvMessage, setCsvMessage] = useState("");

  const computedRows = useMemo(() => rows.map((row) => computeRow(row, assumptions)), [rows, assumptions]);

  const totals = useMemo(() => {
    const avgTarget =
      computedRows.length > 0
        ? computedRows.reduce((sum, row) => sum + row.targetSellingPrice, 0) / computedRows.length
        : 0;
    return {
      skuCount: computedRows.length,
      avgTarget,
      highestTarget: Math.max(0, ...computedRows.map((row) => row.targetSellingPrice)),
      lowestTarget: computedRows.length > 0 ? Math.min(...computedRows.map((row) => row.targetSellingPrice)) : 0,
    };
  }, [computedRows]);

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

  const updateReferralFeeRule = (index, key, value) => {
    setAssumptions((current) => ({
      ...current,
      referralFeeRules: current.referralFeeRules.map((rule, i) => (i === index ? { ...rule, [key]: value } : rule)),
    }));
  };

  const updateGstRule = (index, key, value) => {
    setAssumptions((current) => ({
      ...current,
      gstRules: current.gstRules.map((rule, i) => (i === index ? { ...rule, [key]: value } : rule)),
    }));
  };

  const addReferralFeeRule = () => {
    setAssumptions((current) => ({
      ...current,
      referralFeeRules: [...current.referralFeeRules, { name: "New category", feePct: 0, zeroBelowPrice: 0 }],
    }));
  };

  const addGstRule = () => {
    setAssumptions((current) => ({
      ...current,
      gstRules: [...current.gstRules, { name: "New GST rule", hsnCode: "", productTaxCode: "", gstPct: 18 }],
    }));
  };

  const addRow = () => {
    setRows((current) => [...current, { ...DEFAULT_ROW, id: Date.now(), productName: "" }]);
  };

  const removeRow = (id) => {
    setRows((current) => current.filter((row) => row.id !== id));
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

  return (
    <div className="app-shell">
      <style>{`
        :root { color: #20312d; background: linear-gradient(180deg, #f5efe3 0%, #fbf8f2 100%); font-family: "Avenir Next", "Segoe UI", sans-serif; }
        * { box-sizing: border-box; }
        body { margin: 0; }
        button, input, select { font: inherit; }
        .app-shell { min-height: 100vh; padding: 24px 16px 40px; }
        .page { max-width: 1280px; margin: 0 auto; display: grid; gap: 18px; }
        .hero, .card, .summary-card { background: rgba(255, 252, 247, 0.95); border: 1px solid rgba(32, 49, 45, 0.08); border-radius: 24px; box-shadow: 0 18px 44px rgba(32, 49, 45, 0.07); }
        .hero { padding: 28px; display: flex; flex-wrap: wrap; justify-content: space-between; gap: 16px; background: linear-gradient(145deg, #184f42, #143630); color: #fbf8f2; }
        .hero h1 { margin: 0; font-size: clamp(2rem, 4vw, 3rem); letter-spacing: -0.05em; line-height: 0.98; }
        .hero p { margin: 10px 0 0; max-width: 760px; color: rgba(251, 248, 242, 0.78); line-height: 1.6; }
        .eyebrow { font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.12em; color: rgba(251, 248, 242, 0.7); }
        .toolbar, .page-nav { display: flex; flex-wrap: wrap; gap: 10px; }
        .button, .button-ghost, .upload-label, .page-tab { border: none; border-radius: 999px; padding: 12px 18px; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; }
        .button { background: #f1a258; color: #17302b; font-weight: 700; }
        .button-ghost, .upload-label { background: rgba(251, 248, 242, 0.12); color: #fbf8f2; border: 1px solid rgba(251, 248, 242, 0.18); }
        .page-tab { background: rgba(255, 252, 247, 0.78); color: #24423b; border: 1px solid rgba(32, 49, 45, 0.12); }
        .page-tab.active { background: #184f42; border-color: #184f42; color: #fbf8f2; }
        .summary-grid, .product-fields, .metric-grid, .subgrid, .result-grid, .formula-grid, .pricing-sections { display: grid; gap: 16px; }
        .summary-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
        .product-fields { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .metric-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
        .subgrid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .formula-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
        .result-grid { grid-template-columns: 1.1fr 1fr; gap: 12px; margin-bottom: 14px; }
        .pricing-sections { grid-template-columns: 1fr 1fr; }
        .summary-card, .card { padding: 18px; }
        .summary-label, .section-label, .metric-label { font-size: 0.76rem; text-transform: uppercase; letter-spacing: 0.1em; color: rgba(32, 49, 45, 0.58); }
        .summary-value { margin-top: 8px; font-size: 1.75rem; font-weight: 800; letter-spacing: -0.05em; }
        .summary-hint, .section-copy, .csv-message, .helper { margin-top: 6px; color: rgba(32, 49, 45, 0.62); line-height: 1.5; }
        .section-head { margin-bottom: 16px; }
        .section-head h2 { margin: 6px 0 0; font-size: 1.35rem; letter-spacing: -0.03em; }
        .field { display: grid; gap: 6px; }
        .field label { font-size: 0.84rem; color: rgba(32, 49, 45, 0.72); }
        .field input, .field select { width: 100%; border: 1px solid rgba(32, 49, 45, 0.12); border-radius: 14px; padding: 11px 12px; background: white; }
        .products-wrap, .assumptions-wrap { display: grid; gap: 14px; }
        .product-card { border: 1px solid rgba(32, 49, 45, 0.08); border-radius: 20px; padding: 18px; background: rgba(255, 255, 255, 0.85); }
        .product-head { display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; margin-bottom: 14px; }
        .product-head h3 { margin: 0; font-size: 1.1rem; }
        .metric-card, .formula-card { background: #f5efe2; border-radius: 16px; padding: 12px; }
        .metric-value { margin-top: 6px; font-weight: 700; }
        .result-card { border-radius: 18px; padding: 16px; background: #183f36; color: #fbf8f2; }
        .result-card .metric-label { color: rgba(251, 248, 242, 0.72); }
        .result-card .metric-value { font-size: 1.7rem; letter-spacing: -0.04em; }
        .icon-button { width: 38px; height: 38px; border: 1px solid rgba(32, 49, 45, 0.12); border-radius: 12px; background: white; display: grid; place-items: center; cursor: pointer; }
        .helper-list { margin: 0; padding-left: 18px; color: rgba(32, 49, 45, 0.72); line-height: 1.6; }
        .band-row { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
        .section-box { border: 1px solid rgba(32, 49, 45, 0.08); border-radius: 18px; padding: 14px; background: rgba(245, 239, 226, 0.45); }
        .section-box h4 { margin: 0 0 12px; font-size: 1rem; }
        .section-output { margin-top: 12px; }
        @media (max-width: 1100px) { .summary-grid, .product-fields, .metric-grid, .subgrid, .result-grid, .formula-grid, .band-row, .pricing-sections { grid-template-columns: 1fr; } }
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
          <div className="toolbar">
            <button className="button" onClick={addRow}>
              <Plus size={16} /> Add SKU
            </button>
            <button className="button-ghost" onClick={() => exportCsv(computedRows)}>
              <Download size={16} /> Export CSV
            </button>
            <label className="upload-label">
              <Upload size={16} /> Upload CSV
              <input type="file" accept=".csv" hidden onChange={handleCsvUpload} />
            </label>
          </div>
        </section>

        <section className="summary-grid">
          <SummaryCard label="SKUs" value={String(totals.skuCount)} hint="Rows being priced" />
          <SummaryCard label="Avg Selling Price" value={currency(totals.avgTarget)} hint="Average recommended selling price" />
          <SummaryCard label="Highest Price" value={currency(totals.highestTarget)} hint="Highest recommended SKU price" />
          <SummaryCard label="Lowest Price" value={currency(totals.lowestTarget)} hint="Lowest recommended SKU price" />
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
              <div className="helper">Active assumptions: {assumptions.stepLevel} shipping rates and {pct(assumptions.gstOnAmazonFeesPct)} GST on Amazon fees.</div>
              <div className="csv-message">CSV headers: {CSV_FIELDS.join(", ")}</div>
            </section>

            <section className="products-wrap">
              {computedRows.map((row) => (
                <article className="product-card" key={row.id}>
                  <div className="product-head">
                    <div>
                      <h3>{row.productName || "Untitled SKU"}</h3>
                      <div className="helper">Use the final selling price as the listing price.</div>
                    </div>
                    {rows.length > 1 ? (
                      <button className="icon-button" onClick={() => removeRow(row.id)}>
                        <Trash2 size={16} />
                      </button>
                    ) : null}
                  </div>

                  <div className="pricing-sections">
                    <div className="section-box">
                      <h4>Basic Details</h4>
                      <div className="product-fields">
                        <div className="field">
                          <label>Product name</label>
                          <input value={row.productName} onChange={(event) => updateRow(row.id, "productName", event.target.value)} />
                        </div>
                        <div className="field">
                          <label>Market price</label>
                          <input type="number" value={row.marketPrice} onChange={(event) => updateRow(row.id, "marketPrice", event.target.value)} />
                        </div>
                      </div>
                    </div>

                    <div className="section-box">
                      <h4>Pricing Rules</h4>
                      <div className="product-fields">
                        <div className="field">
                          <label>Referral fee rule</label>
                          <select value={row.referralRule} onChange={(event) => updateRow(row.id, "referralRule", event.target.value)}>
                            {assumptions.referralFeeRules.map((rule) => <option key={rule.name} value={rule.name}>{rule.name}</option>)}
                          </select>
                        </div>
                        <div className="field">
                          <label>GST rule</label>
                          <select value={row.gstRule} onChange={(event) => updateRow(row.id, "gstRule", event.target.value)}>
                            {assumptions.gstRules.map((rule) => <option key={rule.name} value={rule.name}>{rule.name}</option>)}
                          </select>
                        </div>
                        <div className="field">
                          <label>Target margin %</label>
                          <input type="number" value={row.targetMarginPct} onChange={(event) => updateRow(row.id, "targetMarginPct", event.target.value)} />
                        </div>
                      </div>
                    </div>

                    <div className="section-box">
                      <h4>Cost Inputs</h4>
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
                      <h4>Shipping Inputs</h4>
                      <div className="product-fields">
                        <div className="field">
                          <label>Actual weight (g)</label>
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
                  </div>

                  <div className="result-grid">
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

                  <div className="pricing-sections">
                    <div className="section-box">
                      <h4>GST</h4>
                      <div className="metric-grid section-output">
                        <Metric label="GST rule" value={`${row.gstRuleApplied} (${pct(row.gstPctApplied)})`} />
                        <Metric label="Product GST" value={currency(row.productGstCost)} />
                      </div>
                    </div>

                    <div className="section-box">
                      <h4>Amazon Fees</h4>
                      <div className="metric-grid section-output">
                        <Metric label="Referral fee" value={currency(row.referralFeeAtTarget)} />
                        <Metric label="Closing fee" value={currency(row.closingFeeAtTarget)} />
                        <Metric label="GST on Amazon fees" value={currency(row.gstOnAmazonFeesAtTarget)} />
                        <Metric label="Total Amazon fees" value={currency(row.totalAmazonFeesAtTarget)} />
                      </div>
                    </div>

                    <div className="section-box">
                      <h4>Price Check</h4>
                      <div className="metric-grid section-output">
                        <Metric label="Break-even price" value={currency(row.breakEvenPrice)} />
                      </div>
                    </div>
                  </div>
                </article>
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
                  <div className="section-label">GST Rules</div>
                  <h2>HSN / PTC mapping</h2>
                  <div className="section-copy">Select one of these rules per product. Product GST is added to product cost in pricing.</div>
                </div>
              </div>
              <div className="assumptions-wrap">
                {assumptions.gstRules.map((rule, index) => (
                  <div className="band-row" key={`${rule.name}-${index}`}>
                    <div className="field">
                      <label>Rule name</label>
                      <input value={rule.name} onChange={(event) => updateGstRule(index, "name", event.target.value)} />
                    </div>
                    <div className="field">
                      <label>HSN code</label>
                      <input value={rule.hsnCode} onChange={(event) => updateGstRule(index, "hsnCode", event.target.value)} />
                    </div>
                    <div className="field">
                      <label>Product tax code</label>
                      <input value={rule.productTaxCode} onChange={(event) => updateGstRule(index, "productTaxCode", event.target.value)} />
                    </div>
                    <AssumptionField label="GST %" value={rule.gstPct} onChange={(event) => updateGstRule(index, "gstPct", event.target.value)} />
                  </div>
                ))}
                <button className="button" type="button" onClick={addGstRule}>
                  <Plus size={16} /> Add GST rule
                </button>
              </div>
            </section>

            <section className="card">
              <div className="section-head">
                <div>
                  <div className="section-label">Amazon Fee Rules</div>
                  <h2>Referral and closing fees</h2>
                </div>
              </div>
              <ul className="helper-list">
                <li>Referral fee = selling price × referral rule %</li>
                <li>Closing fee = fixed fee based on selling price band</li>
                <li>GST on Amazon fees = GST % applied on shipping + referral + closing fee</li>
              </ul>
              <div className="assumptions-wrap" style={{ marginTop: 16 }}>
                {assumptions.referralFeeRules.map((rule, index) => (
                  <div className="band-row" key={`${rule.name}-${index}`}>
                    <div className="field">
                      <label>Category name</label>
                      <input value={rule.name} onChange={(event) => updateReferralFeeRule(index, "name", event.target.value)} />
                    </div>
                    <AssumptionField label="Referral fee %" value={rule.feePct} onChange={(event) => updateReferralFeeRule(index, "feePct", event.target.value)} />
                    <AssumptionField label="0% below price" value={rule.zeroBelowPrice} onChange={(event) => updateReferralFeeRule(index, "zeroBelowPrice", event.target.value)} />
                  </div>
                ))}
                <button className="button" type="button" onClick={addReferralFeeRule}>
                  <Plus size={16} /> Add referral fee rule
                </button>
              </div>
              <div className="assumptions-wrap" style={{ marginTop: 16 }}>
                {assumptions.closingFeeBands.map((band, index) => (
                  <div className="subgrid" key={`${band.upto}-${index}`}>
                    <AssumptionField label="Selling price up to" value={band.upto} onChange={(event) => updateClosingFeeBand(index, "upto", event.target.value)} />
                    <AssumptionField label="Closing fee" value={band.fee} onChange={(event) => updateClosingFeeBand(index, "fee", event.target.value)} />
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
