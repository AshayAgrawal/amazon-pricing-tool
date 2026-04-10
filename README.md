# Amazon Pricing Tool

This is a pricing calculator for Amazon Seller who is listing products on Amazon India. It helps you estimate the selling price needed for each SKU after accounting for product cost, GST, Amazon fees, shipping charges, and your target margin.

The app is intended for sellers who want a faster way to answer questions like:

- What should I price this product at to hit my target margin?
- What is my break-even selling price?
- How much will Amazon fees affect this SKU?
- How far is my recommended price from the current market price?

## What The Tool Does

For each product, the calculator uses:

- Product cost: making cost + design cost + overhead cost
- Product GST
- Shipping fee based on chargeable weight
- Referral fee based on category and selling price slab
- Closing fee based on selling price band
- GST on Amazon fees
- Target margin percentage

It then calculates:

- Break-even price
- Final recommended selling price
- Total Amazon fees
- Referral slab applied
- Delta vs market price

## Key Features

- Add and price multiple SKUs
- Import products from CSV
- Export calculated results to CSV
- Compare calculated price against market price
- Edit shared assumptions from the UI
- Search referral fee categories
- Switch between Amazon STEP shipping levels

## Video Walkthrough of the tool
https://www.loom.com/share/3aaf6b509e974a7697f5150fe3744a53 

## Tech Stack

- React 18
- Vite
- `lucide-react` for icons

## Getting Started

### Requirements

- Node.js 18+ recommended
- npm

### Install

```bash
npm install
```

### Run Locally

```bash
npm run dev
```

This starts the Vite development server. Open the local URL shown in the terminal, usually `http://localhost:5173`.

### Production Build

```bash
npm run build
```

### Preview Production Build

```bash
npm run preview
```

## How To Use

### 1. Open the Pricing page

The default view is the Pricing page. This is where you enter product details and see the recommended selling price.

### 2. Enter product information

For each SKU, fill in:

- Product name
- Making cost
- Design cost
- Overhead cost
- Actual weight in grams
- Length, breadth, and height in cm
- Referral fee category
- GST %
- Target margin %
- Market price

### 3. Review the calculated output

The app calculates:

- Product cost
- Chargeable weight
- Shipping fee
- Referral fee and applied slab
- Closing fee
- GST on Amazon fees
- Break-even price
- Final selling price
- Delta vs market price

### 4. Save the SKU

Use the Save button to keep the SKU in the price list and continue pricing the next one.

### 5. Export results

Use Download in the SKU Price List section to export calculated pricing results as CSV.

## CSV Import Format

The app supports CSV import on the Pricing page. Use this exact header row:

```csv
productName,makingCost,designCost,overheadCost,actualWeightG,lengthCm,breadthCm,heightCm,referralRule,gstPct,targetMarginPct,marketPrice
```

Example:

```csv
productName,makingCost,designCost,overheadCost,actualWeightG,lengthCm,breadthCm,heightCm,referralRule,gstPct,targetMarginPct,marketPrice
Tote Bag,120,10,50,600,30,25,4,Handbags,18,25,999
Notebook Set,80,5,20,400,22,15,3,Office Products – Office Supplies,12,20,349
```

## Assumptions You Can Edit

The Assumptions page lets you update shared pricing rules when Amazon changes fees.

You can edit:

- GST on Amazon fees %
- Default STEP level
- Easy Ship shipping rates
- Closing fee bands
- Referral fee category lookup and review

Current built-in shipping levels:

- Premium and Advanced
- Standard
- Basic

## Pricing Logic Summary

The tool uses the higher of:

- Actual weight
- Volumetric weight = `length × breadth × height / 5000`

That becomes the chargeable weight used for shipping fee calculation.

The final selling price is solved iteratively so that:

```text
Selling price - total cost - target profit = 0
```

Where total cost includes:

- Product cost
- Product GST
- Amazon fees

And Amazon fees include:

- Shipping fee
- Referral fee
- Closing fee
- GST on the above Amazon fees

## Project Structure

```text
.
├── src/
│   ├── App.jsx
│   ├── main.jsx
│   └── referralRules.js
├── index.html
├── package.json
└── vite.config.js
```

## Notes

- Referral fee categories are currently stored in [`src/referralRules.js`](/Users/ashayagrawal/amazon-pricing-tool/src/referralRules.js).
- Default assumptions are defined in [`src/App.jsx`](/Users/ashayagrawal/amazon-pricing-tool/src/App.jsx).
- This tool is currently front-end only and does not require a backend.

