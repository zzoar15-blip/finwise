import type { FilingStatus } from '@/lib/calculations/paycheck';

export interface StateBracket {
  upTo: number;
  rate: number;
}

export interface AdditionalTax {
  name: string;
  rate: number;
  wageBase?: number; // undefined = no cap
}

export interface StateTaxConfig {
  name: string;
  abbr: string;
  hasIncomeTax: boolean;
  flatRate?: number;
  brackets?: StateBracket[];
  stdDeduction: { single: number; married: number; hoh: number };
  personalExemption: { single: number; married: number; hoh: number };
  allows401k: boolean; // NJ, PA do not allow 401k deduction for state purposes
  additionalTaxes: AdditionalTax[];
  localTaxRate?: number; // e.g. NYC local
  localTaxName?: string;
}

function noTax(name: string, abbr: string, extra: AdditionalTax[] = []): StateTaxConfig {
  return {
    name, abbr, hasIncomeTax: false,
    stdDeduction: { single: 0, married: 0, hoh: 0 },
    personalExemption: { single: 0, married: 0, hoh: 0 },
    allows401k: true, additionalTaxes: extra,
  };
}

function flat(name: string, abbr: string, rate: number, p: Partial<StateTaxConfig> = {}): StateTaxConfig {
  return {
    name, abbr, hasIncomeTax: true, flatRate: rate,
    stdDeduction: p.stdDeduction ?? { single: 0, married: 0, hoh: 0 },
    personalExemption: p.personalExemption ?? { single: 0, married: 0, hoh: 0 },
    allows401k: p.allows401k ?? true,
    additionalTaxes: p.additionalTaxes ?? [],
    ...(p.localTaxRate ? { localTaxRate: p.localTaxRate, localTaxName: p.localTaxName } : {}),
  };
}

const FED_STD = { single: 15000, married: 30000, hoh: 22500 }; // 2025 federal, used as proxy for conforming states

