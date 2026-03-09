// S&P 500 real total returns (inflation-adjusted, with dividends reinvested)
// Sources:
//   - Nominal total returns (1926-2024): Damodaran (NYU Stern) & Shiller dataset
//   - CPI inflation: U.S. Bureau of Labor Statistics
//   - Pre-1926 data: Robert Shiller's "Irrational Exuberance" dataset (1871-1925)
//   - Real return = (1 + nominal) / (1 + CPI) - 1
// Used by cFIREsim, FIRECalc, and similar FIRE backtesting tools.
// Values are decimal fractions (e.g., 0.07 = 7% real return)

export const HISTORICAL_REAL_RETURNS: { year: number; realReturn: number }[] = [
  // ==========================================================
  // 1871-1925: From Shiller's dataset (pre-modern S&P index era)
  // These use Shiller's reconstructed stock index with dividends
  // ==========================================================
  { year: 1871, realReturn: 0.1471 },
  { year: 1872, realReturn: 0.0907 },
  { year: 1873, realReturn: -0.0304 },
  { year: 1874, realReturn: 0.1019 },
  { year: 1875, realReturn: 0.0805 },
  { year: 1876, realReturn: -0.0625 },
  { year: 1877, realReturn: 0.0307 },
  { year: 1878, realReturn: 0.2015 },
  { year: 1879, realReturn: 0.2068 },
  { year: 1880, realReturn: 0.2454 },
  { year: 1881, realReturn: 0.0094 },
  { year: 1882, realReturn: 0.0361 },
  { year: 1883, realReturn: -0.0079 },
  { year: 1884, realReturn: -0.0863 },
  { year: 1885, realReturn: 0.3396 },
  { year: 1886, realReturn: 0.1468 },
  { year: 1887, realReturn: -0.0038 },
  { year: 1888, realReturn: 0.0518 },
  { year: 1889, realReturn: 0.0740 },
  { year: 1890, realReturn: -0.0697 },
  { year: 1891, realReturn: 0.2050 },
  { year: 1892, realReturn: 0.0717 },
  { year: 1893, realReturn: -0.1982 },
  { year: 1894, realReturn: 0.0442 },
  { year: 1895, realReturn: 0.0655 },
  { year: 1896, realReturn: 0.0016 },
  { year: 1897, realReturn: 0.2125 },
  { year: 1898, realReturn: 0.2719 },
  { year: 1899, realReturn: 0.0122 },
  { year: 1900, realReturn: 0.1612 },
  { year: 1901, realReturn: 0.1878 },
  { year: 1902, realReturn: 0.0600 },
  { year: 1903, realReturn: -0.1658 },
  { year: 1904, realReturn: 0.3807 },
  { year: 1905, realReturn: 0.2130 },
  { year: 1906, realReturn: 0.0046 },
  { year: 1907, realReturn: -0.3308 },
  { year: 1908, realReturn: 0.4625 },
  { year: 1909, realReturn: 0.1526 },
  { year: 1910, realReturn: -0.0389 },
  { year: 1911, realReturn: 0.0419 },
  { year: 1912, realReturn: 0.0152 },
  { year: 1913, realReturn: -0.1152 },
  { year: 1914, realReturn: -0.0515 },
  { year: 1915, realReturn: 0.2760 },
  { year: 1916, realReturn: 0.0007 },
  { year: 1917, realReturn: -0.3239 },
  { year: 1918, realReturn: 0.2571 },
  { year: 1919, realReturn: -0.0197 },
  { year: 1920, realReturn: -0.1652 },
  { year: 1921, realReturn: 0.2377 },
  { year: 1922, realReturn: 0.2901 },
  { year: 1923, realReturn: 0.0481 },
  { year: 1924, realReturn: 0.2623 },
  { year: 1925, realReturn: 0.2788 },

  // ==========================================================
  // 1926-2024: Modern era (S&P 90 -> S&P 500 from 1957)
  // Nominal returns from Damodaran/Shiller, CPI from BLS
  // ==========================================================

  // 1926-1939 (Great Depression era)
  { year: 1926, realReturn: 0.1262 },
  { year: 1927, realReturn: 0.3941 },
  { year: 1928, realReturn: 0.4556 },
  { year: 1929, realReturn: -0.0830 },
  { year: 1930, realReturn: -0.2156 },
  { year: 1931, realReturn: -0.3875 },
  { year: 1932, realReturn: 0.0076 },
  { year: 1933, realReturn: 0.5698 },
  { year: 1934, realReturn: 0.0023 },
  { year: 1935, realReturn: 0.4494 },
  { year: 1936, realReturn: 0.3292 },
  { year: 1937, realReturn: -0.3834 },
  { year: 1938, realReturn: 0.3340 },
  { year: 1939, realReturn: 0.0041 },

  // 1940-1959
  { year: 1940, realReturn: -0.0978 },
  { year: 1941, realReturn: -0.2059 },
  { year: 1942, realReturn: 0.1030 },
  { year: 1943, realReturn: 0.2210 },
  { year: 1944, realReturn: 0.1776 },
  { year: 1945, realReturn: 0.3372 },
  { year: 1946, realReturn: -0.2578 },
  { year: 1947, realReturn: -0.0278 },
  { year: 1948, realReturn: 0.0250 },
  { year: 1949, realReturn: 0.2078 },
  { year: 1950, realReturn: 0.2486 },
  { year: 1951, realReturn: 0.1643 },
  { year: 1952, realReturn: 0.1478 },
  { year: 1953, realReturn: -0.0199 },
  { year: 1954, realReturn: 0.5262 },
  { year: 1955, realReturn: 0.3156 },
  { year: 1956, realReturn: 0.0356 },
  { year: 1957, realReturn: -0.1378 },
  { year: 1958, realReturn: 0.4236 },
  { year: 1959, realReturn: 0.1096 },

  // 1960-1979
  { year: 1960, realReturn: -0.0073 },
  { year: 1961, realReturn: 0.2589 },
  { year: 1962, realReturn: -0.1073 },
  { year: 1963, realReturn: 0.2080 },
  { year: 1964, realReturn: 0.1548 },
  { year: 1965, realReturn: 0.1045 },
  { year: 1966, realReturn: -0.1301 },
  { year: 1967, realReturn: 0.2080 },
  { year: 1968, realReturn: 0.0611 },
  { year: 1969, realReturn: -0.1431 },
  { year: 1970, realReturn: -0.0112 },
  { year: 1971, realReturn: 0.1080 },
  { year: 1972, realReturn: 0.1549 },
  { year: 1973, realReturn: -0.2647 },
  { year: 1974, realReturn: -0.3649 },
  { year: 1975, realReturn: 0.3155 },
  { year: 1976, realReturn: 0.1915 },
  { year: 1977, realReturn: -0.1153 },
  { year: 1978, realReturn: -0.0105 },
  { year: 1979, realReturn: 0.0586 },

  // 1980-1999
  { year: 1980, realReturn: 0.1867 },
  { year: 1981, realReturn: -0.0994 },
  { year: 1982, realReturn: 0.1476 },
  { year: 1983, realReturn: 0.1827 },
  { year: 1984, realReturn: 0.0227 },
  { year: 1985, realReturn: 0.2633 },
  { year: 1986, realReturn: 0.1662 },
  { year: 1987, realReturn: 0.0203 },
  { year: 1988, realReturn: 0.1240 },
  { year: 1989, realReturn: 0.2725 },
  { year: 1990, realReturn: -0.0956 },
  { year: 1991, realReturn: 0.2631 },
  { year: 1992, realReturn: 0.0446 },
  { year: 1993, realReturn: 0.0706 },
  { year: 1994, realReturn: -0.0154 },
  { year: 1995, realReturn: 0.3445 },
  { year: 1996, realReturn: 0.1932 },
  { year: 1997, realReturn: 0.3131 },
  { year: 1998, realReturn: 0.2700 },
  { year: 1999, realReturn: 0.1764 },

  // 2000-2024
  { year: 2000, realReturn: -0.1249 },
  { year: 2001, realReturn: -0.1288 },
  { year: 2002, realReturn: -0.2370 },
  { year: 2003, realReturn: 0.2683 },
  { year: 2004, realReturn: 0.0769 },
  { year: 2005, realReturn: 0.0149 },
  { year: 2006, realReturn: 0.1279 },
  { year: 2007, realReturn: 0.0110 },
  { year: 2008, realReturn: -0.3649 },
  { year: 2009, realReturn: 0.2345 },
  { year: 2010, realReturn: 0.1306 },
  { year: 2011, realReturn: -0.0011 },
  { year: 2012, realReturn: 0.1341 },
  { year: 2013, realReturn: 0.3015 },
  { year: 2014, realReturn: 0.1369 },
  { year: 2015, realReturn: 0.0073 },
  { year: 2016, realReturn: 0.0954 },
  { year: 2017, realReturn: 0.1942 },
  { year: 2018, realReturn: -0.0624 },
  { year: 2019, realReturn: 0.2868 },
  { year: 2020, realReturn: 0.1588 },
  { year: 2021, realReturn: 0.2146 },
  { year: 2022, realReturn: -0.2516 },
  { year: 2023, realReturn: 0.2224 },
  { year: 2024, realReturn: 0.2150 },
];

// Statistics from the dataset
export const HISTORICAL_MEAN_REAL_RETURN =
  HISTORICAL_REAL_RETURNS.reduce((s, r) => s + r.realReturn, 0) / HISTORICAL_REAL_RETURNS.length;

export const HISTORICAL_STDDEV_REAL_RETURN = Math.sqrt(
  HISTORICAL_REAL_RETURNS.reduce(
    (s, r) => s + Math.pow(r.realReturn - HISTORICAL_MEAN_REAL_RETURN, 2),
    0
  ) / HISTORICAL_REAL_RETURNS.length
);

// Convenience: start/end years
export const HISTORICAL_START_YEAR = HISTORICAL_REAL_RETURNS[0].year;
export const HISTORICAL_END_YEAR = HISTORICAL_REAL_RETURNS[HISTORICAL_REAL_RETURNS.length - 1].year;
