import { FilingStatus } from '../types';
import { TaxBracket } from './federalTax';

// How a state treats Social Security income
export type SSExemption =
  | 'exempt'           // Fully exempt from state tax (most states)
  | 'taxed'            // Follows federal rules — taxes SS same as federal
  | 'partial';         // Partial exemption (see ssExemptionDetail)

// How a state treats long-term capital gains
export type CapGainsTreatment =
  | 'ordinary'         // Taxed as ordinary income (most states)
  | 'exempt'           // No state income tax or fully exempt
  | 'partial';         // Partial exclusion or preferential rate

export interface StateTaxInfo {
  name: string;
  abbreviation: string;
  hasNoIncomeTax: boolean;
  brackets: {
    single: TaxBracket[];
    married: TaxBracket[];
  };
  standardDeduction: {
    single: number;
    married: number;
  };
  // Social Security tax treatment
  ssExemption: SSExemption;
  // For 'partial' SS exemption: what % of SS is excluded from state tax (0-1)
  // e.g., 0.65 means 65% of SS is excluded. Simplified from complex state rules.
  ssExclusionRate?: number;
  // Capital gains treatment
  capitalGainsTreatment: CapGainsTreatment;
  // For 'partial' cap gains: what fraction of LTCG is excluded (0-1)
  capitalGainsExclusionRate?: number;
}