export const STATE_CONFIGS: StateTaxConfig[] = [
  // ─── NO INCOME TAX ───────────────────────────────────────────────────────────
  noTax('Alaska', 'AK'),
  noTax('Florida', 'FL'),
  noTax('Nevada', 'NV'),
  noTax('New Hampshire', 'NH'),
  noTax('South Dakota', 'SD'),
  noTax('Tennessee', 'TN'),
  noTax('Texas', 'TX'),
  noTax('Washington', 'WA', [{ name: 'WA PFML', rate: 0.0046, wageBase: 176100 }]),
  noTax('Wyoming', 'WY'),

  // ─── FLAT RATE ───────────────────────────────────────────────────────────────
  flat('Arizona', 'AZ', 0.025, {
    stdDeduction: { single: 13850, married: 27700, hoh: 20800 },
    personalExemption: { single: 2200, married: 4400, hoh: 2200 },
  }),
  flat('Colorado', 'CO', 0.044, {
    stdDeduction: FED_STD,
    additionalTaxes: [{ name: 'CO FAMLI', rate: 0.0045 }], // employee 50% of 0.9%
  }),
  flat('Georgia', 'GA', 0.0539, {
    stdDeduction: { single: 12000, married: 24000, hoh: 18000 },
    personalExemption: { single: 2700, married: 7400, hoh: 4000 },
  }),
  flat('Idaho', 'ID', 0.05695, {
    stdDeduction: FED_STD,
  }),
  flat('Illinois', 'IL', 0.0495, {
    personalExemption: { single: 2625, married: 5250, hoh: 2625 },
  }),
  flat('Indiana', 'IN', 0.0305, {
    personalExemption: { single: 1000, married: 2000, hoh: 1000 },
  }),
  flat('Iowa', 'IA', 0.044, {
    stdDeduction: FED_STD,
    personalExemption: { single: 40, married: 80, hoh: 40 },
  }),
  flat('Kentucky', 'KY', 0.04, {
    stdDeduction: { single: 3160, married: 3160, hoh: 3160 },
  }),
  {
    name: 'Massachusetts', abbr: 'MA', hasIncomeTax: true, flatRate: 0.05,
    stdDeduction: { single: 0, married: 0, hoh: 0 },
    personalExemption: { single: 4400, married: 8800, hoh: 6800 },
    allows401k: true,
    additionalTaxes: [{ name: 'MA PFML', rate: 0.0046, wageBase: 176100 }],
  },
  flat('Michigan', 'MI', 0.0405, {
    personalExemption: { single: 5600, married: 11200, hoh: 5600 },
  }),
  flat('Mississippi', 'MS', 0.047, {
    stdDeduction: { single: 2300, married: 4600, hoh: 3400 },
    personalExemption: { single: 6000, married: 12000, hoh: 9500 },
  }),
  flat('Montana', 'MT', 0.047, {
    stdDeduction: { single: 5490, married: 10980, hoh: 5490 },
    personalExemption: { single: 3260, married: 6520, hoh: 3260 },
  }),
  flat('North Carolina', 'NC', 0.045, {
    stdDeduction: { single: 12750, married: 25500, hoh: 19125 },
  }),
  {
    name: 'Pennsylvania', abbr: 'PA', hasIncomeTax: true, flatRate: 0.0307,
    stdDeduction: { single: 0, married: 0, hoh: 0 },
    personalExemption: { single: 0, married: 0, hoh: 0 },
    allows401k: false, // PA does NOT allow 401k deduction
    additionalTaxes: [],
  },
  flat('Utah', 'UT', 0.0465, {
    personalExemption: { single: 886, married: 1772, hoh: 886 },
  }),

  // ─── BRACKET STATES ──────────────────────────────────────────────────────────
  {
    name: 'Alabama', abbr: 'AL', hasIncomeTax: true,
    brackets: [{ upTo: 500, rate: 0.02 }, { upTo: 3000, rate: 0.04 }, { upTo: Infinity, rate: 0.05 }],
    stdDeduction: { single: 2500, married: 7500, hoh: 4700 },
    personalExemption: { single: 1500, married: 3000, hoh: 1500 },
    allows401k: true, additionalTaxes: [],
  },
  {
    name: 'Arkansas', abbr: 'AR', hasIncomeTax: true,
    brackets: [{ upTo: 4999, rate: 0.02 }, { upTo: 9999, rate: 0.04 }, { upTo: Infinity, rate: 0.044 }],
    stdDeduction: { single: 2270, married: 4540, hoh: 2270 },
    personalExemption: { single: 29, married: 58, hoh: 29 },
    allows401k: true, additionalTaxes: [],
  },
  {
    name: 'California', abbr: 'CA', hasIncomeTax: true,
    brackets: [
      { upTo: 10756, rate: 0.01 }, { upTo: 25499, rate: 0.02 }, { upTo: 40245, rate: 0.04 },
      { upTo: 55866, rate: 0.06 }, { upTo: 70606, rate: 0.08 }, { upTo: 360659, rate: 0.093 },
      { upTo: 432787, rate: 0.103 }, { upTo: 721314, rate: 0.113 }, { upTo: 1000000, rate: 0.123 },
      { upTo: Infinity, rate: 0.133 },
    ],
    stdDeduction: { single: 5202, married: 10404, hoh: 10404 },
    personalExemption: { single: 144, married: 288, hoh: 433 },
    allows401k: true,
    additionalTaxes: [{ name: 'CA SDI', rate: 0.011 }], // no wage cap since 2024
  },
  {
    name: 'Connecticut', abbr: 'CT', hasIncomeTax: true,
    brackets: [
      { upTo: 10000, rate: 0.02 }, { upTo: 50000, rate: 0.045 }, { upTo: 100000, rate: 0.055 },
      { upTo: 200000, rate: 0.06 }, { upTo: 250000, rate: 0.065 }, { upTo: Infinity, rate: 0.0699 },
    ],
    stdDeduction: { single: 0, married: 0, hoh: 0 },
    personalExemption: { single: 15000, married: 24000, hoh: 19000 },
    allows401k: true, additionalTaxes: [],
  },
  {
    name: 'Delaware', abbr: 'DE', hasIncomeTax: true,
    brackets: [
      { upTo: 2000, rate: 0 }, { upTo: 5000, rate: 0.022 }, { upTo: 10000, rate: 0.039 },
      { upTo: 20000, rate: 0.048 }, { upTo: 25000, rate: 0.052 }, { upTo: 60000, rate: 0.0555 },
      { upTo: Infinity, rate: 0.066 },
    ],
    stdDeduction: { single: 3250, married: 6500, hoh: 3250 },
    personalExemption: { single: 110, married: 220, hoh: 110 },
    allows401k: true, additionalTaxes: [],
  },
  {
    name: 'District of Columbia', abbr: 'DC', hasIncomeTax: true,
    brackets: [
      { upTo: 10000, rate: 0.04 }, { upTo: 40000, rate: 0.06 }, { upTo: 60000, rate: 0.065 },
      { upTo: 250000, rate: 0.085 }, { upTo: 500000, rate: 0.0925 }, { upTo: 1000000, rate: 0.0975 },
      { upTo: Infinity, rate: 0.1075 },
    ],
    stdDeduction: FED_STD,
    personalExemption: { single: 4100, married: 8200, hoh: 4100 },
    allows401k: true, additionalTaxes: [],
  },
  {
    name: 'Hawaii', abbr: 'HI', hasIncomeTax: true,
    brackets: [
      { upTo: 2400, rate: 0.014 }, { upTo: 4800, rate: 0.032 }, { upTo: 9600, rate: 0.055 },
      { upTo: 14400, rate: 0.064 }, { upTo: 19200, rate: 0.068 }, { upTo: 24000, rate: 0.072 },
      { upTo: 36000, rate: 0.076 }, { upTo: 48000, rate: 0.079 }, { upTo: 150000, rate: 0.0825 },
      { upTo: 175000, rate: 0.09 }, { upTo: 200000, rate: 0.10 }, { upTo: Infinity, rate: 0.11 },
    ],
    stdDeduction: { single: 2200, married: 4400, hoh: 3212 },
    personalExemption: { single: 1144, married: 2288, hoh: 1144 },
    allows401k: true, additionalTaxes: [],
  },
  {
    name: 'Kansas', abbr: 'KS', hasIncomeTax: true,
    brackets: [
      { upTo: 15000, rate: 0.031 }, { upTo: 30000, rate: 0.0525 }, { upTo: Infinity, rate: 0.057 },
    ],
    stdDeduction: { single: 3500, married: 8000, hoh: 6000 },
    personalExemption: { single: 2250, married: 4500, hoh: 2250 },
    allows401k: true, additionalTaxes: [],
  },
  {
    name: 'Louisiana', abbr: 'LA', hasIncomeTax: true,
    brackets: [
      { upTo: 12500, rate: 0.0185 }, { upTo: 50000, rate: 0.035 }, { upTo: Infinity, rate: 0.0425 },
    ],
    stdDeduction: { single: 4500, married: 9000, hoh: 4500 },
    personalExemption: { single: 4500, married: 9000, hoh: 4500 },
    allows401k: true, additionalTaxes: [],
  },
  {
    name: 'Maine', abbr: 'ME', hasIncomeTax: true,
    brackets: [
      { upTo: 24500, rate: 0.058 }, { upTo: 58050, rate: 0.0675 }, { upTo: Infinity, rate: 0.0715 },
    ],
    stdDeduction: FED_STD,
    personalExemption: { single: 5000, married: 10000, hoh: 5000 },
    allows401k: true, additionalTaxes: [],
  },
  {
    name: 'Maryland', abbr: 'MD', hasIncomeTax: true,
    brackets: [
      { upTo: 1000, rate: 0.02 }, { upTo: 2000, rate: 0.03 }, { upTo: 3000, rate: 0.04 },
      { upTo: 100000, rate: 0.0475 }, { upTo: 125000, rate: 0.05 }, { upTo: 150000, rate: 0.0525 },
      { upTo: 250000, rate: 0.055 }, { upTo: Infinity, rate: 0.0575 },
    ],
    stdDeduction: { single: 2350, married: 4700, hoh: 2350 },
    personalExemption: { single: 3200, married: 6400, hoh: 3200 },
    allows401k: true,
    additionalTaxes: [{ name: 'MD County Tax', rate: 0.03 }], // ~avg county rate
  },
  {
    name: 'Minnesota', abbr: 'MN', hasIncomeTax: true,
    brackets: [
      { upTo: 30070, rate: 0.0535 }, { upTo: 98760, rate: 0.068 },
      { upTo: 171220, rate: 0.0785 }, { upTo: Infinity, rate: 0.0985 },
    ],
    stdDeduction: { single: 14575, married: 29150, hoh: 14575 },
    personalExemption: { single: 4750, married: 9500, hoh: 4750 },
    allows401k: true, additionalTaxes: [],
  },
  {
    name: 'Missouri', abbr: 'MO', hasIncomeTax: true,
    brackets: [
      { upTo: 1207, rate: 0 }, { upTo: 2414, rate: 0.02 }, { upTo: 3621, rate: 0.025 },
      { upTo: 4828, rate: 0.03 }, { upTo: 6035, rate: 0.035 }, { upTo: 7242, rate: 0.04 },
      { upTo: 8449, rate: 0.045 }, { upTo: Infinity, rate: 0.048 },
    ],
    stdDeduction: FED_STD,
    personalExemption: { single: 2100, married: 4200, hoh: 2100 },
    allows401k: true, additionalTaxes: [],
  },
  {
    name: 'Nebraska', abbr: 'NE', hasIncomeTax: true,
    brackets: [
      { upTo: 3700, rate: 0.0246 }, { upTo: 22170, rate: 0.0351 },
      { upTo: 35730, rate: 0.0501 }, { upTo: Infinity, rate: 0.0584 },
    ],
    stdDeduction: { single: 7900, married: 15800, hoh: 7900 },
    personalExemption: { single: 157, married: 314, hoh: 157 },
    allows401k: true, additionalTaxes: [],
  },
  {
    name: 'New Jersey', abbr: 'NJ', hasIncomeTax: true,
    brackets: [
      { upTo: 20000, rate: 0.014 }, { upTo: 35000, rate: 0.0175 }, { upTo: 40000, rate: 0.035 },
      { upTo: 75000, rate: 0.05525 }, { upTo: 500000, rate: 0.0637 },
      { upTo: 1000000, rate: 0.0897 }, { upTo: Infinity, rate: 0.1075 },
    ],
    stdDeduction: { single: 0, married: 0, hoh: 0 },
    personalExemption: { single: 1000, married: 2000, hoh: 1500 },
    allows401k: false, // NJ does NOT allow 401k deduction
    additionalTaxes: [
      { name: 'NJ SDI', rate: 0.0028, wageBase: 161400 },
      { name: 'NJ FLI', rate: 0.0009, wageBase: 161400 },
    ],
  },
  {
    name: 'New Mexico', abbr: 'NM', hasIncomeTax: true,
    brackets: [
      { upTo: 5500, rate: 0.017 }, { upTo: 11000, rate: 0.032 }, { upTo: 16000, rate: 0.047 },
      { upTo: 210000, rate: 0.049 }, { upTo: Infinity, rate: 0.059 },
    ],
    stdDeduction: FED_STD,
    personalExemption: { single: 4000, married: 8000, hoh: 4000 },
    allows401k: true, additionalTaxes: [],
  },
  {
    name: 'New York', abbr: 'NY', hasIncomeTax: true,
    brackets: [
      { upTo: 8500, rate: 0.04 }, { upTo: 11700, rate: 0.045 }, { upTo: 13900, rate: 0.0525 },
      { upTo: 21400, rate: 0.0585 }, { upTo: 80650, rate: 0.0625 }, { upTo: 215400, rate: 0.0685 },
      { upTo: 1077550, rate: 0.0965 }, { upTo: 5000000, rate: 0.103 }, { upTo: Infinity, rate: 0.109 },
    ],
    stdDeduction: { single: 8000, married: 16050, hoh: 11200 },
    personalExemption: { single: 0, married: 0, hoh: 0 },
    allows401k: true, additionalTaxes: [],
    localTaxRate: 0.035, localTaxName: 'NYC Local Tax',
  },
  {
    name: 'North Dakota', abbr: 'ND', hasIncomeTax: true,
    brackets: [
      { upTo: 44725, rate: 0 }, { upTo: 225975, rate: 0.0195 }, { upTo: Infinity, rate: 0.025 },
    ],
    stdDeduction: FED_STD,
    personalExemption: { single: 0, married: 0, hoh: 0 },
    allows401k: true, additionalTaxes: [],
  },
  {
    name: 'Ohio', abbr: 'OH', hasIncomeTax: true,
    brackets: [
      { upTo: 26050, rate: 0 }, { upTo: 100000, rate: 0.0275 }, { upTo: Infinity, rate: 0.035 },
    ],
    stdDeduction: { single: 0, married: 0, hoh: 0 },
    personalExemption: { single: 650, married: 1300, hoh: 650 },
    allows401k: true, additionalTaxes: [],
  },
  {
    name: 'Oklahoma', abbr: 'OK', hasIncomeTax: true,
    brackets: [
      { upTo: 1000, rate: 0.0025 }, { upTo: 2500, rate: 0.0075 }, { upTo: 3750, rate: 0.0175 },
      { upTo: 4900, rate: 0.0275 }, { upTo: 7200, rate: 0.0375 }, { upTo: Infinity, rate: 0.0475 },
    ],
    stdDeduction: { single: 6350, married: 12700, hoh: 9350 },
    personalExemption: { single: 1000, married: 2000, hoh: 1000 },
    allows401k: true, additionalTaxes: [],
  },
  {
    name: 'Oregon', abbr: 'OR', hasIncomeTax: true,
    brackets: [
      { upTo: 10200, rate: 0.0475 }, { upTo: 25750, rate: 0.0675 },
      { upTo: 125000, rate: 0.0875 }, { upTo: Infinity, rate: 0.099 },
    ],
    stdDeduction: { single: 2420, married: 4840, hoh: 2420 },
    personalExemption: { single: 236, married: 472, hoh: 236 },
    allows401k: true,
    additionalTaxes: [{ name: 'OR PFML', rate: 0.006 }], // employee 60% of 1%
  },
  {
    name: 'Rhode Island', abbr: 'RI', hasIncomeTax: true,
    brackets: [
      { upTo: 73450, rate: 0.0375 }, { upTo: 166950, rate: 0.0475 }, { upTo: Infinity, rate: 0.0599 },
    ],
    stdDeduction: { single: 10550, married: 21150, hoh: 15825 },
    personalExemption: { single: 4700, married: 9400, hoh: 4700 },
    allows401k: true,
    additionalTaxes: [{ name: 'RI TDI', rate: 0.012, wageBase: 87000 }],
  },
  {
    name: 'South Carolina', abbr: 'SC', hasIncomeTax: true,
    brackets: [
      { upTo: 3460, rate: 0 }, { upTo: 17330, rate: 0.03 }, { upTo: Infinity, rate: 0.062 },
    ],
    stdDeduction: FED_STD,
    personalExemption: { single: 0, married: 0, hoh: 0 },
    allows401k: true, additionalTaxes: [],
  },
  {
    name: 'Virginia', abbr: 'VA', hasIncomeTax: true,
    brackets: [
      { upTo: 3000, rate: 0.02 }, { upTo: 5000, rate: 0.03 },
      { upTo: 17000, rate: 0.05 }, { upTo: Infinity, rate: 0.0575 },
    ],
    stdDeduction: { single: 8000, married: 16000, hoh: 8000 },
    personalExemption: { single: 930, married: 1860, hoh: 930 },
    allows401k: true, additionalTaxes: [],
  },
  {
    name: 'Vermont', abbr: 'VT', hasIncomeTax: true,
    brackets: [
      { upTo: 45400, rate: 0.0335 }, { upTo: 110050, rate: 0.066 },
      { upTo: 229550, rate: 0.076 }, { upTo: Infinity, rate: 0.0875 },
    ],
    stdDeduction: { single: 7000, married: 14050, hoh: 7000 },
    personalExemption: { single: 4500, married: 9000, hoh: 4500 },
    allows401k: true, additionalTaxes: [],
  },
  {
    name: 'West Virginia', abbr: 'WV', hasIncomeTax: true,
    brackets: [
      { upTo: 10000, rate: 0.024 }, { upTo: 25000, rate: 0.032 }, { upTo: 40000, rate: 0.036 },
      { upTo: 60000, rate: 0.048 }, { upTo: Infinity, rate: 0.052 },
    ],
    stdDeduction: { single: 0, married: 0, hoh: 0 },
    personalExemption: { single: 2000, married: 4000, hoh: 2000 },
    allows401k: true, additionalTaxes: [],
  },
  {
    name: 'Wisconsin', abbr: 'WI', hasIncomeTax: true,
    brackets: [
      { upTo: 13810, rate: 0.035 }, { upTo: 27630, rate: 0.044 },
      { upTo: 304170, rate: 0.053 }, { upTo: Infinity, rate: 0.0765 },
    ],
    stdDeduction: { single: 12760, married: 23620, hoh: 12760 },
    personalExemption: { single: 700, married: 1400, hoh: 700 },
    allows401k: true, additionalTaxes: [],
  },
];

// Sort alphabetically by name
STATE_CONFIGS.sort((a, b) => a.name.localeCompare(b.name));

export const STATE_BY_ABBR: Record<string, StateTaxConfig> =
  Object.fromEntries(STATE_CONFIGS.map(s => [s.abbr, s]));

function bracketTax(income: number, brackets: StateBracket[]): number {
  let tax = 0, prev = 0;
  for (const { upTo, rate } of brackets) {
    if (income <= prev) break;
    tax += (Math.min(income, upTo) - prev) * rate;
    prev = upTo;
  }
  return tax;
}

export function computeStateTax(
  config: StateTaxConfig,
  annualGross: number,
  annualTrad401k: number,
  annualSection125: number,
  filingStatus: FilingStatus,
  includeLocalTax = false,
): { incomeTax: number; localTax: number; additionalTaxes: Array<{ name: string; amount: number }> } {
  const k401kDed = config.allows401k ? annualTrad401k : 0;
  const taxable = Math.max(0,
    annualGross - k401kDed - annualSection125
    - config.stdDeduction[filingStatus]
    - config.personalExemption[filingStatus]
  );

  let incomeTax = 0;
  if (config.hasIncomeTax) {
    incomeTax = config.flatRate
      ? taxable * config.flatRate
      : bracketTax(taxable, config.brackets ?? []);
  }

  const localTax = (includeLocalTax && config.localTaxRate)
    ? taxable * config.localTaxRate
    : 0;

  const annualFica = annualGross - annualSection125;
  const additionalTaxes = config.additionalTaxes.map(t => ({
    name: t.name,
    amount: t.wageBase ? Math.min(annualFica, t.wageBase) * t.rate : annualFica * t.rate,
  }));

  return { incomeTax, localTax, additionalTaxes };
}