// All 50 states + DC tax data (2025 approximations)
// States are listed alphabetically by abbreviation
const STATE_TAX_DATA: Record<string, StateTaxInfo> = {
  AL: {
    name: 'Alabama',
    abbreviation: 'AL',
    hasNoIncomeTax: false,
    brackets: {
      single: [
        { min: 0, max: 500, rate: 0.02 },
        { min: 500, max: 3000, rate: 0.04 },
        { min: 3000, max: Infinity, rate: 0.05 },
      ],
      married: [
        { min: 0, max: 1000, rate: 0.02 },
        { min: 1000, max: 6000, rate: 0.04 },
        { min: 6000, max: Infinity, rate: 0.05 },
      ],
    },
    standardDeduction: { single: 3000, married: 8500 },
    ssExemption: 'exempt',
    capitalGainsTreatment: 'ordinary',
  },
  AK: {
    name: 'Alaska',
    abbreviation: 'AK',
    hasNoIncomeTax: true,
    brackets: { single: [], married: [] },
    standardDeduction: { single: 0, married: 0 },
    ssExemption: 'exempt',
    capitalGainsTreatment: 'exempt',
  },
  AZ: {
    name: 'Arizona',
    abbreviation: 'AZ',
    hasNoIncomeTax: false,
    brackets: {
      single: [{ min: 0, max: Infinity, rate: 0.025 }],
      married: [{ min: 0, max: Infinity, rate: 0.025 }],
    },
    standardDeduction: { single: 14600, married: 29200 },
    ssExemption: 'exempt',
    capitalGainsTreatment: 'partial',
    capitalGainsExclusionRate: 0.25,
  },
  AR: {
    name: 'Arkansas',
    abbreviation: 'AR',
    hasNoIncomeTax: false,
    brackets: {
      single: [
        { min: 0, max: 4400, rate: 0.02 },
        { min: 4400, max: 8800, rate: 0.04 },
        { min: 8800, max: Infinity, rate: 0.039 },
      ],
      married: [
        { min: 0, max: 4400, rate: 0.02 },
        { min: 4400, max: 8800, rate: 0.04 },
        { min: 8800, max: Infinity, rate: 0.039 },
      ],
    },
    standardDeduction: { single: 2340, married: 4680 },
    ssExemption: 'exempt',
    capitalGainsTreatment: 'partial',
    capitalGainsExclusionRate: 0.50,
  },
  CA: {
    name: 'California',
    abbreviation: 'CA',
    hasNoIncomeTax: false,
    brackets: {
      single: [
        { min: 0, max: 10412, rate: 0.01 },
        { min: 10412, max: 24684, rate: 0.02 },
        { min: 24684, max: 38959, rate: 0.04 },
        { min: 38959, max: 54081, rate: 0.06 },
        { min: 54081, max: 68350, rate: 0.08 },
        { min: 68350, max: 349137, rate: 0.093 },
        { min: 349137, max: 418961, rate: 0.103 },
        { min: 418961, max: 698271, rate: 0.113 },
        { min: 698271, max: 1000000, rate: 0.123 },
        { min: 1000000, max: Infinity, rate: 0.133 },
      ],
      married: [
        { min: 0, max: 20824, rate: 0.01 },
        { min: 20824, max: 49368, rate: 0.02 },
        { min: 49368, max: 77918, rate: 0.04 },
        { min: 77918, max: 108162, rate: 0.06 },
        { min: 108162, max: 136700, rate: 0.08 },
        { min: 136700, max: 698274, rate: 0.093 },
        { min: 698274, max: 837922, rate: 0.103 },
        { min: 837922, max: 1396542, rate: 0.113 },
        { min: 1396542, max: 1000000, rate: 0.123 },
        { min: 1000000, max: Infinity, rate: 0.133 },
      ],
    },
    standardDeduction: { single: 5540, married: 11080 },
    ssExemption: 'exempt',
    capitalGainsTreatment: 'ordinary',
  },
  CO: {
    name: 'Colorado',
    abbreviation: 'CO',
    hasNoIncomeTax: false,
    brackets: {
      single: [{ min: 0, max: Infinity, rate: 0.044 }],
      married: [{ min: 0, max: Infinity, rate: 0.044 }],
    },
    standardDeduction: { single: 15000, married: 30000 },
    ssExemption: 'partial',
    ssExclusionRate: 0.75,
    capitalGainsTreatment: 'ordinary',
  },
  CT: {
    name: 'Connecticut',
    abbreviation: 'CT',
    hasNoIncomeTax: false,
    brackets: {
      single: [
        { min: 0, max: 10000, rate: 0.03 },
        { min: 10000, max: 50000, rate: 0.05 },
        { min: 50000, max: 100000, rate: 0.055 },
        { min: 100000, max: 200000, rate: 0.06 },
        { min: 200000, max: 250000, rate: 0.065 },
        { min: 250000, max: 500000, rate: 0.069 },
        { min: 500000, max: Infinity, rate: 0.0699 },
      ],
      married: [
        { min: 0, max: 20000, rate: 0.03 },
        { min: 20000, max: 100000, rate: 0.05 },
        { min: 100000, max: 200000, rate: 0.055 },
        { min: 200000, max: 400000, rate: 0.06 },
        { min: 400000, max: 500000, rate: 0.065 },
        { min: 500000, max: 1000000, rate: 0.069 },
        { min: 1000000, max: Infinity, rate: 0.0699 },
      ],
    },
    standardDeduction: { single: 0, married: 0 },
    ssExemption: 'partial',
    ssExclusionRate: 0.75,
    capitalGainsTreatment: 'ordinary',
  },
  DE: {
    name: 'Delaware',
    abbreviation: 'DE',
    hasNoIncomeTax: false,
    brackets: {
      single: [
        { min: 0, max: 2000, rate: 0.0 },
        { min: 2000, max: 5000, rate: 0.022 },
        { min: 5000, max: 10000, rate: 0.039 },
        { min: 10000, max: 20000, rate: 0.048 },
        { min: 20000, max: 25000, rate: 0.052 },
        { min: 25000, max: 60000, rate: 0.055 },
        { min: 60000, max: Infinity, rate: 0.066 },
      ],
      married: [
        { min: 0, max: 2000, rate: 0.0 },
        { min: 2000, max: 5000, rate: 0.022 },
        { min: 5000, max: 10000, rate: 0.039 },
        { min: 10000, max: 20000, rate: 0.048 },
        { min: 20000, max: 25000, rate: 0.052 },
        { min: 25000, max: 60000, rate: 0.055 },
        { min: 60000, max: Infinity, rate: 0.066 },
      ],
    },
    standardDeduction: { single: 3250, married: 6500 },
    ssExemption: 'exempt',
    capitalGainsTreatment: 'ordinary',
  },
  DC: {
    name: 'District of Columbia',
    abbreviation: 'DC',
    hasNoIncomeTax: false,
    brackets: {
      single: [
        { min: 0, max: 10000, rate: 0.04 },
        { min: 10000, max: 40000, rate: 0.06 },
        { min: 40000, max: 60000, rate: 0.065 },
        { min: 60000, max: 250000, rate: 0.085 },
        { min: 250000, max: 500000, rate: 0.0925 },
        { min: 500000, max: 1000000, rate: 0.0975 },
        { min: 1000000, max: Infinity, rate: 0.1075 },
      ],
      married: [
        { min: 0, max: 10000, rate: 0.04 },
        { min: 10000, max: 40000, rate: 0.06 },
        { min: 40000, max: 60000, rate: 0.065 },
        { min: 60000, max: 250000, rate: 0.085 },
        { min: 250000, max: 500000, rate: 0.0925 },
        { min: 500000, max: 1000000, rate: 0.0975 },
        { min: 1000000, max: Infinity, rate: 0.1075 },
      ],
    },
    standardDeduction: { single: 14600, married: 29200 },
    ssExemption: 'exempt',
    capitalGainsTreatment: 'ordinary',
  },
  FL: {
    name: 'Florida',
    abbreviation: 'FL',
    hasNoIncomeTax: true,
    brackets: { single: [], married: [] },
    standardDeduction: { single: 0, married: 0 },
    ssExemption: 'exempt',
    capitalGainsTreatment: 'exempt',
  },
  GA: {
    name: 'Georgia',
    abbreviation: 'GA',
    hasNoIncomeTax: false,
    brackets: {
      single: [{ min: 0, max: Infinity, rate: 0.0539 }],
      married: [{ min: 0, max: Infinity, rate: 0.0539 }],
    },
    standardDeduction: { single: 12000, married: 24000 },
    ssExemption: 'exempt',
    capitalGainsTreatment: 'ordinary',
  },
  HI: {
    name: 'Hawaii',
    abbreviation: 'HI',
    hasNoIncomeTax: false,
    brackets: {
      single: [
        { min: 0, max: 2400, rate: 0.014 },
        { min: 2400, max: 4800, rate: 0.032 },
        { min: 4800, max: 9600, rate: 0.055 },
        { min: 9600, max: 14400, rate: 0.064 },
        { min: 14400, max: 19200, rate: 0.068 },
        { min: 19200, max: 24000, rate: 0.072 },
        { min: 24000, max: 36000, rate: 0.076 },
        { min: 36000, max: 48000, rate: 0.079 },
        { min: 48000, max: 150000, rate: 0.0825 },
        { min: 150000, max: 175000, rate: 0.09 },
        { min: 175000, max: 200000, rate: 0.10 },
        { min: 200000, max: Infinity, rate: 0.11 },
      ],
      married: [
        { min: 0, max: 4800, rate: 0.014 },
        { min: 4800, max: 9600, rate: 0.032 },
        { min: 9600, max: 19200, rate: 0.055 },
        { min: 19200, max: 28800, rate: 0.064 },
        { min: 28800, max: 38400, rate: 0.068 },
        { min: 38400, max: 48000, rate: 0.072 },
        { min: 48000, max: 72000, rate: 0.076 },
        { min: 72000, max: 96000, rate: 0.079 },
        { min: 96000, max: 300000, rate: 0.0825 },
        { min: 300000, max: 350000, rate: 0.09 },
        { min: 350000, max: 400000, rate: 0.10 },
        { min: 400000, max: Infinity, rate: 0.11 },
      ],
    },
    standardDeduction: { single: 2200, married: 4400 },
    ssExemption: 'exempt',
    capitalGainsTreatment: 'ordinary',
  },
  ID: {
    name: 'Idaho',
    abbreviation: 'ID',
    hasNoIncomeTax: false,
    brackets: {
      single: [{ min: 0, max: Infinity, rate: 0.058 }],
      married: [{ min: 0, max: Infinity, rate: 0.058 }],
    },
    standardDeduction: { single: 14600, married: 29200 },
    ssExemption: 'exempt',
    capitalGainsTreatment: 'ordinary',
  },
  IL: {
    name: 'Illinois',
    abbreviation: 'IL',
    hasNoIncomeTax: false,
    brackets: {
      single: [{ min: 0, max: Infinity, rate: 0.0495 }],
      married: [{ min: 0, max: Infinity, rate: 0.0495 }],
    },
    standardDeduction: { single: 0, married: 0 },
    ssExemption: 'exempt',
    capitalGainsTreatment: 'ordinary',
  },
  IN: {
    name: 'Indiana',
    abbreviation: 'IN',
    hasNoIncomeTax: false,
    brackets: {
      single: [{ min: 0, max: Infinity, rate: 0.0305 }],
      married: [{ min: 0, max: Infinity, rate: 0.0305 }],
    },
    standardDeduction: { single: 0, married: 0 },
    ssExemption: 'exempt',
    capitalGainsTreatment: 'ordinary',
  },
  IA: {
    name: 'Iowa',
    abbreviation: 'IA',
    hasNoIncomeTax: false,
    brackets: {
      single: [{ min: 0, max: Infinity, rate: 0.038 }],
      married: [{ min: 0, max: Infinity, rate: 0.038 }],
    },
    standardDeduction: { single: 14600, married: 29200 },
    ssExemption: 'exempt',
    capitalGainsTreatment: 'ordinary',
  },
  KS: {
    name: 'Kansas',
    abbreviation: 'KS',
    hasNoIncomeTax: false,
    brackets: {
      single: [
        { min: 0, max: 15000, rate: 0.031 },
        { min: 15000, max: 30000, rate: 0.0525 },
        { min: 30000, max: Infinity, rate: 0.057 },
      ],
      married: [
        { min: 0, max: 30000, rate: 0.031 },
        { min: 30000, max: 60000, rate: 0.0525 },
        { min: 60000, max: Infinity, rate: 0.057 },
      ],
    },
    standardDeduction: { single: 3500, married: 8000 },
    ssExemption: 'exempt',
    capitalGainsTreatment: 'ordinary',
  },
  KY: {
    name: 'Kentucky',
    abbreviation: 'KY',
    hasNoIncomeTax: false,
    brackets: {
      single: [{ min: 0, max: Infinity, rate: 0.04 }],
      married: [{ min: 0, max: Infinity, rate: 0.04 }],
    },
    standardDeduction: { single: 3160, married: 6320 },
    ssExemption: 'exempt',
    capitalGainsTreatment: 'ordinary',
  },
  LA: {
    name: 'Louisiana',
    abbreviation: 'LA',
    hasNoIncomeTax: false,
    brackets: {
      single: [
        { min: 0, max: 12500, rate: 0.0185 },
        { min: 12500, max: 50000, rate: 0.035 },
        { min: 50000, max: Infinity, rate: 0.0425 },
      ],
      married: [
        { min: 0, max: 25000, rate: 0.0185 },
        { min: 25000, max: 100000, rate: 0.035 },
        { min: 100000, max: Infinity, rate: 0.0425 },
      ],
    },
    standardDeduction: { single: 0, married: 0 },
    ssExemption: 'exempt',
    capitalGainsTreatment: 'ordinary',
  },
  ME: {
    name: 'Maine',
    abbreviation: 'ME',
    hasNoIncomeTax: false,
    brackets: {
      single: [
        { min: 0, max: 26050, rate: 0.058 },
        { min: 26050, max: 61600, rate: 0.0675 },
        { min: 61600, max: Infinity, rate: 0.0715 },
      ],
      married: [
        { min: 0, max: 52100, rate: 0.058 },
        { min: 52100, max: 123250, rate: 0.0675 },
        { min: 123250, max: Infinity, rate: 0.0715 },
      ],
    },
    standardDeduction: { single: 14600, married: 29200 },
    ssExemption: 'exempt',
    capitalGainsTreatment: 'ordinary',
  },
  MD: {
    name: 'Maryland',
    abbreviation: 'MD',
    hasNoIncomeTax: false,
    brackets: {
      single: [
        { min: 0, max: 1000, rate: 0.02 },
        { min: 1000, max: 2000, rate: 0.03 },
        { min: 2000, max: 3000, rate: 0.04 },
        { min: 3000, max: 100000, rate: 0.0475 },
        { min: 100000, max: 125000, rate: 0.05 },
        { min: 125000, max: 150000, rate: 0.0525 },
        { min: 150000, max: 250000, rate: 0.055 },
        { min: 250000, max: Infinity, rate: 0.0575 },
      ],
      married: [
        { min: 0, max: 1000, rate: 0.02 },
        { min: 1000, max: 2000, rate: 0.03 },
        { min: 2000, max: 3000, rate: 0.04 },
        { min: 3000, max: 150000, rate: 0.0475 },
        { min: 150000, max: 175000, rate: 0.05 },
        { min: 175000, max: 225000, rate: 0.0525 },
        { min: 225000, max: 300000, rate: 0.055 },
        { min: 300000, max: Infinity, rate: 0.0575 },
      ],
    },
    standardDeduction: { single: 2550, married: 5150 },
    ssExemption: 'exempt',
    capitalGainsTreatment: 'ordinary',
  },
  MA: {
    name: 'Massachusetts',
    abbreviation: 'MA',
    hasNoIncomeTax: false,
    brackets: {
      single: [
        { min: 0, max: 1000000, rate: 0.05 },
        { min: 1000000, max: Infinity, rate: 0.09 },
      ],
      married: [
        { min: 0, max: 1000000, rate: 0.05 },
        { min: 1000000, max: Infinity, rate: 0.09 },
      ],
    },
    standardDeduction: { single: 0, married: 0 },
    ssExemption: 'exempt',
    capitalGainsTreatment: 'ordinary',
  },
  MI: {
    name: 'Michigan',
    abbreviation: 'MI',
    hasNoIncomeTax: false,
    brackets: {
      single: [{ min: 0, max: Infinity, rate: 0.0425 }],
      married: [{ min: 0, max: Infinity, rate: 0.0425 }],
    },
    standardDeduction: { single: 0, married: 0 },
    ssExemption: 'exempt',
    capitalGainsTreatment: 'ordinary',
  },
  MN: {
    name: 'Minnesota',
    abbreviation: 'MN',
    hasNoIncomeTax: false,
    brackets: {
      single: [
        { min: 0, max: 31690, rate: 0.0535 },
        { min: 31690, max: 104090, rate: 0.068 },
        { min: 104090, max: 193240, rate: 0.0785 },
        { min: 193240, max: Infinity, rate: 0.0985 },
      ],
      married: [
        { min: 0, max: 46330, rate: 0.0535 },
        { min: 46330, max: 184040, rate: 0.068 },
        { min: 184040, max: 321450, rate: 0.0785 },
        { min: 321450, max: Infinity, rate: 0.0985 },
      ],
    },
    standardDeduction: { single: 14575, married: 29150 },
    ssExemption: 'partial',
    ssExclusionRate: 0.5,
    capitalGainsTreatment: 'ordinary',
  },
  MS: {
    name: 'Mississippi',
    abbreviation: 'MS',
    hasNoIncomeTax: false,
    brackets: {
      single: [
        { min: 0, max: 10000, rate: 0.0 },
        { min: 10000, max: Infinity, rate: 0.047 },
      ],
      married: [
        { min: 0, max: 10000, rate: 0.0 },
        { min: 10000, max: Infinity, rate: 0.047 },
      ],
    },
    standardDeduction: { single: 2300, married: 4600 },
    ssExemption: 'exempt',
    capitalGainsTreatment: 'ordinary',
  },
  MO: {
    name: 'Missouri',
    abbreviation: 'MO',
    hasNoIncomeTax: false,
    brackets: {
      single: [
        { min: 0, max: 1207, rate: 0.0 },
        { min: 1207, max: 2414, rate: 0.02 },
        { min: 2414, max: 3621, rate: 0.025 },
        { min: 3621, max: 4828, rate: 0.03 },
        { min: 4828, max: 6035, rate: 0.035 },
        { min: 6035, max: 7242, rate: 0.04 },
        { min: 7242, max: 8449, rate: 0.045 },
        { min: 8449, max: Infinity, rate: 0.048 },
      ],
      married: [
        { min: 0, max: 1207, rate: 0.0 },
        { min: 1207, max: 2414, rate: 0.02 },
        { min: 2414, max: 3621, rate: 0.025 },
        { min: 3621, max: 4828, rate: 0.03 },
        { min: 4828, max: 6035, rate: 0.035 },
        { min: 6035, max: 7242, rate: 0.04 },
        { min: 7242, max: 8449, rate: 0.045 },
        { min: 8449, max: Infinity, rate: 0.048 },
      ],
    },
    standardDeduction: { single: 14600, married: 29200 },
    ssExemption: 'exempt',
    capitalGainsTreatment: 'ordinary',
  },
  MT: {
    name: 'Montana',
    abbreviation: 'MT',
    hasNoIncomeTax: false,
    brackets: {
      single: [{ min: 0, max: Infinity, rate: 0.047 }],
      married: [{ min: 0, max: Infinity, rate: 0.047 }],
    },
    standardDeduction: { single: 14600, married: 29200 },
    ssExemption: 'partial',
    ssExclusionRate: 0.7,
    capitalGainsTreatment: 'ordinary',
  },
  NE: {
    name: 'Nebraska',
    abbreviation: 'NE',
    hasNoIncomeTax: false,
    brackets: {
      single: [
        { min: 0, max: 3700, rate: 0.0246 },
        { min: 3700, max: 22170, rate: 0.0351 },
        { min: 22170, max: 35730, rate: 0.0501 },
        { min: 35730, max: Infinity, rate: 0.0584 },
      ],
      married: [
        { min: 0, max: 7390, rate: 0.0246 },
        { min: 7390, max: 44350, rate: 0.0351 },
        { min: 44350, max: 71460, rate: 0.0501 },
        { min: 71460, max: Infinity, rate: 0.0584 },
      ],
    },
    standardDeduction: { single: 8050, married: 16100 },
    ssExemption: 'exempt',
    capitalGainsTreatment: 'ordinary',
  },
  NV: {
    name: 'Nevada',
    abbreviation: 'NV',
    hasNoIncomeTax: true,
    brackets: { single: [], married: [] },
    standardDeduction: { single: 0, married: 0 },
    ssExemption: 'exempt',
    capitalGainsTreatment: 'exempt',
  },
  NH: {
    name: 'New Hampshire',
    abbreviation: 'NH',
    hasNoIncomeTax: true,
    brackets: { single: [], married: [] },
    standardDeduction: { single: 0, married: 0 },
    ssExemption: 'exempt',
    capitalGainsTreatment: 'exempt',
  },
  NJ: {
    name: 'New Jersey',
    abbreviation: 'NJ',
    hasNoIncomeTax: false,
    brackets: {
      single: [
        { min: 0, max: 20000, rate: 0.014 },
        { min: 20000, max: 35000, rate: 0.0175 },
        { min: 35000, max: 40000, rate: 0.035 },
        { min: 40000, max: 75000, rate: 0.05525 },
        { min: 75000, max: 500000, rate: 0.0637 },
        { min: 500000, max: 1000000, rate: 0.0897 },
        { min: 1000000, max: Infinity, rate: 0.1075 },
      ],
      married: [
        { min: 0, max: 20000, rate: 0.014 },
        { min: 20000, max: 50000, rate: 0.0175 },
        { min: 50000, max: 70000, rate: 0.035 },
        { min: 70000, max: 80000, rate: 0.05525 },
        { min: 80000, max: 150000, rate: 0.0637 },
        { min: 150000, max: 500000, rate: 0.0897 },
        { min: 500000, max: Infinity, rate: 0.1075 },
      ],
    },
    standardDeduction: { single: 0, married: 0 },
    ssExemption: 'exempt',
    capitalGainsTreatment: 'ordinary',
  },
  NM: {
    name: 'New Mexico',
    abbreviation: 'NM',
    hasNoIncomeTax: false,
    brackets: {
      single: [
        { min: 0, max: 5500, rate: 0.017 },
        { min: 5500, max: 11000, rate: 0.032 },
        { min: 11000, max: 16000, rate: 0.047 },
        { min: 16000, max: 210000, rate: 0.049 },
        { min: 210000, max: Infinity, rate: 0.059 },
      ],
      married: [
        { min: 0, max: 8000, rate: 0.017 },
        { min: 8000, max: 16000, rate: 0.032 },
        { min: 16000, max: 24000, rate: 0.047 },
        { min: 24000, max: 315000, rate: 0.049 },
        { min: 315000, max: Infinity, rate: 0.059 },
      ],
    },
    standardDeduction: { single: 14600, married: 29200 },
    ssExemption: 'partial',
    ssExclusionRate: 0.8,
    capitalGainsTreatment: 'ordinary',
  },
  NY: {
    name: 'New York',
    abbreviation: 'NY',
    hasNoIncomeTax: false,
    brackets: {
      single: [
        { min: 0, max: 8500, rate: 0.04 },
        { min: 8500, max: 11700, rate: 0.045 },
        { min: 11700, max: 13900, rate: 0.0525 },
        { min: 13900, max: 80650, rate: 0.055 },
        { min: 80650, max: 215400, rate: 0.06 },
        { min: 215400, max: 1077550, rate: 0.0685 },
        { min: 1077550, max: 5000000, rate: 0.0965 },
        { min: 5000000, max: 25000000, rate: 0.103 },
        { min: 25000000, max: Infinity, rate: 0.109 },
      ],
      married: [
        { min: 0, max: 17150, rate: 0.04 },
        { min: 17150, max: 23600, rate: 0.045 },
        { min: 23600, max: 27900, rate: 0.0525 },
        { min: 27900, max: 161550, rate: 0.055 },
        { min: 161550, max: 323200, rate: 0.06 },
        { min: 323200, max: 2155350, rate: 0.0685 },
        { min: 2155350, max: 5000000, rate: 0.0965 },
        { min: 5000000, max: 25000000, rate: 0.103 },
        { min: 25000000, max: Infinity, rate: 0.109 },
      ],
    },
    standardDeduction: { single: 8000, married: 16050 },
    ssExemption: 'exempt',
    capitalGainsTreatment: 'ordinary',
  },
  NC: {
    name: 'North Carolina',
    abbreviation: 'NC',
    hasNoIncomeTax: false,
    brackets: {
      single: [{ min: 0, max: Infinity, rate: 0.045 }],
      married: [{ min: 0, max: Infinity, rate: 0.045 }],
    },
    standardDeduction: { single: 12750, married: 25500 },
    ssExemption: 'exempt',
    capitalGainsTreatment: 'ordinary',
  },
  ND: {
    name: 'North Dakota',
    abbreviation: 'ND',
    hasNoIncomeTax: false,
    brackets: {
      single: [
        { min: 0, max: 44725, rate: 0.0 },
        { min: 44725, max: Infinity, rate: 0.0195 },
      ],
      married: [
        { min: 0, max: 74750, rate: 0.0 },
        { min: 74750, max: Infinity, rate: 0.0195 },
      ],
    },
    standardDeduction: { single: 14600, married: 29200 },
    ssExemption: 'exempt',
    capitalGainsTreatment: 'partial',
    capitalGainsExclusionRate: 0.40,
  },
  OH: {
    name: 'Ohio',
    abbreviation: 'OH',
    hasNoIncomeTax: false,
    brackets: {
      single: [
        { min: 0, max: 26050, rate: 0.0 },
        { min: 26050, max: 100000, rate: 0.0275 },
        { min: 100000, max: Infinity, rate: 0.035 },
      ],
      married: [
        { min: 0, max: 26050, rate: 0.0 },
        { min: 26050, max: 100000, rate: 0.0275 },
        { min: 100000, max: Infinity, rate: 0.035 },
      ],
    },
    standardDeduction: { single: 0, married: 0 },
    ssExemption: 'exempt',
    capitalGainsTreatment: 'ordinary',
  },
  OK: {
    name: 'Oklahoma',
    abbreviation: 'OK',
    hasNoIncomeTax: false,
    brackets: {
      single: [
        { min: 0, max: 1000, rate: 0.0025 },
        { min: 1000, max: 2500, rate: 0.0075 },
        { min: 2500, max: 3750, rate: 0.0175 },
        { min: 3750, max: 4900, rate: 0.0275 },
        { min: 4900, max: 7200, rate: 0.0375 },
        { min: 7200, max: Infinity, rate: 0.0475 },
      ],
      married: [
        { min: 0, max: 2000, rate: 0.0025 },
        { min: 2000, max: 5000, rate: 0.0075 },
        { min: 5000, max: 7500, rate: 0.0175 },
        { min: 7500, max: 9800, rate: 0.0275 },
        { min: 9800, max: 12200, rate: 0.0375 },
        { min: 12200, max: Infinity, rate: 0.0475 },
      ],
    },
    standardDeduction: { single: 6350, married: 12700 },
    ssExemption: 'exempt',
    capitalGainsTreatment: 'ordinary',
  },
  OR: {
    name: 'Oregon',
    abbreviation: 'OR',
    hasNoIncomeTax: false,
    brackets: {
      single: [
        { min: 0, max: 4050, rate: 0.0475 },
        { min: 4050, max: 10200, rate: 0.0675 },
        { min: 10200, max: 125000, rate: 0.0875 },
        { min: 125000, max: Infinity, rate: 0.099 },
      ],
      married: [
        { min: 0, max: 8100, rate: 0.0475 },
        { min: 8100, max: 20400, rate: 0.0675 },
        { min: 20400, max: 250000, rate: 0.0875 },
        { min: 250000, max: Infinity, rate: 0.099 },
      ],
    },
    standardDeduction: { single: 2745, married: 5495 },
    ssExemption: 'exempt',
    capitalGainsTreatment: 'ordinary',
  },
  PA: {
    name: 'Pennsylvania',
    abbreviation: 'PA',
    hasNoIncomeTax: false,
    brackets: {
      single: [{ min: 0, max: Infinity, rate: 0.0307 }],
      married: [{ min: 0, max: Infinity, rate: 0.0307 }],
    },
    standardDeduction: { single: 0, married: 0 },
    ssExemption: 'exempt',
    capitalGainsTreatment: 'ordinary',
  },
  RI: {
    name: 'Rhode Island',
    abbreviation: 'RI',
    hasNoIncomeTax: false,
    brackets: {
      single: [
        { min: 0, max: 73450, rate: 0.0375 },
        { min: 73450, max: 166950, rate: 0.0475 },
        { min: 166950, max: Infinity, rate: 0.0599 },
      ],
      married: [
        { min: 0, max: 73450, rate: 0.0375 },
        { min: 73450, max: 166950, rate: 0.0475 },
        { min: 166950, max: Infinity, rate: 0.0599 },
      ],
    },
    standardDeduction: { single: 10550, married: 21150 },
    ssExemption: 'partial',
    ssExclusionRate: 0.8,
    capitalGainsTreatment: 'ordinary',
  },
  SC: {
    name: 'South Carolina',
    abbreviation: 'SC',
    hasNoIncomeTax: false,
    brackets: {
      single: [
        { min: 0, max: 3460, rate: 0.0 },
        { min: 3460, max: 17330, rate: 0.03 },
        { min: 17330, max: Infinity, rate: 0.064 },
      ],
      married: [
        { min: 0, max: 3460, rate: 0.0 },
        { min: 3460, max: 17330, rate: 0.03 },
        { min: 17330, max: Infinity, rate: 0.064 },
      ],
    },
    standardDeduction: { single: 14600, married: 29200 },
    ssExemption: 'exempt',
    capitalGainsTreatment: 'partial',
    capitalGainsExclusionRate: 0.44,
  },
  SD: {
    name: 'South Dakota',
    abbreviation: 'SD',
    hasNoIncomeTax: true,
    brackets: { single: [], married: [] },
    standardDeduction: { single: 0, married: 0 },
    ssExemption: 'exempt',
    capitalGainsTreatment: 'exempt',
  },
  TN: {
    name: 'Tennessee',
    abbreviation: 'TN',
    hasNoIncomeTax: true,
    brackets: { single: [], married: [] },
    standardDeduction: { single: 0, married: 0 },
    ssExemption: 'exempt',
    capitalGainsTreatment: 'exempt',
  },
  TX: {
    name: 'Texas',
    abbreviation: 'TX',
    hasNoIncomeTax: true,
    brackets: { single: [], married: [] },
    standardDeduction: { single: 0, married: 0 },
    ssExemption: 'exempt',
    capitalGainsTreatment: 'exempt',
  },
  UT: {
    name: 'Utah',
    abbreviation: 'UT',
    hasNoIncomeTax: false,
    brackets: {
      single: [{ min: 0, max: Infinity, rate: 0.0465 }],
      married: [{ min: 0, max: Infinity, rate: 0.0465 }],
    },
    standardDeduction: { single: 0, married: 0 },
    ssExemption: 'partial',
    ssExclusionRate: 0.9,
    capitalGainsTreatment: 'ordinary',
  },
  VT: {
    name: 'Vermont',
    abbreviation: 'VT',
    hasNoIncomeTax: false,
    brackets: {
      single: [
        { min: 0, max: 45400, rate: 0.0335 },
        { min: 45400, max: 110050, rate: 0.066 },
        { min: 110050, max: 229550, rate: 0.076 },
        { min: 229550, max: Infinity, rate: 0.0875 },
      ],
      married: [
        { min: 0, max: 75850, rate: 0.0335 },
        { min: 75850, max: 183400, rate: 0.066 },
        { min: 183400, max: 279450, rate: 0.076 },
        { min: 279450, max: Infinity, rate: 0.0875 },
      ],
    },
    standardDeduction: { single: 7000, married: 14050 },
    ssExemption: 'partial',
    ssExclusionRate: 0.5,
    capitalGainsTreatment: 'partial',
    capitalGainsExclusionRate: 0.40,
  },
  VA: {
    name: 'Virginia',
    abbreviation: 'VA',
    hasNoIncomeTax: false,
    brackets: {
      single: [
        { min: 0, max: 3000, rate: 0.02 },
        { min: 3000, max: 5000, rate: 0.03 },
        { min: 5000, max: 17000, rate: 0.05 },
        { min: 17000, max: Infinity, rate: 0.0575 },
      ],
      married: [
        { min: 0, max: 3000, rate: 0.02 },
        { min: 3000, max: 5000, rate: 0.03 },
        { min: 5000, max: 17000, rate: 0.05 },
        { min: 17000, max: Infinity, rate: 0.0575 },
      ],
    },
    standardDeduction: { single: 4500, married: 9000 },
    ssExemption: 'exempt',
    capitalGainsTreatment: 'ordinary',
  },
  WA: {
    name: 'Washington',
    abbreviation: 'WA',
    hasNoIncomeTax: true,
    brackets: { single: [], married: [] },
    standardDeduction: { single: 0, married: 0 },
    ssExemption: 'exempt',
    capitalGainsTreatment: 'exempt',
  },
  WV: {
    name: 'West Virginia',
    abbreviation: 'WV',
    hasNoIncomeTax: false,
    brackets: {
      single: [
        { min: 0, max: 10000, rate: 0.0236 },
        { min: 10000, max: 25000, rate: 0.0315 },
        { min: 25000, max: 40000, rate: 0.0354 },
        { min: 40000, max: 60000, rate: 0.0472 },
        { min: 60000, max: Infinity, rate: 0.0512 },
      ],
      married: [
        { min: 0, max: 10000, rate: 0.0236 },
        { min: 10000, max: 25000, rate: 0.0315 },
        { min: 25000, max: 40000, rate: 0.0354 },
        { min: 40000, max: 60000, rate: 0.0472 },
        { min: 60000, max: Infinity, rate: 0.0512 },
      ],
    },
    standardDeduction: { single: 0, married: 0 },
    ssExemption: 'exempt',
    capitalGainsTreatment: 'ordinary',
  },
  WI: {
    name: 'Wisconsin',
    abbreviation: 'WI',
    hasNoIncomeTax: false,
    brackets: {
      single: [
        { min: 0, max: 14320, rate: 0.035 },
        { min: 14320, max: 28640, rate: 0.044 },
        { min: 28640, max: 315310, rate: 0.053 },
        { min: 315310, max: Infinity, rate: 0.0765 },
      ],
      married: [
        { min: 0, max: 19090, rate: 0.035 },
        { min: 19090, max: 38190, rate: 0.044 },
        { min: 38190, max: 420420, rate: 0.053 },
        { min: 420420, max: Infinity, rate: 0.0765 },
      ],
    },
    standardDeduction: { single: 12760, married: 23620 },
    ssExemption: 'exempt',
    capitalGainsTreatment: 'partial',
    capitalGainsExclusionRate: 0.30,
  },
  WY: {
    name: 'Wyoming',
    abbreviation: 'WY',
    hasNoIncomeTax: true,
    brackets: { single: [], married: [] },
    standardDeduction: { single: 0, married: 0 },
    ssExemption: 'exempt',
    capitalGainsTreatment: 'exempt',
  },
};

export function getStateTaxInfo(stateAbbr: string): StateTaxInfo | null {
  return STATE_TAX_DATA[stateAbbr] ?? null;
}

// Calculate state tax with income breakdown for proper SS and capital gains handling
export function calculateStateTax(
  taxableIncome: number,
  stateAbbr: string,
  filingStatus: FilingStatus,
  incomeBreakdown?: {
    ssIncome?: number;        // taxable SS income (federal amount)
    capitalGains?: number;    // LTCG amount
  }
): number {
  const stateInfo = getStateTaxInfo(stateAbbr);
  if (!stateInfo || stateInfo.hasNoIncomeTax) return 0;

  let adjustedIncome = taxableIncome;

  // Apply SS exclusion if the state exempts or partially exempts SS
  if (incomeBreakdown?.ssIncome && incomeBreakdown.ssIncome > 0) {
    if (stateInfo.ssExemption === 'exempt') {
      adjustedIncome -= incomeBreakdown.ssIncome;
    } else if (stateInfo.ssExemption === 'partial' && stateInfo.ssExclusionRate) {
      adjustedIncome -= incomeBreakdown.ssIncome * stateInfo.ssExclusionRate;
    }
    // 'taxed' = no adjustment, follows federal
  }

  // Apply capital gains exclusion if the state provides one
  if (incomeBreakdown?.capitalGains && incomeBreakdown.capitalGains > 0) {
    if (stateInfo.capitalGainsTreatment === 'partial' && stateInfo.capitalGainsExclusionRate) {
      adjustedIncome -= incomeBreakdown.capitalGains * stateInfo.capitalGainsExclusionRate;
    }
    // 'ordinary' = no adjustment (taxed as ordinary)
    // 'exempt' = handled by hasNoIncomeTax
  }

  const deduction = stateInfo.standardDeduction[filingStatus];
  adjustedIncome = Math.max(0, adjustedIncome - deduction);

  const brackets = stateInfo.brackets[filingStatus];
  let tax = 0;

  for (const bracket of brackets) {
    if (adjustedIncome <= bracket.min) break;
    const taxableInBracket = Math.min(adjustedIncome, bracket.max) - bracket.min;
    tax += taxableInBracket * bracket.rate;
  }

  return tax;
}

export function getAllStates(): { abbreviation: string; name: string }[] {
  return Object.values(STATE_TAX_DATA)
    .map((s) => ({ abbreviation: s.abbreviation, name: s.name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
